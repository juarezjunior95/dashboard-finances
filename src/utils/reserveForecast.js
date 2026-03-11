/**
 * Cálculos do fundo de reserva.
 *
 * reserveAfterUse = reserveTotal - reserveTransferred (estável, manual)
 * reserveNeeded = max(0, remainingToPay - availableCash) (pode mudar com status)
 *
 * reserveTransferred é o valor que o usuário JÁ transferiu da reserva
 * para a conta. Só muda quando o usuário informa explicitamente.
 */

const BRL = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export function calculateReserveForecast({
  availableCash = 0,
  remainingToPay = 0,
  recurringIncome = 0,
  essentialExpenses = 0,
  reserveTotal = 0,
  reserveTransferred = 0,
}) {
  const r = (v) => Math.round(v * 100) / 100
  const transferred = reserveTransferred || 0

  // Necessidade adicional (além do que já foi transferido)
  const reserveNeeded = r(Math.max(0, remainingToPay - availableCash))

  // Reserva após uso = total - o que já saiu (estável)
  const reserveAfterUsage = r(Math.max(0, reserveTotal - transferred))

  // Runway — baseado em despesas essenciais vs receita recorrente
  const monthlyGap = Math.max(0, essentialExpenses - recurringIncome)
  let monthsOfRunway
  if (monthlyGap <= 0) {
    const base = essentialExpenses > 0 ? essentialExpenses : recurringIncome || 1
    monthsOfRunway = Math.round((reserveAfterUsage / base) * 10) / 10
  } else {
    monthsOfRunway = Math.round((reserveAfterUsage / monthlyGap) * 10) / 10
  }

  let reserveHealth = 'none'
  if (reserveTotal <= 0) reserveHealth = 'none'
  else if (monthsOfRunway >= 6) reserveHealth = 'excellent'
  else if (monthsOfRunway >= 3) reserveHealth = 'good'
  else if (monthsOfRunway >= 1) reserveHealth = 'warning'
  else reserveHealth = 'critical'

  let message = ''
  if (reserveTotal <= 0) {
    message = 'Informe o saldo da sua reserva.'
  } else if (transferred > 0 && reserveNeeded <= 0) {
    message = `Já transferiu ${BRL(transferred)} da reserva. Caixa cobre o restante.`
  } else if (reserveNeeded <= 0) {
    message = `Reserva intacta com ${BRL(reserveTotal)}.`
  } else if (transferred > 0) {
    message = `Já transferiu ${BRL(transferred)}. Ainda precisa de mais ${BRL(reserveNeeded)}.`
  } else if (reserveNeeded <= reserveTotal) {
    message = `Transfira ${BRL(reserveNeeded)} da reserva para cobrir o mês.`
  } else {
    message = `Atenção: reserva (${BRL(reserveTotal)}) não cobre a necessidade de ${BRL(reserveNeeded)}.`
  }

  return {
    reserveNeeded,
    reserveAfterUsage,
    reserveTotal,
    reserveTransferred: transferred,
    monthsOfRunway,
    reserveHealth,
    needsReserve: reserveNeeded > 0,
    message,
  }
}
