import { chatCompletion, isAiAvailable, parseJsonResponse } from './aiService'

const SYSTEM_PROMPT = `Você é um especialista em análise de planilhas financeiras brasileiras.
Dado os cabeçalhos e amostras de dados de uma planilha, identifique qual coluna corresponde a cada campo.

Campos possíveis:
- "description": nome/descrição do lançamento (ex: DIZIMO, ALUGUEL, Conta de Luz, Seguro carro)
- "amount": valor monetário em reais (ex: R$ 250.00, 850, 1.211,00, 402.93)
- "category": categoria do gasto (ex: contas fixas, cartão de crédito, investimentos, receita)
- "payment_status": status de pagamento (ex: Pago, Pendente, pago, pendente)
- "date": data de vencimento/pagamento (ex: 03/15, 01/03, 2024-03-15, 15/03)
- "ignore": coluna irrelevante, vazia ou que não se encaixa em nenhum campo acima

Regras:
- Analise TANTO os cabeçalhos QUANTO os dados das linhas de amostra para decidir
- Se o cabeçalho está vazio mas os dados mostram valores monetários (com R$, vírgula decimal, etc) → "amount"
- Se o cabeçalho está vazio mas os dados mostram nomes de gastos/serviços → "description"
- Se os dados mostram "Pago"/"Pendente" → "payment_status"
- Cada tipo (exceto "ignore") deve ser atribuído a NO MÁXIMO uma coluna
- "amount" e "category" são obrigatórios — se não encontrar, coloque com confidence: 0
- Colunas completamente vazias → "ignore"
- Na dúvida entre dois campos, escolha o mais provável e ajuste a confidence

Responda APENAS com JSON válido neste formato:
{"mappings":[{"col":0,"field":"description","confidence":0.95},{"col":1,"field":"amount","confidence":0.9}]}`

export async function detectColumnMapping(headers, sampleRows) {
  if (!isAiAvailable()) return null

  const cleanHeaders = headers.map((h, i) =>
    String(h ?? '').trim() || `(coluna ${i + 1} sem título)`,
  )

  const cleanSamples = sampleRows.map(row =>
    row.map(c => String(c ?? '').trim()),
  )

  const userMessage = `Cabeçalhos: ${JSON.stringify(cleanHeaders)}

Dados amostra:
${cleanSamples.map((row, i) => `Linha ${i + 1}: ${JSON.stringify(row)}`).join('\n')}

Identifique o campo de cada coluna (${cleanHeaders.length} colunas).`

  try {
    const response = await chatCompletion(SYSTEM_PROMPT, userMessage, {
      temperature: 0.1,
      maxTokens: 512,
    })
    const parsed = parseJsonResponse(response)
    if (parsed?.mappings && Array.isArray(parsed.mappings)) {
      return parsed.mappings
    }
    return null
  } catch {
    return null
  }
}

export function guessFieldFromHeader(header) {
  if (!header) return null
  const h = String(header).toLowerCase().trim()
  if (!h) return null
  if (['categoria', 'category', 'tipo', 'type'].some(k => h === k || h.includes(k))) return 'category'
  if (['valor', 'value', 'amount', 'quantia', 'total', 'preço', 'preco'].some(k => h === k || h.includes(k))) return 'amount'
  if (['data', 'date', 'dia', 'dt', 'pay day', 'payday', 'vencimento', 'dt_vencimento', 'paydate'].some(k => h === k || h.includes(k))) return 'date'
  if (['descricao', 'descrição', 'description', 'desc', 'nome', 'name', 'historico', 'histórico', 'item', 'lançamento', 'lancamento'].some(k => h === k || h.includes(k))) return 'description'
  if (['status', 'situacao', 'situação', 'pago', 'estado', 'payment'].some(k => h === k || h.includes(k))) return 'payment_status'
  return null
}

export const COLUMN_FIELDS = [
  { value: 'ignore', label: 'Ignorar', icon: '⊘' },
  { value: 'description', label: 'Descrição', icon: '📝' },
  { value: 'amount', label: 'Valor (R$)', icon: '💰' },
  { value: 'category', label: 'Categoria', icon: '📁' },
  { value: 'payment_status', label: 'Status', icon: '✅' },
  { value: 'date', label: 'Data', icon: '📅' },
]

export const FIELD_STYLES = {
  ignore: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-400 dark:text-gray-500', ring: 'ring-gray-300' },
  description: { bg: 'bg-blue-50 dark:bg-blue-950/40', text: 'text-blue-600 dark:text-blue-400', ring: 'ring-blue-300' },
  amount: { bg: 'bg-emerald-50 dark:bg-emerald-950/40', text: 'text-emerald-600 dark:text-emerald-400', ring: 'ring-emerald-300' },
  category: { bg: 'bg-indigo-50 dark:bg-indigo-950/40', text: 'text-indigo-600 dark:text-indigo-400', ring: 'ring-indigo-300' },
  payment_status: { bg: 'bg-amber-50 dark:bg-amber-950/40', text: 'text-amber-600 dark:text-amber-400', ring: 'ring-amber-300' },
  date: { bg: 'bg-violet-50 dark:bg-violet-950/40', text: 'text-violet-600 dark:text-violet-400', ring: 'ring-violet-300' },
}
