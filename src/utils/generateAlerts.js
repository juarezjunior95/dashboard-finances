const BRL = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const CATEGORY_LABELS = {
  fixas: 'Contas Fixas',
  cartao: 'Cartão',
  invest: 'Investimentos',
}

export function generateAlerts({
  totals,
  prevTotals,
  budgetAlerts,
  plan,
  forecast,
  selectedMonth,
  currentMonth,
  historicalSnapshots = [],
}) {
  const alerts = []
  if (!totals) return alerts

  const { receita = 0, fixas = 0, cartao = 0, invest = 0 } = totals
  const saldo = receita - fixas - cartao - invest
  const isCurrentMonth = selectedMonth === currentMonth
  const hasData = receita > 0 || fixas > 0 || cartao > 0 || invest > 0
  const hasSaldoNegativo = saldo < 0

  // 1. Saldo negativo (danger)
  if (hasSaldoNegativo) {
    alerts.push({
      id: 'saldo-negativo',
      type: 'saldo-negativo',
      severity: 'danger',
      icon: '🚨',
      title: 'Gastos acima da receita',
      message: `Seus gastos superam a receita em ${BRL(Math.abs(saldo))}. Revise seus gastos urgentemente.`,
      action: 'Identifique despesas que podem ser cortadas ou adiadas.',
      dismissable: true,
    })
  }

  // 2. Limite de orçamento ultrapassado (danger)
  if (budgetAlerts) {
    const exceededIds = new Set()
    for (const [cat, alert] of Object.entries(budgetAlerts)) {
      if (alert.level === 'exceeded') {
        exceededIds.add(cat)
        const label = CATEGORY_LABELS[cat] || cat
        alerts.push({
          id: `budget-exceeded-${cat}`,
          type: 'budget-exceeded',
          severity: 'danger',
          icon: '🔴',
          title: `${label} ultrapassou o limite`,
          message: `Gastos de ${alert.pct}% do limite definido.`,
          category: cat,
          dismissable: true,
        })
      }
    }

    // 4. Limite de orçamento próximo (warning) - skip if exceeded
    for (const [cat, alert] of Object.entries(budgetAlerts)) {
      if (alert.level === 'warning' && !exceededIds.has(cat)) {
        const label = CATEGORY_LABELS[cat] || cat
        alerts.push({
          id: `budget-warning-${cat}`,
          type: 'budget-warning',
          severity: 'warning',
          icon: '⚠️',
          title: `${label} próximo do limite`,
          message: `Gastos em ${alert.pct}% do limite.`,
          action: 'Revise seus gastos variáveis este mês.',
          category: cat,
          dismissable: true,
        })
      }
    }
  }

  // 3. Projeção de saldo negativo (warning) - skip if already saldo negativo
  if (!hasSaldoNegativo && isCurrentMonth && forecast?.riskLevel === 'danger') {
    alerts.push({
      id: 'forecast-danger',
      type: 'forecast-danger',
      severity: 'warning',
      icon: '📉',
      title: 'Projeção: gastos vão superar receita',
      message: `No ritmo atual, o mês terminará com saldo negativo de ${BRL(Math.abs(forecast.projectedSaldo))}.`,
      action: 'Reduza gastos variáveis nos próximos dias.',
      dismissable: true,
    })
  }

  // 5. Investimento atrasado (warning) - only current month
  if (isCurrentMonth && plan?.status === 'active' && invest === 0 && plan.nextMonthSuggestion > 0) {
    alerts.push({
      id: 'invest-pending',
      type: 'invest-pending',
      severity: 'warning',
      icon: '💰',
      title: 'Investimento pendente',
      message: `Você ainda não investiu neste mês. Sugestão: ${BRL(plan.nextMonthSuggestion)}.`,
      action: 'Registre seu investimento no Planejamento.',
      dismissable: true,
    })
  }

  // 6. Meta de investimento atrasada (danger)
  if (plan?.status === 'overdue') {
    alerts.push({
      id: 'invest-overdue',
      type: 'invest-overdue',
      severity: 'danger',
      icon: '⏰',
      title: 'Meta de investimento atrasada',
      message: `Sua meta está atrasada. Aporte necessário: ${BRL(plan.remaining)}.`,
      dismissable: true,
    })
  }

  // 7. Tendência de alta em despesas (warning)
  if (historicalSnapshots.length >= 3) {
    const sorted = [...historicalSnapshots].sort((a, b) => (a.month || '').localeCompare(b.month || ''))
    const last3 = sorted.slice(-3)
    for (const cat of ['fixas', 'cartao']) {
      const vals = last3.map(s => Number(s[cat]) || 0)
      if (vals.length === 3 && vals[0] > 0 && vals[1] > vals[0] && vals[2] > vals[1]) {
        const label = CATEGORY_LABELS[cat]
        alerts.push({
          id: `trend-up-${cat}`,
          type: 'trend-up',
          severity: 'warning',
          icon: '📈',
          title: `${label} em tendência de alta`,
          message: `Seus gastos com ${label} aumentaram nos últimos 3 meses.`,
          action: 'Avalie se há algum gasto novo que pode ser reduzido.',
          category: cat,
          dismissable: true,
        })
      }
    }
  }

  // 8. Melhoria detectada (success)
  if (prevTotals) {
    for (const cat of ['fixas', 'cartao']) {
      const prev = Number(prevTotals[cat]) || 0
      const curr = Number(totals[cat]) || 0
      if (prev > 0 && curr > 0 && curr <= prev * 0.9) {
        const pct = Math.round(((prev - curr) / prev) * 100)
        const label = CATEGORY_LABELS[cat]
        alerts.push({
          id: `improvement-${cat}`,
          type: 'improvement',
          severity: 'success',
          icon: '🎉',
          title: `Gastos com ${label} reduziram!`,
          message: `Seus gastos diminuíram ${pct}% em relação ao mês passado. Continue assim!`,
          category: cat,
          dismissable: true,
        })
      }
    }
  }

  // 9. Investimento acima do ideal (success)
  if (receita > 0 && invest > 0) {
    const investPct = (invest / receita) * 100
    if (investPct > 20) {
      alerts.push({
        id: 'invest-above-ideal',
        type: 'invest-above-ideal',
        severity: 'success',
        icon: '🏆',
        title: 'Investimentos acima do ideal',
        message: `Você está investindo ${Math.round(investPct)}% da receita — acima dos 20% recomendados. Excelente!`,
        dismissable: true,
      })
    }
  }

  // 10. Mês sem dados (info) - only current month
  if (isCurrentMonth && !hasData) {
    alerts.push({
      id: 'no-data',
      type: 'no-data',
      severity: 'info',
      icon: '📝',
      title: `Registre seus dados`,
      message: 'Você ainda não registrou dados deste mês. Importe um arquivo ou insira manualmente.',
      dismissable: true,
    })
  }

  // Dedup & limit: max 5, prioritized by severity
  const severityOrder = { danger: 0, warning: 1, info: 2, success: 3 }
  alerts.sort((a, b) => (severityOrder[a.severity] ?? 9) - (severityOrder[b.severity] ?? 9))

  return alerts.slice(0, 5)
}
