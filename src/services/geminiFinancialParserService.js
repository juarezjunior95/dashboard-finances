import { GoogleGenerativeAI } from '@google/generative-ai'

const MODEL = 'gemini-1.5-flash'
const SYSTEM_PROMPT = `Você é um extrator de dados financeiros. Sua única saída deve ser um array JSON, sem texto antes ou depois.

INPUT: Qualquer tabela financeira (texto CSV/planilha) ou imagem de planilha/recibo.

OUTPUT: Um único array de objetos JSON, cada objeto com exatamente estes campos (nomes em português):
- "data": string no formato "YYYY-MM-DD" (ou null se não identificável)
- "descricao": string com o título/descrição do lançamento
- "valor": número (float). Positivo = receita, negativo = despesa. NUNCA use strings como "R$ 1.249,00"; converta para número puro (ex: -1249.00)
- "status": exatamente "pago" ou "pendente"
- "is_reserva": boolean. Marque true se o título ou categoria mencionar: Reserva, Transferência de reserva, Fundo de Segurança, Fundo de emergência, Aplicação reserva

REGRAS DE NORMALIZAÇÃO:
- valor: remover "R$", trocar vírgula por ponto, converter para número. Despesas como números negativos.
- status: mapear "ok", "recebido", "concluído", "pago", "sim" -> "pago"; "pendente", "a pagar", "não" -> "pendente"
- Se não houver informação de data, use null para data.
- Retorne APENAS o array JSON, sem markdown e sem explicação. Exemplo: [{"data":"2026-03-01","descricao":"Aluguel","valor":-850,"status":"pendente","is_reserva":false}]`

function getApiKey() {
  return import.meta.env.VITE_GEMINI_API_KEY || null
}

/** Verifica se a extração com IA está disponível (VITE_GEMINI_API_KEY definida no .env) */
export function isGeminiAvailable() {
  const key = getApiKey()
  return typeof key === 'string' && key.length > 0 && key !== 'sua-gemini-api-key-aqui'
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

      return { date, description, amount, status, is_reserva }
    })
    .filter((item) => item.description && (item.amount !== 0 || item.description !== 'Sem descrição'))

  return normalized
}

/**
 * Converte itens extraídos pelo Gemini para o formato de transação do banco.
 * is_reserva -> category 'reserva'; senão receita/compras por sinal do amount.
 * Valida amount (evita NaN).
 */
export function geminiItemsToTransactions(items) {
  return items.map((item) => {
    let amount = Number(item.amount)
    if (Number.isNaN(amount)) amount = 0
    const category = item.is_reserva ? 'reserva' : (amount >= 0 ? 'receita' : 'compras')
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
