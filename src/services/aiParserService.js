import { chatCompletion, isAiAvailable, parseJsonResponse } from './aiService'
import { format } from 'date-fns'

const SYSTEM_PROMPT = `Você extrai dados de transações financeiras a partir de texto em português brasileiro.
Retorne APENAS JSON válido, sem explicação.

Categorias válidas: receita, fixas, cartao, invest
Status válidos: "paid", "pending", null

Se o usuário diz "paguei" ou "comprei" → status: "paid"
Se diz "pendente" ou "falta pagar" → status: "pending"
Se não menciona → status: null

Se não menciona data → use a data de hoje.
Se diz "ontem" → data de ontem.
Se diz "dia X" → use esse dia no mês atual.

Formato de resposta:
{
  "category": "string",
  "description": "string (nome limpo da despesa)",
  "amount": number,
  "date": "YYYY-MM-DD",
  "payment_status": "string|null"
}`

/**
 * Parses a natural language description into a structured transaction.
 * @param {string} text - User input like "paguei 150 de luz ontem"
 * @returns {Promise<{ category, description, amount, date, payment_status } | null>}
 */
export async function parseTransaction(text) {
  if (!isAiAvailable() || !text?.trim()) return null

  const today = format(new Date(), 'yyyy-MM-dd')
  const userMessage = `Texto: "${text.trim()}"\nData de hoje: ${today}`

  try {
    const response = await chatCompletion(SYSTEM_PROMPT, userMessage, {
      temperature: 0.1,
      maxTokens: 256,
    })
    const parsed = parseJsonResponse(response)

    const validCategories = ['receita', 'fixas', 'cartao', 'invest']
    if (!parsed || !validCategories.includes(parsed.category) || !parsed.amount || parsed.amount <= 0) {
      return null
    }

    return {
      category: parsed.category,
      description: parsed.description || text.trim(),
      amount: Math.round(Number(parsed.amount) * 100) / 100,
      date: parsed.date || today,
      payment_status: ['paid', 'pending'].includes(parsed.payment_status) ? parsed.payment_status : null,
    }
  } catch {
    return null
  }
}
