import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { toNumberBR } from '../utils/toNumberBR'
import { bulkInsertTransactions, listTransactions, clearTransactions } from '../services/transactionService'
import { listCategories } from '../services/categoryService'
import { categorizeBatch } from '../services/aiCategorizationService'
import { isAiAvailable } from '../services/aiService'
import { detectColumnMapping, guessFieldFromHeader, COLUMN_FIELDS, FIELD_STYLES } from '../services/aiColumnMapperService'
import { processFinancialInput, isGeminiAvailable, geminiItemsToTransactions } from '../services/geminiFinancialParserService'

const ACCEPTED = '.csv,.xlsx,.xls,.xml'
const ACCEPTED_GEMINI = '.csv,.xlsx,.xls,.png,.jpg,.jpeg'
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024

const BASE_CATEGORY_MAP = {
  fixa: 'fixas',
  fixas: 'fixas',
  'conta fixa': 'fixas',
  'contas fixas': 'fixas',
  'despesa fixa': 'fixas',
  'despesas fixas': 'fixas',
  cartao: 'cartao',
  cartão: 'cartao',
  'cartão de crédito': 'cartao',
  'cartao de credito': 'cartao',
  credito: 'cartao',
  crédito: 'cartao',
  invest: 'invest',
  investimento: 'invest',
  investimentos: 'invest',
  aplicação: 'invest',
  aplicacao: 'invest',
  receita: 'receita',
  receitas: 'receita',
  renda: 'receita',
  salario: 'receita',
  salário: 'receita',
  compras: 'compras',
  compra: 'compras',
  'gastos diarios': 'compras',
  'gastos diários': 'compras',
  'gasto diario': 'compras',
  'gasto diário': 'compras',
  mercado: 'compras',
  supermercado: 'compras',
  reserva: 'reserva',
  'fundo de reserva': 'reserva',
  'transferência de reserva': 'reserva',
  'transferencia de reserva': 'reserva',
  'uso da reserva': 'reserva',
}

/** Mapeamento fixo do CSV: Data, Categoria, Título, Valor, Status */
function getFixedColumnIndices(headers) {
  const lower = headers.map((h) => String(h ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''))
  const dataIdx = lower.findIndex((h) => h === 'data' || h === 'date' || h === 'dia' || h === 'dt')
  const catIdx = lower.findIndex((h) => h === 'categoria' || h === 'category' || h === 'tipo')
  const tituloIdx = lower.findIndex((h) => h === 'titulo' || h === 'título' || h === 'descricao' || h === 'descrição' || h === 'nome' || h === 'name')
  const valorIdx = lower.findIndex((h) => h === 'valor' || h === 'value' || h === 'amount')
  const statusIdx = lower.findIndex((h) => h === 'status' || h === 'pago' || h === 'situacao' || h === 'situação')
  if (catIdx === -1 || valorIdx === -1) return null
  return {
    dateIdx: dataIdx >= 0 ? dataIdx : -1,
    catIdx,
    descIdx: tituloIdx >= 0 ? tituloIdx : catIdx,
    valIdx: valorIdx,
    statusIdx: statusIdx >= 0 ? statusIdx : -1,
  }
}

function buildCategoryMap(userCategories) {
  const map = { ...BASE_CATEGORY_MAP }
  for (const cat of userCategories) {
    if (!cat.is_default) {
      map[cat.key] = cat.key
      map[cat.label.toLowerCase()] = cat.key
    }
  }
  return map
}

function normalizeCategoryWith(raw, catMap) {
  const key = String(raw ?? '').trim().toLowerCase()
  return catMap[key] ?? null
}

function findColumns(headers) {
  const lower = headers.map((h) => String(h).trim().toLowerCase())
  const catIdx = lower.findIndex((h) => ['categoria', 'category', 'tipo', 'type'].includes(h))
  const valIdx = lower.findIndex((h) => ['valor', 'value', 'amount', 'quantia', 'total'].includes(h))
  const dateIdx = lower.findIndex((h) => ['data', 'date', 'dia', 'dt', 'pay day', 'payday', 'vencimento'].includes(h))
  const descIdx = lower.findIndex((h) => ['descricao', 'descrição', 'description', 'desc', 'nome', 'name', 'historico', 'histórico', 'titulo', 'título'].includes(h))
  const statusIdx = lower.findIndex((h) => ['status', 'situacao', 'situação', 'pago', 'estado'].includes(h))
  return { catIdx, valIdx, dateIdx, descIdx, statusIdx }
}

/** Encontra a primeira linha que tenha Categoria e Valor (em qualquer coluna) para planilhas com título no topo */
function findHeaderRowInGrid(sheetData) {
  const maxScan = Math.min(20, sheetData.length)
  for (let i = 0; i < maxScan; i++) {
    const row = sheetData[i] || []
    const headers = row.map((c) => String(c ?? '').trim())
    const fixed = getFixedColumnIndices(headers)
    const fallback = findColumns(headers)
    const ok = (fixed && fixed.catIdx >= 0 && fixed.valIdx >= 0) || (fallback.catIdx >= 0 && fallback.valIdx >= 0)
    if (ok) return [headers, ...sheetData.slice(i + 1)]
  }
  return null
}

function normalizePaymentStatus(raw) {
  if (raw == null || String(raw).trim() === '') return null
  const s = String(raw).trim().toLowerCase()
  if (['pago', 'paid', 'sim', 'yes', '1', 'ok', 'x'].includes(s)) return 'paid'
  if (['pendente', 'pending', 'nao', 'não', 'no', '0'].includes(s)) return 'pending'
  return null
}

function tryParseDate(raw) {
  if (!raw) return null
  const s = String(raw).trim()
  if (!s) return null
  const d = new Date(s)
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0]
  const brMatch = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/)
  if (brMatch) {
    const year = brMatch[3].length === 2 ? '20' + brMatch[3] : brMatch[3]
    const d2 = new Date(`${year}-${brMatch[2].padStart(2, '0')}-${brMatch[1].padStart(2, '0')}`)
    if (!isNaN(d2.getTime())) return d2.toISOString().split('T')[0]
  }
  // Handle MM/DD or DD/MM only (no year) — assume current year
  const shortMatch = s.match(/^(\d{1,2})[/\-.](\d{1,2})$/)
  if (shortMatch) {
    const year = new Date().getFullYear()
    const d3 = new Date(`${year}-${shortMatch[2].padStart(2, '0')}-${shortMatch[1].padStart(2, '0')}`)
    if (!isNaN(d3.getTime())) return d3.toISOString().split('T')[0]
  }
  return null
}

function normalizeRows(rawRows, catMap, customIndices) {
  if (!rawRows.length) return { rows: [], unmapped: {} }

  const headers = rawRows[0]
  const { catIdx, valIdx, dateIdx, descIdx, statusIdx } = customIndices || findColumns(headers)

  if (catIdx === -1 || valIdx === -1) {
    throw new Error(
      `Colunas obrigatórias não encontradas. ` +
      `Esperado: "categoria" (ou tipo/category) e "valor" (ou value/amount). ` +
      `Encontrado: [${headers.join(', ')}]`,
    )
  }

  const rows = []
  const unmapped = {}

  for (let i = 1; i < rawRows.length; i++) {
    const row = rawRows[i]
    if (!row || row.every((c) => c == null || String(c).trim() === '')) continue

    const rawCat = String(row[catIdx] ?? '').trim()
    const categoria = normalizeCategoryWith(rawCat, catMap)
    const valor = toNumberBR(row[valIdx])

    if (Number.isNaN(valor)) continue

    // Descrição = título da linha (ex.: Dizimo, ALUGUEL). Se houver coluna de título/descrição, usar; senão não repetir categoria (deixar vazio)
    const descricao = descIdx !== -1
      ? String(row[descIdx] ?? '').trim()
      : ''
    const data = dateIdx !== -1 ? tryParseDate(row[dateIdx]) : null
    const payment_status = statusIdx !== -1 ? normalizePaymentStatus(row[statusIdx]) : null

    if (categoria === null) {
      const key = rawCat.toLowerCase()
      if (key) {
        if (!unmapped[key]) unmapped[key] = { original: rawCat, count: 0, rows: [] }
        unmapped[key].count++
        unmapped[key].rows.push({ valor, descricao, data, payment_status, rawIdx: i })
      }
      continue
    }

    rows.push({ categoria, valor, descricao, data, payment_status })
  }

  return { rows, unmapped }
}

/** Converte texto colado (Excel/Sheets: tab ou vírgula) em matriz [headers, ...rows] */
function parsePastedTable(text) {
  const trimmed = String(text ?? '').trim()
  if (!trimmed) return null
  const firstLine = trimmed.split(/\r?\n/)[0] || ''
  const delimiter = firstLine.includes('\t') ? '\t' : ','
  const result = Papa.parse(trimmed, { delimiter, header: false, skipEmptyLines: true })
  const rawData = result.data || []
  if (rawData.length < 2) return null
  return rawData
}

// ── Parsers ──────────────────────────────────────────────

function parseCSV(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      skipEmptyLines: true,
      complete(results) {
        if (results.errors.length) reject(new Error(`Erro ao ler CSV: ${results.errors[0].message}`))
        else resolve(results.data)
      },
      error(err) { reject(new Error(`Erro ao ler CSV: ${err.message}`)) },
    })
  })
}

function parseXLSX(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array' })
        const names = wb.SheetNames

        // 1) Preferir aba EXPORT_DASH (formato Categoria | Valor para o dashboard)
        const exportSheet = names.find((n) => /export\s*dash|dash\s*export/i.test(String(n).trim()))
        if (exportSheet) {
          const sheet = wb.Sheets[exportSheet]
          const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
          const headers = (data[0] || []).map((c) => String(c ?? '').trim())
          const fixed = getFixedColumnIndices(headers)
          const fallback = findColumns(headers)
          const hasCatVal = (fixed && fixed.catIdx >= 0 && fixed.valIdx >= 0) || (fallback.catIdx >= 0 && fallback.valIdx >= 0)
          if (hasCatVal && data.length > 1) {
            resolve(data)
            return
          }
        }

        // 2) Em qualquer aba, procurar linha de cabeçalho nas primeiras 20 linhas (planilhas com título no topo)
        for (const name of names) {
          const sheet = wb.Sheets[name]
          const sheetData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
          const withHeader = findHeaderRowInGrid(sheetData)
          if (withHeader && withHeader.length > 1) {
            resolve(withHeader)
            return
          }
        }

        // 3) Fallback: primeira aba como antes
        const sheet = wb.Sheets[names[0]]
        const data = XLSX.utils.sheet_to_json(sheet, { header: 1 })
        resolve(data)
      } catch (err) { reject(new Error(`Erro ao ler XLSX: ${err.message}`)) }
    }
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo XLSX.'))
    reader.readAsArrayBuffer(file)
  })
}

function parseXML(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const parser = new DOMParser()
        const doc = parser.parseFromString(e.target.result, 'text/xml')
        const parseError = doc.querySelector('parsererror')
        if (parseError) { reject(new Error('XML mal-formado: ' + parseError.textContent.slice(0, 120))); return }
        const items = doc.querySelectorAll('item, row, registro, lancamento')
        if (!items.length) { reject(new Error('Nenhum elemento encontrado no XML. Esperado: <item>, <row>, <registro> ou <lancamento>.')); return }
        const rows = [['categoria', 'valor']]
        items.forEach((item) => {
          const cat = item.querySelector('categoria, category, tipo, type')?.textContent ?? ''
          const val = item.querySelector('valor, value, amount, quantia, total')?.textContent ?? ''
          rows.push([cat, val])
        })
        resolve(rows)
      } catch (err) { reject(new Error(`Erro ao ler XML: ${err.message}`)) }
    }
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo XML.'))
    reader.readAsText(file)
  })
}

function getParser(fileName) {
  const ext = fileName.split('.').pop().toLowerCase()
  if (ext === 'csv') return parseCSV
  if (ext === 'xlsx' || ext === 'xls') return parseXLSX
  if (ext === 'xml') return parseXML
  return null
}

// ── Smart Column Mapping Step ────────────────────────────

/** Detecta se uma coluna parece conter valores numéricos (para sugerir "Valor") */
function detectAmountColumn(rawData, colIndex, minRows = 2) {
  if (!rawData || rawData.length < 2) return false
  let numeric = 0
  for (let r = 1; r < Math.min(rawData.length, 15); r++) {
    const row = rawData[r]
    const cell = row && row[colIndex]
    if (cell == null && cell !== 0) continue
    const n = toNumberBR(cell)
    if (typeof n === 'number' && !Number.isNaN(n)) numeric++
  }
  return numeric >= minRows
}

/** Detecta coluna que parece categoria (valores que batem com chaves conhecidas) */
function detectCategoryColumn(rawData, colIndex, minRows = 1) {
  if (!rawData || rawData.length < 2) return false
  const keys = ['receita', 'fixas', 'cartao', 'invest', 'compras', 'reserva', 'contas fixas', 'cartão', 'investimentos']
  let match = 0
  for (let r = 1; r < Math.min(rawData.length, 15); r++) {
    const row = rawData[r]
    const cell = row && row[colIndex]
    const s = String(cell ?? '').trim().toLowerCase()
    if (!s) continue
    if (keys.some(k => s === k || s.includes(k))) match++
  }
  return match >= minRows
}

function ColumnMappingStep({ rawData, aiMappings, aiLoading, onConfirm, onCancel }) {
  const headers = useMemo(() => {
    const row0 = rawData?.[0]
    if (!row0 || !Array.isArray(row0)) return []
    const maxCols = Math.max(
      row0.length,
      ...(rawData.slice(0, 8).map(r => (r && Array.isArray(r) ? r.length : 0)))
    )
    return Array.from({ length: maxCols }, (_, i) => ({
      index: i,
      name: String((row0[i] ?? '')).trim(),
      display: String((row0[i] ?? '')).trim() || `Coluna ${i + 1}`,
    }))
  }, [rawData])

  const sampleRows = useMemo(() => (rawData && rawData.length > 1 ? rawData.slice(1, 6) : []), [rawData])
  const [userEdited, setUserEdited] = useState({})

  const [mappings, setMappings] = useState(() => {
    const m = {}
    for (const h of headers) {
      if (h == null || typeof h !== 'object') continue
      const heuristic = guessFieldFromHeader(h.name)
      if (heuristic) {
        m[h.index] = heuristic
      } else if (!h.name) {
        m[h.index] = 'ignore'
      } else {
        m[h.index] = 'ignore'
      }
    }
    if (!Object.values(m).includes('amount')) {
      let best = -1
      let bestCount = 0
      for (const h of headers) {
        if (h == null || typeof h !== 'object') continue
        if (m[h.index] !== 'ignore') continue
        if (detectAmountColumn(rawData, h.index)) {
          let count = 0
          for (let r = 1; r < Math.min(rawData.length, 15); r++) {
            const n = toNumberBR((rawData[r] && rawData[r][h.index]) ?? '')
            if (typeof n === 'number' && !Number.isNaN(n)) count++
          }
          if (count > bestCount) { bestCount = count; best = h.index }
        }
      }
      if (best >= 0) m[best] = 'amount'
    }
    if (!Object.values(m).includes('category')) {
      for (const h of headers) {
        if (h == null || typeof h !== 'object') continue
        if (m[h.index] !== 'ignore') continue
        if (detectCategoryColumn(rawData, h.index)) { m[h.index] = 'category'; break }
        const sample = rawData.slice(1, 5).map(row => String((row && row[h.index]) ?? '').trim()).filter(Boolean)
        if (sample.length >= 1) { m[h.index] = 'category'; break }
      }
    }
    return m
  })

  // Update from AI when results arrive (only non-user-edited fields)
  useEffect(() => {
    if (!aiMappings) return
    /* eslint-disable-next-line react-hooks/set-state-in-effect -- merge async AI suggestions into local state */
    setMappings(prev => {
      const m = { ...prev }
      for (const ai of aiMappings) {
        if (!userEdited[ai.col] && ai.confidence >= 0.5) {
          m[ai.col] = ai.field
        }
      }
      return m
    })
  }, [aiMappings, userEdited])

  const handleChange = (colIdx, field) => {
    setMappings(prev => ({ ...prev, [colIdx]: field }))
    setUserEdited(prev => ({ ...prev, [colIdx]: true }))
  }

  const hasAmount = Object.values(mappings).includes('amount')
  const hasCategory = Object.values(mappings).includes('category')
  const isValid = hasAmount && hasCategory

  const handleConfirm = () => {
    const indices = { catIdx: -1, valIdx: -1, descIdx: -1, statusIdx: -1, dateIdx: -1 }
    for (const [idx, field] of Object.entries(mappings)) {
      const i = Number(idx)
      if (field === 'category') indices.catIdx = i
      if (field === 'amount') indices.valIdx = i
      if (field === 'description') indices.descIdx = i
      if (field === 'payment_status') indices.statusIdx = i
      if (field === 'date') indices.dateIdx = i
    }
    onConfirm(indices)
  }

  const activeFields = Object.values(mappings).filter(f => f !== 'ignore')
  const duplicates = activeFields.filter((f, i) => activeFields.indexOf(f) !== i)

  return (
    <div className="mt-3 space-y-4 p-4 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-base">🤖</span>
        <h3 className="text-xs font-bold text-gray-700 dark:text-gray-200">Mapeamento de colunas</h3>
        {aiLoading && (
          <span className="text-[9px] font-medium px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/50 text-violet-600 dark:text-violet-400 animate-pulse">
            IA analisando...
          </span>
        )}
        {!aiLoading && aiMappings && (
          <span className="text-[9px] font-medium px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/50 text-violet-600 dark:text-violet-400">
            ✨ IA sugeriu
          </span>
        )}
      </div>

      <p className="text-[11px] text-gray-500 dark:text-gray-400">
        Identifique o que cada coluna da planilha representa. <strong>Categoria</strong> e <strong>Valor</strong> são obrigatórios.
      </p>

      {/* Column mapping cards */}
      <div className="space-y-2">
        {headers.filter(Boolean).map(h => {
          const field = mappings[h.index] || 'ignore'
          const style = FIELD_STYLES[field] || FIELD_STYLES.ignore
          const isAiSuggested = !userEdited[h.index] && aiMappings?.find(a => a.col === h.index && a.confidence >= 0.5)
          const sampleVals = sampleRows.map(row => String((row && row[h.index]) ?? '').trim()).filter(Boolean)

          return (
            <div key={h.index} className={`flex flex-col sm:flex-row sm:items-center gap-2 p-2.5 rounded-lg border ${style.bg} border-gray-200/50 dark:border-gray-700/50`}>
              {/* Column info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-mono text-gray-400 shrink-0">#{h.index + 1}</span>
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-200 truncate">
                    {h.display}
                  </span>
                  {isAiSuggested && <span className="text-[9px] text-violet-500 shrink-0">✨</span>}
                </div>
                {sampleVals.length > 0 && (
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 truncate">
                    Ex: {sampleVals.slice(0, 3).join(' · ')}
                  </p>
                )}
              </div>

              {/* Arrow */}
              <svg className="hidden sm:block w-4 h-4 text-gray-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>

              {/* Field selector */}
              <select
                value={field}
                onChange={e => handleChange(h.index, e.target.value)}
                className={`w-full sm:w-44 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 ${style.text} focus:ring-2 focus:ring-indigo-400 focus:outline-none cursor-pointer`}
              >
                {COLUMN_FIELDS.map(f => (
                  <option key={f.value} value={f.value}>{f.icon} {f.label}</option>
                ))}
              </select>
            </div>
          )
        })}
      </div>

      {/* Duplicate warning */}
      {duplicates.length > 0 && (
        <p className="text-[10px] text-amber-600 dark:text-amber-400">
          ⚠️ Campos duplicados: {[...new Set(duplicates)].map(f => COLUMN_FIELDS.find(c => c.value === f)?.label).join(', ')}
        </p>
      )}

      {/* Preview table */}
      {sampleRows.length > 0 && isValid && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Preview dos dados</p>
          <div className="overflow-x-auto -mx-4 px-4">
            <table className="w-full text-[10px] border-collapse">
              <thead>
                <tr>
                  {headers.map(h => {
                    const field = mappings[h.index] || 'ignore'
                    if (field === 'ignore') return null
                    const fInfo = COLUMN_FIELDS.find(f => f.value === field)
                    const style = FIELD_STYLES[field]
                    return (
                      <th key={h.index} className={`text-left px-2 py-1 font-bold ${style.text}`}>
                        {fInfo?.icon} {fInfo?.label}
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {sampleRows.map((row, ri) => (
                  <tr key={ri} className="border-t border-gray-100 dark:border-gray-800">
                    {headers.map(h => {
                      const field = mappings[h.index] || 'ignore'
                      if (field === 'ignore') return null
                      return (
                        <td key={h.index} className="px-2 py-1 text-gray-600 dark:text-gray-300 truncate max-w-[160px]">
                          {String(row[h.index] ?? '').trim() || '—'}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Validation + actions */}
      <div className="flex items-center gap-3 flex-wrap pt-1">
        <button onClick={handleConfirm} disabled={!isValid || duplicates.length > 0}
          className="px-4 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed">
          ✅ Importar com este mapeamento
        </button>
        <button onClick={onCancel}
          className="px-4 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors cursor-pointer">
          Cancelar
        </button>
        {!isValid && (
          <span className="text-[10px] text-red-500 dark:text-red-400">
            Mapeie pelo menos <strong>Categoria</strong> e <strong>Valor</strong>
          </span>
        )}
      </div>
    </div>
  )
}

// ── Mapping panel for unrecognized categories ───────────

function MappingPanel({ unmapped, allCategories, onApply, onCancel, aiSuggestions }) {
  const [mapping, setMapping] = useState(() => {
    const m = {}
    for (const key of Object.keys(unmapped)) {
      m[key] = aiSuggestions?.[key] || ''
    }
    return m
  })

  const allReady = Object.values(mapping).every(v => v !== '')
  const hasAiSuggestions = aiSuggestions && Object.values(aiSuggestions).some(v => v)

  return (
    <div className="mt-3 space-y-3 p-3 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950">
      <div className="flex items-center gap-2">
        <span className="text-sm">⚠️</span>
        <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">Categorias não reconhecidas</p>
        {hasAiSuggestions && (
          <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/50 text-violet-600 dark:text-violet-400">
            ✨ IA sugeriu
          </span>
        )}
      </div>
      <p className="text-[11px] text-amber-700 dark:text-amber-400">
        {hasAiSuggestions
          ? 'A IA sugeriu categorias. Confira e ajuste se necessário:'
          : 'Mapeie cada categoria para uma existente antes de importar:'}
      </p>
      <div className="space-y-2">
        {Object.entries(unmapped).map(([key, info]) => (
          <div key={key} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
            <span className="text-xs text-gray-700 dark:text-gray-300 font-medium min-w-[120px]">
              &quot;{info.original}&quot; <span className="text-gray-400">({info.count}x)</span>
              {aiSuggestions?.[key] && mapping[key] === aiSuggestions[key] && (
                <span className="text-[9px] text-violet-500 ml-1">✨</span>
              )}
            </span>
            <svg className="hidden sm:block w-3 h-3 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
            <select
              value={mapping[key]}
              onChange={e => setMapping(p => ({ ...p, [key]: e.target.value }))}
              className="flex-1 px-2 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-indigo-400 focus:outline-none"
            >
              <option value="">Selecione...</option>
              {allCategories.map(c => (
                <option key={c.key} value={c.key}>{c.icon} {c.label}</option>
              ))}
            </select>
          </div>
        ))}
      </div>
      <div className="flex gap-2 pt-1">
        <button onClick={() => onApply(mapping)} disabled={!allReady}
          className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed">
          Aplicar mapeamento
        </button>
        <button onClick={onCancel}
          className="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors cursor-pointer">
          Cancelar
        </button>
      </div>
    </div>
  )
}

// ── Main Component ───────────────────────────────────────

export default function FileImporter({ onTotals, month }) {
  const [status, setStatus] = useState('idle')
  const [message, setMessage] = useState('')
  const [dragging, setDragging] = useState(false)
  const [userCategories, setUserCategories] = useState([])

  // Category mapping state (existing)
  const [pendingUnmapped, setPendingUnmapped] = useState(null)
  const [pendingRows, setPendingRows] = useState(null)
  const [pendingFile, setPendingFile] = useState(null)
  const [importModal, setImportModal] = useState(null)
  const [aiSuggestions, setAiSuggestions] = useState(null)

  // Smart column mapping state (new)
  const [showColumnMapping, setShowColumnMapping] = useState(false)
  const [pendingRawData, setPendingRawData] = useState(null)
  const [aiColumnMappings, setAiColumnMappings] = useState(null)
  const [aiMappingLoading, setAiMappingLoading] = useState(false)

  // Colar dados da planilha
  const [pasteText, setPasteText] = useState('')
  const [showPasteArea, setShowPasteArea] = useState(false)

  // Extração com Gemini (IA)
  const [useGeminiImport, setUseGeminiImport] = useState(false)
  const [geminiReviewItems, setGeminiReviewItems] = useState(null)
  const [geminiFileName, setGeminiFileName] = useState(null)

  const importModeRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    listCategories().then(setUserCategories).catch(() => {})
  }, [])

  const resetAll = useCallback(() => {
    setPendingUnmapped(null)
    setPendingRows(null)
    setPendingFile(null)
    setImportModal(null)
    setAiSuggestions(null)
    setShowColumnMapping(false)
    setPendingRawData(null)
    setAiColumnMappings(null)
    setAiMappingLoading(false)
    setGeminiReviewItems(null)
    setGeminiFileName(null)
  }, [])

  const finishImport = useCallback(async (allRows, fileName, replaceExisting) => {
    if (month) {
      if (replaceExisting) await clearTransactions(month)
      await bulkInsertTransactions(month, allRows.map(row => ({
        category: row.categoria,
        description: row.descricao || '',
        amount: row.valor,
        date: row.data || null,
        source: 'import',
        payment_status: row.payment_status || null,
      })))
    }
    setStatus('success')
    setMessage(`${allRows.length} lançamento(s) importado(s) de "${fileName}"`)
    onTotals?.()
  }, [onTotals, month])

  const executeImport = useCallback(async (rows, fileName, replaceExisting) => {
    setStatus('loading')
    try { await finishImport(rows, fileName, replaceExisting) }
    catch (err) { setStatus('error'); setMessage(err.message) }
  }, [finishImport])

  const checkExistingAndImport = useCallback(async (rows, fileName) => {
    if (!month) { await executeImport(rows, fileName, false); return }
    const existing = await listTransactions(month)
    if (existing.length === 0) { await executeImport(rows, fileName, false); return }
    importModeRef.current = { rows, fileName }
    setImportModal(existing.length)
    setStatus('idle')
  }, [month, executeImport])

  const handleImportModalChoice = useCallback(async (choice) => {
    const { rows, fileName } = importModeRef.current || {}
    setImportModal(null)
    if (!rows || choice === 'cancel') return
    await executeImport(rows, fileName, choice === 'replace')
  }, [executeImport])

  // Process rows after column indices are known
  const importWithIndices = useCallback(async (rawData, fileName, columnIndices) => {
    setStatus('loading')
    try {
      const catMap = buildCategoryMap(userCategories)
      const { rows, unmapped } = normalizeRows(rawData, catMap, columnIndices)

      const unmappedKeys = Object.keys(unmapped)
      if (unmappedKeys.length > 0) {
        setPendingRows(rows)
        setPendingUnmapped(unmapped)
        setPendingFile(fileName)

        if (isAiAvailable()) {
          try {
            const descriptions = unmappedKeys.map(k => unmapped[k].original)
            const aiResult = await categorizeBatch(descriptions)
            const suggestions = {}
            for (const key of unmappedKeys) {
              const orig = unmapped[key].original
              const validCats = userCategories.map(c => c.key)
              const parentMap = {}
              for (const c of userCategories) parentMap[c.parent_category] = c.key
              const suggested = aiResult[orig]
              if (suggested && (validCats.includes(suggested) || parentMap[suggested])) {
                suggestions[key] = validCats.includes(suggested) ? suggested : parentMap[suggested]
              }
            }
            setAiSuggestions(Object.keys(suggestions).length > 0 ? suggestions : null)
          } catch { setAiSuggestions(null) }
        }
        setStatus('idle')
        return
      }

      if (rows.length === 0) {
        throw new Error('Nenhuma linha válida encontrada. Verifique se as categorias correspondem a: fixas, cartão, investimento ou receita.')
      }

      await checkExistingAndImport(rows, fileName)
    } catch (err) {
      setStatus('error')
      setMessage(err.message)
    }
  }, [userCategories, checkExistingAndImport])

  const processFileGemini = useCallback(async (file) => {
    setStatus('loading')
    setMessage('Extraindo com IA (Gemini)...')
    setGeminiReviewItems(null)
    setGeminiFileName(null)
    try {
      let content
      let mimeType = file.type || 'application/octet-stream'
      const ext = (file.name || '').split('.').pop()?.toLowerCase()

      if (/^image\//.test(mimeType)) {
        content = await file.arrayBuffer()
      } else if (ext === 'xlsx' || ext === 'xls') {
        const rawData = await parseXLSX(file)
        content = rawData.map((row) => (row || []).map((c) => String(c ?? '')).join(',')).join('\n')
        mimeType = 'text/csv'
      } else {
        content = await file.text()
        mimeType = 'text/csv'
      }

      const items = await processFinancialInput(content, mimeType)
      if (!items.length) {
        setStatus('error')
        setMessage('Nenhum lançamento extraído pela IA.')
        return
      }
      setGeminiReviewItems(items)
      setGeminiFileName(file.name)
      setStatus('idle')
      setMessage('')
    } catch (err) {
      setStatus('error')
      setMessage(err?.message || 'Erro ao processar com Gemini.')
    }
  }, [])

  const handleGeminiConfirm = useCallback(async (replaceExisting) => {
    if (!geminiReviewItems?.length || !geminiFileName) return
    const txs = geminiItemsToTransactions(geminiReviewItems)
    const rows = txs.map((tx) => ({
      categoria: tx.category,
      descricao: tx.description,
      valor: tx.amount,
      data: tx.date,
      payment_status: tx.payment_status,
    }))
    setGeminiReviewItems(null)
    setGeminiFileName(null)
    await checkExistingAndImport(rows, geminiFileName)
  }, [geminiReviewItems, geminiFileName, checkExistingAndImport])

  const handleImportPaste = useCallback(async () => {
    const rawData = parsePastedTable(pasteText)
    if (!rawData || rawData.length < 2) {
      setStatus('error')
      setMessage('Cole pelo menos uma linha de cabeçalho (ex.: Categoria, Valor) e uma linha de dados.')
      return
    }
    const headers = rawData[0].map((c) => String(c ?? '').trim())
    const fixedIndices = getFixedColumnIndices(headers)
    const autoDetected = findColumns(headers)
    const columnIndices = fixedIndices || autoDetected
    if (columnIndices.catIdx < 0 || columnIndices.valIdx < 0) {
      setStatus('error')
      setMessage('Cabeçalho deve ter colunas "Categoria" (ou tipo) e "Valor" (ou value/amount).')
      return
    }
    setStatus('loading')
    await importWithIndices(rawData, 'dados colados', columnIndices)
    setPasteText('')
    setShowPasteArea(false)
  }, [pasteText, importWithIndices])

  const processFile = useCallback(async (file) => {
    setStatus('loading')
    setMessage('')
    resetAll()

    try {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        throw new Error(`Arquivo muito grande (máx. ${MAX_FILE_SIZE_BYTES / 1024 / 1024} MB). Escolha um arquivo menor.`)
      }
      if (useGeminiImport && isGeminiAvailable()) {
        const ext = (file.name || '').split('.').pop()?.toLowerCase()
        const geminiOk = ['csv', 'xlsx', 'xls', 'png', 'jpg', 'jpeg'].includes(ext)
        if (geminiOk) {
          await processFileGemini(file)
          return
        }
      }
      const parser = getParser(file.name)
      if (!parser) throw new Error(`Formato não suportado: "${file.name}". Use CSV, XLSX ou XML.`)

      const rawData = await parser(file)
      if (!rawData.length) throw new Error('Arquivo vazio.')

      const headers = rawData[0]
      const fixedIndices = getFixedColumnIndices(headers)
      const autoDetected = findColumns(headers)
      const columnIndices = fixedIndices || autoDetected

      // Prefer fixed mapping (Data, Categoria, Título, Valor, Status) when detected; otherwise fallback
      if (columnIndices.catIdx >= 0 && columnIndices.valIdx >= 0) {
        await importWithIndices(rawData, file.name, columnIndices)
        return
      }

      // Slow path: show smart column mapping step
      setPendingRawData(rawData)
      setPendingFile(file.name)
      setShowColumnMapping(true)
      setStatus('idle')

      // Kick off AI detection in background
      if (isAiAvailable()) {
        setAiMappingLoading(true)
        detectColumnMapping(headers, rawData.slice(1, 6))
          .then(result => setAiColumnMappings(result))
          .finally(() => setAiMappingLoading(false))
      }
    } catch (err) {
      setStatus('error')
      setMessage(err.message)
    }
  }, [resetAll, importWithIndices, useGeminiImport, processFileGemini])

  // User confirmed column mapping
  const handleColumnMappingConfirm = useCallback(async (indices) => {
    setShowColumnMapping(false)
    if (!pendingRawData) return
    await importWithIndices(pendingRawData, pendingFile || 'arquivo', indices)
    setPendingRawData(null)
  }, [pendingRawData, pendingFile, importWithIndices])

  const handleApplyMapping = useCallback(async (mapping) => {
    if (!pendingUnmapped || !pendingRows) return
    setStatus('loading')
    try {
      const extraRows = []
      for (const [key, info] of Object.entries(pendingUnmapped)) {
        const target = mapping[key]
        if (!target) continue
        for (const r of info.rows) {
          extraRows.push({ categoria: target, valor: r.valor, descricao: r.descricao, data: r.data, payment_status: r.payment_status || null })
        }
      }
      const allRows = [...pendingRows, ...extraRows]
      if (allRows.length === 0) throw new Error('Nenhuma linha válida após o mapeamento.')
      setPendingUnmapped(null)
      setPendingRows(null)
      await checkExistingAndImport(allRows, pendingFile || 'arquivo')
    } catch (err) {
      setStatus('error')
      setMessage(err.message)
    }
  }, [pendingUnmapped, pendingRows, pendingFile, checkExistingAndImport])

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
    e.target.value = ''
  }

  const handleDrop = (e) => { e.preventDefault(); setDragging(false); const file = e.dataTransfer.files?.[0]; if (file) processFile(file) }
  const handleDragOver = (e) => { e.preventDefault(); setDragging(true) }
  const handleDragLeave = (e) => { e.preventDefault(); setDragging(false) }

  const statusColors = {
    idle: 'border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-800',
    loading: 'border-indigo-300 bg-indigo-50 dark:border-indigo-700 dark:bg-indigo-950',
    success: 'border-emerald-400 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950',
    error: 'border-red-400 bg-red-50 dark:border-red-700 dark:bg-red-950',
  }

  return (
    <div className="w-full max-w-xl mx-auto">
      {isGeminiAvailable() && (
        <div className="mb-3 flex items-center gap-2">
          <input
            id="use-gemini-import"
            type="checkbox"
            checked={useGeminiImport}
            onChange={(e) => setUseGeminiImport(e.target.checked)}
            className="rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-400"
          />
          <label htmlFor="use-gemini-import" className="text-xs font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
            Usar extração com IA (Gemini) — CSV, XLSX ou imagem
          </label>
        </div>
      )}
      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => inputRef.current?.click()}
        className={`relative flex flex-col items-center justify-center gap-2 sm:gap-3 rounded-2xl border-2 border-dashed p-6 sm:p-10 cursor-pointer transition-all duration-200 ${
          dragging ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950 scale-[1.02]' : statusColors[status]
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={useGeminiImport ? ACCEPTED_GEMINI : ACCEPTED}
          onChange={handleFileChange}
          className="hidden"
        />
        <div className="text-3xl sm:text-4xl">
          {status === 'loading' && '⏳'}
          {status === 'success' && '✅'}
          {status === 'error' && '❌'}
          {(status === 'idle' || dragging) && '📂'}
        </div>
        <p className="text-gray-600 dark:text-gray-300 text-center text-xs sm:text-sm font-medium">
          {status === 'loading' ? (useGeminiImport ? 'Extraindo com IA...' : 'Processando arquivo...') : 'Arraste um arquivo aqui ou clique para selecionar'}
        </p>
        <span className="text-[10px] sm:text-xs text-gray-400 dark:text-gray-500">
          {useGeminiImport ? 'CSV, XLSX ou PNG/JPG' : 'CSV, XLSX ou XML — qualquer formato de planilha'}
        </span>
      </div>

      {/* Colar dados (Excel/Sheets) */}
      <div className="mt-3">
        <button
          type="button"
          onClick={() => setShowPasteArea((v) => !v)}
          className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
        >
          {showPasteArea ? '▼ Ocultar' : '▶ Ou cole os dados da planilha'}
        </button>
        {showPasteArea && (
          <div className="mt-2 p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 space-y-2">
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              Copie um trecho no Excel ou Google Sheets (com cabeçalho: Categoria, Valor, etc.) e cole abaixo. Use tab ou vírgula como separador.
            </p>
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={'Categoria\tValor\nreceita\t100\ncontas fixas\t50'}
              rows={4}
              className="w-full px-3 py-2 text-xs rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:ring-2 focus:ring-indigo-400 focus:outline-none resize-y"
            />
            <button
              type="button"
              onClick={handleImportPaste}
              disabled={!pasteText.trim() || status === 'loading'}
              className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 disabled:cursor-not-allowed rounded-lg transition-colors cursor-pointer"
            >
              Importar colado
            </button>
          </div>
        )}
      </div>

      {/* Smart column mapping step */}
      {showColumnMapping && pendingRawData && (
        <ColumnMappingStep
          rawData={pendingRawData}
          aiMappings={aiColumnMappings}
          aiLoading={aiMappingLoading}
          onConfirm={handleColumnMappingConfirm}
          onCancel={() => { resetAll(); setStatus('idle') }}
        />
      )}

      {/* Category mapping panel (existing, for unrecognized categories) */}
      {pendingUnmapped && (
        <MappingPanel
          unmapped={pendingUnmapped}
          allCategories={userCategories}
          onApply={handleApplyMapping}
          onCancel={() => { setPendingUnmapped(null); setPendingRows(null); setPendingFile(null); setAiSuggestions(null) }}
          aiSuggestions={aiSuggestions}
        />
      )}

      {/* Revisão dos dados extraídos pelo Gemini */}
      {geminiReviewItems && geminiReviewItems.length > 0 && (
        <div className="mt-3 p-4 rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-950/30 space-y-3">
          <p className="text-xs font-semibold text-violet-800 dark:text-violet-300">
            Revisar {geminiReviewItems.length} lançamento(s) extraído(s) por IA de &quot;{geminiFileName}&quot;
          </p>
          <div className="max-h-60 overflow-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-gray-100 dark:bg-gray-800">
                <tr>
                  <th className="px-2 py-1.5 font-semibold">Data</th>
                  <th className="px-2 py-1.5 font-semibold">Descrição</th>
                  <th className="px-2 py-1.5 font-semibold text-right">Valor</th>
                  <th className="px-2 py-1.5 font-semibold">Status</th>
                  <th className="px-2 py-1.5 font-semibold">Reserva</th>
                </tr>
              </thead>
              <tbody>
                {geminiReviewItems.map((item, i) => (
                  <tr key={i} className="border-t border-gray-100 dark:border-gray-800">
                    <td className="px-2 py-1">{item.date || '—'}</td>
                    <td className="px-2 py-1 truncate max-w-[140px]">{item.description}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{Number(item.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                    <td className="px-2 py-1">{item.status}</td>
                    <td className="px-2 py-1">{item.is_reserva ? 'Sim' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleGeminiConfirm()}
              className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors cursor-pointer"
            >
              Confirmar importação
            </button>
            <button
              onClick={() => { setGeminiReviewItems(null); setGeminiFileName(null) }}
              className="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors cursor-pointer"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Import mode modal */}
      {importModal !== null && (
        <div className="mt-3 space-y-3 p-3 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950">
          <p className="text-xs font-semibold text-blue-800 dark:text-blue-300">
            Este mês já tem {importModal} transaç{importModal === 1 ? 'ão' : 'ões'}. O que deseja fazer?
          </p>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => handleImportModalChoice('replace')}
              className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors cursor-pointer">
              Substituir todas
            </button>
            <button onClick={() => handleImportModalChoice('add')}
              className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors cursor-pointer">
              Adicionar às existentes
            </button>
            <button onClick={() => handleImportModalChoice('cancel')}
              className="px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors cursor-pointer">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Status message */}
      {message && (
        <div className={`mt-4 rounded-xl px-4 py-3 text-sm ${
          status === 'error'
            ? 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800'
            : 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800'
        }`}>
          {message}
        </div>
      )}
    </div>
  )
}
