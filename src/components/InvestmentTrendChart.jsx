import { useMemo } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
} from 'chart.js'
import { Chart } from 'react-chartjs-2'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

ChartJS.register(
  CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip, Legend,
)

function formatBRL(v) {
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function monthLabel(key) {
  try {
    return format(parseISO(key + '-01'), 'MMM/yy', { locale: ptBR })
  } catch {
    return key
  }
}

export default function InvestmentTrendChart({ schedule, dark }) {
  const textColor = dark ? '#e5e7eb' : '#374151'
  const gridColor = dark ? '#374151' : '#f3f4f6'

  const chartData = useMemo(() => ({
    labels: schedule.map(s => monthLabel(s.month)),
    datasets: [
      {
        type: 'bar',
        label: 'Investido (Real)',
        data: schedule.map(s => s.actual),
        backgroundColor: dark ? 'rgba(99,102,241,0.65)' : 'rgba(99,102,241,0.8)',
        borderRadius: 4,
        maxBarThickness: 36,
        order: 2,
      },
      {
        type: 'line',
        label: 'Recomendado',
        data: schedule.map(s => s.recommended),
        borderColor: '#f97316',
        borderWidth: 2,
        borderDash: [6, 3],
        pointRadius: 3,
        pointBackgroundColor: '#f97316',
        tension: 0.2,
        fill: false,
        order: 1,
      },
      {
        type: 'bar',
        label: 'Gap',
        data: schedule.map(s => (s.actual > 0 ? s.gap : 0)),
        backgroundColor: schedule.map(s =>
          s.gap >= 0 ? 'rgba(34,197,94,0.5)' : 'rgba(244,63,94,0.5)',
        ),
        borderRadius: 2,
        maxBarThickness: 18,
        order: 3,
      },
    ],
  }), [schedule, dark])

  const chartOpts = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        position: 'bottom',
        labels: { padding: 12, usePointStyle: true, color: textColor, font: { size: 11 } },
      },
      tooltip: {
        callbacks: {
          title(items) {
            if (!items.length) return ''
            const idx = items[0].dataIndex
            return schedule[idx]?.month || ''
          },
          label(ctx) {
            const idx = ctx.dataIndex
            const entry = schedule[idx]
            if (!entry) return ''
            if (ctx.datasetIndex === 0) return ` Real: ${formatBRL(entry.actual)}`
            if (ctx.datasetIndex === 1) return ` Recomendado: ${formatBRL(entry.recommended)}`
            if (ctx.datasetIndex === 2 && entry.actual > 0) {
              const pct = entry.recommended > 0
                ? ((entry.gap / entry.recommended) * 100).toFixed(1)
                : '0.0'
              return ` Gap: ${formatBRL(entry.gap)} (${pct}%)`
            }
            return null
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (v) => v >= 1000 ? `R$${(v / 1000).toFixed(0)}k` : `R$${v}`,
          color: textColor,
          font: { size: 10 },
        },
        grid: { color: gridColor },
      },
      x: {
        ticks: { color: textColor, font: { size: 10 }, maxRotation: 45 },
        grid: { display: false },
      },
    },
  }), [schedule, dark, textColor, gridColor])

  if (!schedule || schedule.length === 0) return null

  return (
    <div className="h-[280px] md:h-[360px]">
      <Chart key={`trend-${dark}`} type="bar" data={chartData} options={chartOpts} />
    </div>
  )
}
