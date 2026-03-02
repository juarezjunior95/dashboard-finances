import { useMemo } from 'react'
import {
  Chart as ChartJS,
  ArcElement,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from 'chart.js'
import { Doughnut, Bar } from 'react-chartjs-2'

ChartJS.register(ArcElement, CategoryScale, LinearScale, BarElement, Tooltip, Legend)

// ── Utils ────────────────────────────────────────────────

export function formatBRL(v) {
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function calcPercent(value, total) {
  if (!total) return '0.0'
  return ((value / total) * 100).toFixed(1)
}

// ── Constants ────────────────────────────────────────────

const LABELS = {
  fixas: 'Contas Fixas',
  cartao: 'Cartão',
  invest: 'Investimentos',
  receita: 'Receitas',
  saldo: 'Saldo Livre',
}

const COLORS = {
  fixas: { bg: '#f43f5e', light: '#fff1f2', darkLight: '#4c0519' },
  cartao: { bg: '#f97316', light: '#fff7ed', darkLight: '#431407' },
  invest: { bg: '#6366f1', light: '#eef2ff', darkLight: '#1e1b4b' },
  receita: { bg: '#10b981', light: '#ecfdf5', darkLight: '#052e16' },
  saldo: { bg: '#22c55e', light: '#f0fdf4', darkLight: '#052e16' },
}

// ── CSV Export ───────────────────────────────────────────

function exportCSV({ receita, fixas, cartao, invest }) {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const saldo = receita - fixas - cartao - invest

  const rows = [
    ['Categoria', 'Valor'],
    ['Receitas', receita.toFixed(2)],
    ['Contas Fixas', fixas.toFixed(2)],
    ['Cartão', cartao.toFixed(2)],
    ['Investimentos', invest.toFixed(2)],
    ['Saldo Livre', Math.max(saldo, 0).toFixed(2)],
  ]

  const csv = rows.map((r) => r.join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  a.download = `export_dash_${yyyy}-${mm}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ── KPI Card ─────────────────────────────────────────────

function DeltaBadge({ current, previous, invertColor = false }) {
  if (previous == null || previous === 0) return null
  const diff = current - previous
  if (diff === 0) return null
  const pct = ((diff / previous) * 100).toFixed(1)
  const up = diff > 0
  const isGood = invertColor ? !up : up
  return (
    <span className={`inline-flex items-center gap-0.5 text-[9px] sm:text-[10px] font-semibold ${
      isGood
        ? 'text-emerald-600 dark:text-emerald-400'
        : 'text-red-500 dark:text-red-400'
    }`}>
      <svg xmlns="http://www.w3.org/2000/svg" className={`h-2.5 w-2.5 ${up ? '' : 'rotate-180'}`} viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
      </svg>
      {Math.abs(pct)}%
    </span>
  )
}

function KpiCard({ label, value, percent, color, dark, prevValue, invertColor }) {
  return (
    <div
      className="rounded-2xl border p-3 sm:p-5 flex flex-col gap-0.5 sm:gap-1"
      style={{
        backgroundColor: dark ? color.darkLight : color.light,
        borderColor: `${color.bg}${dark ? '50' : '30'}`,
      }}
    >
      <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wide opacity-60 text-gray-700 dark:text-gray-300">
        {label}
      </span>
      <div className="flex items-center gap-1.5">
        <span className="text-lg sm:text-2xl font-bold" style={{ color: color.bg }}>
          {formatBRL(value)}
        </span>
        <DeltaBadge current={value} previous={prevValue} invertColor={invertColor} />
      </div>
      <span className="text-[10px] sm:text-xs font-medium" style={{ color: color.bg }}>
        {percent}% da receita
      </span>
    </div>
  )
}

// ── Dashboard ────────────────────────────────────────────

export default function Dashboard({ receita, fixas, cartao, invest, prevTotals, dark }) {
  const total = receita || 1
  const saldoReal = receita - fixas - cartao - invest
  const saldoGrafico = Math.max(saldoReal, 0)
  const gastosExcedidos = saldoReal < 0

  const pct = useMemo(
    () => ({
      fixas: calcPercent(fixas, total),
      cartao: calcPercent(cartao, total),
      invest: calcPercent(invest, total),
      receita: '100.0',
      saldo: calcPercent(saldoGrafico, total),
    }),
    [receita, fixas, cartao, invest, total, saldoGrafico],
  )

  const textColor = dark ? '#e5e7eb' : '#374151'
  const gridColor = dark ? '#374151' : '#f3f4f6'

  const doughnutData = useMemo(
    () => ({
      labels: [LABELS.fixas, LABELS.cartao, LABELS.invest, LABELS.saldo],
      datasets: [
        {
          data: [fixas, cartao, invest, saldoGrafico],
          backgroundColor: [
            COLORS.fixas.bg,
            COLORS.cartao.bg,
            COLORS.invest.bg,
            COLORS.saldo.bg,
          ],
          borderWidth: 0,
          hoverOffset: 6,
        },
      ],
    }),
    [fixas, cartao, invest, saldoGrafico],
  )

  const doughnutOpts = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      cutout: '68%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            padding: 12,
            usePointStyle: true,
            color: textColor,
            font: { size: 11 },
          },
        },
        tooltip: {
          callbacks: {
            label(ctx) {
              const value = formatBRL(ctx.raw)
              const percent = calcPercent(ctx.raw, receita)
              return ` ${ctx.label}: ${value} (${percent}%)`
            },
          },
        },
      },
    }),
    [dark, textColor, receita],
  )

  const barData = useMemo(
    () => ({
      labels: [LABELS.receita, LABELS.fixas, LABELS.cartao, LABELS.invest],
      datasets: [
        {
          data: [receita, fixas, cartao, invest],
          backgroundColor: [
            COLORS.receita.bg,
            COLORS.fixas.bg,
            COLORS.cartao.bg,
            COLORS.invest.bg,
          ],
          borderRadius: 6,
          maxBarThickness: 48,
        },
      ],
    }),
    [receita, fixas, cartao, invest],
  )

  const barOpts = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label(ctx) {
              const value = formatBRL(ctx.raw)
              const percent = calcPercent(ctx.raw, receita)
              return ` ${value} (${percent}%)`
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: (v) => `R$ ${(v / 1000).toFixed(0)}k`,
            color: textColor,
            font: { size: 10 },
          },
          grid: { color: gridColor },
        },
        x: {
          ticks: {
            color: textColor,
            font: { size: 10 },
            maxRotation: 45,
          },
          grid: { display: false },
        },
      },
    }),
    [dark, textColor, gridColor, receita],
  )

  return (
    <section className="w-full max-w-5xl mx-auto space-y-4 sm:space-y-8">
      {/* KPIs: 1col mobile → 2col tablet → 4col desktop */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <KpiCard label={LABELS.receita} value={receita} percent={pct.receita} color={COLORS.receita} dark={dark}
          prevValue={prevTotals?.receita} invertColor={false} />
        <KpiCard label={LABELS.fixas} value={fixas} percent={pct.fixas} color={COLORS.fixas} dark={dark}
          prevValue={prevTotals?.fixas} invertColor={true} />
        <KpiCard label={LABELS.cartao} value={cartao} percent={pct.cartao} color={COLORS.cartao} dark={dark}
          prevValue={prevTotals?.cartao} invertColor={true} />
        <KpiCard label={LABELS.invest} value={invest} percent={pct.invest} color={COLORS.invest} dark={dark}
          prevValue={prevTotals?.invest} invertColor={false} />
      </div>

      {/* Saldo */}
      <div
        className={`rounded-2xl px-4 sm:px-6 py-3 sm:py-4 text-center font-bold text-base sm:text-lg ${
          saldoReal >= 0
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800'
            : 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800'
        }`}
      >
        Saldo: {formatBRL(saldoReal)}
      </div>

      {/* Alerta gastos excedidos */}
      {gastosExcedidos && (
        <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-2xl px-4 sm:px-6 py-3 sm:py-4 flex items-center gap-3">
          <span className="text-lg sm:text-xl shrink-0">⚠️</span>
          <div>
            <p className="text-xs sm:text-sm font-bold text-amber-800 dark:text-amber-300">Gastos acima da receita</p>
            <p className="text-[11px] sm:text-xs text-amber-700 dark:text-amber-400">
              Seus gastos ultrapassam a receita em {formatBRL(Math.abs(saldoReal))}. O saldo aparece como zero no gráfico.
            </p>
          </div>
        </div>
      )}

      {/* Charts: stacked on mobile, side-by-side on md+ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
          <h3 className="text-xs sm:text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3 sm:mb-4">Distribuição da Receita</h3>
          <div className="h-[280px] md:h-[360px]">
            <Doughnut key={`doughnut-${dark}`} data={doughnutData} options={doughnutOpts} />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
          <h3 className="text-xs sm:text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3 sm:mb-4">Comparativo</h3>
          <div className="h-[280px] md:h-[360px]">
            <Bar key={`bar-${dark}`} data={barData} options={barOpts} />
          </div>
        </div>
      </div>

      {/* Export */}
      <div className="flex justify-end">
        <button
          onClick={() => exportCSV({ receita, fixas, cartao, invest })}
          className="flex items-center gap-2 bg-gray-800 hover:bg-gray-900 dark:bg-gray-700 dark:hover:bg-gray-600 text-white text-xs sm:text-sm font-medium px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl transition-colors cursor-pointer"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V3" />
          </svg>
          Exportar CSV
        </button>
      </div>
    </section>
  )
}
