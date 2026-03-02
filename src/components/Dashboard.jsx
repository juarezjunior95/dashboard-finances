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

const LABELS = {
  fixas: 'Despesas Fixas',
  cartao: 'Cartão',
  invest: 'Investimentos',
  receita: 'Receitas',
}

const COLORS = {
  fixas: { bg: '#f43f5e', light: '#fff1f2' },
  cartao: { bg: '#f97316', light: '#fff7ed' },
  invest: { bg: '#6366f1', light: '#eef2ff' },
  receita: { bg: '#10b981', light: '#ecfdf5' },
}

const BRL = (v) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

// ── CSV Export ───────────────────────────────────────────

function exportCSV({ receita, fixas, cartao, invest }) {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')

  const rows = [
    ['Categoria', 'Valor'],
    ['Receitas', receita.toFixed(2)],
    ['Despesas Fixas', fixas.toFixed(2)],
    ['Cartão', cartao.toFixed(2)],
    ['Investimentos', invest.toFixed(2)],
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

function KpiCard({ label, value, percent, color }) {
  return (
    <div
      className="rounded-2xl border p-5 flex flex-col gap-1"
      style={{ backgroundColor: color.light, borderColor: `${color.bg}30` }}
    >
      <span className="text-xs font-semibold uppercase tracking-wide opacity-60">
        {label}
      </span>
      <span className="text-2xl font-bold" style={{ color: color.bg }}>
        {BRL(value)}
      </span>
      <span className="text-xs font-medium" style={{ color: color.bg }}>
        {percent}% da receita
      </span>
    </div>
  )
}

// ── Dashboard ────────────────────────────────────────────

export default function Dashboard({ receita, fixas, cartao, invest }) {
  const total = receita || 1 // avoid division by zero

  const pct = useMemo(
    () => ({
      fixas: ((fixas / total) * 100).toFixed(1),
      cartao: ((cartao / total) * 100).toFixed(1),
      invest: ((invest / total) * 100).toFixed(1),
      receita: '100.0',
    }),
    [receita, fixas, cartao, invest, total],
  )

  const despesas = [fixas, cartao, invest]
  const despesaLabels = [LABELS.fixas, LABELS.cartao, LABELS.invest]
  const despesaColors = [COLORS.fixas.bg, COLORS.cartao.bg, COLORS.invest.bg]

  const doughnutData = useMemo(
    () => ({
      labels: despesaLabels,
      datasets: [
        {
          data: despesas,
          backgroundColor: despesaColors,
          borderWidth: 0,
          hoverOffset: 6,
        },
      ],
    }),
    [fixas, cartao, invest],
  )

  const doughnutOpts = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '68%',
    plugins: {
      legend: { position: 'bottom', labels: { padding: 16, usePointStyle: true } },
      tooltip: {
        callbacks: {
          label: (ctx) => ` ${ctx.label}: ${BRL(ctx.raw)}`,
        },
      },
    },
  }

  const barData = useMemo(
    () => ({
      labels: [LABELS.receita, LABELS.fixas, LABELS.cartao, LABELS.invest],
      datasets: [
        {
          label: 'Valor (R$)',
          data: [receita, fixas, cartao, invest],
          backgroundColor: [
            COLORS.receita.bg,
            COLORS.fixas.bg,
            COLORS.cartao.bg,
            COLORS.invest.bg,
          ],
          borderRadius: 8,
          maxBarThickness: 56,
        },
      ],
    }),
    [receita, fixas, cartao, invest],
  )

  const barOpts = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => ` ${BRL(ctx.raw)}`,
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: { callback: (v) => `R$ ${(v / 1000).toFixed(0)}k` },
        grid: { color: '#f3f4f6' },
      },
      x: { grid: { display: false } },
    },
  }

  const saldo = receita - fixas - cartao - invest

  return (
    <section className="w-full max-w-5xl mx-auto space-y-8">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label={LABELS.receita} value={receita} percent={pct.receita} color={COLORS.receita} />
        <KpiCard label={LABELS.fixas} value={fixas} percent={pct.fixas} color={COLORS.fixas} />
        <KpiCard label={LABELS.cartao} value={cartao} percent={pct.cartao} color={COLORS.cartao} />
        <KpiCard label={LABELS.invest} value={invest} percent={pct.invest} color={COLORS.invest} />
      </div>

      {/* Saldo */}
      <div
        className={`rounded-2xl px-6 py-4 text-center font-bold text-lg ${
          saldo >= 0
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}
      >
        Saldo: {BRL(saldo)}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-500 mb-4">Distribuição de Despesas</h3>
          <div className="h-64">
            <Doughnut data={doughnutData} options={doughnutOpts} />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-500 mb-4">Comparativo</h3>
          <div className="h-64">
            <Bar data={barData} options={barOpts} />
          </div>
        </div>
      </div>

      {/* Export */}
      <div className="flex justify-end">
        <button
          onClick={() => exportCSV({ receita, fixas, cartao, invest })}
          className="flex items-center gap-2 bg-gray-800 hover:bg-gray-900 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-colors cursor-pointer"
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
