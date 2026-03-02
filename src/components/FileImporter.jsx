import { useState, useRef, useCallback } from 'react'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { toNumberBR } from '../utils/toNumberBR'

const ACCEPTED = '.csv,.xlsx,.xls,.xml'

const CATEGORY_MAP = {
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

function normalizeCategory(raw) {
  const key = String(raw ?? '').trim().toLowerCase()
  return CATEGORY_MAP[key] ?? null
}

function findColumns(headers) {
  const lower = headers.map((h) => String(h).trim().toLowerCase())

  const catIdx = lower.findIndex((h) =>
    ['categoria', 'category', 'tipo', 'type'].includes(h),
  )
  const valIdx = lower.findIndex((h) =>
    ['valor', 'value', 'amount', 'quantia', 'total'].includes(h),
  )

  return { catIdx, valIdx }
}

function normalizeRows(rawRows) {
  if (!rawRows.length) return []

  const headers = rawRows[0]
  const { catIdx, valIdx } = findColumns(headers)

  if (catIdx === -1 || valIdx === -1) {
    throw new Error(
      `Colunas obrigatórias não encontradas. ` +
        `Esperado: "categoria" (ou tipo/category) e "valor" (ou value/amount). ` +
        `Encontrado: [${headers.join(', ')}]`,
    )
  }

  const rows = []
  for (let i = 1; i < rawRows.length; i++) {
    const row = rawRows[i]
    if (!row || row.every((c) => c == null || String(c).trim() === '')) continue

    const categoria = normalizeCategory(row[catIdx])
    const valor = toNumberBR(row[valIdx])

    if (categoria === null) continue
    if (Number.isNaN(valor)) continue

    rows.push({ categoria, valor })
  }

  return rows
}

function computeTotals(rows) {
  const totals = { fixas: 0, cartao: 0, invest: 0, receita: 0 }
  for (const { categoria, valor } of rows) {
    if (categoria in totals) {
      totals[categoria] += valor
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

// ── Componente ───────────────────────────────────────────

export default function FileImporter({ onTotals }) {
  const [status, setStatus] = useState('idle')
  const [message, setMessage] = useState('')
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef(null)

  const processFile = useCallback(
    async (file) => {
      setStatus('loading')
      setMessage('')

      try {
        const parser = getParser(file.name)
        if (!parser) {
          throw new Error(
            `Formato não suportado: "${file.name}". Use CSV, XLSX ou XML.`,
          )
        }

        const rawData = await parser(file)
        const normalized = normalizeRows(rawData)

        if (normalized.length === 0) {
          throw new Error(
            'Nenhuma linha válida encontrada. Verifique se as categorias correspondem a: fixas, cartão, investimento ou receita.',
          )
        }

        const totals = computeTotals(normalized)

        setStatus('success')
        setMessage(`${normalized.length} lançamento(s) importado(s) de "${file.name}"`)
        onTotals?.(totals)
      } catch (err) {
        setStatus('error')
        setMessage(err.message)
      }
    },
    [onTotals],
  )

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
