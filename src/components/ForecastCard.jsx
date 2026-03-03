import { useMemo, useState } from 'react'
import { getDaysInMonth, getDate } from 'date-fns'
import { forecastMonth } from '../utils/forecast'

const BRL = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const CONFIDENCE_BADGE = {
  high: { label: 'Alta', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300' },
  medium: { label: 'Média', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300' },
  low: { label: 'Baixa', cls: 'bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-300' },
}

const RISK_COLORS = {
  safe: 'text-emerald-600 dark:text-emerald-400',
  attention: 'text-amber-600 dark:text-amber-400',
  danger: 'text-red-600 dark:text-red-400',
}

const CAT_META = {
  fixas: { label: 'Contas Fixas', bg: 'bg-rose-500', bgLight: 'bg-rose-200 dark:bg-rose-900/40' },
  cartao: { label: 'Cartão', bg: 'bg-orange-500', bgLight: 'bg-orange-200 dark:bg-orange-900/40' },
  invest: { label: 'Investimentos', bg: 'bg-indigo-500', bgLight: 'bg-indigo-200 dark:bg-indigo-900/40' },
}

function ProgressBar({ current, projected, max, label }) {
  const safeMax = max || 1
  const pctCurrent = Math.min((current / safeMax) * 100, 100)
  const pctProjected = Math.min((projected / safeMax) * 100, 150)
  const overflows = pctProjected > 100

  return (
    <div className="space-y-1">
      {label && <p className="text-[10px] text-gray-500 dark:text-gray-400">{label}</p>}
      <div className="relative h-3 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
        {pctProjected > pctCurrent && (
          <div
            className={`absolute inset-y-0 left-0 rounded-full ${overflows ? 'bg-red-300 dark:bg-red-800' : 'bg-indigo-200 dark:bg-indigo-900/60'}`}
            style={{ width: `${Math.min(pctProjected, 100)}%` }}
          />
        )}
        <div
          className={`absolute inset-y-0 left-0 rounded-full ${overflows ? 'bg-red-500' : 'bg-indigo-500'}`}
          style={{ width: `${pctCurrent}%` }}
        />
        <div
          className="absolute inset-y-0 w-0.5 bg-gray-800 dark:bg-gray-200"
          style={{ left: '100%', transform: 'translateX(-100%)' }}
        />
      </div>
    </div>
  )
}

export default function ForecastCard({ totals, selectedMonth, currentMonth, historicalSnapshots = [], budgetLimits }) {
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

  const { projections, projectedSaldo, totalExpensesProjected, confidence, riskLevel, percentUsed, percentProjected, daysRemaining, dayOfMonth, daysInMonth, message } = forecast
  const confBadge = CONFIDENCE_BADGE[confidence]
  const receita = projections.receita.projected || 1

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

      {/* Main progress bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">
          <span>Gasto atual: <strong className="text-gray-700 dark:text-gray-200">{BRL(totalExpensesProjected > 0 ? (totals.fixas || 0) + (totals.cartao || 0) + (totals.invest || 0) : 0)}</strong></span>
          <span>Projeção: <strong className="text-gray-700 dark:text-gray-200">{BRL(totalExpensesProjected)}</strong></span>
        </div>
        <ProgressBar
          current={(totals.fixas || 0) + (totals.cartao || 0) + (totals.invest || 0)}
          projected={totalExpensesProjected}
          max={projections.receita.projected}
        />
        <div className="flex justify-end">
          <span className="text-[10px] text-gray-400 dark:text-gray-500">
            Receita projetada: {BRL(projections.receita.projected)}
          </span>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-3">
          <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase">Gasto atual</p>
          <p className="text-sm sm:text-base font-bold text-gray-800 dark:text-gray-100">
            {BRL((totals.fixas || 0) + (totals.cartao || 0) + (totals.invest || 0))}
          </p>
          <p className="text-[10px] text-gray-400 dark:text-gray-500">{percentUsed}% da receita</p>
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-3">
          <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase">Projeção</p>
          <p className="text-sm sm:text-base font-bold text-gray-800 dark:text-gray-100">{BRL(totalExpensesProjected)}</p>
          <p className="text-[10px] text-gray-400 dark:text-gray-500">{percentProjected}% da receita</p>
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-3">
          <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase">Saldo projetado</p>
          <p className={`text-sm sm:text-base font-bold ${projectedSaldo >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
            {BRL(projectedSaldo)}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-3">
          <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase">Dias restantes</p>
          <p className="text-sm sm:text-base font-bold text-gray-800 dark:text-gray-100">{daysRemaining}</p>
          <div className="mt-1 h-1.5 rounded-full bg-gray-100 dark:bg-gray-800">
            <div
              className="h-full rounded-full bg-indigo-500"
              style={{ width: `${(dayOfMonth / daysInMonth) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Contextual message */}
      <p className={`text-xs sm:text-sm font-medium ${RISK_COLORS[riskLevel]}`}>
        {message}
      </p>

      {/* Category breakdown */}
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
        <div className="space-y-3 pt-1">
          {Object.entries(CAT_META).map(([key, meta]) => {
            const proj = projections[key]
            if (!proj) return null
            return (
              <div key={key} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${meta.bg}`} />
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{meta.label}</span>
                  </div>
                  <span className="text-[10px] text-gray-500 dark:text-gray-400">
                    Atual: <strong>{BRL(proj.current)}</strong> → Projetado: <strong>{BRL(proj.projected)}</strong>
                  </span>
                </div>
                <div className="relative h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                  {proj.projected > proj.current && (
                    <div
                      className={`absolute inset-y-0 left-0 rounded-full opacity-40 ${meta.bg}`}
                      style={{ width: `${Math.min((proj.projected / receita) * 100, 100)}%` }}
                    />
                  )}
                  <div
                    className={`absolute inset-y-0 left-0 rounded-full ${meta.bg}`}
                    style={{ width: `${Math.min((proj.current / receita) * 100, 100)}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
