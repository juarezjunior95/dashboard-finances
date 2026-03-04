import { getDaysInMonth, getDate } from 'date-fns'

const BRL = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/**
 * Projeção para categorias com gastos PONTUAIS (fixas, invest).
 * Lógica: gastos pontuais geralmente já foram pagos no início do mês.
 */
function projectLumpSum(currentAmount, dayOfMonth, daysInMonth, historicalValues) {
  const validHistory = historicalValues.filter(v => v > 0)
  
  if (validHistory.length >= 2) {
    const avgHistorical = validHistory.reduce((s, v) => s + v, 0) / validHistory.length
    
    if (dayOfMonth >= 20) {
      return { projected: Math.max(currentAmount, avgHistorical * 0.9), method: 'lump_late' }
    }
    
    if (dayOfMonth >= 10) {
      return { projected: Math.max(currentAmount, avgHistorical), method: 'lump_mid' }
    }
    
    if (currentAmount >= avgHistorical) {
      return { projected: currentAmount * 1.05, method: 'lump_early_above' }
    }
    return { projected: avgHistorical, method: 'lump_early_below' }
  }
  
  if (dayOfMonth >= 15) {
    return { projected: currentAmount * 1.1, method: 'lump_no_history_late' }
  }
  return { projected: currentAmount * 1.5, method: 'lump_no_history_early' }
}

/**
 * Projeção para categorias com gastos DIÁRIOS/CONTÍNUOS (cartão).
 * Usa projeção linear (pace) combinada com histórico.
 */
function projectLinear(currentAmount, dayOfMonth, daysInMonth, historicalValues) {
  const paceProjection = dayOfMonth > 0 ? (currentAmount / dayOfMonth) * daysInMonth : 0
  const validHistory = historicalValues.filter(v => v > 0)
  
  if (validHistory.length < 2) {
    return { projected: Math.round(paceProjection * 100) / 100, method: 'linear_pace' }
  }
  
  const avgHistorical = validHistory.reduce((s, v) => s + v, 0) / validHistory.length
  
  let paceWeight
  if (dayOfMonth >= 20) paceWeight = 0.8
  else if (dayOfMonth >= 10) paceWeight = 0.6
  else paceWeight = 0.3
  
  const projected = paceProjection * paceWeight + avgHistorical * (1 - paceWeight)
  return { projected: Math.round(projected * 100) / 100, method: 'linear_combined' }
}

/**
 * Projeção para receita (valor fixo/pontual).
 */
function projectReceita(currentAmount, historicalValues) {
  if (currentAmount > 0) {
    return { projected: currentAmount, method: 'receita_actual' }
  }
  const valid = historicalValues.filter(v => v > 0)
  if (valid.length >= 2) {
    const avg = valid.reduce((s, v) => s + v, 0) / valid.length
    return { projected: Math.round(avg * 100) / 100, method: 'receita_historical' }
  }
  return { projected: 0, method: 'receita_none' }
}

function getConfidence(dayOfMonth, historyCount) {
  if (dayOfMonth >= 20 || historyCount >= 3) return 'high'
  if (dayOfMonth >= 10) return 'medium'
  return 'low'
}

const CATEGORY_MODELS = {
  receita: 'receita',
  fixas: 'lump_sum',
  cartao: 'linear',
  invest: 'lump_sum',
}

export function forecastMonth({ currentTotals, dayOfMonth, daysInMonth, historicalSnapshots = [] }) {
  const day = dayOfMonth || getDate(new Date())
  const totalDays = daysInMonth || getDaysInMonth(new Date())
  const daysRemaining = Math.max(totalDays - day, 0)

  const recent = historicalSnapshots.slice(-6)
  const historyCount = recent.length

  const projections = {}
  const cats = ['receita', 'fixas', 'cartao', 'invest']

  for (const cat of cats) {
    const current = Number(currentTotals[cat]) || 0
    const histValues = recent.map(s => Number(s[cat]) || 0)
    const model = CATEGORY_MODELS[cat]
    
    let result
    if (model === 'receita') {
      result = projectReceita(current, histValues)
    } else if (model === 'lump_sum') {
      result = projectLumpSum(current, day, totalDays, histValues)
    } else {
      result = projectLinear(current, day, totalDays, histValues)
    }
    
    const confidence = getConfidence(day, historyCount)
    projections[cat] = { 
      current, 
      projected: Math.round(result.projected * 100) / 100, 
      method: result.method,
      confidence 
    }
  }

  const totalExpensesProjected = projections.fixas.projected + projections.cartao.projected + projections.invest.projected
  const receitaProjetada = projections.receita.projected
  const projectedSaldo = Math.round((receitaProjetada - totalExpensesProjected) * 100) / 100
  const currentExpenses = (currentTotals.fixas || 0) + (currentTotals.cartao || 0) + (currentTotals.invest || 0)
  const currentSaldo = Math.round(((currentTotals.receita || 0) - currentExpenses) * 100) / 100
  const receita = receitaProjetada || 1
  const percentUsed = Math.round((currentExpenses / receita) * 1000) / 10
  const percentProjected = Math.round((totalExpensesProjected / receita) * 1000) / 10
  const confidence = getConfidence(day, historyCount)

  let riskLevel = 'safe'
  if (projectedSaldo < -(receita * 0.1)) riskLevel = 'danger'
  else if (projectedSaldo < 0) riskLevel = 'attention'

  const orcamentoDisponivel = currentSaldo
  const orcamentoDiario = daysRemaining > 0
    ? Math.round((currentSaldo / daysRemaining) * 100) / 100
    : 0

  let message
  const receitaReal = Number(currentTotals.receita) || 0
  if (receitaReal === 0) {
    message = 'Registre sua receita para ver a previsão do mês.'
  } else if (currentSaldo < 0) {
    message = `Seus gastos já ultrapassaram a receita em ${BRL(Math.abs(currentSaldo))}. Evite novos gastos.`
  } else if (currentSaldo < receitaReal * 0.1) {
    message = `Atenção: sobram apenas ${BRL(currentSaldo)}. Limite seus gastos a ${BRL(Math.max(orcamentoDiario, 0))}/dia.`
  } else if (daysRemaining > 0) {
    message = `Você pode gastar até ${BRL(orcamentoDiario)}/dia nos próximos ${daysRemaining} dias para terminar o mês no positivo.`
  } else {
    message = projectedSaldo >= 0
      ? `Mês encerrado com saldo positivo de ${BRL(projectedSaldo)}.`
      : `Mês encerrado com saldo negativo de ${BRL(Math.abs(projectedSaldo))}.`
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
    receitaReal,
    receitaProjetada,
    orcamentoDisponivel,
    orcamentoDiario,
    currentExpenses,
  }
}
