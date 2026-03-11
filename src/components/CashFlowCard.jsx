import { useMemo } from 'react'

const BRL = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/**
 * Fluxo de Caixa Real do mês.
 *
 * availableCash = balanceAccount + expectedIncome + reserveTransferred
 * remainingToPay = monthlyExpenses - alreadyPaid
 * reserveNeeded = max(0, remainingToPay - availableCash)
 * reserveAfterUse = reserveTotal - reserveTransferred
 *
 * reserveTransferred é um valor manual que NÃO muda ao togglr status.
 * reserveAfterUse é sempre baseado em reserveTransferred, não em reserveNeeded.
 */
export default function CashFlowCard({
  realBalance = 0,
  totalReceita = 0,
  totalExpenses = 0,
  expenseStatus = null,
  reserveTotal = 0,
  reserveTransferred = 0,
}) {
  const cf = useMemo(() => {
    const balanceAccount = realBalance || 0
    const expectedIncome = totalReceita || 0
    const transferred = reserveTransferred || 0

    // Entradas: saldo + receita + o que já veio da reserva
    const availableCash = balanceAccount + expectedIncome + transferred

    // Saídas
    const jaPago = expenseStatus?.paid || 0
    const pendente = expenseStatus?.pending || 0
    const hasPaidData = jaPago > 0 || pendente > 0
    const semStatus = Math.max(0, totalExpenses - jaPago - pendente)
    const remainingToPay = hasPaidData ? (pendente + semStatus) : totalExpenses

    // Necessidade adicional de reserva (além do que já foi transferido)
    const reserveNeeded = Math.max(0, Math.round((remainingToPay - availableCash) * 100) / 100)

    // Reserva após uso = total - o que já saiu (manual, estável)
    const reserveAfterUse = Math.max(0, Math.round(((reserveTotal || 0) - transferred) * 100) / 100)

    const hasRealBalance = realBalance != null && realBalance > 0
    const hasReserve = reserveTotal != null && reserveTotal > 0

    return {
      balanceAccount,
      expectedIncome,
      transferred,
      availableCash,
      jaPago,
      pendente,
      hasPaidData,
      totalExpenses,
      remainingToPay,
      reserveNeeded,
      reserveAfterUse,
      hasRealBalance,
      hasReserve,
      needsReserve: reserveNeeded > 0,
    }
  }, [realBalance, totalReceita, totalExpenses, expenseStatus, reserveTotal, reserveTransferred])

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 sm:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="text-base">💰</span>
        <h2 className="text-sm font-semibold text-gray-600 dark:text-gray-400">Fluxo de Caixa Real</h2>
        {!cf.hasRealBalance && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400 font-medium">
            Informe o saldo real para ativar
          </span>
        )}
      </div>

      {cf.hasRealBalance ? (
        <>
          {/* Entradas */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 p-3 sm:p-4 space-y-2">
            <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Caixa disponível</p>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 dark:text-gray-400">Saldo da conta</span>
              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">{BRL(cf.balanceAccount)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 dark:text-gray-400">+ Receitas esperadas</span>
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{BRL(cf.expectedIncome)}</span>
            </div>
            {cf.transferred > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">+ Transferido da reserva</span>
                <span className="text-xs font-bold text-violet-600 dark:text-violet-400">{BRL(cf.transferred)}</span>
              </div>
            )}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">= Caixa disponível</span>
              <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">{BRL(cf.availableCash)}</span>
            </div>
          </div>

          {/* Saídas */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 p-3 sm:p-4 space-y-2">
            <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Ainda a pagar</p>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 dark:text-gray-400">Gastos do mês</span>
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{BRL(cf.totalExpenses)}</span>
            </div>
            {cf.hasPaidData && cf.jaPago > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">− Já pago</span>
                <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">− {BRL(cf.jaPago)}</span>
              </div>
            )}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-2 flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">= Ainda a pagar</span>
              <span className="text-sm font-bold text-rose-700 dark:text-rose-400">{BRL(cf.remainingToPay)}</span>
            </div>
          </div>

          {/* Resultado */}
          <div className={`rounded-xl p-3 sm:p-4 border ${
            cf.needsReserve
              ? 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950'
              : 'border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-[10px] font-semibold uppercase tracking-wide ${
                  cf.needsReserve ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
                }`}>
                  {cf.needsReserve ? 'Ainda precisa da reserva' : 'Saldo positivo'}
                </p>
                <p className={`text-lg sm:text-xl font-bold mt-0.5 ${
                  cf.needsReserve ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400'
                }`}>
                  {cf.needsReserve ? BRL(cf.reserveNeeded) : BRL(cf.availableCash - cf.remainingToPay)}
                </p>
              </div>
              {cf.hasReserve && (
                <div className="text-right">
                  <p className="text-[10px] text-gray-400 dark:text-gray-500">Reserva após uso</p>
                  <p className="text-xs font-bold text-gray-600 dark:text-gray-300">{BRL(cf.reserveAfterUse)}</p>
                </div>
              )}
            </div>
            <p className={`text-[10px] sm:text-xs mt-1.5 ${
              cf.needsReserve ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
            }`}>
              {cf.needsReserve
                ? cf.hasReserve
                  ? `Transfira mais ${BRL(cf.reserveNeeded)} da reserva para cobrir o mês.`
                  : 'Informe o saldo da reserva para ver quanto usar.'
                : cf.transferred > 0
                  ? `Reserva usada: ${BRL(cf.transferred)}. Caixa cobre o restante.`
                  : 'Sua receita + saldo cobrem todas as despesas do mês.'
              }
            </p>
          </div>
        </>
      ) : (
        <div className="text-center py-4">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Informe seu saldo real da conta acima para ver o fluxo de caixa completo.
          </p>
        </div>
      )}
    </div>
  )
}
