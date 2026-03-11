import { useState, useCallback, useRef } from 'react'
import { parseTransaction } from '../services/aiParserService'
import { isAiAvailable } from '../services/aiService'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const BRL = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const CAT_LABELS = {
  receita: { label: 'Receita', color: 'emerald' },
  fixas: { label: 'Contas Fixas', color: 'rose' },
  cartao: { label: 'Cartão', color: 'orange' },
  invest: { label: 'Investimentos', color: 'indigo' },
}

const STATUS_LABELS = {
  paid: 'Pago',
  pending: 'Pendente',
}

function formatDate(d) {
  try {
    return format(parseISO(d), "dd MMM", { locale: ptBR })
  } catch {
    return d
  }
}

export default function AiTransactionInput({ onConfirm }) {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState(null)
  const debounceRef = useRef(null)

  const handleParse = useCallback(async () => {
    if (!input.trim()) return
    setLoading(true)
    setError(null)
    setPreview(null)
    try {
      const result = await parseTransaction(input)
      if (result) {
        setPreview(result)
      } else {
        setError('Não consegui entender. Tente algo como "paguei 150 de luz"')
      }
    } catch {
      setError('Erro ao processar. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }, [input])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (preview) {
        handleConfirm()
      } else if (input.trim()) {
        handleParse()
      }
    }
    if (e.key === 'Escape') {
      setPreview(null)
      setError(null)
    }
  }

  const handleInputChange = (e) => {
    setInput(e.target.value)
    setPreview(null)
    setError(null)

    clearTimeout(debounceRef.current)
    if (e.target.value.trim().length > 10) {
      debounceRef.current = setTimeout(() => {
        // Auto-parse after 1.5s of inactivity
      }, 1500)
    }
  }

  const handleConfirm = () => {
    if (!preview) return
    onConfirm?.(preview)
    setInput('')
    setPreview(null)
    setError(null)
  }

  const handleClear = () => {
    setInput('')
    setPreview(null)
    setError(null)
  }

  if (!isAiAvailable()) return null

  return (
    <div className="space-y-2">
      <div className="relative flex items-center gap-2">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm">✨</span>
          <input
            type="text"
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder='Descreva: "paguei 150 de luz ontem"'
            className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl border border-violet-200 dark:border-violet-700 bg-violet-50/50 dark:bg-violet-950/30 text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-400 transition-shadow"
          />
        </div>
        {input.trim() && !preview && (
          <button
            onClick={handleParse}
            disabled={loading}
            className="px-3 py-2.5 text-xs font-medium text-white bg-violet-600 hover:bg-violet-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 rounded-xl transition-colors cursor-pointer disabled:cursor-not-allowed shrink-0"
          >
            {loading ? (
              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              'Interpretar'
            )}
          </button>
        )}
        {input.trim() && (
          <button
            onClick={handleClear}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer shrink-0"
            title="Limpar"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <p className="text-[10px] text-red-500 dark:text-red-400 px-1">{error}</p>
      )}

      {/* Preview card */}
      {preview && (
        <div className="flex items-center gap-3 p-3 rounded-xl border border-violet-200 dark:border-violet-700 bg-violet-50/50 dark:bg-violet-950/30">
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`inline-block px-2 py-0.5 text-[10px] font-semibold rounded-full bg-${CAT_LABELS[preview.category]?.color || 'gray'}-100 dark:bg-${CAT_LABELS[preview.category]?.color || 'gray'}-900/50 text-${CAT_LABELS[preview.category]?.color || 'gray'}-700 dark:text-${CAT_LABELS[preview.category]?.color || 'gray'}-400`}>
                {CAT_LABELS[preview.category]?.label || preview.category}
              </span>
              {preview.payment_status && (
                <span className={`inline-block px-2 py-0.5 text-[10px] font-semibold rounded-full ${
                  preview.payment_status === 'paid'
                    ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400'
                    : 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400'
                }`}>
                  {STATUS_LABELS[preview.payment_status]}
                </span>
              )}
              <span className="text-[10px] text-gray-400 dark:text-gray-500">{formatDate(preview.date)}</span>
              <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/50 text-violet-500 dark:text-violet-400">✨ IA</span>
            </div>
            <p className="text-xs text-gray-700 dark:text-gray-300">{preview.description}</p>
          </div>
          <span className={`text-sm font-bold tabular-nums shrink-0 text-${CAT_LABELS[preview.category]?.color || 'gray'}-600 dark:text-${CAT_LABELS[preview.category]?.color || 'gray'}-400`}>
            {BRL(preview.amount)}
          </span>
          <div className="flex gap-1 shrink-0">
            <button
              onClick={handleConfirm}
              className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors cursor-pointer"
              title="Confirmar"
            >
              Salvar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
