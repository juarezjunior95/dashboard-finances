import { useMemo } from 'react'

const BRL_PCT = (v) => `${v.toFixed(2)}%`
const BRL = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export default function EconomicIndicators({ data, investAmount = 0, reserveAmount = 0 }) {
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

  // Calcular projeções de rendimento
  const totalInvestido = investAmount + reserveAmount
  const hasInvestments = totalInvestido > 0

  const projections = useMemo(() => {
    if (!hasInvestments) return null

    // Rendimentos anuais
    const rendimentoSelic = (totalInvestido * selic.valor) / 100
    const rendimentoCDI = (totalInvestido * cdi.valor) / 100 * 12 // CDI é mensal, converter para anual
    const perdaIPCA = (totalInvestido * ipca.valor) / 100
    const rendimentoRealAnual = (totalInvestido * rendimentoReal) / 100

    // Rendimentos mensais
    const rendimentoSelicMensal = rendimentoSelic / 12
    const rendimentoCDIMensal = (totalInvestido * cdi.valor) / 100

    return {
      anual: {
        selic: Math.round(rendimentoSelic * 100) / 100,
        cdi: Math.round(rendimentoCDI * 100) / 100,
        ipca: Math.round(perdaIPCA * 100) / 100,
        real: Math.round(rendimentoRealAnual * 100) / 100,
      },
      mensal: {
        selic: Math.round(rendimentoSelicMensal * 100) / 100,
        cdi: Math.round(rendimentoCDIMensal * 100) / 100,
      }
    }
  }, [hasInvestments, totalInvestido, selic.valor, cdi.valor, ipca.valor, rendimentoReal])

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

      {/* Calculadora de Rendimento */}
      {hasInvestments && projections && (
        <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/20 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">💰</span>
            <div className="flex-1">
              <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                Projeção de Rendimento dos seus Investimentos
              </p>
              <p className="text-[10px] text-gray-600 dark:text-gray-400 mt-0.5">
                Baseado em {BRL(totalInvestido)} investidos
                {investAmount > 0 && reserveAmount > 0 
                  ? ` (${BRL(investAmount)} investimentos + ${BRL(reserveAmount)} reserva)`
                  : investAmount > 0 
                    ? ' (investimentos)'
                    : ' (fundo de reserva)'
                }
              </p>
            </div>
          </div>

          {/* Rendimentos Mensais */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700">
              <p className="text-[9px] font-semibold text-gray-400 dark:text-gray-500 uppercase mb-1">
                Rendimento Mensal (100% CDI)
              </p>
              <p className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                {BRL(projections.mensal.cdi)}
              </p>
              <p className="text-[9px] text-gray-500 dark:text-gray-400 mt-0.5">
                {BRL_PCT(cdi.valor)} ao mês
              </p>
            </div>

            <div className="rounded-lg bg-white dark:bg-gray-800 p-3 border border-gray-200 dark:border-gray-700">
              <p className="text-[9px] font-semibold text-gray-400 dark:text-gray-500 uppercase mb-1">
                Rendimento Mensal (Selic)
              </p>
              <p className="text-base font-bold text-indigo-600 dark:text-indigo-400">
                {BRL(projections.mensal.selic)}
              </p>
              <p className="text-[9px] text-gray-500 dark:text-gray-400 mt-0.5">
                {BRL_PCT(selic.valor / 12)} ao mês
              </p>
            </div>
          </div>

          {/* Rendimentos Anuais */}
          <div className="space-y-2">
            <p className="text-[10px] font-semibold text-gray-600 dark:text-gray-400 uppercase">
              Projeção Anual (12 meses)
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="rounded-lg bg-white dark:bg-gray-800 p-2.5 border border-gray-200 dark:border-gray-700">
                <p className="text-[9px] text-gray-500 dark:text-gray-400 mb-1">100% CDI</p>
                <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                  +{BRL(projections.anual.cdi)}
                </p>
              </div>

              <div className="rounded-lg bg-white dark:bg-gray-800 p-2.5 border border-gray-200 dark:border-gray-700">
                <p className="text-[9px] text-gray-500 dark:text-gray-400 mb-1">Selic</p>
                <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                  +{BRL(projections.anual.selic)}
                </p>
              </div>

              <div className="rounded-lg bg-white dark:bg-gray-800 p-2.5 border border-gray-200 dark:border-gray-700">
                <p className="text-[9px] text-gray-500 dark:text-gray-400 mb-1">Rendimento Real</p>
                <p className={`text-sm font-bold ${
                  projections.anual.real >= 0 
                    ? 'text-emerald-600 dark:text-emerald-400' 
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  {projections.anual.real >= 0 ? '+' : ''}{BRL(projections.anual.real)}
                </p>
              </div>
            </div>

            {/* Comparação com inflação */}
            <div className="rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 p-2.5">
              <div className="flex items-center justify-between">
                <p className="text-[9px] font-semibold text-orange-700 dark:text-orange-300">
                  Perda pela inflação (IPCA):
                </p>
                <p className="text-sm font-bold text-orange-600 dark:text-orange-400">
                  -{BRL(projections.anual.ipca)}
                </p>
              </div>
              <p className="text-[9px] text-gray-600 dark:text-gray-400 mt-1">
                Para manter o poder de compra, seu investimento precisa render pelo menos {BRL_PCT(ipca.valor)} a.a.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <p className="text-[10px] text-gray-400 dark:text-gray-500 text-center">
        Fonte: Banco Central {formattedDate && `| Atualizado em ${formattedDate}`}
        {stale && ' | API indisponível'}
      </p>
    </div>
  )
}
