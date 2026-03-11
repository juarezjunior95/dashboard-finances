import { useMemo, useState } from 'react'
import { format, parse } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const BRL = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

function formatMonthLabel(month) {
  try {
    const d = parse(month, 'yyyy-MM', new Date())
    return format(d, "MMMM/yyyy", { locale: ptBR })
  } catch {
    return month
  }
}

function DeltaBadge({ value, positiveIsGood = true }) {
  if (value === 0 || isNaN(value)) return <span className="text-[10px] text-gray-400">→ 0%</span>
  const up = value > 0
  const isGood = positiveIsGood ? up : !up
  const color = isGood
    ? 'text-emerald-600 dark:text-emerald-400'
    : 'text-red-600 dark:text-red-400'
  const arrow = up ? '↑' : '↓'
  return <span className={`text-[10px] font-semibold ${color}`}>{arrow} {Math.abs(value)}%</span>
}

function SummaryRow({ label, current, previous, positiveIsGood, colorClass }) {
  const pct = previous > 0 ? Math.round(((current - previous) / previous) * 100) : 0
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-50 dark:border-gray-800/50 last:border-0">
      <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{label}</span>
      <div className="flex items-center gap-3">
        <span className="text-[10px] text-gray-400 dark:text-gray-500 tabular-nums">{BRL(previous)}</span>
        <span className="text-[10px] text-gray-300 dark:text-gray-600">→</span>
        <span className={`text-xs font-bold tabular-nums ${colorClass}`}>{BRL(current)}</span>
        <DeltaBadge value={pct} positiveIsGood={positiveIsGood} />
      </div>
    </div>
  )
}

export default function MonthlySummary({ currentMonth, snapshots, totals, realBalance, reserveTotal }) {
  const [expanded, setExpanded] = useState(false)

  const summary = useMemo(() => {
    if (!snapshots || snapshots.length < 2) return null

    const sortedSnaps = [...snapshots].sort((a, b) => a.month.localeCompare(b.month))
    const currentIdx = sortedSnaps.findIndex(s => s.month === currentMonth)

    let prevSnap
    if (currentIdx > 0) {
      prevSnap = sortedSnaps[currentIdx - 1]
    } else {
      prevSnap = sortedSnaps[sortedSnaps.length - 2]
    }

    if (!prevSnap) return null

    const prev = {
      receita: Number(prevSnap.receita) || 0,
      fixas: Number(prevSnap.fixas) || 0,
      cartao: Number(prevSnap.cartao) || 0,
      invest: Number(prevSnap.invest) || 0,
      realBalance: prevSnap.real_balance != null ? Number(prevSnap.real_balance) : null,
      reserveTotal: prevSnap.reserve_total != null ? Number(prevSnap.reserve_total) : null,
    }

    const curr = {
      receita: totals.receita || 0,
      fixas: totals.fixas || 0,
      cartao: totals.cartao || 0,
      invest: totals.invest || 0,
      realBalance: realBalance,
      reserveTotal: reserveTotal,
    }

    const prevTotal = prev.fixas + prev.cartao + prev.invest
    const currTotal = curr.fixas + curr.cartao + curr.invest
    const prevSaldo = prev.receita - prevTotal
    const currSaldo = curr.receita - currTotal

    const totalPct = prevTotal > 0 ? Math.round(((currTotal - prevTotal) / prevTotal) * 100) : 0

    let healthScore = 0
    if (currSaldo > 0) healthScore += 2
    else if (currSaldo === 0) healthScore += 1
    if (totalPct <= 0) healthScore += 1
    if (curr.invest > 0) healthScore += 1

    const health = healthScore >= 3 ? 'good' : healthScore >= 2 ? 'ok' : 'warning'

    return {
      prev,
      curr,
      prevMonth: prevSnap.month,
      prevTotal,
      currTotal,
      prevSaldo,
      currSaldo,
      totalPct,
      health,
    }
  }, [snapshots, currentMonth, totals, realBalance, reserveTotal])

  if (!summary) return null

  const healthMeta = {
    good:    { label: 'Mês saudável', cls: 'text-emerald-600 dark:text-emerald-400', icon: '✓', badge: 'bg-emerald-50 dark:bg-emerald-900/30' },
    ok:      { label: 'Mês estável', cls: 'text-blue-600 dark:text-blue-400', icon: '→', badge: 'bg-blue-50 dark:bg-blue-900/30' },
    warning: { label: 'Atenção', cls: 'text-amber-600 dark:text-amber-400', icon: '⚠️', badge: 'bg-amber-50 dark:bg-amber-900/30' },
  }
  const hm = healthMeta[summary.health]

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 sm:p-6 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm">📊</span>
          <h2 className="text-sm font-semibold text-gray-600 dark:text-gray-400">Resumo do Mês</h2>
        </div>
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${hm.cls} ${hm.badge}`}>
          {hm.icon} {hm.label}
        </span>
      </div>

      <p className="text-[10px] text-gray-400 dark:text-gray-500">
        Comparando <span className="font-medium text-gray-500 dark:text-gray-400">{formatMonthLabel(currentMonth)}</span> com{' '}
        <span className="font-medium text-gray-500 dark:text-gray-400">{formatMonthLabel(summary.prevMonth)}</span>
      </p>

      {/* Top-level KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3">
          <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase">Saldo Orçamentário</p>
          <p className={`text-sm font-bold ${summary.currSaldo >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
            {BRL(summary.currSaldo)}
          </p>
          <DeltaBadge
            value={summary.prevSaldo !== 0 ? Math.round(((summary.currSaldo - summary.prevSaldo) / Math.abs(summary.prevSaldo)) * 100) : 0}
            positiveIsGood={true}
          />
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3">
          <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase">Total de Gastos</p>
          <p className="text-sm font-bold text-red-600 dark:text-red-400">{BRL(summary.currTotal)}</p>
          <DeltaBadge value={summary.totalPct} positiveIsGood={false} />
        </div>

        {summary.curr.realBalance != null && (
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3">
            <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase">Saldo Real</p>
            <p className="text-sm font-bold text-gray-700 dark:text-gray-300">{BRL(summary.curr.realBalance)}</p>
            {summary.prev.realBalance != null && (
              <DeltaBadge
                value={summary.prev.realBalance > 0 ? Math.round(((summary.curr.realBalance - summary.prev.realBalance) / summary.prev.realBalance) * 100) : 0}
                positiveIsGood={true}
              />
            )}
          </div>
        )}
      </div>

      {/* Expandable detail */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 cursor-pointer flex items-center gap-1"
      >
        <svg className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-90' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        {expanded ? 'Ocultar detalhes' : 'Ver detalhes vs mês anterior'}
      </button>

      {expanded && (
        <div className="space-y-0.5">
          <SummaryRow label="Receita" current={summary.curr.receita} previous={summary.prev.receita}
            positiveIsGood={true} colorClass="text-emerald-600 dark:text-emerald-400" />
          <SummaryRow label="Contas Fixas" current={summary.curr.fixas} previous={summary.prev.fixas}
            positiveIsGood={false} colorClass="text-rose-600 dark:text-rose-400" />
          <SummaryRow label="Cartão" current={summary.curr.cartao} previous={summary.prev.cartao}
            positiveIsGood={false} colorClass="text-orange-600 dark:text-orange-400" />
          <SummaryRow label="Investimentos" current={summary.curr.invest} previous={summary.prev.invest}
            positiveIsGood={true} colorClass="text-indigo-600 dark:text-indigo-400" />
        </div>
      )}
    </div>
  )
}
