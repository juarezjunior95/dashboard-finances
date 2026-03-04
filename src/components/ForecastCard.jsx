import { useMemo, useState } from 'react'
import { getDaysInMonth, getDate } from 'date-fns'
import { forecastMonth } from '../utils/forecast'

const BRL = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const CONFIDENCE_BADGE = {
  high: { label: 'Alta', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300' },
  medium: { label: 'Média', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300' },
  low: { label: 'Baixa', cls: 'bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-300' },
}

const CAT_META = {
  fixas: { label: 'Contas Fixas', bg: 'bg-rose-500' },
  cartao: { label: 'Cartão', bg: 'bg-orange-500' },
  invest: { label: 'Investimentos', bg: 'bg-indigo-500' },
}

const METHOD_LABELS = {
  receita_actual: 'Receita já registrada',
  receita_historical: 'Baseado na média dos últimos meses',
  receita_none: 'Sem dados para projetar',
  lump_early_below: 'Baseado na sua média mensal',
  lump_early_above: 'Mês acima da média — usando valor atual',
  lump_mid: 'Maioria das contas já pagas',
  lump_late: 'Quase todas as contas já pagas',
  lump_no_history_early: 'Estimativa conservadora (sem histórico)',
  lump_no_history_late: 'Valor atual + margem de segurança',
  linear_pace: 'Projeção por ritmo diário',
  linear_combined: 'Combinado: ritmo atual + histórico',
}

function getCategoryConfidence(method, dayOfMonth, historyCount) {
  if (method.startsWith('lump_') && historyCount >= 3) return 'high'
  if (method.startsWith('lump_') && historyCount >= 1) return 'medium'
  if (method === 'receita_actual') return 'high'
  if (method.startsWith('linear_') && dayOfMonth < 10) return 'low'
  if (method.startsWith('linear_') && dayOfMonth < 20) return 'medium'
  if (method.startsWith('linear_') && dayOfMonth >= 20) return 'high'
  if (method.includes('no_history')) return 'low'
  return 'medium'
}

export default function ForecastCard({ totals, selectedMonth, currentMonth, historicalSnapshots = [], prevTotals = null }) {
  const [detailsOpen, setDetailsOpen] = useState(false)

  const isCurrentMonth = selectedMonth === currentMonth
  const hasData = totals && Object.values(totals).some(v => v > 0)

  const forecast = useMemo(() => {
    if (!isCurrentMonth || !hasData) return null
    const now = new Date()
    return forecastMonth({
      currentTotals: totals,
      dayOfMonth: getDate(now),
      daysInMonth: getDaysInMonth(now),
      historicalSnapshots: historicalSnapshots.filter(s => s.month !== currentMonth).slice(-6),
    })
  }, [totals, isCurrentMonth, hasData, historicalSnapshots, currentMonth])

  if (!forecast) return null

  const {
    projections, confidence, riskLevel,
    daysRemaining, dayOfMonth, daysInMonth, message,
    receitaReal, currentSaldo, currentExpenses, orcamentoDiario,
    totalExpensesProjected,
  } = forecast

  const confBadge = CONFIDENCE_BADGE[confidence]
  const receita = receitaReal || projections.receita.projected || 1
  const pctGasto = Math.min((currentExpenses / receita) * 100, 150)
  const pctProjetado = Math.min((totalExpensesProjected / receita) * 100, 150)
  const noReceita = receitaReal === 0
  const historyCount = historicalSnapshots.filter(s => s.month !== currentMonth).length

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 sm:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400">Previsão do Mês</h2>
          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold ${confBadge.cls}`}>
            {confBadge.label}
          </span>
        </div>
        <span className="text-[10px] text-gray-400 dark:text-gray-500">
          Dia {dayOfMonth} de {daysInMonth}
        </span>
      </div>

      {/* KPIs: Receita, Já gasto, Disponível */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-3">
          <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase">Receita</p>
          <p className="text-sm sm:text-base font-bold text-emerald-600 dark:text-emerald-400">
            {noReceita ? '—' : BRL(receitaReal)}
          </p>
          {noReceita && (
            <p className="text-[10px] text-gray-400 dark:text-gray-500">Sem receita</p>
          )}
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-3">
          <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase">Já gasto</p>
          <p className="text-sm sm:text-base font-bold text-gray-800 dark:text-gray-100">
            {BRL(currentExpenses)}
          </p>
          {!noReceita && (
            <p className="text-[10px] text-gray-400 dark:text-gray-500">
              {Math.round((currentExpenses / receita) * 100)}% da receita
            </p>
          )}
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-3">
          <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase">Disponível</p>
          {noReceita ? (
            <p className="text-sm sm:text-base font-bold text-gray-400">—</p>
          ) : currentSaldo >= 0 ? (
            <>
              <p className="text-sm sm:text-base font-bold text-emerald-600 dark:text-emerald-400">
                {BRL(currentSaldo)}
              </p>
              {daysRemaining > 0 && orcamentoDiario > 0 && (
                <p className="text-[10px] text-gray-400 dark:text-gray-500">
                  {BRL(orcamentoDiario)}/dia
                </p>
              )}
            </>
          ) : (
            <p className="text-sm sm:text-base font-bold text-red-600 dark:text-red-400">
              Estourou {BRL(Math.abs(currentSaldo))}
            </p>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {!noReceita && (
        <div className="space-y-1.5">
          <div className="relative h-3 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
            {pctProjetado > pctGasto && (
              <div
                className={`absolute inset-y-0 left-0 rounded-full ${pctProjetado > 100 ? 'bg-red-200 dark:bg-red-900/40' : 'bg-indigo-200 dark:bg-indigo-900/40'}`}
                style={{ width: `${Math.min(pctProjetado, 100)}%` }}
              />
            )}
            <div
              className={`absolute inset-y-0 left-0 rounded-full ${pctGasto > 100 ? 'bg-red-500' : 'bg-indigo-500'}`}
              style={{ width: `${Math.min(pctGasto, 100)}%` }}
            />
            <div
              className="absolute inset-y-0 w-0.5 bg-gray-800 dark:bg-gray-200"
              style={{ left: '100%', transform: 'translateX(-100%)' }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] text-gray-400 dark:text-gray-500">
            <span>Gasto: {BRL(currentExpenses)}</span>
            <span>Receita: {BRL(receita)}</span>
          </div>
        </div>
      )}

      {/* Days remaining bar */}
      <div className="flex items-center gap-3">
        <span className="text-[10px] text-gray-400 dark:text-gray-500 shrink-0">
          {daysRemaining} dia{daysRemaining !== 1 ? 's' : ''} restante{daysRemaining !== 1 ? 's' : ''}
        </span>
        <div className="flex-1 h-1.5 rounded-full bg-gray-100 dark:bg-gray-800">
          <div
            className="h-full rounded-full bg-indigo-500"
            style={{ width: `${(dayOfMonth / daysInMonth) * 100}%` }}
          />
        </div>
      </div>

      {/* Contextual message */}
      <p className={`text-xs sm:text-sm font-medium ${
        riskLevel === 'safe' ? 'text-emerald-600 dark:text-emerald-400'
          : riskLevel === 'attention' ? 'text-amber-600 dark:text-amber-400'
          : noReceita ? 'text-gray-500 dark:text-gray-400'
          : 'text-red-600 dark:text-red-400'
      }`}>
        {message}
      </p>

      {/* Category breakdown */}
      {!noReceita && (
        <>
          <button
            onClick={() => setDetailsOpen(o => !o)}
            className="flex items-center gap-1 text-[10px] sm:text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 cursor-pointer"
          >
            <svg className={`w-3.5 h-3.5 transition-transform ${detailsOpen ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            Detalhes por categoria
          </button>

          {detailsOpen && (
            <div className="space-y-4 pt-1">
              {Object.entries(CAT_META).map(([key, meta]) => {
                const proj = projections[key]
                if (!proj) return null
                
                const catConfidence = getCategoryConfidence(proj.method, dayOfMonth, historyCount)
                const catConfBadge = CONFIDENCE_BADGE[catConfidence]
                const prevValue = prevTotals?.[key] || null
                const reference = prevValue || (proj.projected > 0 ? proj.projected : 1)
                const pctVsPrev = prevValue ? Math.round((proj.current / prevValue) * 100) : null

                // Explicação do método
                let explanation = METHOD_LABELS[proj.method] || proj.method
                if (proj.method === 'linear_combined' && daysRemaining > 0) {
                  const dailyRate = Math.round((proj.current / dayOfMonth) * 100) / 100
                  explanation = `Ritmo atual: ${BRL(dailyRate)}/dia × ${daysRemaining} dias restantes`
                }

                return (
                  <div key={key} className="space-y-1.5 pb-3 border-b border-gray-100 dark:border-gray-800 last:border-0 last:pb-0">
                    {/* Header: Label + Confidence Badge */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${meta.bg}`} />
                        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{meta.label}</span>
                      </div>
                      <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-semibold ${catConfBadge.cls}`}>
                        {catConfBadge.label} {catConfidence === 'high' ? '✓' : catConfidence === 'low' ? '⚠' : ''}
                      </span>
                    </div>

                    {/* Values: Atual, Projetado, Mês anterior (se existir) */}
                    <div className="grid grid-cols-3 gap-2 text-[10px]">
                      <div>
                        <p className="text-gray-400 dark:text-gray-500 uppercase font-semibold mb-0.5">Atual</p>
                        <p className="font-bold text-gray-800 dark:text-gray-100">{BRL(proj.current)}</p>
                      </div>
                      <div>
                        <p className="text-gray-400 dark:text-gray-500 uppercase font-semibold mb-0.5">Projetado</p>
                        <p className="font-bold text-gray-800 dark:text-gray-100">{BRL(proj.projected)}</p>
                      </div>
                      {prevValue !== null && (
                        <div>
                          <p className="text-gray-400 dark:text-gray-500 uppercase font-semibold mb-0.5">Mês anterior</p>
                          <p className="font-bold text-gray-800 dark:text-gray-100">{BRL(prevValue)}</p>
                        </div>
                      )}
                    </div>

                    {/* Progress bar: current vs reference (prev month or projected) */}
                    <div className="relative h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                      {proj.projected > proj.current && (
                        <div
                          className={`absolute inset-y-0 left-0 rounded-full opacity-40 ${meta.bg}`}
                          style={{ width: `${Math.min((proj.projected / reference) * 100, 100)}%` }}
                        />
                      )}
                      <div
                        className={`absolute inset-y-0 left-0 rounded-full ${meta.bg}`}
                        style={{ width: `${Math.min((proj.current / reference) * 100, 100)}%` }}
                      />
                    </div>

                    {/* Progress label */}
                    {pctVsPrev !== null && (
                      <p className="text-[9px] text-gray-400 dark:text-gray-500">
                        {pctVsPrev}% do mês anterior
                      </p>
                    )}

                    {/* Method explanation */}
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 italic">
                      {explanation}
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
