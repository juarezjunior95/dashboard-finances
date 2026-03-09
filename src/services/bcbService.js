const BCB_BASE_URL = 'https://api.bcb.gov.br/dados/serie/bcdata.sgs'
const CACHE_KEY = 'bcb_indicators'
const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 horas

const SERIES = {
  selic: 432,      // Taxa Selic meta (% a.a.)
  ipca: 13522,     // IPCA acumulado últimos 12 meses
  cdi: 4389,       // CDI acumulado no mês
}

/**
 * Busca um indicador específico da API do BCB
 */
async function fetchSeries(code) {
  const url = `${BCB_BASE_URL}.${code}/dados/ultimos/1?formato=json`
  const response = await fetch(url)
  if (!response.ok) throw new Error(`BCB API error: ${response.status}`)
  const data = await response.json()
  if (!Array.isArray(data) || data.length === 0) return null
  return {
    valor: parseFloat(data[0].valor),
    data: data[0].data,
  }
}

/**
 * Verifica se o cache é válido (< 24h)
 */
function isCacheValid(cached) {
  if (!cached || !cached.fetchedAt) return false
  const now = Date.now()
  const fetchedAt = new Date(cached.fetchedAt).getTime()
  return (now - fetchedAt) < CACHE_TTL_MS
}

/**
 * Busca indicadores econômicos do Banco Central
 * - Cache de 24h em localStorage
 * - Se API falhar, usa cache expirado com flag stale: true
 * - Se não houver dados, retorna null
 */
export async function fetchIndicators() {
  // Tentar cache primeiro
  try {
    const cachedRaw = localStorage.getItem(CACHE_KEY)
    if (cachedRaw) {
      const cached = JSON.parse(cachedRaw)
      if (isCacheValid(cached)) {
        return cached
      }
    }
  } catch {
    // Ignorar erro de parse
  }

  // Buscar da API
  try {
    const [selic, ipca, cdi] = await Promise.all([
      fetchSeries(SERIES.selic),
      fetchSeries(SERIES.ipca),
      fetchSeries(SERIES.cdi),
    ])

    if (!selic || !ipca || !cdi) {
      throw new Error('Incomplete data from BCB API')
    }

    const rendimentoReal = Math.round((selic.valor - ipca.valor) * 100) / 100
    const result = {
      selic,
      ipca,
      cdi,
      rendimentoReal,
      stale: false,
      fetchedAt: new Date().toISOString(),
    }

    // Salvar no cache
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(result))
    } catch {
      // Ignorar erro de quota/storage
    }

    return result
  } catch (error) {
    console.warn('BCB API fetch failed, trying stale cache:', error)

    // Se API falhou, tentar usar cache expirado
    try {
      const cachedRaw = localStorage.getItem(CACHE_KEY)
      if (cachedRaw) {
        const cached = JSON.parse(cachedRaw)
        return { ...cached, stale: true }
      }
    } catch {
      // Ignorar erro de parse
    }

    // Sem cache e API falhou
    return null
  }
}
