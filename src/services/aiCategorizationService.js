import { chatCompletion, isAiAvailable, parseJsonResponse } from './aiService'

const CACHE_KEY = 'ai_category_cache'

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

function normalizeKey(desc) {
  return (desc || '').trim().toLowerCase().replace(/\s+/g, ' ')
}

const KNOWN_PATTERNS = [
  { pattern: /salario|salário|holerite|pagamento\s*empresa/i, category: 'receita' },
  { pattern: /pix\s*recebido|transferencia\s*recebida|ted\s*recebida/i, category: 'receita' },
  { pattern: /rendimento|dividendo|juros\s*sobre\s*capital/i, category: 'receita' },
  { pattern: /aluguel|condominio|condominío|iptu|energia|luz|agua|água|gas|gás|internet|telefone|celular/i, category: 'fixas' },
  { pattern: /escola|faculdade|mensalidade|plano\s*de\s*saude|plano\s*saúde|seguro/i, category: 'fixas' },
  { pattern: /ifood|uber\s*eats|rappi|mercado|supermercado|posto|combustivel|uber|99|taxi|táxi/i, category: 'cartao' },
  { pattern: /amazon|shopee|mercado\s*livre|magalu|americanas|shein|aliexpress/i, category: 'cartao' },
  { pattern: /netflix|spotify|youtube|disney|hbo|prime\s*video|apple/i, category: 'cartao' },
  { pattern: /restaurante|padaria|lanchonete|bar\b|cafe|café|pizza/i, category: 'cartao' },
  { pattern: /cdb|tesouro|lci|lca|fundo|ação|ações|etf|cripto|bitcoin|investimento|nuinvest|rico|xp|clear/i, category: 'invest' },
]

/**
 * Categorizes a single transaction description.
 * Layer 1: cache + regex patterns (instant)
 * Layer 2: AI via Groq (only for unknown descriptions)
 */
export function categorizeLocal(description) {
  const key = normalizeKey(description)
  if (!key) return null

  const cache = getCache()
  if (cache[key]) return cache[key]

  for (const { pattern, category } of KNOWN_PATTERNS) {
    if (pattern.test(key)) {
      cache[key] = category
      setCache(cache)
      return category
    }
  }

  return null
}

const SYSTEM_PROMPT = `Você classifica transações bancárias brasileiras.
Categorias válidas: receita, fixas, cartao, invest
Responda APENAS com um JSON array. Cada item: {"description": "...", "category": "..."}
Sem explicação, apenas JSON.`

/**
 * Categorizes a batch of descriptions using AI.
 * Returns a map: description → category
 */
export async function categorizeBatch(descriptions) {
  if (!isAiAvailable() || descriptions.length === 0) return {}

  const cache = getCache()
  const unknown = descriptions.filter(d => !cache[normalizeKey(d)] && !categorizeLocal(d))

  if (unknown.length === 0) {
    const result = {}
    for (const d of descriptions) {
      result[d] = cache[normalizeKey(d)] || categorizeLocal(d)
    }
    return result
  }

  const batches = []
  for (let i = 0; i < unknown.length; i += 20) {
    batches.push(unknown.slice(i, i + 20))
  }

  for (const batch of batches) {
    try {
      const list = batch.map((d, i) => `${i + 1}. "${d}"`).join('\n')
      const response = await chatCompletion(SYSTEM_PROMPT, `Classifique:\n${list}`, { temperature: 0.1, maxTokens: 1024 })
      const parsed = parseJsonResponse(response)

      if (Array.isArray(parsed)) {
        const validCategories = ['receita', 'fixas', 'cartao', 'invest']
        for (const item of parsed) {
          if (item.description && validCategories.includes(item.category)) {
            cache[normalizeKey(item.description)] = item.category
          }
        }
        setCache(cache)
      }
    } catch {
      // AI failed for this batch — skip, fallback to manual
    }
  }

  const result = {}
  for (const d of descriptions) {
    result[d] = cache[normalizeKey(d)] || categorizeLocal(d) || null
  }
  return result
}

/**
 * Saves a user correction to the cache for future use.
 */
export function saveCorrection(description, category) {
  const cache = getCache()
  cache[normalizeKey(description)] = category
  setCache(cache)
}

/**
 * Returns cached category for a description, or null.
 */
export function getCachedCategory(description) {
  const cache = getCache()
  return cache[normalizeKey(description)] || categorizeLocal(description)
}
