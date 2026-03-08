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

// História 3: determinar status da categoria
function getCategoryStatus(cat, proj, dayOfMonth, prevValue, avgHistorical) {
  const { current, projected, method } = proj
  
  // Categorias lump_sum (fixas, invest): comparar com média/anterior
  if (method.startsWith('lump_') || method.startsWith('receita')) {
    const reference = avgHistorical || prevValue || 0
    if (reference === 0) return { status: 'neutral', label: 'Sem referência' }
    const pct = (current / reference) * 100
    if (pct > 120) return { status: 'warning', label: 'Acima da média' }
    if (pct > 90) return { status: 'ok', label: 'Normal' }
    return { status: 'good', label: 'Abaixo da média' }
  }
  
  // Categorias lineares (cartão): analisar ritmo
  if (dayOfMonth < 10) {
    return { status: 'neutral', label: 'Acompanhe' }
  }
  const reference = prevValue || avgHistorical || projected
  if (projected > reference * 1.2) return { status: 'warning', label: 'Acima do padrão' }
  if (projected > reference) return { status: 'attention', label: 'Atenção' }
  return { status: 'ok', label: 'Normal' }
}

const STATUS_BADGE = {
  ok: { label: '✓ Normal', cls: 'text-emerald-600 dark:text-emerald-400' },
  good: { label: '✓ Ok', cls: 'text-emerald-600 dark:text-emerald-400' },
  attention: { label: '⚠ Atenção', cls: 'text-amber-600 dark:text-amber-400' },
  warning: { label: '⚠ Acima do padrão', cls: 'text-amber-600 dark:text-amber-400' },
  neutral: { label: 'Acompanhe', cls: 'text-gray-500 dark:text-gray-400' },
}

const HEALTH_META = {
  excellent: { label: 'Excelente', cls: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500', icon: '🛡️' },
  good:      { label: 'Boa', cls: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500', icon: '✓' },
  warning:   { label: 'Atenção', cls: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500', icon: '⚠️' },
  critical:  { label: 'Crítica', cls: 'text-red-600 dark:text-red-400', bg: 'bg-red-500', icon: '🚨' },
  none:      { label: '—', cls: 'text-gray-400', bg: 'bg-gray-300', icon: '' },
}

export default function ForecastCard({ totals, selectedMonth, currentMonth, historicalSnapshots = [], prevTotals = null, incomeBreakdown = null, realBalance = null, reserveForecast = null }) {
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
      recurringIncome: incomeBreakdown?.hasBreakdown ? incomeBreakdown.recurring : undefined,
      extraordinaryIncome: incomeBreakdown?.extraordinary,
      reserveUsage: incomeBreakdown?.reserve,
    })
  }, [totals, isCurrentMonth, hasData, historicalSnapshots, currentMonth, incomeBreakdown])

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
  
  // Calcular médias históricas para cada categoria
  const historicalAvg = useMemo(() => {
    const validSnapshots = historicalSnapshots.filter(s => s.month !== currentMonth && s.month)
    if (validSnapshots.length === 0) return {}
    const avg = {}
    for (const cat of ['fixas', 'cartao', 'invest']) {
      const values = validSnapshots.map(s => Number(s[cat]) || 0).filter(v => v > 0)
      if (values.length > 0) {
        avg[cat] = Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 100) / 100
      }
    }
    return avg
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historicalSnapshots.length, currentMonth])

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

      {/* KPIs: Receita, Já gasto, Disponível, (Saldo Real) */}
      <div className={`grid gap-3 ${realBalance != null && realBalance > 0 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'}`}>
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-3">
          <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase">
            {forecast.hasRecurringBreakdown ? 'Receita Recorrente' : 'Receita'}
          </p>
          <p className="text-sm sm:text-base font-bold text-emerald-600 dark:text-emerald-400">
            {noReceita ? '—' : BRL(forecast.hasRecurringBreakdown ? forecast.recurringIncome : receitaReal)}
          </p>
          {forecast.hasRecurringBreakdown && forecast.extraordinaryIncome > 0 && (
            <p className="text-[10px] text-cyan-600 dark:text-cyan-400">+{BRL(forecast.extraordinaryIncome)} extra</p>
          )}
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
        {realBalance != null && realBalance > 0 && (
          <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/50 p-3">
            <p className="text-[10px] font-semibold text-indigo-500 dark:text-indigo-400 uppercase">Saldo Real</p>
            <p className="text-sm sm:text-base font-bold text-indigo-600 dark:text-indigo-400">
              {BRL(realBalance)}
            </p>
            <p className="text-[10px] text-gray-400 dark:text-gray-500">Conta bancária</p>
          </div>
        )}
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
                
                const prevValue = prevTotals?.[key] || null
                const avgHistValue = historicalAvg[key] || null
                const catStatus = getCategoryStatus(key, proj, dayOfMonth, prevValue, avgHistValue)
                const statusBadge = STATUS_BADGE[catStatus.status]
                const isLumpSum = proj.method.startsWith('lump_') || proj.method.startsWith('receita')
                const isLinear = proj.method.startsWith('linear_')
                
                const reference = prevValue || avgHistValue || 1

                return (
                  <div key={key} className="space-y-2 pb-3 border-b border-gray-100 dark:border-gray-800 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${meta.bg}`} />
                        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{meta.label}</span>
                      </div>
                      <span className={`text-[10px] font-semibold ${statusBadge.cls}`}>
                        {statusBadge.label}
                      </span>
                    </div>

                    {isLumpSum && (
                      <>
                        <div className="grid grid-cols-3 gap-2 text-[10px]">
                          <div>
                            <p className="text-gray-400 dark:text-gray-500 uppercase font-semibold mb-0.5">Gasto atual</p>
                            <p className="font-bold text-gray-800 dark:text-gray-100">{BRL(proj.current)}</p>
                          </div>
                          <div>
                            <p className="text-gray-400 dark:text-gray-500 uppercase font-semibold mb-0.5">Média mensal</p>
                            <p className="font-bold text-gray-800 dark:text-gray-100">
                              {avgHistValue ? BRL(avgHistValue) : '—'}
                            </p>
                          </div>
                          {prevValue !== null && (
                            <div>
                              <p className="text-gray-400 dark:text-gray-500 uppercase font-semibold mb-0.5">Mês anterior</p>
                              <p className="font-bold text-gray-800 dark:text-gray-100">{BRL(prevValue)}</p>
                            </div>
                          )}
                        </div>

                        {(avgHistValue || prevValue) && (
                          <div className="relative h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                            <div
                              className={`absolute inset-y-0 left-0 rounded-full ${meta.bg}`}
                              style={{ width: `${Math.min((proj.current / reference) * 100, 100)}%` }}
                            />
                          </div>
                        )}

                        {prevValue !== null && prevValue > 0 && (
                          <p className="text-[10px] text-gray-500 dark:text-gray-400">
                            {proj.current > prevValue 
                              ? `+${Math.round(((proj.current - prevValue) / prevValue) * 100)}% em relação ao mês anterior`
                              : `${Math.round(((proj.current - prevValue) / prevValue) * 100)}% em relação ao mês anterior`
                            }
                          </p>
                        )}
                      </>
                    )}

                    {isLinear && (
                      <>
                        <div className="grid grid-cols-3 gap-2 text-[10px]">
                          <div>
                            <p className="text-gray-400 dark:text-gray-500 uppercase font-semibold mb-0.5">Gasto atual</p>
                            <p className="font-bold text-gray-800 dark:text-gray-100">{BRL(proj.current)}</p>
                          </div>
                          <div>
                            <p className="text-gray-400 dark:text-gray-500 uppercase font-semibold mb-0.5">Ritmo diário</p>
                            <p className="font-bold text-gray-800 dark:text-gray-100">
                              {dayOfMonth > 0 ? BRL(Math.round((proj.current / dayOfMonth) * 100) / 100) : '—'}/dia
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-400 dark:text-gray-500 uppercase font-semibold mb-0.5">Projeção</p>
                            <p className="font-bold text-gray-800 dark:text-gray-100">~{BRL(proj.projected)}</p>
                          </div>
                        </div>

                        {prevValue && (
                          <div className="relative h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                            <div
                              className={`absolute inset-y-0 left-0 rounded-full ${meta.bg}`}
                              style={{ width: `${Math.min((proj.current / prevValue) * 100, 100)}%` }}
                            />
                          </div>
                        )}

                        {prevValue !== null && (
                          <p className="text-[10px] text-gray-500 dark:text-gray-400">
                            {Math.round((proj.current / prevValue) * 100)}% do mês anterior ({BRL(prevValue)})
                          </p>
                        )}

                        {dayOfMonth < 10 && (
                          <p className="text-[10px] text-gray-500 dark:text-gray-400 italic">
                            Poucos dias — projeção incerta, acompanhe nos próximos dias
                          </p>
                        )}
                        {dayOfMonth >= 10 && proj.projected > (prevValue || 0) && (
                          <p className="text-[10px] text-amber-600 dark:text-amber-400 italic">
                            ⚠ No ritmo atual, pode ultrapassar o mês anterior
                          </p>
                        )}
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* Reserve forecast section */}
      {reserveForecast && reserveForecast.reserveTotal > 0 && (
        <ReserveSection forecast={reserveForecast} />
      )}
    </div>
  )
}

function ReserveSection({ forecast }) {
  const health = HEALTH_META[forecast.reserveHealth] || HEALTH_META.none

  return (
    <div className="border-t border-gray-200 dark:border-gray-800 pt-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm">🛡️</span>
          <h3 className="text-xs sm:text-sm font-semibold text-gray-600 dark:text-gray-400">Fundo de Reserva</h3>
        </div>
        <span className={`text-[10px] sm:text-xs font-semibold ${health.cls}`}>
          {health.icon} {health.label}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-950/50 p-3">
          <p className="text-[10px] font-semibold text-violet-500 dark:text-violet-400 uppercase">Saldo Reserva</p>
          <p className="text-sm font-bold text-violet-600 dark:text-violet-400">{BRL(forecast.reserveTotal)}</p>
          <p className="text-[10px] text-gray-400 dark:text-gray-500">
            {forecast.monthsOfRunway > 0 ? `${forecast.monthsOfRunway} mes${forecast.monthsOfRunway !== 1 ? 'es' : ''} de cobertura` : '—'}
          </p>
        </div>

        <div className={`rounded-xl border p-3 ${
          forecast.needsReserve
            ? 'border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/50'
            : 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/50'
        }`}>
          <p className={`text-[10px] font-semibold uppercase ${
            forecast.needsReserve ? 'text-amber-500 dark:text-amber-400' : 'text-emerald-500 dark:text-emerald-400'
          }`}>Uso Projetado</p>
          <p className={`text-sm font-bold ${
            forecast.needsReserve ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
          }`}>
            {forecast.needsReserve ? BRL(forecast.reserveUsageForecast) : 'Nenhum'}
          </p>
          <p className="text-[10px] text-gray-400 dark:text-gray-500">
            {forecast.needsReserve ? 'Gastos > Receita' : 'Receita cobre gastos'}
          </p>
        </div>

        <div className={`rounded-xl border p-3 ${
          forecast.needsImmediateTransfer
            ? 'border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/50'
            : 'border-gray-200 dark:border-gray-800'
        }`}>
          <p className={`text-[10px] font-semibold uppercase ${
            forecast.needsImmediateTransfer ? 'text-red-500 dark:text-red-400' : 'text-gray-400 dark:text-gray-500'
          }`}>Transferir Agora</p>
          <p className={`text-sm font-bold ${
            forecast.needsImmediateTransfer ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'
          }`}>
            {forecast.needsImmediateTransfer ? BRL(forecast.immediateTransferNeeded) : '—'}
          </p>
          <p className="text-[10px] text-gray-400 dark:text-gray-500">
            {forecast.needsImmediateTransfer ? 'Para cobrir pendentes' : 'Sem necessidade'}
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-3">
          <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase">Reserva Após Uso</p>
          <p className="text-sm font-bold text-gray-700 dark:text-gray-300">{BRL(forecast.reserveAfterUsage)}</p>
          <p className="text-[10px] text-gray-400 dark:text-gray-500">Saldo projetado</p>
        </div>
      </div>

      {/* Runway bar */}
      {forecast.reserveTotal > 0 && (
        <div className="space-y-1">
          <div className="relative h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
            <div
              className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${health.bg}`}
              style={{ width: `${Math.min((forecast.monthsOfRunway / 6) * 100, 100)}%` }}
            />
            <div
              className="absolute inset-y-0 w-0.5 bg-gray-500 dark:bg-gray-300"
              style={{ left: `${(3 / 6) * 100}%` }}
              title="Ideal: 3 meses"
            />
          </div>
          <div className="flex items-center justify-between text-[10px] text-gray-400 dark:text-gray-500">
            <span>0 meses</span>
            <span>Ideal: 3 meses</span>
            <span>6+ meses</span>
          </div>
        </div>
      )}

      <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 italic">
        {forecast.message}
      </p>
    </div>
  )
}
