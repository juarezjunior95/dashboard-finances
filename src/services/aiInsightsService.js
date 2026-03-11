import { chatCompletion, isAiAvailable } from './aiService'

const CACHE_KEY = 'ai_insights_cache'

function getCache() {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY)) || {}
  } catch {
    return {}
  }
}

function setCache(cache) {
  localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
}

function hashData(data) {
  return JSON.stringify(data).length + '_' + JSON.stringify(data).split('').reduce((a, c) => ((a << 5) - a + c.charCodeAt(0)) | 0, 0)
}

const SYSTEM_PROMPT = `Você é um consultor financeiro pessoal brasileiro.
Analise os dados financeiros do mês e gere um resumo de 3 a 5 frases.
Regras:
- Português brasileiro, tom amigável e direto
- Foque em INSIGHTS, não repita números brutos
- Se o saldo é negativo, alerte com urgência
- Se alguma categoria subiu >15% vs mês anterior, mencione
- Se há meta financeira perto do prazo, mencione
- Destaque conquistas (investimento, economia)
- Máximo 5 frases curtas
- NÃO use markdown, apenas texto simples
- NÃO comece com "Olá" ou saudações`

/**
 * Generates a natural-language financial summary for the given month.
 * Uses cache to avoid redundant API calls.
 */
export async function generateInsight({ month, receita, fixas, cartao, invest, realBalance, reserveTotal, monthsOfRunway, prevReceita, prevFixas, prevCartao, prevInvest, goals }) {
  if (!isAiAvailable()) return null

  const data = { month, receita, fixas, cartao, invest, realBalance, reserveTotal }
  const hash = hashData(data)

  const cache = getCache()
  if (cache[month]?.hash === hash) {
    return cache[month].text
  }

  const saldo = receita - fixas - cartao - invest
  const totalGastos = fixas + cartao + invest

  const deltaParts = []
  if (prevReceita > 0) deltaParts.push(`Receita: ${pctChange(receita, prevReceita)}`)
  if (prevFixas > 0) deltaParts.push(`Fixas: ${pctChange(fixas, prevFixas)}`)
  if (prevCartao > 0) deltaParts.push(`Cartão: ${pctChange(cartao, prevCartao)}`)
  if (prevInvest > 0) deltaParts.push(`Invest: ${pctChange(invest, prevInvest)}`)

  const goalsPart = goals?.length > 0
    ? goals.map(g => `- ${g.name}: ${Math.round((g.current_amount / g.target_amount) * 100)}% concluída${g.deadline ? `, prazo: ${g.deadline}` : ''}`).join('\n')
    : 'Nenhuma meta cadastrada'

  const userMessage = `Dados do mês ${month}:
- Receita: R$ ${fmt(receita)}
- Contas fixas: R$ ${fmt(fixas)}
- Cartão: R$ ${fmt(cartao)}
- Investimentos: R$ ${fmt(invest)}
- Total de gastos: R$ ${fmt(totalGastos)}
- Saldo orçamentário: R$ ${fmt(saldo)} (${saldo >= 0 ? 'positivo' : 'NEGATIVO'})
- Saldo real em conta: ${realBalance != null ? `R$ ${fmt(realBalance)}` : 'não informado'}
- Reserva de emergência: ${reserveTotal != null ? `R$ ${fmt(reserveTotal)}` : 'não informada'}
- Runway da reserva: ${monthsOfRunway != null ? `${monthsOfRunway} meses` : 'não calculado'}

Variação vs mês anterior:
${deltaParts.length > 0 ? deltaParts.join('\n') : 'Sem dados do mês anterior'}

Metas financeiras:
${goalsPart}`

  const text = await chatCompletion(SYSTEM_PROMPT, userMessage, { temperature: 0.5, maxTokens: 512 })

  const newCache = getCache()
  newCache[month] = { hash, text, generatedAt: new Date().toISOString() }
  setCache(newCache)

  return text
}

function fmt(v) {
  return Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
}

function pctChange(current, previous) {
  if (!previous) return '—'
  const pct = Math.round(((current - previous) / previous) * 100)
  return `${pct > 0 ? '+' : ''}${pct}%`
}
