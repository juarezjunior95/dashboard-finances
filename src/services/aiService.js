const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
const MODEL = 'llama-3.3-70b-versatile'

function getApiKey() {
  return import.meta.env.VITE_GROQ_API_KEY || null
}

export function isAiAvailable() {
  const key = getApiKey()
  return !!key && key !== 'sua-groq-api-key-aqui'
}

/**
 * Sends a chat completion request to Groq API.
 * @param {string} systemPrompt
 * @param {string} userMessage
 * @param {{ temperature?: number, maxTokens?: number }} options
 * @returns {Promise<string>} The assistant's response text
 */
export async function chatCompletion(systemPrompt, userMessage, { temperature = 0.3, maxTokens = 1024 } = {}) {
  const apiKey = getApiKey()
  if (!apiKey) throw new Error('VITE_GROQ_API_KEY não configurada')

  const res = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature,
      max_tokens: maxTokens,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || `Groq API error: ${res.status}`)
  }

  const data = await res.json()
  return data.choices?.[0]?.message?.content?.trim() || ''
}

/**
 * Parses a JSON response from the AI, handling markdown code fences.
 */
export function parseJsonResponse(text) {
  let clean = text.trim()
  if (clean.startsWith('```')) {
    clean = clean.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '')
  }
  return JSON.parse(clean)
}
