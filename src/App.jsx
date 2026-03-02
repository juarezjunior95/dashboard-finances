import { useCallback, useEffect, useState } from 'react'
import FileImporter from './components/FileImporter'
import Dashboard from './components/Dashboard'
import DarkToggle from './components/DarkToggle'
import Login from './components/Login'
import InvestmentTracker from './components/InvestmentTracker'
import { useDarkMode } from './hooks/useDarkMode'
import { useAuth } from './contexts/AuthContext'

const STORAGE_KEY = 'dashboard-financas-totals'
const EMPTY = { receita: 0, fixas: 0, cartao: 0, invest: 0 }

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return {
      receita: Number(parsed.receita) || 0,
      fixas: Number(parsed.fixas) || 0,
      cartao: Number(parsed.cartao) || 0,
      invest: Number(parsed.invest) || 0,
    }
  } catch {
    return null
  }
}

function saveToStorage(totals) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(totals))
}

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
          className={`w-full pl-9 pr-3 py-2.5 rounded-xl border text-sm font-medium
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

export default function App() {
  const { dark, toggle } = useDarkMode()
  const { user, loading, signOut } = useAuth()

  const [totals, setTotals] = useState(() => loadFromStorage() ?? { ...EMPTY })
  const [showDash, setShowDash] = useState(() => {
    const saved = loadFromStorage()
    return saved !== null && Object.values(saved).some((v) => v > 0)
  })

  useEffect(() => {
    saveToStorage(totals)
  }, [totals])

  const handleImport = useCallback((imported) => {
    setTotals(imported)
    setShowDash(true)
  }, [])

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setTotals((prev) => ({ ...prev, [name]: parseFloat(value) || 0 }))
  }

  const handleApplyManual = () => {
    setShowDash(true)
  }

  const handleReset = () => {
    setTotals({ ...EMPTY })
    setShowDash(false)
    localStorage.removeItem(STORAGE_KEY)
  }

  const hasValues = Object.values(totals).some((v) => v > 0)

  if (loading) return <LoadingScreen />
  if (!user) return <Login />

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-5xl mx-auto px-4 py-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Dashboard de Finanças</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {user.email}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <DarkToggle dark={dark} onToggle={toggle} />
            {showDash && (
              <button
                onClick={handleReset}
                className="text-sm text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 transition-colors cursor-pointer"
              >
                Limpar dados
              </button>
            )}
            <button
              onClick={signOut}
              className="text-sm font-medium text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 transition-colors cursor-pointer"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* Import + Manual inputs */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* File Importer */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-4">Importar arquivo</h2>
            <FileImporter onTotals={handleImport} />
          </div>

          {/* Manual inputs */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-4">Entrada manual</h2>
            <div className="grid grid-cols-2 gap-4">
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

            <div className="mt-5 flex items-center justify-between">
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {hasValues
                  ? `Total: ${BRL_FMT(totals.receita)} receita`
                  : 'Preencha os campos acima'}
              </span>
              <button
                onClick={handleApplyManual}
                disabled={!hasValues}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:cursor-not-allowed
                  text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-colors cursor-pointer"
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>

        {/* Dashboard */}
        {showDash && (
          <Dashboard
            receita={totals.receita}
            fixas={totals.fixas}
            cartao={totals.cartao}
            invest={totals.invest}
            dark={dark}
          />
        )}

        {/* Investimentos */}
        <InvestmentTracker />
      </main>
    </div>
  )
}
