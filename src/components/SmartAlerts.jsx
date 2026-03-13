import { useCallback, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { generateAlerts } from '../utils/generateAlerts'

const DISMISSED_KEY = 'dismissed_alerts'

function getDismissed() {
  try {
    return JSON.parse(localStorage.getItem(DISMISSED_KEY) || '{}')
  } catch { return {} }
}

function setDismissed(obj) {
  localStorage.setItem(DISMISSED_KEY, JSON.stringify(obj))
}

const SEVERITY_BORDER = {
  danger: 'border-l-red-500',
  warning: 'border-l-amber-500',
  success: 'border-l-emerald-500',
  info: 'border-l-blue-500',
}

const SEVERITY_BG = {
  danger: 'bg-red-50 dark:bg-red-950/40',
  warning: 'bg-amber-50 dark:bg-amber-950/40',
  success: 'bg-emerald-50 dark:bg-emerald-950/40',
  info: 'bg-blue-50 dark:bg-blue-950/40',
}

export default function SmartAlerts({
  totals,
  prevTotals,
  budgetAlerts,
  plan,
  forecast,
  selectedMonth,
  currentMonth,
  historicalSnapshots,
}) {
  const currentMonthKey = useMemo(() => format(new Date(), 'yyyy-MM'), [])

  const allAlerts = useMemo(() =>
    generateAlerts({
      totals,
      prevTotals,
      budgetAlerts,
      plan,
      forecast,
      selectedMonth,
      currentMonth,
      historicalSnapshots,
    }),
    [totals, prevTotals, budgetAlerts, plan, forecast, selectedMonth, currentMonth, historicalSnapshots]
  )

  const [dismissed, setDismissedState] = useState(() => {
    const stored = getDismissed()
    const cleaned = {}
    for (const [id, month] of Object.entries(stored)) {
      if (month === currentMonthKey) cleaned[id] = month
    }
    if (Object.keys(stored).length !== Object.keys(cleaned).length) {
      setDismissed(cleaned)
    }
    return cleaned
  })

  const visibleAlerts = useMemo(
    () => allAlerts.filter(a => !dismissed[a.id]),
    [allAlerts, dismissed]
  )

  const hasDanger = visibleAlerts.some(a => a.severity === 'danger')
  const [userCollapsed, setUserCollapsed] = useState(false)
  const expanded = hasDanger || !userCollapsed

  const [exiting, setExiting] = useState({})

  const handleDismiss = useCallback((id) => {
    setExiting(prev => ({ ...prev, [id]: true }))
    setTimeout(() => {
      setDismissedState(prev => {
        const next = { ...prev, [id]: currentMonthKey }
        setDismissed(next)
        return next
      })
      setExiting(prev => {
        const next = { ...prev }
        delete next[id]
        return next
      })
    }, 300)
  }, [currentMonthKey])

  if (visibleAlerts.length === 0) return null

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setUserCollapsed(c => !c)}
        className="w-full flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Alertas</span>
          <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold text-white ${
            hasDanger ? 'bg-red-500' : 'bg-amber-500'
          }`}>
            {visibleAlerts.length}
          </span>
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 dark:text-gray-500 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Alert list */}
      {expanded && (
        <div className="px-4 sm:px-6 pb-4 sm:pb-6 space-y-2">
          {visibleAlerts.map(alert => (
            <div
              key={alert.id}
              className={`
                relative rounded-xl border-l-4 p-3 sm:p-4 transition-all duration-300
                ${SEVERITY_BORDER[alert.severity]} ${SEVERITY_BG[alert.severity]}
                ${exiting[alert.id] ? 'opacity-0 -translate-x-4' : 'opacity-100 translate-x-0'}
              `}
              style={{ animation: exiting[alert.id] ? 'none' : 'slideIn 0.3s ease-out' }}
            >
              <div className="flex items-start gap-3">
                <span className="text-base sm:text-lg shrink-0 mt-0.5">{alert.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-semibold text-gray-800 dark:text-gray-100">{alert.title}</p>
                  <p className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-400 mt-0.5">{alert.message}</p>
                  {alert.action && (
                    <p className="text-[10px] sm:text-xs italic text-gray-500 dark:text-gray-500 mt-1">
                      Dica: {alert.action}
                    </p>
                  )}
                </div>
                {alert.dismissable && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDismiss(alert.id) }}
                    className="shrink-0 p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-200/50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
                    aria-label="Dispensar"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
