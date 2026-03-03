import { useState, useRef, useCallback, useEffect } from 'react'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { toNumberBR } from '../utils/toNumberBR'
import { bulkInsertTransactions } from '../services/transactionService'
import { listCategories } from '../services/categoryService'

const ACCEPTED = '.csv,.xlsx,.xls,.xml'

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

  const catIdx = lower.findIndex((h) =>
    ['categoria', 'category', 'tipo', 'type'].includes(h),
  )
  const valIdx = lower.findIndex((h) =>
    ['valor', 'value', 'amount', 'quantia', 'total'].includes(h),
  )
  const dateIdx = lower.findIndex((h) =>
    ['data', 'date', 'dia', 'dt'].includes(h),
  )
  const descIdx = lower.findIndex((h) =>
    ['descricao', 'descrição', 'description', 'desc', 'nome', 'name', 'historico', 'histórico'].includes(h),
  )

  return { catIdx, valIdx, dateIdx, descIdx }
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
  return null
}

function normalizeRows(rawRows, catMap) {
  if (!rawRows.length) return { rows: [], unmapped: {} }

  const headers = rawRows[0]
  const { catIdx, valIdx, dateIdx, descIdx } = findColumns(headers)

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

    const descricao = descIdx !== -1 ? String(row[descIdx] ?? '').trim() : rawCat
    const data = dateIdx !== -1 ? tryParseDate(row[dateIdx]) : null

    if (categoria === null) {
      const key = rawCat.toLowerCase()
      if (key) {
        if (!unmapped[key]) unmapped[key] = { original: rawCat, count: 0, rows: [] }
        unmapped[key].count++
        unmapped[key].rows.push({ valor, descricao, data, rawIdx: i })
      }
      continue
    }

    rows.push({ categoria, valor, descricao, data })
  }

  return { rows, unmapped }
}

function computeTotals(rows, userCategories) {
  const totals = { fixas: 0, cartao: 0, invest: 0, receita: 0 }
  const catLookup = new Map()
  for (const c of userCategories) catLookup.set(c.key, c.parent_category)

  for (const { categoria, valor } of rows) {
    const parent = catLookup.get(categoria) || categoria
    if (parent in totals) {
      totals[parent] += valor
    }
  }
  return totals
}

// ── Parsers ──────────────────────────────────────────────

function parseCSV(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      skipEmptyLines: true,
      complete(results) {
        if (results.errors.length) {
          reject(new Error(`Erro ao ler CSV: ${results.errors[0].message}`))
        } else {
          resolve(results.data)
        }
      },
      error(err) {
        reject(new Error(`Erro ao ler CSV: ${err.message}`))
      },
    })
  })
}

function parseXLSX(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array' })
        const sheet = wb.Sheets[wb.SheetNames[0]]
        const data = XLSX.utils.sheet_to_json(sheet, { header: 1 })
        resolve(data)
      } catch (err) {
        reject(new Error(`Erro ao ler XLSX: ${err.message}`))
      }
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
        if (parseError) {
          reject(new Error('XML mal-formado: ' + parseError.textContent.slice(0, 120)))
          return
        }

        const items = doc.querySelectorAll('item, row, registro, lancamento')
        if (!items.length) {
          reject(
            new Error(
              'Nenhum elemento encontrado no XML. Esperado: <item>, <row>, <registro> ou <lancamento>.',
            ),
          )
          return
        }

        const rows = [['categoria', 'valor']]
        items.forEach((item) => {
          const cat =
            item.querySelector('categoria, category, tipo, type')?.textContent ?? ''
          const val =
            item.querySelector('valor, value, amount, quantia, total')?.textContent ?? ''
          rows.push([cat, val])
        })

        resolve(rows)
      } catch (err) {
        reject(new Error(`Erro ao ler XML: ${err.message}`))
      }
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

// ── Mapping panel for unrecognized categories ───────────

function MappingPanel({ unmapped, allCategories, onApply, onCancel }) {
  const [mapping, setMapping] = useState(() => {
    const m = {}
    for (const key of Object.keys(unmapped)) m[key] = ''
    return m
  })

  const allReady = Object.values(mapping).every(v => v !== '')

  return (
    <div className="mt-3 space-y-3 p-3 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950">
      <div className="flex items-center gap-2">
        <span className="text-sm">⚠️</span>
        <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
          Categorias não reconhecidas
        </p>
      </div>
      <p className="text-[11px] text-amber-700 dark:text-amber-400">
        Mapeie cada categoria para uma existente antes de importar:
      </p>
      <div className="space-y-2">
        {Object.entries(unmapped).map(([key, info]) => (
          <div key={key} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
            <span className="text-xs text-gray-700 dark:text-gray-300 font-medium min-w-[120px]">
              &quot;{info.original}&quot; <span className="text-gray-400">({info.count}x)</span>
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

// ── Componente ───────────────────────────────────────────

export default function FileImporter({ onTotals, month }) {
  const [status, setStatus] = useState('idle')
  const [message, setMessage] = useState('')
  const [dragging, setDragging] = useState(false)
  const [userCategories, setUserCategories] = useState([])
  const [pendingUnmapped, setPendingUnmapped] = useState(null)
  const [pendingRows, setPendingRows] = useState(null)
  const [pendingFile, setPendingFile] = useState(null)
  const inputRef = useRef(null)

  useEffect(() => {
    listCategories().then(setUserCategories).catch(() => {})
  }, [])

  const finishImport = useCallback(async (allRows, fileName) => {
    const totals = computeTotals(allRows, userCategories)

    if (month) {
      await bulkInsertTransactions(month, allRows.map(row => ({
        category: row.categoria,
        description: row.descricao || '',
        amount: row.valor,
        date: row.data || null,
        source: 'import',
      })))
    }

    setStatus('success')
    setMessage(`${allRows.length} lançamento(s) importado(s) de "${fileName}"`)
    onTotals?.(totals)
  }, [onTotals, month, userCategories])

  const processFile = useCallback(
    async (file) => {
      setStatus('loading')
      setMessage('')
      setPendingUnmapped(null)
      setPendingRows(null)
      setPendingFile(null)

      try {
        const parser = getParser(file.name)
        if (!parser) {
          throw new Error(
            `Formato não suportado: "${file.name}". Use CSV, XLSX ou XML.`,
          )
        }

        const rawData = await parser(file)
        const catMap = buildCategoryMap(userCategories)
        const { rows, unmapped } = normalizeRows(rawData, catMap)

        const unmappedKeys = Object.keys(unmapped)
        if (unmappedKeys.length > 0) {
          setPendingRows(rows)
          setPendingUnmapped(unmapped)
          setPendingFile(file.name)
          setStatus('idle')
          return
        }

        if (rows.length === 0) {
          throw new Error(
            'Nenhuma linha válida encontrada. Verifique se as categorias correspondem a: fixas, cartão, investimento ou receita.',
          )
        }

        await finishImport(rows, file.name)
      } catch (err) {
        setStatus('error')
        setMessage(err.message)
      }
    },
    [onTotals, month, userCategories, finishImport],
  )

  const handleApplyMapping = useCallback(async (mapping) => {
    if (!pendingUnmapped || !pendingRows) return
    setStatus('loading')
    try {
      const extraRows = []
      for (const [key, info] of Object.entries(pendingUnmapped)) {
        const target = mapping[key]
        if (!target) continue
        for (const r of info.rows) {
          extraRows.push({ categoria: target, valor: r.valor, descricao: r.descricao, data: r.data })
        }
      }
      const allRows = [...pendingRows, ...extraRows]
      if (allRows.length === 0) {
        throw new Error('Nenhuma linha válida após o mapeamento.')
      }
      await finishImport(allRows, pendingFile || 'arquivo')
      setPendingUnmapped(null)
      setPendingRows(null)
      setPendingFile(null)
    } catch (err) {
      setStatus('error')
      setMessage(err.message)
    }
  }, [pendingUnmapped, pendingRows, pendingFile, finishImport])

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
    e.target.value = ''
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) processFile(file)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    setDragging(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    setDragging(false)
  }

  const statusColors = {
    idle: 'border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-800',
    loading: 'border-indigo-300 bg-indigo-50 dark:border-indigo-700 dark:bg-indigo-950',
    success: 'border-emerald-400 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950',
    error: 'border-red-400 bg-red-50 dark:border-red-700 dark:bg-red-950',
  }

  return (
    <div className="w-full max-w-xl mx-auto">
      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => inputRef.current?.click()}
        className={`
          relative flex flex-col items-center justify-center gap-2 sm:gap-3
          rounded-2xl border-2 border-dashed p-6 sm:p-10 cursor-pointer
          transition-all duration-200
          ${dragging
            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950 scale-[1.02]'
            : statusColors[status]}
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED}
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
          {status === 'loading'
            ? 'Processando arquivo...'
            : 'Arraste um arquivo aqui ou clique para selecionar'}
        </p>

        <span className="text-[10px] sm:text-xs text-gray-400 dark:text-gray-500">CSV, XLSX ou XML</span>
      </div>

      {/* Mapping panel for unrecognized categories */}
      {pendingUnmapped && (
        <MappingPanel
          unmapped={pendingUnmapped}
          allCategories={userCategories}
          onApply={handleApplyMapping}
          onCancel={() => { setPendingUnmapped(null); setPendingRows(null); setPendingFile(null) }}
        />
      )}

      {/* Mensagem de status */}
      {message && (
        <div
          className={`mt-4 rounded-xl px-4 py-3 text-sm ${
            status === 'error'
              ? 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800'
              : 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800'
          }`}
        >
          {message}
        </div>
      )}
    </div>
  )
}
