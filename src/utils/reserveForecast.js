/**
 * Cálculos do fundo de reserva.
 *
 * Alinhado com o CashFlowCard:
 *   caixaDisponivel = saldoReal + receita
 *   totalAPagar = despesas totais - já pago (+ amortização inclusa)
 *   reserveNeeded = max(0, totalAPagar - caixaDisponivel)
 *
 * Runway usa receita recorrente (extra não é garantida no futuro).
 */

const BRL = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/**
 * @param {number} params.caixaDisponivel - Saldo real + receitas esperadas
 * @param {number} params.totalAPagar - Total de despesas ainda pendentes
 * @param {number} params.recurringIncome - Receita recorrente (para runway)
 * @param {number} params.essentialExpenses - Despesas essenciais reais (fixas + cartão)
 * @param {number} params.reserveTotal - Saldo total do fundo de reserva
 */
export function calculateReserveForecast({
  caixaDisponivel = 0,
  totalAPagar = 0,
  recurringIncome = 0,
  essentialExpenses = 0,
  reserveTotal = 0,
}) {
  const r = (v) => Math.round(v * 100) / 100

  // Quanto precisa tirar da reserva
  const reserveNeeded = r(Math.max(0, totalAPagar - caixaDisponivel))

  // Saldo após uso
  const reserveAfterUsage = r(Math.max(0, reserveTotal - reserveNeeded))

  // Runway — baseado em despesas essenciais vs receita recorrente
  const monthlyGap = Math.max(0, essentialExpenses - recurringIncome)
  let monthsOfRunway
  if (monthlyGap <= 0) {
    const base = essentialExpenses > 0 ? essentialExpenses : recurringIncome || 1
    monthsOfRunway = Math.round((reserveTotal / base) * 10) / 10
  } else {
    monthsOfRunway = Math.round((reserveTotal / monthlyGap) * 10) / 10
  }

  // Saúde
  let reserveHealth = 'none'
  if (reserveTotal <= 0) reserveHealth = 'none'
  else if (monthsOfRunway >= 6) reserveHealth = 'excellent'
  else if (monthsOfRunway >= 3) reserveHealth = 'good'
  else if (monthsOfRunway >= 1) reserveHealth = 'warning'
  else reserveHealth = 'critical'

  // Mensagem
  let message = ''
  if (reserveTotal <= 0) {
    message = 'Informe o saldo da sua reserva.'
  } else if (reserveNeeded <= 0) {
    message = `Reserva intacta com ${BRL(reserveTotal)}.`
  } else if (reserveNeeded <= reserveTotal) {
    message = `Transfira ${BRL(reserveNeeded)} da reserva para cobrir o mês.`
  } else {
    message = `Atenção: reserva (${BRL(reserveTotal)}) não cobre a necessidade de ${BRL(reserveNeeded)}.`
  }

  return {
    reserveNeeded,
    reserveAfterUsage,
    reserveTotal,
    monthsOfRunway,
    reserveHealth,
    needsReserve: reserveNeeded > 0,
    message,
  }
}
