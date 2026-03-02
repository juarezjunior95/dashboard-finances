/**
 * Converte strings monetárias brasileiras e americanas para número.
 *
 * Aceita formatos como:
 *   "R$ 1.234,56"  →  1234.56
 *   "1.234,56"     →  1234.56
 *   "1,234.56"     →  1234.56
 *   "-R$ 50,00"    →  -50
 *   "1234"         →  1234
 *
 * Retorna NaN se a entrada não puder ser convertida.
 */
export function toNumberBR(raw) {
  if (typeof raw === 'number') return raw
  if (raw == null) return NaN

  const str = String(raw).trim()
  if (str === '') return NaN

  const cleaned = str.replace(/^-?\s*R\$\s*/, (m) => (m.startsWith('-') ? '-' : ''))

  const lastComma = cleaned.lastIndexOf(',')
  const lastDot = cleaned.lastIndexOf('.')

  let normalized
  if (lastComma > lastDot) {
    // "1.234,56" → brasileiro: pontos são milhar, vírgula é decimal
    normalized = cleaned.replace(/\./g, '').replace(',', '.')
  } else if (lastDot > lastComma) {
    // "1,234.56" → americano: vírgulas são milhar, ponto é decimal
    normalized = cleaned.replace(/,/g, '')
  } else {
    // Só vírgula ou só ponto (sem ambiguidade) ou nenhum
    normalized = cleaned.replace(',', '.')
  }

  // Remove qualquer caractere restante que não seja número, ponto ou sinal
  normalized = normalized.replace(/[^\d.\-]/g, '')

  const result = parseFloat(normalized)
  return Number.isFinite(result) ? result : NaN
}
