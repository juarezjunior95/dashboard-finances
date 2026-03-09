import { useMemo } from 'react'

const BRL_PCT = (v) => `${v.toFixed(2)}%`

export default function EconomicIndicators({ data }) {
  // Não renderizar se não houver dados
  if (!data) return null

  const { selic, ipca, cdi, rendimentoReal, stale, fetchedAt } = data

  const formattedDate = useMemo(() => {
    if (!fetchedAt) return ''
    try {
      const date = new Date(fetchedAt)
      return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
    } catch {
      return ''
    }
  }, [fetchedAt])

  const rendimentoPositivo = rendimentoReal > 0
  const rendimentoAbs = Math.abs(rendimentoReal)

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 sm:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">📈</span>
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Indicadores Econômicos
          </h2>
        </div>
        {stale && (
          <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300">
            Dados de {formattedDate}
          </span>
        )}
      </div>

      {/* Grid de indicadores */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Selic */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-3">
          <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase mb-1">
            Selic
          </p>
          <p className="text-lg sm:text-xl font-bold text-indigo-600 dark:text-indigo-400">
            {BRL_PCT(selic.valor)}
          </p>
          <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
            Taxa básica de juros
          </p>
        </div>

        {/* IPCA */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-3">
          <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase mb-1">
            IPCA
          </p>
          <p className="text-lg sm:text-xl font-bold text-orange-600 dark:text-orange-400">
            {BRL_PCT(ipca.valor)}
          </p>
          <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
            Inflação (12 meses)
          </p>
        </div>

        {/* CDI */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-3">
          <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase mb-1">
            CDI
          </p>
          <p className="text-lg sm:text-xl font-bold text-emerald-600 dark:text-emerald-400">
            {BRL_PCT(cdi.valor)}
          </p>
          <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
            Rendimento mensal
          </p>
        </div>
      </div>

      {/* Rendimento Real */}
      <div className={`rounded-xl p-4 ${
        rendimentoPositivo
          ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800'
          : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
      }`}>
        <div className="flex items-center gap-2">
          <span className="text-2xl">{rendimentoPositivo ? '✅' : '⚠️'}</span>
          <div className="flex-1">
            <p className={`text-xs font-semibold ${
              rendimentoPositivo
                ? 'text-emerald-700 dark:text-emerald-300'
                : 'text-red-700 dark:text-red-300'
            }`}>
              {rendimentoPositivo
                ? `Reserva rende ${BRL_PCT(rendimentoAbs)} acima da inflação`
                : `Reserva perde ${BRL_PCT(rendimentoAbs)} para inflação`
              }
            </p>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
              {rendimentoPositivo
                ? 'Seu fundo de reserva está protegido contra a inflação'
                : 'Considere realocar parte da reserva para investimentos que rendam acima do CDI'
              }
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <p className="text-[10px] text-gray-400 dark:text-gray-500 text-center">
        Fonte: Banco Central {formattedDate && `| Atualizado em ${formattedDate}`}
        {stale && ' | API indisponível'}
      </p>
    </div>
  )
}
