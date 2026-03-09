const BRL = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const HEALTH_META = {
  excellent: { label: 'Excelente', cls: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500', icon: '🛡️' },
  good:      { label: 'Boa', cls: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500', icon: '✓' },
  warning:   { label: 'Atenção', cls: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500', icon: '⚠️' },
  critical:  { label: 'Crítica', cls: 'text-red-600 dark:text-red-400', bg: 'bg-red-500', icon: '🚨' },
  none:      { label: '—', cls: 'text-gray-400', bg: 'bg-gray-300', icon: '' },
}

export default function ReserveCard({ forecast }) {
  if (!forecast || forecast.reserveTotal <= 0) return null

  const health = HEALTH_META[forecast.reserveHealth] || HEALTH_META.none

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 sm:p-6 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm">🛡️</span>
          <h2 className="text-sm font-semibold text-gray-600 dark:text-gray-400">Fundo de Reserva</h2>
        </div>
        <span className={`text-[10px] sm:text-xs font-semibold ${health.cls}`}>
          {health.icon} {health.label}
        </span>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-950/50 p-3">
          <p className="text-[10px] font-semibold text-violet-500 dark:text-violet-400 uppercase">Reserva Atual</p>
          <p className="text-sm font-bold text-violet-600 dark:text-violet-400">{BRL(forecast.reserveTotal)}</p>
          <p className="text-[10px] text-gray-400 dark:text-gray-500">
            {forecast.monthsOfRunway > 0 ? `${forecast.monthsOfRunway} mes${forecast.monthsOfRunway !== 1 ? 'es' : ''} de cobertura` : '—'}
          </p>
        </div>

        <div className={`rounded-xl border p-3 ${
          forecast.needsReserve
            ? 'border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/50'
            : 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/50'
        }`}>
          <p className={`text-[10px] font-semibold uppercase ${
            forecast.needsReserve ? 'text-amber-500 dark:text-amber-400' : 'text-emerald-500 dark:text-emerald-400'
          }`}>Usar da Reserva</p>
          <p className={`text-sm font-bold ${
            forecast.needsReserve ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
          }`}>
            {forecast.needsReserve ? BRL(forecast.reserveNeeded) : 'Nenhum'}
          </p>
          <p className="text-[10px] text-gray-400 dark:text-gray-500">
            {forecast.needsReserve ? 'Transferir para a conta' : 'Receita cobre tudo'}
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-3">
          <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase">Após Uso</p>
          <p className="text-sm font-bold text-gray-700 dark:text-gray-300">{BRL(forecast.reserveAfterUsage)}</p>
          <p className="text-[10px] text-gray-400 dark:text-gray-500">
            {forecast.needsReserve ? 'Saldo restante' : 'Intacta'}
          </p>
        </div>
      </div>

      {/* Runway bar */}
      <div className="space-y-1">
        <div className="relative h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
          <div
            className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${health.bg}`}
            style={{ width: `${Math.min((forecast.monthsOfRunway / 6) * 100, 100)}%` }}
          />
          <div
            className="absolute inset-y-0 w-0.5 bg-gray-500 dark:bg-gray-300"
            style={{ left: `${(3 / 6) * 100}%` }}
            title="Ideal: 3 meses"
          />
        </div>
        <div className="flex items-center justify-between text-[10px] text-gray-400 dark:text-gray-500">
          <span>0 meses</span>
          <span>Ideal: 3 meses</span>
          <span>6+ meses</span>
        </div>
      </div>

      {/* Message */}
      <p className={`text-[10px] sm:text-xs font-medium ${
        forecast.needsReserve ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
      }`}>
        {forecast.message}
      </p>
    </div>
  )
}
