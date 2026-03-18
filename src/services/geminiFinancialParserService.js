import { GoogleGenerativeAI } from '@google/generative-ai'

/** gemini-1.5-flash foi descontinuado na API; usar alias atual */
const MODEL = 'gemini-flash-latest'

/** Chaves aceitas no app (transações) */
export const GEMINI_CATEGORY_KEYS = ['receita', 'fixas', 'cartao', 'compras', 'invest', 'reserva']

export const GEMINI_REVIEW_CATEGORY_OPTIONS = [
  { value: 'receita', label: '💰 Receita' },
  { value: 'fixas', label: '🏠 Contas fixas' },
  { value: 'cartao', label: '💳 Cartão' },
  { value: 'compras', label: '🛒 Compras / dia a dia' },
  { value: 'invest', label: '📈 Investimentos' },
  { value: 'reserva', label: '🏦 Reserva' },
]

const SYSTEM_PROMPT = `Você é um extrator de dados financeiros. Sua única saída deve ser um array JSON, sem texto antes ou depois.

INPUT: Qualquer tabela financeira (texto CSV/planilha) ou imagem de planilha/recibo.

OUTPUT: Um único array de objetos JSON, cada objeto com estes campos (nomes em português):
- "data": string "YYYY-MM-DD" ou null
- "descricao": string (título do lançamento)
- "valor": número float. Positivo = entrada/receita, negativo = despesa. Sem "R$" na saída.
- "status": "pago" ou "pendente"
- "is_reserva": boolean (true se for reserva/fundo emergência/transferência de reserva)
- "categoria": OBRIGATÓRIO. Uma destas chaves em minúsculas, conforme o contexto da planilha:
  - "receita" — salário, NTT, ganhos extras, entradas, receitas
  - "fixas" — dízimo, aluguel, luz, água, internet, academia, mensalidades fixas, "contas fixas"
  - "cartao" — fatura cartão, Bradesco, Nubank, Itaú cartão, Mercado Pago cartão, parcelas de cartão
  - "compras" — mercado, Uber, comida fora, gastos do dia a dia (se não for claramente cartão)
  - "invest" — investimento, aplicação, poupança investimento
  - "reserva" — só se is_reserva for true ou for explicitamente fundo de reserva

Se a planilha tiver uma coluna "Categoria" (ex.: contas fixas, cartao de credito), use-a para preencher "categoria" mapeando: contas fixas→fixas, cartao/cartão→cartao, investimentos→invest.

REGRAS:
- valor: normalizar número; despesas negativas.
- status: ok/recebido/concluído→pago; pendente/a pagar→pendente
- Retorne APENAS o array JSON. Exemplo:
[{"data":null,"descricao":"ALUGUEL","valor":-850,"status":"pendente","is_reserva":false,"categoria":"fixas"}]`

function getApiKey() {
  return import.meta.env.VITE_GEMINI_API_KEY || null
}

/** Verifica se a extração com IA está disponível (VITE_GEMINI_API_KEY definida no .env) */
export function isGeminiAvailable() {
  const key = getApiKey()
  return typeof key === 'string' && key.length > 0 && key !== 'sua-gemini-api-key-aqui'
}

const CAT_SET = new Set(GEMINI_CATEGORY_KEYS)

function normalizeGeminiCategory(raw, isReserva, amount, descricao = '') {
  if (isReserva) return 'reserva'
  const s = String(raw ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  if (CAT_SET.has(s)) return s
  const d = String(descricao)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  const aliases = [
    [/^(receita|salario|entrada|ganho)/, 'receita'],
    [/fixa|aluguel|dizimo|luz|agua|internet|mensalidade|academia|seguro celular/, 'fixas'],
    [/cartao|credito|nubank|bradesco|itau|mercado pago|parcela/, 'cartao'],
    [/invest|aplica(cao|ção)/, 'invest'],
    [/reserva|emergencia/, 'reserva'],
    [/mercado|uber|ifood|comida|combustivel|pizzaria/, 'compras'],
  ]
  for (const [re, cat] of aliases) {
    if (re.test(s)) return cat
  }
  for (const [re, cat] of aliases) {
    if (re.test(d) && amount < 0) return cat
  }
  return amount >= 0 ? 'receita' : 'compras'
}

/**
 * Processa arquivo (texto ou imagem em Base64) e extrai lançamentos financeiros via Gemini.
 * @param {string | ArrayBuffer} fileContent - Conteúdo: string (texto/CSV) ou Base64 (imagem), ou ArrayBuffer
 * @param {string} mimeType - Ex: "text/csv", "image/png", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
 * @returns {Promise<Array<{ date: string|null, description: string, amount: number, status: 'pago'|'pendente', is_reserva: boolean }>>}
 */
export async function processFinancialInput(fileContent, mimeType) {
  const apiKey = getApiKey()
  if (!apiKey || typeof apiKey !== 'string') {
    throw new Error('VITE_GEMINI_API_KEY não configurada. Adicione no arquivo .env na raiz do projeto.')
  }

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: MODEL,
    systemInstruction: SYSTEM_PROMPT,
  })

  const isImage = mimeType && /^image\//.test(mimeType)
  let parts

  if (isImage) {
    let base64Data = ''
    if (typeof fileContent === 'string') {
      base64Data = fileContent.replace(/^data:image\/[^;]+;base64,/, '')
    } else if (fileContent instanceof ArrayBuffer) {
      const bytes = new Uint8Array(fileContent)
      let binary = ''
      for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
      base64Data = btoa(binary)
    }
    parts = [
      { inlineData: { mimeType: mimeType || 'image/png', data: base64Data } },
      { text: 'Extraia todos os lançamentos financeiros desta imagem e retorne apenas o array JSON.' },
    ]
  } else {
    let text = ''
    if (typeof fileContent === 'string') {
      text = fileContent
    } else if (fileContent instanceof ArrayBuffer) {
      text = new TextDecoder().decode(fileContent)
    }
    parts = [{ text: 'Extraia todos os lançamentos financeiros do texto abaixo e retorne apenas o array JSON.\n\n' + text }]
  }

  const result = await model.generateContent(parts)
  const response = result.response
  if (!response) throw new Error('Resposta vazia do Gemini.')
  let rawText = response.text?.()?.trim() || ''
  if (!rawText) throw new Error('Nenhum conteúdo retornado pelo Gemini.')

  if (rawText.startsWith('```')) {
    rawText = rawText.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '')
  }
  let items
  try {
    items = JSON.parse(rawText)
  } catch {
    const match = rawText.match(/\[[\s\S]*\]/)
    if (match) items = JSON.parse(match[0])
    else throw new Error('Resposta do Gemini não é um JSON válido.')
  }

  if (!Array.isArray(items)) items = [items]

  const normalized = items
    .map((item) => {
      const rawValor = item.valor ?? item.amount
      let amount = rawValor
      if (typeof amount === 'string') {
        amount = parseFloat(amount.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '')) || 0
      }
      if (amount != null && typeof amount !== 'number') amount = Number(amount)
      if (amount == null || Number.isNaN(amount)) amount = 0

      const rawData = item.data ?? item.date
      const date = rawData && /^\d{4}-\d{2}-\d{2}$/.test(String(rawData)) ? String(rawData) : null
      const description = String(item.descricao ?? item.description ?? '').trim() || 'Sem descrição'
      const status = item.status === 'pago' || item.status === 'pendente' ? item.status : 'pendente'
      const is_reserva = Boolean(item.is_reserva)
      const categoria = normalizeGeminiCategory(item.categoria, is_reserva, amount, description)

      return { date, description, amount, status, is_reserva, categoria }
    })
    .filter((item) => item.description && (item.amount !== 0 || item.description !== 'Sem descrição'))

  return normalized
}

/**
 * Converte itens (revisão) para transações do banco.
 * Usa item.categoria quando válida; is_reserva força reserva.
 */
export function geminiItemsToTransactions(items) {
  return items.map((item) => {
    let amount = Number(item.amount)
    if (Number.isNaN(amount)) amount = 0
    let category = item.categoria
    if (!category || !CAT_SET.has(category)) {
      category = item.is_reserva ? 'reserva' : (amount >= 0 ? 'receita' : 'compras')
    }
    if (item.is_reserva) category = 'reserva'
    return {
      category,
      description: item.description || '',
      amount,
      date: item.date || null,
      source: 'import',
      payment_status: item.status === 'pago' ? 'paid' : (item.status === 'pendente' ? 'pending' : null),
    }
  }).filter((tx) => tx.description || tx.amount !== 0)
}
