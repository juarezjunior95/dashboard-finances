import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { addMonths, format, startOfMonth, getDaysInMonth, getDate } from 'date-fns'
import FileImporter from './components/FileImporter'
import Dashboard from './components/Dashboard'
import DarkToggle from './components/DarkToggle'
import Login from './components/Login'
import MonthSelector from './components/MonthSelector'
import InvestmentPlanner from './components/InvestmentPlanner'
import MonthlyTrend from './components/MonthlyTrend'
import BudgetProgress from './components/BudgetProgress'
import TransactionList from './components/TransactionList'
import ConfirmModal from './components/ConfirmModal'
import Welcome from './components/Welcome'
import { SkeletonDashboardPage, SkeletonBudgetProgress, SkeletonInvestmentPlanner } from './components/Skeleton'
import { useDarkMode } from './hooks/useDarkMode'
import { useAuth } from './contexts/AuthContext'
import { getSnapshot, upsertSnapshot, listMonths, listAllSnapshots, getEffectiveIncome, deleteSnapshot } from './services/snapshotService'
import { listCategories } from './services/categoryService'
import {
  getTransactionTotals,
  getIncomeTotals,
  getExpensesByStatus,
  getPendingIncome,
  upsertTransaction,
  deleteTransactionsBySource,
  listTransactions,
  clearTransactions,
} from './services/transactionService'
import ForecastCard from './components/ForecastCard'
import SmartAlerts from './components/SmartAlerts'
import BalanceInput from './components/BalanceInput'
import CashFlowCard from './components/CashFlowCard'
import ReserveCard from './components/ReserveCard'
import EconomicIndicators from './components/EconomicIndicators'
import { forecastMonth } from './utils/forecast'
import { calculateReserveForecast } from './utils/reserveForecast'
import { fetchIndicators } from './services/bcbService'
import { useToast } from './contexts/ToastContext'

const LEGACY_KEY = 'dashboard-financas-totals'
const EMPTY = { receita: 0, fixas: 0, cartao: 0, invest: 0 }

const BRL_FMT = (v) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

function InputField({ label, name, value, onChange, color }) {
  return (
    <div>
      <label htmlFor={name} className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
        {label}
      </label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-400 dark:text-gray-500">
          R$
        </span>
        <input
          id={name}
          name={name}
          type="number"
          step="0.01"
          min="0"
          value={value || ''}
          onChange={onChange}
          placeholder="0,00"
          className={`w-full pl-9 pr-3 py-2 sm:py-2.5 rounded-xl border text-sm font-medium
            bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100
            placeholder-gray-300 dark:placeholder-gray-600
            focus:outline-none focus:ring-2 transition-shadow
            ${color}`}
        />
      </div>
    </div>
  )
}

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto" />
        <p className="text-sm text-gray-500 dark:text-gray-400">Carregando...</p>
      </div>
    </div>
  )
}

function prevMonthKey(month) {
  const date = addMonths(new Date(month + '-01'), -1)
  return format(startOfMonth(date), 'yyyy-MM')
}

export default function App() {
  const { dark, toggle } = useDarkMode()
  const { user, loading: authLoading, signOut } = useAuth()
  const { showToast } = useToast()

  const currentMonth = useMemo(() => format(new Date(), 'yyyy-MM'), [])

  const [selectedMonth, setSelectedMonth] = useState(currentMonth)
  const [totals, setTotals] = useState({ ...EMPTY })
  const [prevTotals, setPrevTotals] = useState(null)
  const [availableMonths, setAvailableMonths] = useState([])
  const [showDash, setShowDash] = useState(false)
  const [monthLoading, setMonthLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState(null)
  const [budgetAlerts, setBudgetAlerts] = useState({})
  const [confirmReset, setConfirmReset] = useState(false)
  const [userCategories, setUserCategories] = useState(null)
  const [txDetailTotals, setTxDetailTotals] = useState(null)
  const [allSnapshots, setAllSnapshots] = useState([])
  const [investPlan, setInvestPlan] = useState(null)
  const [txCount, setTxCount] = useState(0)
  const [incomeBreakdown, setIncomeBreakdown] = useState(null)
  const [expenseStatus, setExpenseStatus] = useState(null)
  const [realBalance, setRealBalance] = useState(null)
  const [realBalanceUpdatedAt, setRealBalanceUpdatedAt] = useState(null)
  const [currentSnapshot, setCurrentSnapshot] = useState(null)
  const [reserveTotal, setReserveTotal] = useState(null)
  const [reserveTransferred, setReserveTransferred] = useState(null)
  const [pendingIncome, setPendingIncome] = useState(0)
  const [indicators, setIndicators] = useState(null)

  const totalsRef = useRef(totals)
  const statusTimer = useRef(null)
  const selectedMonthRef = useRef(selectedMonth)

  useEffect(() => { totalsRef.current = totals }, [totals])
  useEffect(() => { selectedMonthRef.current = selectedMonth }, [selectedMonth])
  useEffect(() => () => { clearTimeout(statusTimer.current) }, [])

  // ── Load available months ──

  const refreshMonths = useCallback(async () => {
    try {
      const months = await listMonths()
      setAvailableMonths(months)
    } catch {
      showToast({ type: 'error', message: 'Erro ao carregar meses disponíveis.' })
    }
  }, [showToast])

  // ── Load snapshot for a given month ──

  const loadMonth = useCallback(async (month) => {
    setMonthLoading(true)
    try {
      let snap = await getSnapshot(month)

      if (!snap && month === currentMonth) {
        const legacyRaw = localStorage.getItem(LEGACY_KEY)
        if (legacyRaw) {
          try {
            const legacy = JSON.parse(legacyRaw)
            const hasSomething = Object.values(legacy).some(v => Number(v) > 0)
            if (hasSomething) {
              snap = {
                receita: Number(legacy.receita) || 0,
                fixas: Number(legacy.fixas) || 0,
                cartao: Number(legacy.cartao) || 0,
                invest: Number(legacy.invest) || 0,
              }
              await upsertSnapshot({ month, ...snap })
              localStorage.removeItem(LEGACY_KEY)
              await refreshMonths()
            }
          } catch { /* ignore corrupt legacy */ }
        }
      }

      const txTotals = await getTransactionTotals(month)
      const txs = await listTransactions(month)
      setTxCount(txs.length)

      // Load real balance and income breakdown from snapshot
      setCurrentSnapshot(snap)
      if (snap) {
        setRealBalance(snap.real_balance != null ? Number(snap.real_balance) : null)
        setRealBalanceUpdatedAt(snap.real_balance_updated_at || null)
        setReserveTotal(snap.reserve_total != null ? Number(snap.reserve_total) : null)
        setReserveTransferred(snap.reserve_transferred != null ? Number(snap.reserve_transferred) : null)
      } else {
        setRealBalance(null)
        setRealBalanceUpdatedAt(null)
        setReserveTotal(null)
        setReserveTransferred(null)
      }

      if (snap) {
        const t = {
          receita: Number(snap.receita) || 0,
          fixas: Number(snap.fixas) || 0,
          cartao: Number(snap.cartao) || 0,
          invest: Number(snap.invest) || 0,
        }

        let migrated = false
        for (const cat of ['receita', 'fixas', 'cartao', 'invest']) {
          const diff = Math.round((t[cat] - (txTotals[cat] || 0)) * 100) / 100
          if (diff > 0.01) {
            await upsertTransaction({
              month,
              category: cat,
              amount: diff,
              description: 'Saldo anterior',
              source: 'migration',
            })
            migrated = true
          }
        }

        if (migrated) {
          const newTotals = await getTransactionTotals(month)
          const count = (await listTransactions(month)).length
          setTxCount(count)
          setTotals(newTotals)
          totalsRef.current = newTotals
          setShowDash(Object.values(newTotals).some(v => v > 0))
          await upsertSnapshot({ month, ...newTotals })
        } else {
          const best = {}
          for (const cat of ['receita', 'fixas', 'cartao', 'invest']) {
            best[cat] = Math.max(t[cat], txTotals[cat] || 0)
          }
          setTotals(best)
          totalsRef.current = best
          setShowDash(Object.values(best).some(v => v > 0))
        }
      } else if (Object.values(txTotals).some(v => v > 0)) {
        setTotals(txTotals)
        totalsRef.current = txTotals
        setShowDash(true)
      } else {
        setTotals({ ...EMPTY })
        totalsRef.current = { ...EMPTY }
        setShowDash(false)
      }

      const prev = await getSnapshot(prevMonthKey(month))
      if (prev) {
        setPrevTotals({
          receita: Number(prev.receita) || 0,
          fixas: Number(prev.fixas) || 0,
          cartao: Number(prev.cartao) || 0,
          invest: Number(prev.invest) || 0,
        })
      } else {
        setPrevTotals(null)
      }
    } catch {
      setTotals({ ...EMPTY })
      setShowDash(false)
      setPrevTotals(null)
      setTxCount(0)
      setIncomeBreakdown(null)
      setExpenseStatus(null)
      setRealBalance(null)
      setRealBalanceUpdatedAt(null)
      setCurrentSnapshot(null)
      setReserveTotal(null)
      setReserveTransferred(null)
      setPendingIncome(0)
      showToast({ type: 'error', message: 'Erro ao carregar dados do mês.' })
    } finally {
      setMonthLoading(false)
    }
  }, [currentMonth, refreshMonths, showToast])

  const loadCategories = useCallback(async () => {
    try {
      const cats = await listCategories()
      setUserCategories(cats)
    } catch { /* fallback handled in service */ }
  }, [])

  const handleCategoriesChanged = useCallback((cats) => {
    setUserCategories(cats)
    loadCategories()
  }, [loadCategories])

  const loadSnapshots = useCallback(async () => {
    try {
      const snaps = await listAllSnapshots()
      setAllSnapshots(snaps)
    } catch { /* non-critical */ }
  }, [])

  const loadIncomeAndExpenseData = useCallback(async (month, cats) => {
    try {
      const categories = cats || userCategories || []
      const [incomeTotals, expStatus, pendingInc] = await Promise.all([
        getIncomeTotals(month, categories),
        getExpensesByStatus(month),
        getPendingIncome(month),
      ])
      setPendingIncome(pendingInc)
      const hasBreakdown = incomeTotals.extraordinary > 0 || incomeTotals.reserve > 0
      setIncomeBreakdown({
        recurring: incomeTotals.recurring,
        extraordinary: incomeTotals.extraordinary,
        reserve: incomeTotals.reserve,
        total: incomeTotals.recurring + incomeTotals.extraordinary + incomeTotals.reserve,
        hasBreakdown,
      })
      setExpenseStatus(expStatus)

      // Sync income breakdown to snapshot for historical reference
      if (hasBreakdown) {
        await upsertSnapshot({
          month,
          ...totalsRef.current,
          recurring_income: incomeTotals.recurring,
          extraordinary_income: incomeTotals.extraordinary,
          reserve_usage: incomeTotals.reserve,
        })
      }
    } catch { /* non-critical */ }
  }, [userCategories])

  // ── Initial load ──

  useEffect(() => {
    if (!user) return
    refreshMonths()
    loadMonth(selectedMonth)
    loadCategories()
    loadSnapshots()
    loadIncomeAndExpenseData(selectedMonth)
    
    // Buscar indicadores econômicos (não bloqueia o carregamento)
    fetchIndicators().then(setIndicators).catch(() => setIndicators(null))
    
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, selectedMonth])

  // ── Handlers ──

  const handleImport = useCallback(async () => {
    const month = selectedMonthRef.current
    setSaveStatus('saving')
    try {
      const txTotals = await getTransactionTotals(month)
      setTotals(txTotals)
      totalsRef.current = txTotals
      const hasSomething = Object.values(txTotals).some(v => v > 0)
      setShowDash(hasSomething)
      await upsertSnapshot({ month, ...txTotals })
      const months = await listMonths()
      setAvailableMonths(months)
      const txs = await listTransactions(month)
      setTxCount(txs.length)
      loadSnapshots()
      loadIncomeAndExpenseData(month)
      setSaveStatus('saved')
      clearTimeout(statusTimer.current)
      statusTimer.current = setTimeout(() => setSaveStatus(null), 2000)
    } catch {
      showToast({ type: 'error', message: 'Erro ao processar importação.' })
      setSaveStatus('error')
    }
  }, [loadSnapshots, loadIncomeAndExpenseData, showToast])

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setTotals((prev) => {
      const next = { ...prev, [name]: parseFloat(value) || 0 }
      totalsRef.current = next
      return next
    })
  }

  const ADJ_LABELS = {
    receita: 'Receita (entrada manual)',
    fixas: 'Contas fixas (ajuste manual)',
    cartao: 'Cartão (ajuste manual)',
    invest: 'Investimentos (ajuste manual)',
  }

  const handleApplyManual = useCallback(async () => {
    const month = selectedMonthRef.current
    const inputValues = totalsRef.current

    setSaveStatus('saving')
    try {
      await deleteTransactionsBySource(month, 'adjustment')
      const txTotals = await getTransactionTotals(month)

      const deltas = {}
      for (const cat of ['receita', 'fixas', 'cartao', 'invest']) {
        const diff = Math.round(((inputValues[cat] || 0) - (txTotals[cat] || 0)) * 100) / 100
        if (Math.abs(diff) >= 0.01) {
          deltas[cat] = diff
          await upsertTransaction({
            month,
            category: cat,
            amount: diff,
            description: ADJ_LABELS[cat],
            source: 'adjustment',
          })
        }
      }

      const finalTotals = await getTransactionTotals(month)
      setTotals(finalTotals)
      totalsRef.current = finalTotals
      const hasSomething = Object.values(finalTotals).some(v => v > 0)
      setShowDash(hasSomething)

      await upsertSnapshot({ month, ...finalTotals })
      const months = await listMonths()
      setAvailableMonths(months)
      const txs = await listTransactions(month)
      setTxCount(txs.length)
      loadSnapshots()
      loadIncomeAndExpenseData(month)

      const deltaEntries = Object.entries(deltas)
      if (deltaEntries.length > 0) {
        const summary = deltaEntries
          .map(([cat, d]) => `${ADJ_LABELS[cat].split(' (')[0]}: ${d > 0 ? '+' : ''}${BRL_FMT(d)}`)
          .join(', ')
        showToast({ type: 'success', message: `Ajustes aplicados: ${summary}` })
      }

      setSaveStatus('saved')
      clearTimeout(statusTimer.current)
      statusTimer.current = setTimeout(() => setSaveStatus(null), 2000)
    } catch {
      setSaveStatus('error')
      showToast({ type: 'error', message: 'Erro ao salvar ajustes.' })
    }
  }, [loadSnapshots, loadIncomeAndExpenseData, showToast])

  const handleReset = async () => {
    const month = selectedMonthRef.current
    try {
      await clearTransactions(month)
      await deleteSnapshot(month)
    } catch {
      showToast({ type: 'error', message: 'Erro ao limpar dados do mês.' })
    }
    setTotals({ ...EMPTY })
    totalsRef.current = { ...EMPTY }
    setShowDash(false)
    setSaveStatus(null)
    setTxCount(0)
    setCurrentSnapshot(null)
    setRealBalance(null)
    setRealBalanceUpdatedAt(null)
    setReserveTotal(null)
    setIncomeBreakdown(null)
    setExpenseStatus(null)
    setPendingIncome(0)
    refreshMonths()
  }

  const handleMonthChange = (month) => {
    setSaveStatus(null)
    setSelectedMonth(month)
  }

  const handleTransactionTotals = useCallback(async (newTotals) => {
    setTotals(newTotals)
    totalsRef.current = newTotals
    const hasSomething = Object.values(newTotals).some(v => v > 0)
    setShowDash(hasSomething)
    try {
      await upsertSnapshot({ month: selectedMonthRef.current, ...newTotals })
      const months = await listMonths()
      setAvailableMonths(months)
      const txs = await listTransactions(selectedMonthRef.current)
      setTxCount(txs.length)
      loadSnapshots()
      loadIncomeAndExpenseData(selectedMonthRef.current)
    } catch { /* toast handled by TransactionList */ }
  }, [loadSnapshots, loadIncomeAndExpenseData])

  const forecast = useMemo(() => {
    if (selectedMonth !== currentMonth) return null
    if (!Object.values(totals).some(v => v > 0)) return null
    const now = new Date()
    return forecastMonth({
      currentTotals: totals,
      dayOfMonth: getDate(now),
      daysInMonth: getDaysInMonth(now),
      historicalSnapshots: allSnapshots.filter(s => s.month !== currentMonth).slice(-6),
      recurringIncome: incomeBreakdown?.hasBreakdown ? incomeBreakdown.recurring : undefined,
      extraordinaryIncome: incomeBreakdown?.extraordinary,
      reserveUsage: incomeBreakdown?.reserve,
    })
  }, [totals, selectedMonth, currentMonth, allSnapshots, incomeBreakdown])

  const reserveForecast = useMemo(() => {
    if (reserveTotal == null || reserveTotal <= 0) return null

    const balanceAccount = realBalance || 0
    const expectedIncome = totals.receita || 0
    const transferred = reserveTransferred || 0
    const totalExp = (totals.fixas || 0) + (totals.cartao || 0) + (totals.invest || 0)
    const recurringInc = incomeBreakdown?.hasBreakdown ? incomeBreakdown.recurring : expectedIncome
    const essentialExp = (totals.fixas || 0) + (totals.cartao || 0)

    // availableCash includes what was already transferred from reserve
    const availableCash = balanceAccount + expectedIncome + transferred

    // remainingToPay = pendente + sem status
    const jaPago = expenseStatus?.paid || 0
    const pendente = expenseStatus?.pending || 0
    const hasPaidData = jaPago > 0 || pendente > 0
    const semStatus = Math.max(0, totalExp - jaPago - pendente)
    const remainingToPay = hasPaidData ? (pendente + semStatus) : totalExp

    return calculateReserveForecast({
      availableCash,
      remainingToPay,
      recurringIncome: recurringInc,
      essentialExpenses: essentialExp,
      reserveTotal,
      reserveTransferred: transferred,
    })
  }, [reserveTotal, reserveTransferred, realBalance, totals, expenseStatus, incomeBreakdown])

  const handleSaveReserveTotal = useCallback(async (value) => {
    const month = selectedMonthRef.current
    try {
      await upsertSnapshot({ month, ...totalsRef.current, reserve_total: value })
      setReserveTotal(value)
      showToast({ type: 'success', message: value != null ? 'Saldo da reserva atualizado.' : 'Saldo da reserva removido.' })
    } catch {
      showToast({ type: 'error', message: 'Erro ao salvar saldo da reserva.' })
    }
  }, [showToast])

  const handleSaveReserveTransferred = useCallback(async (value) => {
    const month = selectedMonthRef.current
    try {
      await upsertSnapshot({ month, ...totalsRef.current, reserve_transferred: value })
      setReserveTransferred(value)
      showToast({ type: 'success', message: value != null ? 'Transferência da reserva atualizada.' : 'Transferência removida.' })
    } catch {
      showToast({ type: 'error', message: 'Erro ao salvar transferência.' })
    }
  }, [showToast])

  const handleSaveRealBalance = useCallback(async (value) => {
    const month = selectedMonthRef.current
    try {
      await upsertSnapshot({ month, ...totalsRef.current, real_balance: value })
      setRealBalance(value)
      setRealBalanceUpdatedAt(value != null ? new Date().toISOString() : null)
      showToast({ type: 'success', message: value != null ? 'Saldo real atualizado.' : 'Saldo real removido.' })
    } catch {
      showToast({ type: 'error', message: 'Erro ao salvar saldo real.' })
    }
  }, [showToast])

  const hasValues = Object.values(totals).some((v) => v > 0)

  if (authLoading) return <LoadingScreen />
  if (!user) return <Login />

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header — sticky */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-5xl mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg sm:text-2xl font-bold text-gray-800 dark:text-gray-100 truncate">
              Dashboard de Finanças
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">
              {user.email}
            </p>
          </div>
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <MonthSelector
              selectedMonth={selectedMonth}
              onChange={handleMonthChange}
              availableMonths={availableMonths}
            />
            <DarkToggle dark={dark} onToggle={toggle} />
            {showDash && (
              <button
                onClick={() => setConfirmReset(true)}
                className="hidden sm:inline text-sm text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 transition-colors cursor-pointer"
              >
                Limpar
              </button>
            )}
            <button
              onClick={signOut}
              className="text-xs sm:text-sm font-medium text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 transition-colors cursor-pointer"
            >
              Sair
            </button>
          </div>
        </div>

        {/* Save indicator */}
        {saveStatus && (
          <div className="max-w-5xl mx-auto px-3 sm:px-4 pb-2">
            <span className={`text-[10px] sm:text-xs font-medium ${
              saveStatus === 'saving' ? 'text-amber-600 dark:text-amber-400'
                : saveStatus === 'saved' ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-red-600 dark:text-red-400'
            }`}>
              {saveStatus === 'saving' ? 'Salvando...' : saveStatus === 'saved' ? 'Salvo' : 'Erro ao salvar'}
            </span>
          </div>
        )}
      </header>

      <main className="max-w-5xl mx-auto px-3 sm:px-4 py-4 sm:py-8 space-y-4 sm:space-y-8">
        {monthLoading ? (
          <SkeletonDashboardPage />
        ) : (
          <>
            {/* Onboarding para novos usuarios */}
            {!showDash && availableMonths.length === 0 && !Object.values(totals).some(v => v > 0) && (
              <Welcome />
            )}

            {/* Alertas inteligentes */}
            {showDash && (
              <SmartAlerts
                totals={totals}
                prevTotals={prevTotals}
                budgetAlerts={budgetAlerts}
                plan={investPlan}
                forecast={forecast}
                selectedMonth={selectedMonth}
                currentMonth={currentMonth}
                historicalSnapshots={allSnapshots}
              />
            )}

            {/* Import + Manual inputs */}
            <div id="input-section" className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              {/* File Importer */}
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 sm:p-6">
                <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3 sm:mb-4">Importar arquivo</h2>
                <FileImporter onTotals={handleImport} month={selectedMonth} />
              </div>

              {/* Manual inputs */}
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 sm:p-6">
                <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3 sm:mb-4">Entrada manual</h2>

                {txCount > 0 && (
                  <p className="text-[10px] sm:text-xs text-gray-400 dark:text-gray-500 mb-3">
                    Valores baseados em {txCount} transaç{txCount === 1 ? 'ão' : 'ões'} registrada{txCount === 1 ? '' : 's'}. Alterações criam ajustes.
                  </p>
                )}

                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <InputField
                    label="Receita"
                    name="receita"
                    value={totals.receita}
                    onChange={handleInputChange}
                    color="border-emerald-200 dark:border-emerald-800 focus:ring-emerald-400"
                  />
                  <InputField
                    label="Contas Fixas"
                    name="fixas"
                    value={totals.fixas}
                    onChange={handleInputChange}
                    color="border-rose-200 dark:border-rose-800 focus:ring-rose-400"
                  />
                  <InputField
                    label="Cartão"
                    name="cartao"
                    value={totals.cartao}
                    onChange={handleInputChange}
                    color="border-orange-200 dark:border-orange-800 focus:ring-orange-400"
                  />
                  <InputField
                    label="Investimentos"
                    name="invest"
                    value={totals.invest}
                    onChange={handleInputChange}
                    color="border-indigo-200 dark:border-indigo-800 focus:ring-indigo-400"
                  />
                </div>

                <div className="mt-4 sm:mt-5 flex items-center justify-between gap-2">
                  <span className="text-xs text-gray-400 dark:text-gray-500 truncate">
                    {hasValues
                      ? `Total: ${BRL_FMT(totals.receita)} receita`
                      : 'Preencha os campos acima'}
                  </span>
                  <button
                    onClick={handleApplyManual}
                    disabled={!hasValues}
                    className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:cursor-not-allowed
                      text-white text-sm font-medium px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl transition-colors cursor-pointer shrink-0"
                  >
                    Aplicar
                  </button>
                </div>

                {/* Mobile-only reset button */}
                {showDash && (
                  <button
                    onClick={() => setConfirmReset(true)}
                    className="sm:hidden mt-3 w-full text-xs text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 transition-colors cursor-pointer text-center"
                  >
                    Limpar dados
                  </button>
                )}
              </div>
            </div>

            {/* Inputs manuais: saldo e reserva */}
            {showDash && (
              <BalanceInput
                value={realBalance}
                updatedAt={realBalanceUpdatedAt}
                onSave={handleSaveRealBalance}
                reserveTotal={reserveTotal}
                onSaveReserve={handleSaveReserveTotal}
                reserveTransferred={reserveTransferred}
                onSaveReserveTransferred={handleSaveReserveTransferred}
              />
            )}

            {/* Bloco 1: Fluxo de Caixa Real */}
            {showDash && (
              <CashFlowCard
                realBalance={realBalance}
                totalReceita={totals.receita}
                totalExpenses={(totals.fixas || 0) + (totals.cartao || 0) + (totals.invest || 0)}
                expenseStatus={expenseStatus}
                reserveTotal={reserveTotal}
                reserveTransferred={reserveTransferred}
              />
            )}

            {/* Bloco 2: Fundo de Reserva */}
            {showDash && (
              <ReserveCard forecast={reserveForecast} />
            )}

            {/* Indicadores Econômicos */}
            <EconomicIndicators 
              data={indicators} 
              investAmount={totals.invest || 0}
              reserveAmount={reserveTotal || 0}
            />

            {/* Bloco 3: Visão Orçamentária */}
            {showDash && (
              <Dashboard
                receita={totals.receita}
                fixas={totals.fixas}
                cartao={totals.cartao}
                invest={totals.invest}
                prevTotals={prevTotals}
                budgetAlerts={budgetAlerts}
                dark={dark}
                categories={userCategories}
                transactionTotals={txDetailTotals}
                incomeBreakdown={incomeBreakdown}
                expenseStatus={expenseStatus}
                realBalance={realBalance}
                realBalanceUpdatedAt={realBalanceUpdatedAt}
              />
            )}

            {/* Previsão do mês */}
            {showDash && (
              <ForecastCard
                totals={totals}
                selectedMonth={selectedMonth}
                currentMonth={currentMonth}
                historicalSnapshots={allSnapshots}
                prevTotals={prevTotals}
                incomeBreakdown={incomeBreakdown}
                realBalance={realBalance}
              />
            )}

            {/* Transações detalhadas */}
            {showDash && (
              <TransactionList
                month={selectedMonth}
                onTotalsChanged={handleTransactionTotals}
                onDetailedTotals={setTxDetailTotals}
                categories={userCategories}
              />
            )}

            {/* Evolução mensal */}
            <MonthlyTrend dark={dark} selectedMonth={selectedMonth} externalSnapshots={allSnapshots} />

            {/* Limites por categoria */}
            <BudgetProgress
              totals={totals}
              onBudgetAlerts={setBudgetAlerts}
              categories={userCategories}
              onCategoriesChanged={handleCategoriesChanged}
            />

            {/* Planejamento de Investimentos */}
            <InvestmentPlanner dark={dark} onPlanCalculated={setInvestPlan} />
          </>
        )}
      </main>

      <ConfirmModal
        open={confirmReset}
        title="Limpar dados"
        message="Tem certeza que deseja limpar todos os valores deste mês? Esta ação não pode ser desfeita."
        confirmLabel="Limpar"
        onConfirm={() => { setConfirmReset(false); handleReset() }}
        onCancel={() => setConfirmReset(false)}
      />
    </div>
  )
}
