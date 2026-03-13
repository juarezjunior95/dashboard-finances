import { useCallback, useEffect, useMemo, useState } from 'react'
import { format, parse, differenceInMonths, startOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { listGoals, upsertGoal, deleteGoal, GOAL_ICONS, GOAL_COLORS } from '../services/goalsService'
import { calculateInvestmentPlan } from '../utils/calculateInvestmentPlan'
import InvestmentTrendChart from './InvestmentTrendChart'
import { useToast } from '../contexts/ToastContext'
import ConfirmModal from './ConfirmModal'

const BRL = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const ENTRIES_KEY = (id) => `goal_entries_${id}`

function getEntries(goalId) {
  try { return JSON.parse(localStorage.getItem(ENTRIES_KEY(goalId))) || [] } catch { return [] }
}
function setEntries(goalId, entries) {
  localStorage.setItem(ENTRIES_KEY(goalId), JSON.stringify(entries))
}

const COLOR_STYLES = {
  indigo:  { bg: 'bg-indigo-50 dark:bg-indigo-950/30', border: 'border-indigo-200 dark:border-indigo-800', bar: 'bg-indigo-500', text: 'text-indigo-600 dark:text-indigo-400' },
  emerald: { bg: 'bg-emerald-50 dark:bg-emerald-950/30', border: 'border-emerald-200 dark:border-emerald-800', bar: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' },
  violet:  { bg: 'bg-violet-50 dark:bg-violet-950/30', border: 'border-violet-200 dark:border-violet-800', bar: 'bg-violet-500', text: 'text-violet-600 dark:text-violet-400' },
  rose:    { bg: 'bg-rose-50 dark:bg-rose-950/30', border: 'border-rose-200 dark:border-rose-800', bar: 'bg-rose-500', text: 'text-rose-600 dark:text-rose-400' },
  amber:   { bg: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-200 dark:border-amber-800', bar: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400' },
  cyan:    { bg: 'bg-cyan-50 dark:bg-cyan-950/30', border: 'border-cyan-200 dark:border-cyan-800', bar: 'bg-cyan-500', text: 'text-cyan-600 dark:text-cyan-400' },
  blue:    { bg: 'bg-blue-50 dark:bg-blue-950/30', border: 'border-blue-200 dark:border-blue-800', bar: 'bg-blue-500', text: 'text-blue-600 dark:text-blue-400' },
  orange:  { bg: 'bg-orange-50 dark:bg-orange-950/30', border: 'border-orange-200 dark:border-orange-800', bar: 'bg-orange-500', text: 'text-orange-600 dark:text-orange-400' },
}

function GoalForm({ initial, onSave, onCancel, saving }) {
  const [form, setForm] = useState(() => ({
    name: initial?.name || '',
    target_amount: initial?.target_amount || '',
    current_amount: initial?.current_amount || '',
    deadline: initial?.deadline || '',
    icon: initial?.icon || '🎯',
    color: initial?.color || 'indigo',
  }))

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.name || !form.target_amount) return
    onSave({
      ...form,
      target_amount: Number(form.target_amount),
      current_amount: Number(form.current_amount) || 0,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 p-4 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/30">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-0.5">Nome da meta</label>
          <input name="name" value={form.name} onChange={handleChange} placeholder="Ex: Reserva de emergência"
            className="w-full px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-indigo-400 focus:outline-none" />
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-0.5">Valor alvo (R$)</label>
          <input name="target_amount" type="number" step="0.01" min="0" value={form.target_amount} onChange={handleChange} placeholder="10000"
            className="w-full px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-indigo-400 focus:outline-none" />
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-0.5">Valor atual (R$)</label>
          <input name="current_amount" type="number" step="0.01" min="0" value={form.current_amount} onChange={handleChange} placeholder="0"
            className="w-full px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-indigo-400 focus:outline-none" />
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-0.5">Prazo (mês/ano)</label>
          <input name="deadline" type="month" value={form.deadline} onChange={handleChange}
            className="w-full px-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-indigo-400 focus:outline-none" />
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div>
          <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-1">Ícone</label>
          <div className="flex gap-1">
            {GOAL_ICONS.map(ic => (
              <button key={ic} type="button" onClick={() => setForm(f => ({ ...f, icon: ic }))}
                className={`w-7 h-7 rounded-lg text-sm flex items-center justify-center cursor-pointer transition-colors ${form.icon === ic ? 'bg-indigo-100 dark:bg-indigo-900 ring-2 ring-indigo-400' : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
                {ic}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 mb-1">Cor</label>
          <div className="flex gap-1">
            {GOAL_COLORS.map(c => (
              <button key={c} type="button" onClick={() => setForm(f => ({ ...f, color: c }))}
                className={`w-7 h-7 rounded-lg cursor-pointer transition-all ${COLOR_STYLES[c].bar} ${form.color === c ? 'ring-2 ring-offset-1 ring-gray-400 dark:ring-gray-300 scale-110' : 'opacity-60 hover:opacity-100'}`} />
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <button type="submit" disabled={saving || !form.name || !form.target_amount}
          className="px-4 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed">
          {saving ? 'Salvando...' : initial ? 'Atualizar' : 'Criar meta'}
        </button>
        <button type="button" onClick={onCancel}
          className="px-4 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors cursor-pointer">
          Cancelar
        </button>
      </div>
    </form>
  )
}

function fmtMonth(key) {
  try { return format(new Date(key + '-01'), 'MMM/yy', { locale: ptBR }) } catch { return key }
}

function GoalSchedule({ goal, dark, onUpdateCurrent }) {
  const [entries, setEntriesState] = useState(() => getEntries(goal.id))
  const [actualEdits, setActualEdits] = useState({})
  const currentMonth = useMemo(() => format(startOfMonth(new Date()), 'yyyy-MM'), [])

  const plan = useMemo(() => {
    if (!goal.deadline || !goal.target_amount) return null
    return calculateInvestmentPlan({
      targetAmount: goal.target_amount,
      targetDate: goal.deadline + '-28',
      investmentsActual: entries.map(e => ({ month: e.month, amount: e.amount })),
    })
  }, [goal, entries])

  const handleActualChange = (month, raw) => setActualEdits(p => ({ ...p, [month]: raw }))

  const commitActual = useCallback((month, raw) => {
    const num = parseFloat(raw)
    let updated
    if (isNaN(num) || num <= 0) {
      updated = entries.filter(e => e.month !== month)
    } else {
      const idx = entries.findIndex(e => e.month === month)
      if (idx >= 0) {
        updated = [...entries]
        updated[idx] = { month, amount: num }
      } else {
        updated = [...entries, { month, amount: num }].sort((a, b) => a.month.localeCompare(b.month))
      }
    }
    setEntriesState(updated)
    setEntries(goal.id, updated)
    setActualEdits(p => { const n = { ...p }; delete n[month]; return n })

    const totalActual = updated.reduce((s, e) => s + e.amount, 0)
    onUpdateCurrent?.(goal.id, Math.round(totalActual * 100) / 100)
  }, [entries, goal.id, onUpdateCurrent])

  if (!plan || plan.status === 'empty') {
    return (
      <p className="text-[10px] text-gray-400 dark:text-gray-500 py-2">
        Defina um prazo para ver o cronograma.
      </p>
    )
  }

  return (
    <div className="space-y-3 pt-2 border-t border-gray-200/50 dark:border-gray-700/50">
      {/* Mini KPIs */}
      <div className="grid grid-cols-3 gap-2">
        <div className="text-center">
          <p className="text-[9px] font-semibold text-gray-400 uppercase">Atingido</p>
          <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{plan.percent.toFixed(0)}%</p>
        </div>
        <div className="text-center">
          <p className="text-[9px] font-semibold text-gray-400 uppercase">Restante</p>
          <p className="text-xs font-bold text-rose-600 dark:text-rose-400">{BRL(plan.remaining)}</p>
        </div>
        <div className="text-center">
          <p className="text-[9px] font-semibold text-gray-400 uppercase">Recomendado/mês</p>
          <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400">{BRL(plan.recommendedPerMonth)}</p>
        </div>
      </div>

      {plan.warnings?.map((w, i) => (
        <p key={i} className="text-[10px] text-amber-600 dark:text-amber-400">⚠️ {w}</p>
      ))}

      {/* Chart */}
      {plan.schedule.length > 2 && (
        <div className="h-[200px]">
          <InvestmentTrendChart schedule={plan.schedule} dark={dark} />
        </div>
      )}

      {/* Schedule table */}
      <div className="overflow-x-auto -mx-4 px-4">
        <table className="w-full min-w-[400px] text-[10px]">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700 text-gray-400">
              <th className="text-left py-1.5 px-1 font-semibold">Mês</th>
              <th className="text-right py-1.5 px-1 font-semibold">Sugerido</th>
              <th className="text-right py-1.5 px-1 font-semibold">Aportado</th>
              <th className="text-right py-1.5 px-1 font-semibold">Acumulado</th>
            </tr>
          </thead>
          <tbody>
            {plan.schedule.map(row => {
              const isCurrent = row.month === currentMonth
              const isEditing = row.month in actualEdits
              const displayVal = isEditing ? actualEdits[row.month] : (row.actual > 0 ? row.actual : '')

              return (
                <tr key={row.month} className={`border-b border-gray-50 dark:border-gray-800/50 ${isCurrent ? 'bg-indigo-50/30 dark:bg-indigo-950/20' : ''}`}>
                  <td className="py-1.5 px-1 font-medium text-gray-600 dark:text-gray-400">
                    {fmtMonth(row.month)}
                    {isCurrent && <span className="ml-1 text-[8px] text-indigo-500 font-bold">ATUAL</span>}
                  </td>
                  <td className="py-1.5 px-1 text-right text-gray-400">{row.recommended > 0 ? BRL(row.recommended) : '—'}</td>
                  <td className="py-1.5 px-1 text-right">
                    <input
                      type="number" step="0.01" min="0"
                      value={displayVal} placeholder="0"
                      onChange={e => handleActualChange(row.month, e.target.value)}
                      onBlur={() => { if (row.month in actualEdits) commitActual(row.month, actualEdits[row.month]) }}
                      className={`w-20 px-1.5 py-0.5 text-[10px] text-right rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:ring-1 focus:ring-indigo-400 focus:outline-none ${
                        row.actual > 0 && !isEditing ? 'font-bold text-indigo-600 dark:text-indigo-400' : ''
                      }`}
                    />
                  </td>
                  <td className="py-1.5 px-1 text-right text-gray-500 dark:text-gray-400">{BRL(row.projectedTotal)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function GoalCard({ goal, onEdit, onDelete, onQuickUpdate, dark }) {
  const [editAmount, setEditAmount] = useState(false)
  const [amount, setAmount] = useState('')
  const [showSchedule, setShowSchedule] = useState(false)
  const colors = COLOR_STYLES[goal.color] || COLOR_STYLES.indigo
  const pct = goal.target_amount > 0 ? Math.min(100, Math.round((goal.current_amount / goal.target_amount) * 100)) : 0
  const remaining = Math.max(0, goal.target_amount - goal.current_amount)

  const deadlineInfo = useMemo(() => {
    if (!goal.deadline) return null
    try {
      const target = parse(goal.deadline, 'yyyy-MM', new Date())
      const months = differenceInMonths(target, new Date())
      if (months <= 0) return { label: 'Prazo vencido', urgent: true, months }
      const monthlyNeeded = remaining / months
      return { label: format(target, "MMM/yyyy", { locale: ptBR }), months, monthlyNeeded, urgent: months <= 2 }
    } catch { return null }
  }, [goal.deadline, remaining])

  const handleQuickSave = () => {
    const val = Number(amount)
    if (val > 0) onQuickUpdate(goal.id, goal.current_amount + val)
    setEditAmount(false)
    setAmount('')
  }

  return (
    <div className={`rounded-xl border ${colors.border} ${colors.bg} p-4 space-y-3`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg shrink-0">{goal.icon}</span>
          <div className="min-w-0">
            <h3 className={`text-sm font-bold truncate ${colors.text}`}>{goal.name}</h3>
            {deadlineInfo && (
              <p className={`text-[10px] ${deadlineInfo.urgent ? 'text-red-500 font-semibold' : 'text-gray-400 dark:text-gray-500'}`}>
                {deadlineInfo.urgent && deadlineInfo.months <= 0 ? deadlineInfo.label : `Meta: ${deadlineInfo.label}`}
                {deadlineInfo.months > 0 && ` (${deadlineInfo.months} meses)`}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => onEdit(goal)} className="p-1 rounded hover:bg-white/50 dark:hover:bg-gray-800/50 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer" title="Editar">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
          </button>
          <button onClick={() => onDelete(goal)} className="p-1 rounded hover:bg-white/50 dark:hover:bg-gray-800/50 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors cursor-pointer" title="Excluir">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="flex items-baseline justify-between">
          <span className={`text-xs font-bold ${colors.text}`}>{BRL(goal.current_amount)}</span>
          <span className="text-[10px] text-gray-400 dark:text-gray-500">de {BRL(goal.target_amount)}</span>
        </div>
        <div className="relative h-2.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
          <div className={`absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out ${colors.bar}`} style={{ width: `${pct}%` }} />
        </div>
        <div className="flex items-center justify-between">
          <span className={`text-[10px] font-bold ${pct >= 100 ? 'text-emerald-600 dark:text-emerald-400' : colors.text}`}>{pct}%</span>
          {remaining > 0 && <span className="text-[10px] text-gray-400 dark:text-gray-500">Faltam {BRL(remaining)}</span>}
          {pct >= 100 && <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">Meta atingida!</span>}
        </div>
      </div>

      {deadlineInfo?.monthlyNeeded > 0 && remaining > 0 && (
        <p className="text-[10px] text-gray-500 dark:text-gray-400 bg-white/50 dark:bg-gray-800/50 rounded-lg px-2 py-1.5">
          Economize <span className="font-bold">{BRL(deadlineInfo.monthlyNeeded)}</span>/mês para atingir no prazo
        </p>
      )}

      {/* Actions row */}
      <div className="flex items-center gap-3 flex-wrap">
        {editAmount ? (
          <div className="flex items-center gap-2 flex-1">
            <input type="number" step="0.01" min="0" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Valor" autoFocus
              className="flex-1 px-2 py-1 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-indigo-400 focus:outline-none"
              onKeyDown={e => { if (e.key === 'Enter') handleQuickSave(); if (e.key === 'Escape') { setEditAmount(false); setAmount('') } }} />
            <button onClick={handleQuickSave} disabled={!amount || Number(amount) <= 0}
              className="px-2 py-1 text-[10px] font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed">
              Adicionar
            </button>
            <button onClick={() => { setEditAmount(false); setAmount('') }}
              className="px-2 py-1 text-[10px] font-medium text-gray-500 bg-gray-100 dark:bg-gray-800 rounded-lg transition-colors cursor-pointer">✕</button>
          </div>
        ) : (
          <>
            <button onClick={() => setEditAmount(true)}
              className={`text-[10px] font-medium ${colors.text} hover:opacity-80 cursor-pointer flex items-center gap-1`}>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Registrar progresso
            </button>
            {goal.deadline && (
              <button onClick={() => setShowSchedule(s => !s)}
                className="text-[10px] font-medium text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer flex items-center gap-1">
                <svg className={`w-3 h-3 transition-transform ${showSchedule ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                Cronograma
              </button>
            )}
          </>
        )}
      </div>

      {/* Expandable schedule */}
      {showSchedule && goal.deadline && (
        <GoalSchedule goal={goal} dark={dark} onUpdateCurrent={onQuickUpdate} />
      )}
    </div>
  )
}

export default function FinancialGoals({ onActivity, dark, onPlanCalculated }) {
  const { showToast } = useToast()
  const [goals, setGoals] = useState([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [expanded, setExpanded] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listGoals()
      setGoals(data.filter(g => g.active !== false))
    } catch {
      showToast({ type: 'error', message: 'Erro ao carregar metas.' })
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => { load() }, [load])

  // Expose plan data for SmartAlerts
  useEffect(() => {
    if (!goals.length || !onPlanCalculated) return
    const investGoal = goals.find(g => g.deadline && g.target_amount > 0 && g.current_amount < g.target_amount)
    if (!investGoal) { onPlanCalculated(null); return }
    const entries = getEntries(investGoal.id)
    const plan = calculateInvestmentPlan({
      targetAmount: investGoal.target_amount,
      targetDate: investGoal.deadline + '-28',
      investmentsActual: entries.map(e => ({ month: e.month, amount: e.amount })),
    })
    onPlanCalculated(plan)
  }, [goals, onPlanCalculated])

  const handleSave = useCallback(async (data) => {
    setSaving(true)
    try {
      const isEdit = !!editId
      await upsertGoal({ id: editId || undefined, ...data })
      await load()
      setAdding(false)
      setEditId(null)
      onActivity?.(isEdit ? `Meta "${data.name}" atualizada` : `Meta "${data.name}" criada`)
      showToast({ type: 'success', message: isEdit ? 'Meta atualizada.' : 'Meta criada!' })
    } catch {
      showToast({ type: 'error', message: 'Erro ao salvar meta.' })
    } finally {
      setSaving(false)
    }
  }, [editId, load, showToast, onActivity])

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return
    try {
      await deleteGoal(deleteTarget.id)
      await load()
      onActivity?.(`Meta "${deleteTarget.name}" removida`)
      showToast({ type: 'success', message: 'Meta removida.' })
    } catch {
      showToast({ type: 'error', message: 'Erro ao remover meta.' })
    } finally {
      setDeleteTarget(null)
    }
  }, [deleteTarget, load, showToast, onActivity])

  const handleQuickUpdate = useCallback(async (id, newAmount) => {
    try {
      const goal = goals.find(g => g.id === id)
      if (!goal) return
      await upsertGoal({ id, name: goal.name, target_amount: goal.target_amount, current_amount: newAmount, icon: goal.icon, color: goal.color, deadline: goal.deadline })
      await load()
      onActivity?.(`Progresso em "${goal.name}": ${BRL(newAmount)}`)
      showToast({ type: 'success', message: 'Progresso atualizado!' })
    } catch {
      showToast({ type: 'error', message: 'Erro ao atualizar progresso.' })
    }
  }, [goals, load, showToast, onActivity])

  const totalProgress = useMemo(() => {
    if (goals.length === 0) return null
    const totalTarget = goals.reduce((s, g) => s + (g.target_amount || 0), 0)
    const totalCurrent = goals.reduce((s, g) => s + (g.current_amount || 0), 0)
    const pct = totalTarget > 0 ? Math.round((totalCurrent / totalTarget) * 100) : 0
    const completed = goals.filter(g => g.current_amount >= g.target_amount).length
    return { totalTarget, totalCurrent, pct, completed, total: goals.length }
  }, [goals])

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 sm:p-6 space-y-3">
        <div className="h-4 w-36 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        <div className="h-20 bg-gray-100 dark:bg-gray-800/50 rounded-xl animate-pulse" />
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 sm:p-6 space-y-3">
      <div className="flex items-center justify-between">
        <button onClick={() => setExpanded(e => !e)} className="flex items-center gap-2 cursor-pointer">
          <span className="text-sm">🎯</span>
          <h2 className="text-sm font-semibold text-gray-600 dark:text-gray-400">Metas e Planejamento</h2>
          {totalProgress && (
            <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500">
              {totalProgress.completed}/{totalProgress.total} concluídas
            </span>
          )}
        </button>
        <div className="flex items-center gap-2">
          {totalProgress && (
            <span className={`text-[10px] font-bold ${totalProgress.pct >= 100 ? 'text-emerald-600 dark:text-emerald-400' : 'text-indigo-600 dark:text-indigo-400'}`}>
              {totalProgress.pct}% geral
            </span>
          )}
          <button onClick={() => { setAdding(true); setEditId(null); setExpanded(true) }}
            className="text-[10px] font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 cursor-pointer flex items-center gap-0.5">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Nova
          </button>
        </div>
      </div>

      {totalProgress && expanded && (
        <div className="space-y-1">
          <div className="relative h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
            <div className="absolute inset-y-0 left-0 rounded-full bg-indigo-500 transition-all duration-500" style={{ width: `${Math.min(totalProgress.pct, 100)}%` }} />
          </div>
        </div>
      )}

      {expanded && (
        <>
          {adding && <GoalForm onSave={handleSave} onCancel={() => setAdding(false)} saving={saving} />}
          {editId && <GoalForm initial={goals.find(g => g.id === editId)} onSave={handleSave} onCancel={() => setEditId(null)} saving={saving} />}

          {goals.length === 0 && !adding ? (
            <div className="text-center py-6">
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">Nenhuma meta cadastrada ainda</p>
              <button onClick={() => setAdding(true)} className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 cursor-pointer">
                Criar sua primeira meta
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {goals.map(goal => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  dark={dark}
                  onEdit={(g) => { setEditId(g.id); setAdding(false) }}
                  onDelete={(g) => setDeleteTarget(g)}
                  onQuickUpdate={handleQuickUpdate}
                />
              ))}
            </div>
          )}
        </>
      )}

      <ConfirmModal open={!!deleteTarget} title="Excluir meta"
        message={`Tem certeza que deseja excluir a meta "${deleteTarget?.name}"?`}
        confirmLabel="Excluir" onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
    </div>
  )
}
