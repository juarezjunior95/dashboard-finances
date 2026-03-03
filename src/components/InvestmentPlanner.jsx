import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { format, parseISO, startOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { calculateInvestmentPlan } from '../utils/calculateInvestmentPlan'
import {
  getGoal,
  upsertGoal,
  listInvestments,
  upsertInvestment,
  deleteInvestment,
  checkOnline,
} from '../services/investmentService'
import InvestmentTrendChart from './InvestmentTrendChart'
import { SkeletonInvestmentPlanner } from './Skeleton'

const BRL = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const OVERRIDES_KEY = 'planner_overrides'
const LIMITS_KEY = 'planner_limits'

function fmtMonth(key) {
  try { return format(parseISO(key + '-01'), 'MMM/yy', { locale: ptBR }) }
  catch { return key }
}

// ── Sub-components ───────────────────────────────────────

function StatusBadge({ status }) {
  const map = {
    active: 'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300',
    completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300',
    overdue: 'bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-300',
  }
  const labels = { active: 'Em andamento', completed: 'Concluída', overdue: 'Atrasada' }
  return (
    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold ${map[status] || map.active}`}>
      {labels[status] || status}
    </span>
  )
}

function SaveIndicator({ status }) {
  if (!status) return null
  const map = {
    saving: 'text-amber-600 dark:text-amber-400',
    saved: 'text-emerald-600 dark:text-emerald-400',
    error: 'text-red-600 dark:text-red-400',
  }
  const text = { saving: 'Salvando...', saved: 'Salvo', error: 'Erro ao salvar' }
  return <span className={`text-[10px] sm:text-xs font-medium ${map[status]}`}>{text[status]}</span>
}

function KpiCard({ label, value, sub, className: cls }) {
  return (
    <div className={`rounded-xl border p-3 sm:p-4 ${cls}`}>
      <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wide opacity-70 mb-0.5">{label}</p>
      <p className="text-base sm:text-xl font-bold truncate">{value}</p>
      {sub && <p className="text-[10px] sm:text-xs opacity-60 mt-0.5 truncate">{sub}</p>}
    </div>
  )
}

const INPUT_CLS = `w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700
  bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 text-sm
  focus:outline-none focus:ring-2 focus:ring-indigo-400`

const SMALL_INPUT_CLS = `w-24 px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700
  bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 text-xs text-right
  focus:outline-none focus:ring-2 focus:ring-indigo-400`

// ── Main Component ───────────────────────────────────────

export default function InvestmentPlanner({ dark, onPlanCalculated }) {
  const [goal, setGoal] = useState(null)
  const [investments, setInvestments] = useState([])
  const [overrides, setOverrides] = useState(() => {
    try { return JSON.parse(localStorage.getItem(OVERRIDES_KEY)) || {} } catch { return {} }
  })
  const [limits, setLimits] = useState(() => {
    try { return JSON.parse(localStorage.getItem(LIMITS_KEY)) || { min: 0, max: 0 } } catch { return { min: 0, max: 0 } }
  })
  const [actualEdits, setActualEdits] = useState({})
  const [loading, setLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState(null)
  const [online, setOnline] = useState(true)
  const [editing, setEditing] = useState(false)

  const goalRef = useRef(goal)
  const saveTimer = useRef(null)
  const statusTimer = useRef(null)
  const actualTimers = useRef({})

  useEffect(() => { goalRef.current = goal }, [goal])
  useEffect(() => () => {
    clearTimeout(saveTimer.current)
    clearTimeout(statusTimer.current)
    Object.values(actualTimers.current).forEach(clearTimeout)
  }, [])

  // ── Load data ──

  const loadData = useCallback(async () => {
    try {
      const [g, invs, isOn] = await Promise.all([getGoal(), listInvestments(), checkOnline()])
      setGoal(g)
      setInvestments(invs || [])
      setOnline(isOn)
      if (!g) setEditing(true)
    } catch {
      setOnline(false)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // ── Derived: numeric overrides for calculator ──

  const numericOverrides = useMemo(() => {
    const result = {}
    for (const [m, v] of Object.entries(overrides)) {
      const num = parseFloat(v)
      if (!isNaN(num) && num > 0) result[m] = num
    }
    return result
  }, [overrides])

  // ── Calculated plan ──

  const currentMonth = useMemo(() => format(startOfMonth(new Date()), 'yyyy-MM'), [])

  const plan = useMemo(() => {
    if (!goal?.target_amount || !goal?.target_date) return null
    return calculateInvestmentPlan({
      targetAmount: Number(goal.target_amount),
      targetDate: goal.target_date,
      investmentsActual: investments.map(i => ({ month: i.month, amount: Number(i.amount) })),
      monthlyOverrides: numericOverrides,
      minPerMonth: Number(limits.min) || 0,
      maxPerMonth: Number(limits.max) || Infinity,
    })
  }, [goal, investments, numericOverrides, limits])

  useEffect(() => {
    onPlanCalculated?.(plan)
  }, [plan, onPlanCalculated])

  // ── Debounced goal save ──

  const scheduleSave = useCallback(() => {
    clearTimeout(saveTimer.current)
    setSaveStatus('saving')
    saveTimer.current = setTimeout(async () => {
      const g = goalRef.current
      if (!g?.target_amount || !g?.target_date) { setSaveStatus(null); return }
      try {
        await upsertGoal({
          title: g.title || 'Minha Meta',
          target_amount: Number(g.target_amount) || 0,
          target_date: g.target_date,
        })
        setSaveStatus('saved')
        clearTimeout(statusTimer.current)
        statusTimer.current = setTimeout(() => setSaveStatus(null), 2000)
      } catch {
        setSaveStatus('error')
      }
    }, 600)
  }, [])

  // ── Save status helper ──

  const flashSaved = useCallback(() => {
    setSaveStatus('saved')
    clearTimeout(statusTimer.current)
    statusTimer.current = setTimeout(() => setSaveStatus(null), 2000)
  }, [])

  // ── Handlers: goal ──

  const handleGoalField = (field, value) => {
    setGoal(prev => ({ ...prev, [field]: value }))
    scheduleSave()
  }

  const handleLimitChange = (field, value) => {
    const updated = { ...limits, [field]: value }
    setLimits(updated)
    localStorage.setItem(LIMITS_KEY, JSON.stringify(updated))
  }

  // ── Handlers: planned overrides ──

  const handleOverride = (month, rawValue) => {
    const updated = { ...overrides, [month]: rawValue }
    setOverrides(updated)
    localStorage.setItem(OVERRIDES_KEY, JSON.stringify(updated))
  }

  const handleOverrideBlur = (month) => {
    const raw = overrides[month]
    if (raw === '' || raw === undefined || raw === null) {
      const updated = { ...overrides }
      delete updated[month]
      setOverrides(updated)
      localStorage.setItem(OVERRIDES_KEY, JSON.stringify(updated))
    }
  }

  const handleRecalculate = () => {
    setOverrides({})
    localStorage.removeItem(OVERRIDES_KEY)
  }

  // ── Handlers: actual investments ──

  const handleActualChange = (month, rawValue) => {
    setActualEdits(prev => ({ ...prev, [month]: rawValue }))
  }

  const commitActual = useCallback(async (month, rawValue) => {
    const num = parseFloat(rawValue)
    const inv = investments.find(i => i.month === month)

    if (rawValue === '' || isNaN(num) || num <= 0) {
      if (inv) {
        setSaveStatus('saving')
        try {
          await deleteInvestment(inv.id)
          const invs = await listInvestments()
          setInvestments(invs || [])
          flashSaved()
        } catch { setSaveStatus('error') }
      }
    } else {
      setSaveStatus('saving')
      try {
        await upsertInvestment({ month, amount: num })
        const invs = await listInvestments()
        setInvestments(invs || [])
        flashSaved()
      } catch { setSaveStatus('error') }
    }

    setActualEdits(prev => { const n = { ...prev }; delete n[month]; return n })
  }, [investments, flashSaved])

  const handleActualBlur = (month) => {
    clearTimeout(actualTimers.current[month])
    const raw = actualEdits[month]
    if (raw === undefined) return
    commitActual(month, raw)
  }

  // ── Handlers: actions ──

  const handleApplySuggestion = async () => {
    if (!plan) return
    const entry = plan.schedule.find(s => s.month === currentMonth)
    const amount = entry?.planned || plan.recommendedPerMonth
    if (!amount || amount <= 0) return

    setSaveStatus('saving')
    try {
      await upsertInvestment({ month: currentMonth, amount })
      const invs = await listInvestments()
      setInvestments(invs || [])
      flashSaved()
    } catch {
      setSaveStatus('error')
    }
  }

  const handleCreateGoal = async (e) => {
    e.preventDefault()
    const fd = new FormData(e.target)
    const data = {
      title: fd.get('title') || 'Minha Meta',
      target_amount: Number(fd.get('target_amount')) || 0,
      target_date: fd.get('target_date'),
    }
    if (!data.target_amount || !data.target_date) return

    setSaveStatus('saving')
    try {
      const saved = await upsertGoal(data)
      setGoal(saved)
      setEditing(false)
      flashSaved()
    } catch {
      setSaveStatus('error')
    }
  }

  // ── Loading ──

  if (loading) return <SkeletonInvestmentPlanner />

  // ── Create / edit goal form ──

  if (!goal || editing) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400">
            Planejamento de Investimentos
          </h2>
          <SaveIndicator status={saveStatus} />
        </div>

        {!online && (
          <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-xl px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
            Modo offline — dados salvos localmente
          </div>
        )}

        <form onSubmit={handleCreateGoal} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Nome da meta</label>
            <input name="title" type="text" defaultValue={goal?.title || 'Minha Meta'} className={INPUT_CLS} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Valor alvo (R$)</label>
              <input name="target_amount" type="number" step="0.01" min="1" defaultValue={goal?.target_amount || ''} required className={INPUT_CLS} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Data limite</label>
              <input name="target_date" type="date" defaultValue={goal?.target_date || ''} required className={INPUT_CLS} />
            </div>
          </div>
          <button type="submit"
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium py-2.5 rounded-xl transition-colors cursor-pointer">
            {goal ? 'Atualizar meta' : 'Definir meta'}
          </button>
          {goal && (
            <button type="button" onClick={() => setEditing(false)}
              className="w-full text-xs text-gray-500 dark:text-gray-400 hover:underline cursor-pointer text-center">
              Cancelar
            </button>
          )}
        </form>
      </div>
    )
  }

  // ── Main planner ──

  const hasCurrentInvestment = investments.some(i => i.month === currentMonth)

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* ── Header card ── */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 sm:p-6 space-y-3 sm:space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 truncate">
              Planejamento de Investimentos
            </h2>
            {plan && <StatusBadge status={plan.status} />}
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <SaveIndicator status={saveStatus} />
            <button onClick={() => setEditing(true)}
              className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer">
              Editar meta
            </button>
          </div>
        </div>

        {!online && (
          <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-xl px-3 py-2 text-xs text-amber-700 dark:text-amber-400 flex items-center gap-2">
            <span>📡</span> Modo offline — dados salvos localmente
          </div>
        )}

        {/* Goal summary inline editable */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-[10px] sm:text-xs text-gray-400 dark:text-gray-500 mb-1">Meta</label>
            <input type="text" value={goal.title || ''} onChange={(e) => handleGoalField('title', e.target.value)} className={INPUT_CLS} />
          </div>
          <div>
            <label className="block text-[10px] sm:text-xs text-gray-400 dark:text-gray-500 mb-1">Valor alvo (R$)</label>
            <input type="number" step="0.01" min="1" value={goal.target_amount || ''} onChange={(e) => handleGoalField('target_amount', e.target.value)} className={INPUT_CLS} />
          </div>
          <div>
            <label className="block text-[10px] sm:text-xs text-gray-400 dark:text-gray-500 mb-1">Data limite</label>
            <input type="date" value={goal.target_date || ''} onChange={(e) => handleGoalField('target_date', e.target.value)} className={INPUT_CLS} />
          </div>
        </div>

        {/* Optional limits */}
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-[10px] sm:text-xs text-gray-400 dark:text-gray-500 mb-1">Aporte mínimo/mês</label>
            <input type="number" min="0" step="0.01" value={limits.min || ''} placeholder="0"
              onChange={(e) => handleLimitChange('min', e.target.value)} className={SMALL_INPUT_CLS} />
          </div>
          <div>
            <label className="block text-[10px] sm:text-xs text-gray-400 dark:text-gray-500 mb-1">Aporte máximo/mês</label>
            <input type="number" min="0" step="0.01" value={limits.max || ''} placeholder="sem limite"
              onChange={(e) => handleLimitChange('max', e.target.value)} className={SMALL_INPUT_CLS} />
          </div>
        </div>

        {/* Warnings */}
        {plan?.warnings?.map((w, i) => (
          <div key={i} className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-xl px-3 py-2 text-xs text-amber-700 dark:text-amber-400 flex items-center gap-2">
            <span className="shrink-0">⚠️</span> {w}
          </div>
        ))}

        {plan?.status === 'overdue' && (
          <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl px-3 py-2 text-xs text-red-700 dark:text-red-400">
            Meta atrasada! Aporte único necessário: <strong>{BRL(plan.remaining)}</strong>
          </div>
        )}
      </div>

      {/* ── KPIs ── */}
      {plan && plan.status !== 'empty' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <KpiCard
            label="Atingido"
            value={`${plan.percent.toFixed(1)}%`}
            sub={`${BRL(plan.totalReal)} de ${BRL(Number(goal.target_amount))}`}
            className="bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800"
          />
          <KpiCard
            label="Restante"
            value={BRL(plan.remaining)}
            sub={`${plan.monthsRemaining} meses restantes`}
            className="bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800"
          />
          <KpiCard
            label="Recomendado/mês"
            value={BRL(plan.recommendedPerMonth)}
            sub="aporte sugerido"
            className="bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800"
          />
          <KpiCard
            label="Próximo aporte"
            value={BRL(plan.nextMonthSuggestion)}
            sub={fmtMonth(currentMonth)}
            className="bg-indigo-50 text-indigo-800 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-800"
          />
        </div>
      )}

      {/* ── Chart ── */}
      {plan && plan.schedule.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 sm:p-6">
          <h3 className="text-xs sm:text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3 sm:mb-4">
            Evolução Mensal
          </h3>
          <InvestmentTrendChart schedule={plan.schedule} dark={dark} />
        </div>
      )}

      {/* ── Schedule table ── */}
      {plan && plan.schedule.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 sm:p-6 space-y-4">
          <h3 className="text-xs sm:text-sm font-semibold text-gray-500 dark:text-gray-400">
            Cronograma
          </h3>

          <div className="overflow-x-auto -mx-4 sm:-mx-6 px-4 sm:px-6">
            <table className="w-full min-w-[640px] text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400">
                  <th className="text-left py-2 px-2 font-semibold">Mês</th>
                  <th className="text-right py-2 px-2 font-semibold">Recomendado</th>
                  <th className="text-right py-2 px-2 font-semibold">Planejado</th>
                  <th className="text-right py-2 px-2 font-semibold">Real</th>
                  <th className="text-right py-2 px-2 font-semibold">Gap</th>
                  <th className="text-right py-2 px-2 font-semibold">Projeção</th>
                  <th className="text-right py-2 px-2 font-semibold">%</th>
                </tr>
              </thead>
              <tbody>
                {plan.schedule.map((row) => {
                  const isCurrent = row.month === currentMonth

                  /* ── Planned value for input ── */
                  const plannedDisplay = row.month in overrides
                    ? overrides[row.month]
                    : (row.planned || '')

                  /* ── Actual value for input ── */
                  const isEditingActual = row.month in actualEdits
                  const actualDisplay = isEditingActual
                    ? actualEdits[row.month]
                    : (row.actual > 0 ? row.actual : '')

                  return (
                    <tr
                      key={row.month}
                      className={`border-b border-gray-100 dark:border-gray-800 ${
                        isCurrent ? 'bg-indigo-50/50 dark:bg-indigo-950/20' : ''
                      }`}
                    >
                      {/* Mês */}
                      <td className="py-2 px-2 font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                        {fmtMonth(row.month)}
                        {isCurrent && <span className="ml-1 text-[9px] text-indigo-500 dark:text-indigo-400 font-bold">ATUAL</span>}
                      </td>

                      {/* Recomendado */}
                      <td className="py-2 px-2 text-right text-gray-400 dark:text-gray-500">
                        {row.recommended > 0 ? BRL(row.recommended) : '—'}
                      </td>

                      {/* Planejado (editável para meses futuros sem investimento real) */}
                      <td className="py-2 px-2 text-right">
                        {row.editable ? (
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={plannedDisplay}
                            onChange={(e) => handleOverride(row.month, e.target.value)}
                            onBlur={() => handleOverrideBlur(row.month)}
                            placeholder={String(row.recommended || 0)}
                            className={SMALL_INPUT_CLS}
                          />
                        ) : (
                          <span className="text-gray-600 dark:text-gray-300">
                            {row.planned > 0 ? BRL(row.planned) : '—'}
                          </span>
                        )}
                      </td>

                      {/* Real (editável — salva no blur via upsertInvestment) */}
                      <td className="py-2 px-2 text-right">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={actualDisplay}
                          onChange={(e) => handleActualChange(row.month, e.target.value)}
                          onBlur={() => handleActualBlur(row.month)}
                          placeholder="0"
                          className={`${SMALL_INPUT_CLS} ${
                            row.actual > 0 && !isEditingActual
                              ? 'font-medium text-indigo-600 dark:text-indigo-400'
                              : ''
                          }`}
                        />
                      </td>

                      {/* Gap */}
                      <td className={`py-2 px-2 text-right font-medium ${
                        row.gap > 0 ? 'text-emerald-600 dark:text-emerald-400'
                          : row.gap < 0 ? 'text-red-500 dark:text-red-400'
                          : 'text-gray-300 dark:text-gray-600'
                      }`}>
                        {row.actual > 0 && row.recommended > 0 ? BRL(row.gap) : '—'}
                      </td>

                      {/* Projeção */}
                      <td className="py-2 px-2 text-right text-gray-600 dark:text-gray-300">
                        {BRL(row.projectedTotal)}
                      </td>

                      {/* % */}
                      <td className="py-2 px-2 text-right text-gray-600 dark:text-gray-300">
                        {row.percent.toFixed(1)}%
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-3 pt-2">
            <button
              onClick={handleApplySuggestion}
              disabled={plan.status === 'completed'}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 dark:disabled:bg-gray-700
                text-white text-xs sm:text-sm font-medium px-4 py-2 rounded-xl transition-colors
                cursor-pointer disabled:cursor-not-allowed"
            >
              {hasCurrentInvestment
                ? `Atualizar ${fmtMonth(currentMonth)}`
                : `Investir ${BRL(plan.nextMonthSuggestion)} em ${fmtMonth(currentMonth)}`}
            </button>
            <button
              onClick={handleRecalculate}
              className="bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600
                text-gray-700 dark:text-gray-300 text-xs sm:text-sm font-medium px-4 py-2 rounded-xl
                transition-colors cursor-pointer"
            >
              Recalcular cronograma
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
