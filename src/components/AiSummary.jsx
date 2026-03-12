import { useCallback, useEffect, useState } from 'react'
import { generateInsight } from '../services/aiInsightsService'
import { isAiAvailable } from '../services/aiService'

export default function AiSummary({ month, totals, prevTotals, realBalance, reserveTotal, reserveForecast, goals }) {
  const [text, setText] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [dismissed, setDismissed] = useState(false)

  const generate = useCallback(async () => {
    if (!isAiAvailable()) return
    if (!totals || !Object.values(totals).some(v => v > 0)) return

    setLoading(true)
    setError(null)
    try {
      const result = await generateInsight({
        month,
        receita: totals.receita || 0,
        fixas: totals.fixas || 0,
        cartao: totals.cartao || 0,
        invest: totals.invest || 0,
        realBalance,
        reserveTotal,
        monthsOfRunway: reserveForecast?.monthsOfRunway ?? null,
        prevReceita: prevTotals?.receita,
        prevFixas: prevTotals?.fixas,
        prevCartao: prevTotals?.cartao,
        prevInvest: prevTotals?.invest,
        goals: goals || [],
      })
      setText(result)
    } catch (err) {
      setError(err.message || 'Erro ao gerar resumo')
    } finally {
      setLoading(false)
    }
  }, [month, totals, prevTotals, realBalance, reserveTotal, reserveForecast, goals])

  useEffect(() => {
    generate()
  }, [generate])

  if (!isAiAvailable()) return null
  if (dismissed) return null
  if (!loading && !text && !error) return null

  return (
    <div className="bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-violet-950/30 dark:to-indigo-950/30 rounded-2xl border border-violet-200 dark:border-violet-800 p-4 sm:p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm">✨</span>
          <h2 className="text-sm font-semibold text-violet-700 dark:text-violet-400">Resumo Inteligente</h2>
          <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/50 text-violet-500 dark:text-violet-400">
            IA
          </span>
        </div>
        <div className="flex items-center gap-2">
          {text && !loading && (
            <button
              onClick={() => { setText(null); generate() }}
              className="text-[10px] text-violet-500 dark:text-violet-400 hover:text-violet-700 cursor-pointer flex items-center gap-0.5"
              title="Regenerar"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Regenerar
            </button>
          )}
          <button
            onClick={() => setDismissed(true)}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer"
            title="Fechar"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {loading && (
        <div className="space-y-2 animate-pulse">
          <div className="h-3 bg-violet-200 dark:bg-violet-800 rounded w-full" />
          <div className="h-3 bg-violet-200 dark:bg-violet-800 rounded w-5/6" />
          <div className="h-3 bg-violet-200 dark:bg-violet-800 rounded w-4/6" />
        </div>
      )}

      {error && (
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
      )}

      {text && !loading && (
        <p className="text-xs sm:text-sm leading-relaxed text-gray-700 dark:text-gray-300">
          {text}
        </p>
      )}
    </div>
  )
}
