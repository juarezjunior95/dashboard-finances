import { useMemo } from 'react'

const BRL = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/**
 * Fluxo de Caixa Real — bloco principal do dashboard.
 *
 * O cálculo de reserva usa TOTAL de despesas do mês (não subtrai "já pago").
 * Motivo: o saldo real já reflete pagamentos feitos. Subtrair "já pago"
 * causaria oscilação ao mudar status, sem o usuário atualizar o saldo.
 * O breakdown pago/pendente é puramente informativo.
 */
export default function CashFlowCard({
  realBalance = 0,
  totalReceita = 0,
  totalExpenses = 0,
  expenseStatus = null,
  reserveTotal = 0,
}) {
  const cashFlow = useMemo(() => {
    const saldoReal = realBalance || 0
    const receitas = totalReceita || 0
    const caixaDisponivel = saldoReal + receitas

    const jaPago = expenseStatus?.paid || 0
    const pendente = expenseStatus?.pending || 0
    const hasPaidData = jaPago > 0 || pendente > 0

    // Reserva usa total de despesas — status é informativo
    const necessidadeReserva = Math.max(0, Math.round((totalExpenses - caixaDisponivel) * 100) / 100)
    const reservaAposUso = Math.max(0, Math.round(((reserveTotal || 0) - necessidadeReserva) * 100) / 100)

    const temSaldoReal = realBalance != null && realBalance > 0
    const temReserva = reserveTotal != null && reserveTotal > 0

    return {
      saldoReal,
      receitas,
      caixaDisponivel,
      jaPago,
      pendente,
      hasPaidData,
      totalExpenses,
      necessidadeReserva,
      reservaAposUso,
      temSaldoReal,
      temReserva,
      precisaReserva: necessidadeReserva > 0,
    }
  }, [realBalance, totalReceita, totalExpenses, expenseStatus, reserveTotal])

  const cf = cashFlow

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 sm:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="text-base">💰</span>
        <h2 className="text-sm font-semibold text-gray-600 dark:text-gray-400">Fluxo de Caixa Real</h2>
        {!cf.temSaldoReal && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400 font-medium">
            Informe o saldo real para ativar
          </span>
        )}
      </div>

      {cf.temSaldoReal ? (
        <>
          {/* Entradas */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 p-3 sm:p-4 space-y-2">
            <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Entradas</p>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 dark:text-gray-400">Saldo real da conta</span>
              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">{BRL(cf.saldoReal)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 dark:text-gray-400">+ Receitas esperadas</span>
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{BRL(cf.receitas)}</span>
            </div>
            <div className="border-t border-gray-200 dark:border-gray-700 pt-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">= Caixa disponível</span>
              <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">{BRL(cf.caixaDisponivel)}</span>
            </div>
          </div>

          {/* Saídas */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 p-3 sm:p-4 space-y-2">
            <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Saídas</p>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Gastos totais do mês</span>
              <span className="text-sm font-bold text-rose-700 dark:text-rose-400">{BRL(cf.totalExpenses)}</span>
            </div>
            {cf.hasPaidData && (
              <div className="flex items-center gap-3 pt-1">
                {cf.jaPago > 0 && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300 font-medium">
                    Pago {BRL(cf.jaPago)}
                  </span>
                )}
                {cf.pendente > 0 && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300 font-medium">
                    Pendente {BRL(cf.pendente)}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Resultado */}
          <div className={`rounded-xl p-3 sm:p-4 border ${
            cf.precisaReserva
              ? 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950'
              : 'border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-[10px] font-semibold uppercase tracking-wide ${
                  cf.precisaReserva ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
                }`}>
                  {cf.precisaReserva ? 'Necessidade de reserva' : 'Saldo positivo'}
                </p>
                <p className={`text-lg sm:text-xl font-bold mt-0.5 ${
                  cf.precisaReserva ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400'
                }`}>
                  {cf.precisaReserva ? BRL(cf.necessidadeReserva) : BRL(cf.caixaDisponivel - cf.totalExpenses)}
                </p>
              </div>
              {cf.precisaReserva && cf.temReserva && (
                <div className="text-right">
                  <p className="text-[10px] text-gray-400 dark:text-gray-500">Reserva após uso</p>
                  <p className="text-xs font-bold text-gray-600 dark:text-gray-300">{BRL(cf.reservaAposUso)}</p>
                </div>
              )}
            </div>
            <p className={`text-[10px] sm:text-xs mt-1.5 ${
              cf.precisaReserva ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
            }`}>
              {cf.precisaReserva
                ? cf.temReserva
                  ? cf.necessidadeReserva <= (reserveTotal || 0)
                    ? `Transfira ${BRL(cf.necessidadeReserva)} da reserva para sua conta.`
                    : `Atenção: reserva (${BRL(reserveTotal)}) não cobre a necessidade total.`
                  : 'Informe o saldo da reserva para ver quanto usar.'
                : 'Sua receita + saldo cobrem todas as despesas do mês.'
              }
            </p>
          </div>
        </>
      ) : (
        /* Estado vazio: sem saldo real informado */
        <div className="text-center py-4">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Informe seu saldo real da conta acima para ver o fluxo de caixa completo.
          </p>
        </div>
      )}
    </div>
  )
}
