import { useMemo } from 'react'

const BRL = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/**
 * Fluxo de Caixa Real do mês.
 *
 * O saldo real da conta é o PROTAGONISTA — ele já reflete qualquer
 * transferência de reserva que tenha ocorrido.
 *
 * saldoLiquido = balanceAccount - remainingToPay
 *   → quanto realmente sobra para gastar após pagar contas pendentes
 *
 * A reserva aparece como indicador de COBERTURA, não como dinheiro para gastar.
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

    const jaPago = expenseStatus?.paid || 0
    const pendente = expenseStatus?.pending || 0
    const hasPaidData = jaPago > 0 || pendente > 0
    const semStatus = Math.max(0, totalExpenses - jaPago - pendente)
    const remainingToPay = hasPaidData ? (pendente + semStatus) : totalExpenses

    // Saldo líquido real = o que sobra na conta após pagar pendentes
    const saldoLiquido = Math.round((balanceAccount - remainingToPay) * 100) / 100

    // Cobertura total (para contexto): saldo + receita + reserva vs total de gastos
    const totalResources = balanceAccount + expectedIncome + transferred
    const coverageSurplus = Math.round((totalResources - remainingToPay) * 100) / 100
    const reserveNeeded = Math.max(0, Math.round((remainingToPay - totalResources) * 100) / 100)

    const reserveAfterUse = Math.max(0, Math.round(((reserveTotal || 0) - transferred) * 100) / 100)

    // Quanto faltaria sem a reserva
    const deficitWithoutReserve = Math.max(0, Math.round((totalExpenses - (balanceAccount + expectedIncome)) * 100) / 100)

    const hasRealBalance = realBalance != null && realBalance > 0
    const hasReserve = reserveTotal != null && reserveTotal > 0

    return {
      balanceAccount,
      expectedIncome,
      transferred,
      jaPago,
      pendente,
      hasPaidData,
      totalExpenses,
      remainingToPay,
      saldoLiquido,
      coverageSurplus,
      reserveNeeded,
      reserveAfterUse,
      deficitWithoutReserve,
      hasRealBalance,
      hasReserve,
      needsReserve: reserveNeeded > 0,
    }
  }, [realBalance, totalReceita, totalExpenses, expenseStatus, reserveTotal, reserveTransferred])

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 sm:p-6 space-y-4">
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
          {/* Saldo líquido — PROTAGONISTA */}
          <div className={`rounded-xl p-3 sm:p-4 border ${
            cf.saldoLiquido > 0
              ? 'border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/50'
              : 'border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/50'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-semibold text-indigo-500 dark:text-indigo-400 uppercase tracking-wide">
                  Saldo real em conta
                </p>
                <p className="text-xl sm:text-2xl font-bold text-indigo-700 dark:text-indigo-300 mt-0.5">
                  {BRL(cf.balanceAccount)}
                </p>
              </div>
              {cf.remainingToPay > 0 && (
                <div className="text-right">
                  <p className="text-[10px] text-gray-400 dark:text-gray-500">Após pendentes</p>
                  <p className={`text-sm font-bold ${cf.saldoLiquido >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                    {BRL(cf.saldoLiquido)}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Saídas */}
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 p-3 sm:p-4 space-y-2">
            <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Contas do mês</p>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 dark:text-gray-400">Total de gastos</span>
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

          {/* Indicador de reserva (separado, não como "dinheiro para gastar") */}
          {cf.transferred > 0 && (
            <div className="rounded-xl border border-blue-200 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-950/50 p-3 sm:p-4 space-y-2">
              <p className="text-[10px] font-semibold text-blue-500 dark:text-blue-400 uppercase tracking-wide">
                Reserva de emergência usada
              </p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">Transferido este mês</span>
                <span className="text-xs font-bold text-blue-600 dark:text-blue-400">{BRL(cf.transferred)}</span>
              </div>
              {cf.hasReserve && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Reserva restante</span>
                  <span className="text-xs font-bold text-gray-600 dark:text-gray-300">{BRL(cf.reserveAfterUse)}</span>
                </div>
              )}
              {cf.deficitWithoutReserve > 0 && (
                <p className="text-[10px] text-blue-600 dark:text-blue-400 pt-1 border-t border-blue-200/50 dark:border-blue-700/50">
                  Sem a reserva, faltariam {BRL(cf.deficitWithoutReserve)} para cobrir os gastos do mês.
                </p>
              )}
            </div>
          )}

          {/* Alerta se precisa de mais reserva */}
          {cf.needsReserve && (
            <div className="rounded-xl p-3 sm:p-4 border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950">
              <p className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide">
                Ainda precisa da reserva
              </p>
              <p className="text-lg sm:text-xl font-bold text-amber-700 dark:text-amber-400 mt-0.5">
                {BRL(cf.reserveNeeded)}
              </p>
              <p className="text-[10px] sm:text-xs mt-1.5 text-amber-600 dark:text-amber-400">
                {cf.hasReserve
                  ? `Transfira mais ${BRL(cf.reserveNeeded)} da reserva para cobrir o mês.`
                  : 'Informe o saldo da reserva para ver quanto usar.'}
              </p>
            </div>
          )}

          {/* Status quando NÃO precisa de reserva e NÃO usou reserva */}
          {!cf.needsReserve && !cf.transferred && (
            <div className="rounded-xl p-3 sm:p-4 border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950">
              <p className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
                Mês coberto
              </p>
              <p className="text-[10px] sm:text-xs mt-1 text-emerald-600 dark:text-emerald-400">
                Sua receita + saldo cobrem todas as despesas do mês.
              </p>
            </div>
          )}
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
