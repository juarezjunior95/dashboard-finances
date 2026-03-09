/**
 * Cálculos do fundo de reserva.
 *
 * Regra financeira: reserva NÃO é receita mensal.
 * Transferência da reserva não deve inflar o orçamento recorrente.
 *
 * Uso projetado no mês atual: compara receita TOTAL real deste mês
 * (incluindo extraordinária já recebida) contra despesas essenciais.
 * Se a receita total já cobre tudo, não precisa da reserva.
 *
 * Runway (quantos meses sustenta): usa apenas receita recorrente,
 * pois extraordinária não é garantida nos próximos meses.
 */

const BRL = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/**
 * @param {number} params.totalIncomeThisMonth - Receita TOTAL do mês (recorrente + extra já recebida)
 * @param {number} params.recurringIncome - Receita recorrente (para cálculo de runway futuro)
 * @param {number} params.essentialExpensesProjected - Despesas essenciais projetadas (fixas + cartão)
 * @param {number} params.currentAccountBalance - Saldo real da conta (ou calculado)
 * @param {number} params.pendingExpenses - Gastos pendentes de pagamento
 * @param {number} params.reserveTotal - Saldo total do fundo de reserva
 * @param {number} [params.pendingIncome=0] - Receita pendente de recebimento
 * @param {number} [params.currentEssentialExpenses=0] - Despesas essenciais já realizadas
 */
export function calculateReserveForecast({
  totalIncomeThisMonth = 0,
  recurringIncome = 0,
  essentialExpensesProjected = 0,
  currentAccountBalance = 0,
  pendingExpenses = 0,
  reserveTotal = 0,
  pendingIncome = 0,
  currentEssentialExpenses = 0,
}) {
  // 1. Previsão de uso da reserva ESTE MÊS
  //    Usa receita TOTAL (recorrente + extra já recebida) porque o dinheiro JÁ está na conta.
  //    Só precisa da reserva se despesas essenciais superam o que realmente entrou.
  const incomeForThisMonth = Math.max(totalIncomeThisMonth, recurringIncome)
  const reserveUsageForecast = Math.max(0, Math.round((essentialExpensesProjected - incomeForThisMonth) * 100) / 100)

  // 2. Transferência imediata necessária
  const availableForPending = currentAccountBalance + pendingIncome
  const immediateTransferNeeded = Math.max(0, Math.round((pendingExpenses - availableForPending) * 100) / 100)

  // 3. Saldo da reserva após uso projetado
  const reserveAfterUsage = Math.max(0, Math.round((reserveTotal - reserveUsageForecast) * 100) / 100)

  // 4. Quantos meses a reserva sustenta — baseado em despesas essenciais vs receita RECORRENTE
  //    Extraordinária não é garantida, então runway projeta cenário sem ela
  const monthlyGap = Math.max(0, essentialExpensesProjected - recurringIncome)
  let monthsOfRunway
  if (monthlyGap <= 0) {
    // Receita recorrente cobre despesas essenciais — reserva é puro colchão
    const survivalCost = essentialExpensesProjected > 0
      ? essentialExpensesProjected
      : currentEssentialExpenses > 0
        ? currentEssentialExpenses
        : recurringIncome || 1
    monthsOfRunway = Math.round((reserveTotal / survivalCost) * 10) / 10
  } else {
    // Receita recorrente NÃO cobre — runway = quantos meses a reserva tapa o gap
    monthsOfRunway = Math.round((reserveTotal / monthlyGap) * 10) / 10
  }

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
    message = `Sua receita cobre as despesas do mês. Reserva intacta com ${BRL(reserveTotal)}.`
    if (recurringIncome < essentialExpensesProjected && totalIncomeThisMonth >= essentialExpensesProjected) {
      message += ` Atenção: sem a entrada extra, você precisaria de ${BRL(Math.round((essentialExpensesProjected - recurringIncome) * 100) / 100)} da reserva.`
    }
  } else if (immediateTransferNeeded > 0) {
    message = `Transfira ${BRL(immediateTransferNeeded)} da reserva agora para cobrir gastos pendentes.`
  } else if (reserveUsageForecast > 0) {
    message = `Projeção: despesas essenciais excedem a receita em ${BRL(reserveUsageForecast)}. Será necessário usar a reserva.`
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
