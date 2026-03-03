import { getDaysInMonth, getDate } from 'date-fns'

const BRL = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

function projectCategory(currentAmount, dayOfMonth, daysInMonth, historicalValues) {
  const paceProjection = dayOfMonth > 0 ? (currentAmount / dayOfMonth) * daysInMonth : 0
  const validHistory = historicalValues.filter(v => v > 0)

  if (validHistory.length < 2) {
    return { projected: Math.round(paceProjection * 100) / 100, method: 'pace' }
  }

  const avgHistorical = validHistory.reduce((s, v) => s + v, 0) / validHistory.length

  let paceWeight
  if (dayOfMonth >= 20) paceWeight = 0.8
  else if (dayOfMonth >= 10) paceWeight = 0.6
  else paceWeight = 0.3

  const projected = paceProjection * paceWeight + avgHistorical * (1 - paceWeight)
  return { projected: Math.round(projected * 100) / 100, method: 'combined' }
}

function getConfidence(dayOfMonth, historyCount) {
  if (dayOfMonth >= 20 || historyCount >= 3) return 'high'
  if (dayOfMonth >= 10) return 'medium'
  return 'low'
}

export function forecastMonth({ currentTotals, dayOfMonth, daysInMonth, historicalSnapshots = [] }) {
  const day = dayOfMonth || getDate(new Date())
  const totalDays = daysInMonth || getDaysInMonth(new Date())
  const daysRemaining = Math.max(totalDays - day, 0)

  const recent = historicalSnapshots.slice(-6)
  const historyCount = recent.length

  const cats = ['receita', 'fixas', 'cartao', 'invest']
  const projections = {}

  for (const cat of cats) {
    const current = Number(currentTotals[cat]) || 0
    const histValues = recent.map(s => Number(s[cat]) || 0)
    const { projected } = projectCategory(current, day, totalDays, histValues)
    const confidence = getConfidence(day, historyCount)

    projections[cat] = { current, projected, confidence }
  }

  const totalExpensesProjected = projections.fixas.projected + projections.cartao.projected + projections.invest.projected
  const projectedSaldo = Math.round((projections.receita.projected - totalExpensesProjected) * 100) / 100
  const currentExpenses = (currentTotals.fixas || 0) + (currentTotals.cartao || 0) + (currentTotals.invest || 0)
  const currentSaldo = (currentTotals.receita || 0) - currentExpenses
  const receita = projections.receita.projected || 1
  const percentUsed = Math.round((currentExpenses / receita) * 1000) / 10
  const percentProjected = Math.round((totalExpensesProjected / receita) * 1000) / 10
  const confidence = getConfidence(day, historyCount)

  let riskLevel = 'safe'
  if (projectedSaldo < -(receita * 0.1)) riskLevel = 'danger'
  else if (projectedSaldo < 0) riskLevel = 'attention'

  let message
  if (day < 5) {
    message = 'Poucos dados — previsão preliminar. Continue registrando para maior precisão.'
  } else if (riskLevel === 'safe') {
    message = `No ritmo atual, você terminará o mês com saldo positivo de ${BRL(projectedSaldo)}.`
  } else if (riskLevel === 'attention') {
    message = `Atenção: no ritmo atual, seus gastos vão consumir quase toda a receita. Saldo projetado: ${BRL(projectedSaldo)}.`
  } else {
    message = `Cuidado: no ritmo atual, seus gastos vão ultrapassar a receita em ${BRL(Math.abs(projectedSaldo))}.`
  }

  return {
    projections,
    projectedSaldo,
    currentSaldo,
    totalExpensesProjected,
    confidence,
    riskLevel,
    percentUsed,
    percentProjected,
    daysRemaining,
    dayOfMonth: day,
    daysInMonth: totalDays,
    message,
  }
}
