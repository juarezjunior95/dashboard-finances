import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getBudgets, upsertBudget } from '../services/budgetService'
import { useToast } from '../contexts/ToastContext'
import { SkeletonBudgetProgress } from './Skeleton'
import CategoryManager from './CategoryManager'

const BRL = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const DEFAULT_BUDGET_CATS = [
  { key: 'fixas', label: 'Contas Fixas', color: 'rose' },
  { key: 'cartao', label: 'Cartao', color: 'orange' },
  { key: 'invest', label: 'Investimentos', color: 'indigo' },
]

function barColor(pct) {
  if (pct >= 100) return 'bg-red-500'
  if (pct >= 80) return 'bg-amber-500'
  if (pct >= 60) return 'bg-yellow-400'
  return 'bg-emerald-500'
}

function alertLevel(pct) {
  if (pct >= 100) return 'exceeded'
  if (pct >= 80) return 'warning'
  return null
}

const SMALL_INPUT_CLS = `w-28 px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700
  bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 text-xs text-right
  focus:outline-none focus:ring-2 focus:ring-indigo-400`

export default function BudgetProgress({ totals, onBudgetAlerts, categories, onCategoriesChanged }) {
  const [budgets, setBudgets] = useState([])
  const [editValues, setEditValues] = useState({})
  const [loading, setLoading] = useState(true)
  const [showManager, setShowManager] = useState(false)
  const saveTimers = useRef({})
  const { showToast } = useToast()

  const budgetCats = useMemo(
    () => (categories
      ? categories.filter(c => c.parent_category !== 'receita')
      : DEFAULT_BUDGET_CATS),
    [categories]
  )

  useEffect(() => () => {
    Object.values(saveTimers.current).forEach(clearTimeout)
  }, [])

  const load = useCallback(async () => {
    try {
      const data = await getBudgets()
      setBudgets(data || [])
    } catch {
      showToast({ type: 'error', message: 'Erro ao carregar limites de orçamento.' })
    }
    finally { setLoading(false) }
  }, [showToast])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!onBudgetAlerts) return
    const alerts = {}
    for (const cat of budgetCats) {
      const budget = budgets.find(b => b.category === cat.key)
      if (!budget || !budget.limit_amount) continue
      const spent = totals[cat.key] || 0
      const pct = (spent / budget.limit_amount) * 100
      const level = alertLevel(pct)
      if (level) alerts[cat.key] = { pct, level }
    }
    onBudgetAlerts(alerts)
  }, [budgets, totals, onBudgetAlerts, budgetCats])

  const handleChange = (category, rawValue) => {
    setEditValues(prev => ({ ...prev, [category]: rawValue }))

    clearTimeout(saveTimers.current[category])
    saveTimers.current[category] = setTimeout(async () => {
      const num = rawValue === '' ? 0 : parseFloat(rawValue)
      if (isNaN(num) || num < 0) return

      try {
        await upsertBudget({ category, limit_amount: num })
        const data = await getBudgets()
        setBudgets(data || [])
      } catch {
        showToast({ type: 'error', message: 'Erro ao salvar limite. Tente novamente.' })
      }
    }, 1000)
  }

  const handleBlur = (category) => {
    clearTimeout(saveTimers.current[category])
    const raw = editValues[category]
    setEditValues(prev => { const n = { ...prev }; delete n[category]; return n })

    if (raw === undefined) return

    const num = raw === '' ? 0 : parseFloat(raw)
    if (isNaN(num) || num < 0) return

    upsertBudget({ category, limit_amount: num })
      .then(() => getBudgets())
      .then(data => setBudgets(data || []))
      .catch(() => showToast({ type: 'error', message: 'Erro ao salvar limite. Tente novamente.' }))
  }

  if (loading) return <SkeletonBudgetProgress />

  const hasAnyBudget = budgets.some(b => b.limit_amount > 0)
  const hasAnyValue = Object.values(totals).some(v => v > 0)

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400">
          Limites por Categoria
        </h2>
        <button onClick={() => setShowManager(s => !s)}
          className="text-[10px] sm:text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 cursor-pointer flex items-center gap-1">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Categorias
        </button>
      </div>

      {showManager && (
        <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
          <CategoryManager onCategoriesChanged={onCategoriesChanged} />
        </div>
      )}

      <div className="space-y-4">
        {budgetCats.map(cat => {
          const budget = budgets.find(b => b.category === cat.key)
          const limit = budget?.limit_amount || 0
          const spent = totals[cat.key] || 0
          const pct = limit > 0 ? Math.min((spent / limit) * 100, 120) : 0
          const pctReal = limit > 0 ? (spent / limit) * 100 : 0
          const level = alertLevel(pctReal)
          const isEditing = cat.key in editValues
          const inputValue = isEditing ? editValues[cat.key] : (limit || '')

          return (
            <div key={cat.key} className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">
                  {cat.icon ? `${cat.icon} ` : ''}{cat.label}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] sm:text-xs text-gray-400 dark:text-gray-500">Limite:</span>
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 dark:text-gray-500">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={inputValue}
                      onChange={(e) => handleChange(cat.key, e.target.value)}
                      onBlur={() => handleBlur(cat.key)}
                      placeholder="0"
                      className={`${SMALL_INPUT_CLS} pl-7`}
                    />
                  </div>
                </div>
              </div>

              {limit > 0 && hasAnyValue && (
                <>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${barColor(pctReal)}`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                    <span className={`text-[10px] sm:text-xs font-semibold min-w-[40px] text-right ${
                      pctReal >= 100 ? 'text-red-600 dark:text-red-400'
                        : pctReal >= 80 ? 'text-amber-600 dark:text-amber-400'
                        : 'text-gray-500 dark:text-gray-400'
                    }`}>
                      {pctReal.toFixed(0)}%
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[10px] sm:text-xs text-gray-400 dark:text-gray-500">
                    <span>{BRL(spent)} / {BRL(limit)}</span>
                    {level === 'exceeded' && (
                      <span className="text-red-600 dark:text-red-400 font-semibold">
                        Limite ultrapassado em {BRL(spent - limit)}
                      </span>
                    )}
                    {level === 'warning' && (
                      <span className="text-amber-600 dark:text-amber-400 font-semibold">
                        Proximo do limite
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>

      {!hasAnyBudget && !showManager && (
        <p className="text-[10px] sm:text-xs text-gray-400 dark:text-gray-500 text-center">
          Defina limites acima para acompanhar seus gastos por categoria.
        </p>
      )}
    </div>
  )
}
