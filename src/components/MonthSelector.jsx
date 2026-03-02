import { useMemo } from 'react'
import { addMonths, format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

function chevronLeft() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  )
}

function chevronRight() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  )
}

export default function MonthSelector({ selectedMonth, onChange, availableMonths = [] }) {
  const currentSystemMonth = useMemo(() => format(new Date(), 'yyyy-MM'), [])

  const label = useMemo(() => {
    try {
      return format(parseISO(selectedMonth + '-01'), 'MMM yyyy', { locale: ptBR })
    } catch {
      return selectedMonth
    }
  }, [selectedMonth])

  const hasPrev = true
  const hasNext = selectedMonth < currentSystemMonth

  const hasData = availableMonths.includes(selectedMonth)
  const isCurrent = selectedMonth === currentSystemMonth

  const navigate = (direction) => {
    const date = parseISO(selectedMonth + '-01')
    const next = addMonths(date, direction)
    const key = format(next, 'yyyy-MM')
    if (direction > 0 && key > currentSystemMonth) return
    onChange(key)
  }

  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      <button
        onClick={() => navigate(-1)}
        disabled={!hasPrev}
        className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800
          disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
        title="Mês anterior"
      >
        {chevronLeft()}
      </button>

      <div className="flex items-center gap-1.5 min-w-[100px] sm:min-w-[120px] justify-center">
        <span className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-200 capitalize select-none">
          {label}
        </span>
        {isCurrent && (
          <span className="text-[8px] sm:text-[9px] font-bold bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded-full leading-none">
            ATUAL
          </span>
        )}
        {hasData && !isCurrent && (
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" title="Dados salvos" />
        )}
      </div>

      <button
        onClick={() => navigate(1)}
        disabled={!hasNext}
        className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800
          disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
        title="Próximo mês"
      >
        {chevronRight()}
      </button>
    </div>
  )
}
