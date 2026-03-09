/**
 * Cálculos do fundo de reserva.
 *
 * Regra financeira: reserva NÃO é receita mensal.
 * Transferência da reserva não deve inflar o orçamento recorrente.
 *
 * Cálculo principal: quanto da reserva vou usar este mês?
 *   déficit = max(0, despesas essenciais - receita total)
 *   usar da reserva = max(0, déficit - saldo em conta)
 *
 * Runway: usa receita recorrente (extra não é garantida no futuro).
 */

const BRL = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/**
 * @param {number} params.totalIncomeThisMonth - Receita TOTAL do mês
 * @param {number} params.recurringIncome - Receita recorrente (para runway)
 * @param {number} params.essentialExpenses - Despesas essenciais reais (fixas + cartão)
 * @param {number} params.currentAccountBalance - Saldo real da conta (ou calculado)
 * @param {number} params.reserveTotal - Saldo total do fundo de reserva
 */
export function calculateReserveForecast({
  totalIncomeThisMonth = 0,
  recurringIncome = 0,
  essentialExpenses = 0,
  currentAccountBalance = 0,
  reserveTotal = 0,
}) {
  const r = (v) => Math.round(v * 100) / 100

  // 1. Déficit do mês: quanto as despesas essenciais excedem a receita
  const deficit = r(Math.max(0, essentialExpenses - totalIncomeThisMonth))

  // 2. Quanto REALMENTE preciso tirar da reserva (desconta saldo em conta)
  const reserveNeeded = r(Math.max(0, deficit - Math.max(currentAccountBalance, 0)))

  // 3. Saldo da reserva após uso
  const reserveAfterUsage = r(Math.max(0, reserveTotal - reserveNeeded))

  // 4. Runway — quantos meses a reserva sustenta
  //    Baseado em despesas essenciais vs receita RECORRENTE (extra não é garantida)
  const monthlyGap = Math.max(0, essentialExpenses - recurringIncome)
  let monthsOfRunway
  if (monthlyGap <= 0) {
    const base = essentialExpenses > 0 ? essentialExpenses : recurringIncome || 1
    monthsOfRunway = Math.round((reserveTotal / base) * 10) / 10
  } else {
    monthsOfRunway = Math.round((reserveTotal / monthlyGap) * 10) / 10
  }

  // 5. Saúde da reserva
  let reserveHealth = 'none'
  if (reserveTotal <= 0) reserveHealth = 'none'
  else if (monthsOfRunway >= 6) reserveHealth = 'excellent'
  else if (monthsOfRunway >= 3) reserveHealth = 'good'
  else if (monthsOfRunway >= 1) reserveHealth = 'warning'
  else reserveHealth = 'critical'

  // 6. Mensagem direta
  let message = ''
  if (reserveTotal <= 0) {
    message = 'Informe o saldo da sua reserva para ver a análise.'
  } else if (deficit <= 0) {
    message = `Sua receita cobre todas as despesas. Reserva intacta.`
    if (recurringIncome < essentialExpenses && totalIncomeThisMonth >= essentialExpenses) {
      message += ` Sem a entrada extra, precisaria de ${BRL(r(essentialExpenses - recurringIncome))} da reserva.`
    }
  } else if (reserveNeeded <= 0) {
    message = `Déficit de ${BRL(deficit)}, mas seu saldo em conta (${BRL(currentAccountBalance)}) cobre. Não precisa da reserva.`
  } else if (reserveNeeded <= reserveTotal) {
    message = `Transfira ${BRL(reserveNeeded)} da reserva para sua conta para cobrir as despesas do mês.`
  } else {
    message = `Atenção: você precisaria de ${BRL(reserveNeeded)} mas a reserva tem apenas ${BRL(reserveTotal)}.`
  }

  return {
    deficit,
    reserveNeeded,
    reserveAfterUsage,
    reserveTotal,
    monthsOfRunway,
    reserveHealth,
    essentialExpenses,
    totalIncomeThisMonth,
    currentAccountBalance,
    needsReserve: reserveNeeded > 0,
    message,
  }
}
