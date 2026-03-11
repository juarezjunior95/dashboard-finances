import { useMemo, useState } from 'react'
import { format, parseISO, isToday, isYesterday } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { getActivityLog, ACTIVITY_META } from '../services/activityLogService'

const BRL = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

function formatTimestamp(ts) {
  try {
    const date = parseISO(ts)
    if (isToday(date)) return `Hoje, ${format(date, 'HH:mm')}`
    if (isYesterday(date)) return `Ontem, ${format(date, 'HH:mm')}`
    return format(date, "dd MMM, HH:mm", { locale: ptBR })
  } catch {
    return '—'
  }
}

const COLOR_MAP = {
  emerald: { dot: 'bg-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-950/30', text: 'text-emerald-700 dark:text-emerald-400' },
  violet:  { dot: 'bg-violet-500',  bg: 'bg-violet-50 dark:bg-violet-950/30',  text: 'text-violet-700 dark:text-violet-400' },
  rose:    { dot: 'bg-rose-500',    bg: 'bg-rose-50 dark:bg-rose-950/30',    text: 'text-rose-700 dark:text-rose-400' },
  blue:    { dot: 'bg-blue-500',    bg: 'bg-blue-50 dark:bg-blue-950/30',    text: 'text-blue-700 dark:text-blue-400' },
  indigo:  { dot: 'bg-indigo-500',  bg: 'bg-indigo-50 dark:bg-indigo-950/30',  text: 'text-indigo-700 dark:text-indigo-400' },
  amber:   { dot: 'bg-amber-500',   bg: 'bg-amber-50 dark:bg-amber-950/30',   text: 'text-amber-700 dark:text-amber-400' },
  cyan:    { dot: 'bg-cyan-500',    bg: 'bg-cyan-50 dark:bg-cyan-950/30',    text: 'text-cyan-700 dark:text-cyan-400' },
  red:     { dot: 'bg-red-500',     bg: 'bg-red-50 dark:bg-red-950/30',     text: 'text-red-700 dark:text-red-400' },
}

function DetailLine({ entry }) {
  const d = entry.details
  if (!d) return null

  if (d.value != null) {
    return <span className="text-[10px] text-gray-500 dark:text-gray-400">{BRL(d.value)}</span>
  }
  if (d.from && d.to) {
    return <span className="text-[10px] text-gray-500 dark:text-gray-400">{d.from} → {d.to}</span>
  }
  return null
}

const INITIAL_SHOW = 8

export default function ActivityLog({ month, refreshKey }) {
  const [expanded, setExpanded] = useState(false)

  const entries = useMemo(() => {
    void refreshKey
    return getActivityLog(month)
  }, [month, refreshKey])

  if (entries.length === 0) return null

  const visible = expanded ? entries : entries.slice(0, INITIAL_SHOW)
  const hasMore = entries.length > INITIAL_SHOW

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 sm:p-6 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm">📋</span>
          <h2 className="text-sm font-semibold text-gray-600 dark:text-gray-400">Histórico do Mês</h2>
        </div>
        <span className="text-[10px] text-gray-400 dark:text-gray-500">{entries.length} ações</span>
      </div>

      <div className="relative">
        <div className="absolute left-[9px] top-2 bottom-2 w-px bg-gray-200 dark:bg-gray-700" />

        <div className="space-y-1.5">
          {visible.map((entry) => {
            const meta = ACTIVITY_META[entry.type] || { icon: '•', label: entry.type, color: 'gray' }
            const colors = COLOR_MAP[meta.color] || COLOR_MAP.blue

            return (
              <div key={entry.id} className="relative flex items-start gap-3 pl-1">
                <div className={`relative z-10 w-[18px] h-[18px] rounded-full flex items-center justify-center text-[9px] shrink-0 mt-0.5 ${colors.dot} text-white`}>
                  <span>{meta.icon}</span>
                </div>

                <div className={`flex-1 rounded-lg px-3 py-1.5 ${colors.bg}`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-xs font-medium ${colors.text}`}>{entry.description}</p>
                    <span className="text-[10px] text-gray-400 dark:text-gray-500 shrink-0">
                      {formatTimestamp(entry.timestamp)}
                    </span>
                  </div>
                  <DetailLine entry={entry} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {hasMore && (
        <button
          onClick={() => setExpanded(e => !e)}
          className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 cursor-pointer flex items-center gap-1 mt-1"
        >
          <svg className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-90' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          {expanded ? 'Ver menos' : `Ver todas (${entries.length})`}
        </button>
      )}
    </div>
  )
}
