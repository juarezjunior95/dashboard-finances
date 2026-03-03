import { useState } from 'react'
import { SOURCE } from '../utils/financialRules'

const COLLAPSE_KEY = 'insights_collapsed'

const STATUS_STYLES = {
  excellent: {
    border: 'border-emerald-200 dark:border-emerald-800',
    bg: 'bg-emerald-50 dark:bg-emerald-950',
    text: 'text-emerald-700 dark:text-emerald-400',
    bar: 'bg-emerald-500',
    icon: 'check',
  },
  ok: {
    border: 'border-blue-200 dark:border-blue-800',
    bg: 'bg-blue-50 dark:bg-blue-950',
    text: 'text-blue-700 dark:text-blue-400',
    bar: 'bg-blue-500',
    icon: 'check',
  },
  warning: {
    border: 'border-amber-200 dark:border-amber-800',
    bg: 'bg-amber-50 dark:bg-amber-950',
    text: 'text-amber-700 dark:text-amber-400',
    bar: 'bg-amber-500',
    icon: 'alert',
  },
  danger: {
    border: 'border-red-200 dark:border-red-800',
    bg: 'bg-red-50 dark:bg-red-950',
    text: 'text-red-700 dark:text-red-400',
    bar: 'bg-red-500',
    icon: 'danger',
  },
}

const SCORE_STYLES = {
  healthy: {
    bg: 'bg-emerald-50 dark:bg-emerald-950',
    border: 'border-emerald-200 dark:border-emerald-800',
    text: 'text-emerald-700 dark:text-emerald-400',
    label: 'Saude Financeira: Boa',
  },
  attention: {
    bg: 'bg-amber-50 dark:bg-amber-950',
    border: 'border-amber-200 dark:border-amber-800',
    text: 'text-amber-700 dark:text-amber-400',
    label: 'Saude Financeira: Atencao',
  },
  critical: {
    bg: 'bg-red-50 dark:bg-red-950',
    border: 'border-red-200 dark:border-red-800',
    text: 'text-red-700 dark:text-red-400',
    label: 'Saude Financeira: Critica',
  },
}

function StatusIcon({ type, className = '' }) {
  if (type === 'check') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${className}`} viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
      </svg>
    )
  }
  if (type === 'alert') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${className}`} viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
      </svg>
    )
  }
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 ${className}`} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
    </svg>
  )
}

function ReferenceBar({ actual, idealPct, direction, status }) {
  const style = STATUS_STYLES[status] || STATUS_STYLES.ok
  const clampedActual = Math.min(actual, 100)
  const markerPos = Math.min(idealPct, 100)

  return (
    <div className="relative h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-visible mt-1.5 mb-1">
      {/* Filled bar */}
      <div
        className={`absolute top-0 left-0 h-full rounded-full transition-all duration-500 ${style.bar}`}
        style={{ width: `${clampedActual}%`, opacity: 0.85 }}
      />
      {/* Ideal marker */}
      <div
        className="absolute top-[-3px] w-0.5 h-[18px] bg-gray-600 dark:bg-gray-300 rounded-full"
        style={{ left: `${markerPos}%` }}
        title={`Ideal: ${direction === 'max' ? 'ate' : 'min'} ${idealPct}%`}
      />
      <div
        className="absolute top-[18px] text-[8px] font-bold text-gray-500 dark:text-gray-400 -translate-x-1/2"
        style={{ left: `${markerPos}%` }}
      >
        {idealPct}%
      </div>
    </div>
  )
}

function InsightCard({ rule }) {
  const style = STATUS_STYLES[rule.status] || STATUS_STYLES.ok

  return (
    <div className={`rounded-xl border p-3 sm:p-4 space-y-2 ${style.border} ${style.bg}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <StatusIcon type={style.icon} className={style.text} />
          <span className={`text-xs sm:text-sm font-bold ${style.text}`}>
            {rule.label}
          </span>
        </div>
        <span className={`text-xs sm:text-sm font-bold ${style.text}`}>
          {rule.actual}%
        </span>
      </div>

      <ReferenceBar
        actual={rule.actual}
        idealPct={rule.idealPct}
        direction={rule.direction}
        status={rule.status}
      />

      <p className="text-[11px] sm:text-xs text-gray-600 dark:text-gray-400 leading-relaxed pt-1">
        {rule.message}
      </p>
      <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-500 leading-relaxed italic">
        {rule.actionTip}
      </p>
    </div>
  )
}

export default function FinancialInsights({ analysis }) {
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(COLLAPSE_KEY) === 'true' } catch { return false }
  })
  const [showHelp, setShowHelp] = useState(false)

  if (!analysis || analysis.overallScore === 'empty') return null

  const toggleCollapse = () => {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem(COLLAPSE_KEY, String(next))
  }

  const scoreStyle = SCORE_STYLES[analysis.overallScore] || SCORE_STYLES.healthy

  return (
    <div className="space-y-3">
      {/* Header + overall score */}
      <div className={`rounded-2xl border p-3 sm:p-4 ${scoreStyle.bg} ${scoreStyle.border}`}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className={`text-xs sm:text-sm font-bold ${scoreStyle.text}`}>
              {scoreStyle.label}
            </span>
            <button
              onClick={() => setShowHelp(!showHelp)}
              className="shrink-0 w-4 h-4 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400
                text-[9px] font-bold flex items-center justify-center hover:bg-gray-300 dark:hover:bg-gray-600
                transition-colors cursor-pointer"
              title="O que e a regra 50-30-20?"
            >
              ?
            </button>
          </div>
          <button
            onClick={toggleCollapse}
            className="text-[10px] sm:text-xs font-medium text-gray-500 dark:text-gray-400 hover:underline cursor-pointer shrink-0"
          >
            {collapsed ? 'Expandir' : 'Recolher'}
          </button>
        </div>

        <p className={`text-[11px] sm:text-xs mt-1 ${scoreStyle.text} opacity-80`}>
          {analysis.overallMessage}
        </p>

        {/* Help tooltip */}
        {showHelp && (
          <div className="mt-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-3 space-y-2">
            <p className="text-xs font-bold text-gray-700 dark:text-gray-300">Regra 50-30-20</p>
            <p className="text-[11px] sm:text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
              Metodo criado pela economista <strong>Elizabeth Warren</strong> no livro <em>All Your Worth</em>.
              Divide a renda liquida em tres partes:
            </p>
            <ul className="text-[11px] sm:text-xs text-gray-600 dark:text-gray-400 space-y-1 pl-3">
              <li><strong>50%</strong> para necessidades (moradia, contas, transporte)</li>
              <li><strong>30%</strong> para desejos (lazer, restaurantes, compras)</li>
              <li><strong>20%</strong> para objetivos financeiros (investimentos, reserva)</li>
            </ul>
            <p className="text-[10px] text-gray-400 dark:text-gray-500">
              Fonte: {SOURCE}. Recomendado por Nubank, InfoMoney, Serasa e Banco Central.
            </p>
          </div>
        )}
      </div>

      {/* Insight cards */}
      {!collapsed && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {analysis.rules.map(rule => (
            <InsightCard key={rule.category} rule={rule} />
          ))}
        </div>
      )}
    </div>
  )
}
