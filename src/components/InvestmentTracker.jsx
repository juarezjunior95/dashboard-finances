import { useCallback, useEffect, useState } from 'react'
import {
  getGoal,
  upsertGoal,
  listInvestments,
  upsertInvestment,
  deleteInvestment,
} from '../services/investmentService'

const BRL = (v) =>
  Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const MONTH_LABELS = {
  '01': 'Jan', '02': 'Fev', '03': 'Mar', '04': 'Abr',
  '05': 'Mai', '06': 'Jun', '07': 'Jul', '08': 'Ago',
  '09': 'Set', '10': 'Out', '11': 'Nov', '12': 'Dez',
}

function formatMonth(yyyymm) {
  const [year, mm] = yyyymm.split('-')
  return `${MONTH_LABELS[mm] || mm}/${year}`
}

function getCurrentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

// ── Goal Form ────────────────────────────────────────────

function GoalSection({ goal, onSaved }) {
  const [title, setTitle] = useState(goal?.title ?? 'Minha Meta')
  const [targetAmount, setTargetAmount] = useState(goal?.target_amount ?? '')
  const [targetDate, setTargetDate] = useState(goal?.target_date ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (goal) {
      setTitle(goal.title)
      setTargetAmount(goal.target_amount)
      setTargetDate(goal.target_date ?? '')
    }
  }, [goal])

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const saved = await upsertGoal({
        title,
        target_amount: parseFloat(targetAmount) || 0,
        target_date: targetDate || null,
      })
      onSaved(saved)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <div>
        <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
          Nome da meta
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700
            bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 text-sm
            focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
            Valor alvo (R$)
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={targetAmount}
            onChange={(e) => setTargetAmount(e.target.value)}
            placeholder="100000.00"
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700
              bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 text-sm
              focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
            Data limite
          </label>
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700
              bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 text-sm
              focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400
          text-white text-sm font-medium py-2.5 rounded-xl transition-colors cursor-pointer disabled:cursor-not-allowed"
      >
        {saving ? 'Salvando...' : goal ? 'Atualizar meta' : 'Definir meta'}
      </button>
    </form>
  )
}

// ── Progress Bar ─────────────────────────────────────────

function GoalProgress({ goal, totalInvested }) {
  if (!goal || !goal.target_amount) return null

  const target = Number(goal.target_amount)
  const pct = Math.min((totalInvested / target) * 100, 100)
  const remaining = Math.max(target - totalInvested, 0)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-gray-700 dark:text-gray-300">{goal.title}</span>
        <span className="text-gray-500 dark:text-gray-400">
          {pct.toFixed(1)}%
        </span>
      </div>
      <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            backgroundColor: pct >= 100 ? '#10b981' : '#6366f1',
          }}
        />
      </div>
      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
        <span>{BRL(totalInvested)} investido</span>
        <span>
          {pct >= 100
            ? 'Meta atingida!'
            : `Faltam ${BRL(remaining)}`}
        </span>
      </div>
      {goal.target_date && (
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Prazo: {new Date(goal.target_date + 'T00:00:00').toLocaleDateString('pt-BR')}
        </p>
      )}
    </div>
  )
}

// ── Add Investment Form ──────────────────────────────────

function AddInvestmentForm({ onAdded }) {
  const [month, setMonth] = useState(getCurrentMonth())
  const [amount, setAmount] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!amount || parseFloat(amount) <= 0) {
      setError('Informe um valor maior que zero.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await upsertInvestment({ month, amount: parseFloat(amount) })
      setAmount('')
      onAdded()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
      <div className="flex-1">
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700
            bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 text-sm
            focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
      </div>
      <div className="flex-1 relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-400 dark:text-gray-500">
          R$
        </span>
        <input
          type="number"
          step="0.01"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0,00"
          className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700
            bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 text-sm
            focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
      </div>
      <button
        type="submit"
        disabled={saving}
        className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400
          text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-colors
          cursor-pointer disabled:cursor-not-allowed whitespace-nowrap"
      >
        {saving ? '...' : 'Adicionar'}
      </button>
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400 sm:col-span-3">{error}</p>
      )}
    </form>
  )
}

// ── Investment List ──────────────────────────────────────

function InvestmentList({ investments, onDeleted }) {
  const [deletingId, setDeletingId] = useState(null)

  const handleDelete = async (id) => {
    setDeletingId(id)
    try {
      await deleteInvestment(id)
      onDeleted()
    } catch {
      /* error silenciado — RLS protege */
    } finally {
      setDeletingId(null)
    }
  }

  if (!investments.length) {
    return (
      <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-6">
        Nenhum investimento registrado ainda.
      </p>
    )
  }

  return (
    <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
      {investments.map((inv) => (
        <div
          key={inv.id}
          className="flex items-center justify-between bg-gray-50 dark:bg-gray-800/50 rounded-xl px-4 py-3"
        >
          <div>
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">
              {formatMonth(inv.month)}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
              {BRL(inv.amount)}
            </span>
            <button
              onClick={() => handleDelete(inv.id)}
              disabled={deletingId === inv.id}
              className="text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors cursor-pointer disabled:opacity-50"
              title="Excluir"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Main Component ───────────────────────────────────────

export default function InvestmentTracker() {
  const [goal, setGoal] = useState(null)
  const [investments, setInvestments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showGoalForm, setShowGoalForm] = useState(false)

  const totalInvested = investments.reduce((sum, i) => sum + Number(i.amount), 0)

  const loadData = useCallback(async () => {
    try {
      const [g, invs] = await Promise.all([getGoal(), listInvestments()])
      setGoal(g)
      setInvestments(invs)
      setError('')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6">
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400">
          Investimentos
        </h2>
        <button
          onClick={() => setShowGoalForm((v) => !v)}
          className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
        >
          {showGoalForm ? 'Fechar' : goal ? 'Editar meta' : 'Definir meta'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Goal form */}
      {showGoalForm && (
        <GoalSection
          goal={goal}
          onSaved={(saved) => {
            setGoal(saved)
            setShowGoalForm(false)
          }}
        />
      )}

      {/* Progress */}
      <GoalProgress goal={goal} totalInvested={totalInvested} />

      {/* Total acumulado */}
      <div className="bg-indigo-50 dark:bg-indigo-950 rounded-xl px-4 py-3 flex items-center justify-between">
        <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">
          Total acumulado
        </span>
        <span className="text-lg font-bold text-indigo-700 dark:text-indigo-300">
          {BRL(totalInvested)}
        </span>
      </div>

      {/* Add form */}
      <AddInvestmentForm onAdded={loadData} />

      {/* List */}
      <InvestmentList investments={investments} onDeleted={loadData} />
    </div>
  )
}
