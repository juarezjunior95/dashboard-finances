import { useCallback, useEffect, useMemo, useState } from 'react'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
} from 'chart.js'
import { format, parse } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { listAllSnapshots } from '../services/snapshotService'
import { useToast } from '../contexts/ToastContext'

ChartJS.register(CategoryScale, LinearScale, LineElement, PointElement, Tooltip, Legend)

const BRL = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

function formatMonthLabel(month) {
  try {
    const d = parse(month, 'yyyy-MM', new Date())
    return format(d, "MMM/yy", { locale: ptBR })
  } catch {
    return month
  }
}

function TrendBadge({ label, pctChange, positiveIsGood }) {
  const up = pctChange > 0
  const isGood = positiveIsGood ? up : !up
  const color = pctChange === 0
    ? 'text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800'
    : isGood
      ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30'
      : 'text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/30'
  const arrow = pctChange > 0 ? '↑' : pctChange < 0 ? '↓' : '→'

  return (
    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${color}`}>
      {label} {arrow} {Math.abs(pctChange)}%
    </span>
  )
}

export default function MonthlyTrend({ dark, selectedMonth }) {
  const { showToast } = useToast()
  const [snapshots, setSnapshots] = useState([])
  const [loading, setLoading] = useState(true)
  const [showTable, setShowTable] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listAllSnapshots()
      setSnapshots(data)
    } catch {
      showToast({ type: 'error', message: 'Erro ao carregar evolução mensal.' })
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => { load() }, [load])

  const recent = useMemo(() => {
    if (snapshots.length <= 1) return snapshots
    return snapshots.slice(-12)
  }, [snapshots])

  const trends = useMemo(() => {
    if (snapshots.length < 2) return []
    const last = snapshots[snapshots.length - 1]
    const prev3 = snapshots.slice(-4, -1)
    if (prev3.length === 0) return []

    const cats = [
      { key: 'receita', label: 'Receita', positiveIsGood: true },
      { key: 'fixas', label: 'Fixas', positiveIsGood: false },
      { key: 'cartao', label: 'Cartão', positiveIsGood: false },
      { key: 'invest', label: 'Invest', positiveIsGood: true },
    ]

    return cats.map(({ key, label, positiveIsGood }) => {
      const avg = prev3.reduce((s, snap) => s + (Number(snap[key]) || 0), 0) / prev3.length
      const current = Number(last[key]) || 0
      const pct = avg > 0 ? Math.round(((current - avg) / avg) * 100) : 0
      return { label, pctChange: pct, positiveIsGood }
    }).filter(t => t.pctChange !== 0)
  }, [snapshots])

  const tableAverages = useMemo(() => {
    if (recent.length === 0) return null
    const sum = { receita: 0, fixas: 0, cartao: 0, invest: 0 }
    for (const s of recent) {
      sum.receita += Number(s.receita) || 0
      sum.fixas += Number(s.fixas) || 0
      sum.cartao += Number(s.cartao) || 0
      sum.invest += Number(s.invest) || 0
    }
    const n = recent.length
    return {
      receita: sum.receita / n,
      fixas: sum.fixas / n,
      cartao: sum.cartao / n,
      invest: sum.invest / n,
      saldo: (sum.receita - sum.fixas - sum.cartao - sum.invest) / n,
    }
  }, [recent])

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 sm:p-6 space-y-3">
        <div className="h-4 w-36 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        <div className="h-[280px] md:h-[360px] bg-gray-100 dark:bg-gray-800/50 rounded-xl animate-pulse" />
      </div>
    )
  }

  if (snapshots.length < 2) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 sm:p-6">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">Evolução Mensal</h2>
        <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-8">
          Adicione dados de mais meses para ver a evolução ao longo do tempo.
        </p>
      </div>
    )
  }

  const labels = recent.map(s => formatMonthLabel(s.month))
  const textColor = dark ? '#d1d5db' : '#6b7280'
  const gridColor = dark ? 'rgba(75,85,99,0.3)' : 'rgba(209,213,219,0.5)'

  const chartData = {
    labels,
    datasets: [
      {
        label: 'Receita',
        data: recent.map(s => Number(s.receita) || 0),
        borderColor: '#10b981',
        backgroundColor: '#10b98133',
        borderWidth: 2.5,
        pointRadius: 3,
        pointHoverRadius: 5,
        tension: 0.3,
      },
      {
        label: 'Contas Fixas',
        data: recent.map(s => Number(s.fixas) || 0),
        borderColor: '#f43f5e',
        backgroundColor: '#f43f5e33',
        borderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 5,
        tension: 0.3,
      },
      {
        label: 'Cartão',
        data: recent.map(s => Number(s.cartao) || 0),
        borderColor: '#f97316',
        backgroundColor: '#f9731633',
        borderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 5,
        tension: 0.3,
      },
      {
        label: 'Investimentos',
        data: recent.map(s => Number(s.invest) || 0),
        borderColor: '#6366f1',
        backgroundColor: '#6366f133',
        borderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 5,
        tension: 0.3,
      },
      {
        label: 'Saldo',
        data: recent.map(s => {
          const r = Number(s.receita) || 0
          const f = Number(s.fixas) || 0
          const c = Number(s.cartao) || 0
          const i = Number(s.invest) || 0
          return r - f - c - i
        }),
        borderColor: '#22c55e',
        backgroundColor: '#22c55e22',
        borderWidth: 2,
        borderDash: [6, 3],
        pointRadius: 3,
        pointHoverRadius: 5,
        tension: 0.3,
      },
    ],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: textColor,
          font: { size: 11 },
          usePointStyle: true,
          pointStyleWidth: 8,
          padding: 12,
        },
      },
      tooltip: {
        backgroundColor: dark ? '#1f2937' : '#ffffff',
        titleColor: dark ? '#f3f4f6' : '#111827',
        bodyColor: dark ? '#d1d5db' : '#374151',
        borderColor: dark ? '#374151' : '#e5e7eb',
        borderWidth: 1,
        padding: 10,
        bodySpacing: 4,
        callbacks: {
          label(ctx) {
            return ` ${ctx.dataset.label}: ${BRL(ctx.parsed.y)}`
          },
        },
      },
    },
    scales: {
      x: {
        ticks: { color: textColor, font: { size: 10 } },
        grid: { color: gridColor },
      },
      y: {
        ticks: {
          color: textColor,
          font: { size: 10 },
          callback: (v) => {
            if (v >= 1000) return `R$ ${(v / 1000).toFixed(0)}k`
            return `R$ ${v}`
          },
        },
        grid: { color: gridColor },
      },
    },
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 sm:p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Evolução Mensal</h2>
        {trends.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {trends.map(t => (
              <TrendBadge key={t.label} {...t} />
            ))}
          </div>
        )}
      </div>

      {/* Chart */}
      <div className="h-[280px] md:h-[360px]">
        <Line data={chartData} options={options} />
      </div>

      {/* Collapsible table */}
      <div>
        <button onClick={() => setShowTable(s => !s)}
          className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 cursor-pointer flex items-center gap-1">
          <svg className={`w-3.5 h-3.5 transition-transform ${showTable ? 'rotate-90' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          {showTable ? 'Ocultar detalhes' : 'Ver detalhes'}
        </button>

        {showTable && (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-xs min-w-[500px]">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800 text-gray-500 dark:text-gray-400">
                  <th className="text-left py-2 font-semibold">Mês</th>
                  <th className="text-right py-2 font-semibold">Receita</th>
                  <th className="text-right py-2 font-semibold">Fixas</th>
                  <th className="text-right py-2 font-semibold">Cartão</th>
                  <th className="text-right py-2 font-semibold">Invest</th>
                  <th className="text-right py-2 font-semibold">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {recent.map(snap => {
                  const saldo = (Number(snap.receita) || 0) - (Number(snap.fixas) || 0) - (Number(snap.cartao) || 0) - (Number(snap.invest) || 0)
                  const isCurrent = snap.month === selectedMonth
                  return (
                    <tr key={snap.month}
                      className={`border-b border-gray-50 dark:border-gray-800/50 ${isCurrent ? 'bg-indigo-50/50 dark:bg-indigo-900/10' : ''}`}>
                      <td className={`py-1.5 font-medium ${isCurrent ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-700 dark:text-gray-300'}`}>
                        {formatMonthLabel(snap.month)}
                      </td>
                      <td className="py-1.5 text-right text-emerald-600 dark:text-emerald-400 tabular-nums">{BRL(snap.receita)}</td>
                      <td className="py-1.5 text-right text-rose-600 dark:text-rose-400 tabular-nums">{BRL(snap.fixas)}</td>
                      <td className="py-1.5 text-right text-orange-600 dark:text-orange-400 tabular-nums">{BRL(snap.cartao)}</td>
                      <td className="py-1.5 text-right text-indigo-600 dark:text-indigo-400 tabular-nums">{BRL(snap.invest)}</td>
                      <td className={`py-1.5 text-right font-bold tabular-nums ${saldo >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                        {BRL(saldo)}
                      </td>
                    </tr>
                  )
                })}
                {/* Averages row */}
                {tableAverages && (
                  <tr className="border-t-2 border-gray-200 dark:border-gray-700 font-bold">
                    <td className="py-2 text-gray-700 dark:text-gray-200">Média</td>
                    <td className="py-2 text-right text-emerald-600 dark:text-emerald-400 tabular-nums">{BRL(tableAverages.receita)}</td>
                    <td className="py-2 text-right text-rose-600 dark:text-rose-400 tabular-nums">{BRL(tableAverages.fixas)}</td>
                    <td className="py-2 text-right text-orange-600 dark:text-orange-400 tabular-nums">{BRL(tableAverages.cartao)}</td>
                    <td className="py-2 text-right text-indigo-600 dark:text-indigo-400 tabular-nums">{BRL(tableAverages.invest)}</td>
                    <td className={`py-2 text-right tabular-nums ${tableAverages.saldo >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                      {BRL(tableAverages.saldo)}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
