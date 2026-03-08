/**
 * Cálculos do fundo de reserva.
 *
 * Regra financeira: reserva NÃO é receita mensal.
 * Transferência da reserva não deve inflar o orçamento recorrente.
 *
 * Dois cálculos principais:
 * 1. reserveUsageForecast = max(0, gastos projetados - receita recorrente)
 *    → quanto vou precisar tirar da reserva este mês
 * 2. immediateTransferNeeded = max(0, gastos pendentes - saldo em conta - receita pendente)
 *    → quanto preciso transferir da reserva AGORA para cobrir o que falta pagar
 */

const BRL = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/**
 * @param {object} params
 * @param {number} params.recurringIncome - Receita recorrente mensal (salário)
 * @param {number} params.totalExpensesProjected - Gastos projetados para o mês inteiro
 * @param {number} params.currentAccountBalance - Saldo real da conta (ou calculado como fallback)
 * @param {number} params.pendingExpenses - Gastos ainda pendentes de pagamento
 * @param {number} params.reserveTotal - Saldo total do fundo de reserva
 * @param {number} [params.pendingIncome=0] - Receita pendente de recebimento este mês
 * @param {number} [params.currentExpenses=0] - Gastos já realizados este mês
 */
export function calculateReserveForecast({
  recurringIncome = 0,
  totalExpensesProjected = 0,
  currentAccountBalance = 0,
  pendingExpenses = 0,
  reserveTotal = 0,
  pendingIncome = 0,
  currentExpenses = 0,
}) {
  // 1. Previsão de uso da reserva no mês
  //    Se os gastos projetados superam a receita recorrente, a diferença vem da reserva
  const reserveUsageForecast = Math.max(0, Math.round((totalExpensesProjected - recurringIncome) * 100) / 100)

  // 2. Transferência imediata necessária
  //    Quanto falta para cobrir os gastos pendentes considerando o que tenho em conta + receitas a receber
  const availableForPending = currentAccountBalance + pendingIncome
  const immediateTransferNeeded = Math.max(0, Math.round((pendingExpenses - availableForPending) * 100) / 100)

  // 3. Saldo da reserva após uso projetado
  const reserveAfterUsage = Math.max(0, Math.round((reserveTotal - reserveUsageForecast) * 100) / 100)

  // 4. Quantos meses a reserva sustenta o padrão atual de gastos
  const monthlyExpensePattern = totalExpensesProjected > 0 ? totalExpensesProjected : currentExpenses > 0 ? currentExpenses : recurringIncome
  const monthsOfRunway = monthlyExpensePattern > 0
    ? Math.round((reserveTotal / monthlyExpensePattern) * 10) / 10
    : 0

  // 5. Nível de saúde da reserva
  let reserveHealth = 'none'
  if (reserveTotal <= 0) {
    reserveHealth = 'none'
  } else if (monthsOfRunway >= 6) {
    reserveHealth = 'excellent'
  } else if (monthsOfRunway >= 3) {
    reserveHealth = 'good'
  } else if (monthsOfRunway >= 1) {
    reserveHealth = 'warning'
  } else {
    reserveHealth = 'critical'
  }

  // 6. Mensagem contextual
  let message = ''
  if (reserveTotal <= 0) {
    message = 'Informe o saldo da sua reserva para ver a análise.'
  } else if (reserveUsageForecast <= 0 && immediateTransferNeeded <= 0) {
    message = `Sua receita cobre os gastos do mês. Reserva intacta com ${BRL(reserveTotal)}.`
  } else if (immediateTransferNeeded > 0) {
    message = `Transfira ${BRL(immediateTransferNeeded)} da reserva agora para cobrir gastos pendentes.`
  } else if (reserveUsageForecast > 0) {
    message = `Projeção: você vai precisar de ${BRL(reserveUsageForecast)} da reserva este mês.`
  }

  return {
    reserveUsageForecast,
    immediateTransferNeeded,
    reserveAfterUsage,
    reserveTotal,
    monthsOfRunway,
    reserveHealth,
    needsReserve: reserveUsageForecast > 0,
    needsImmediateTransfer: immediateTransferNeeded > 0,
    message,
  }
}
