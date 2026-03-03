/**
 * Regra 50-30-20 — Elizabeth Warren, "All Your Worth" (2005)
 * Recomendada por: Nubank, InfoMoney, Serasa, Banco Central do Brasil.
 *
 * 50% da renda liquida → Necessidades (contas fixas)
 * 30% da renda liquida → Desejos (gastos variaveis / cartao)
 * 20% da renda liquida → Objetivos financeiros (investimentos)
 */

const RULES = [
  {
    category: 'fixas',
    label: 'Contas Fixas',
    idealPct: 50,
    direction: 'max',
    tip: 'Gastos essenciais como moradia, luz, agua, internet e transporte nao devem ultrapassar 50% da sua renda liquida.',
    tipOver: 'Considere renegociar aluguel, trocar de plano de celular/internet, ou buscar alternativas de transporte mais baratas.',
    tipGood: 'Parabens! Suas contas fixas estao dentro do recomendado, sobrando mais espaco para investir e aproveitar.',
  },
  {
    category: 'cartao',
    label: 'Cartao',
    idealPct: 30,
    direction: 'max',
    tip: 'Gastos variaveis como lazer, restaurantes, assinaturas e compras por impulso devem ficar em ate 30% da renda.',
    tipOver: 'Revise assinaturas que nao usa, reduza delivery e compras por impulso. Pequenos cortes somam muito no final do mes.',
    tipGood: 'Otimo controle dos gastos variaveis! Voce esta deixando espaco saudavel para poupanca e emergencias.',
  },
  {
    category: 'invest',
    label: 'Investimentos',
    idealPct: 20,
    direction: 'min',
    tip: 'Reserve pelo menos 20% da renda para investimentos, reserva de emergencia e objetivos de longo prazo.',
    tipOver: 'Excelente! Investir acima de 20% acelera a construcao de patrimonio e antecipa suas metas financeiras.',
    tipGood: 'Voce esta no caminho certo investindo pelo menos 20%. Mantenha a consistencia mes a mes.',
  },
]

const SOURCE = 'Regra 50-30-20 (Elizabeth Warren, "All Your Worth")'

function getStatus(actual, idealPct, direction) {
  if (direction === 'max') {
    if (actual <= idealPct - 10) return 'excellent'
    if (actual <= idealPct) return 'ok'
    if (actual <= idealPct + 10) return 'warning'
    return 'danger'
  }
  // direction === 'min' (invest: more is better)
  if (actual >= idealPct + 5) return 'excellent'
  if (actual >= idealPct) return 'ok'
  if (actual >= idealPct - 10) return 'warning'
  return 'danger'
}

function buildMessage(rule, actual) {
  const { label, idealPct, direction } = rule
  const pctStr = actual.toFixed(1)
  const diff = Math.abs(actual - idealPct).toFixed(1)

  if (direction === 'max') {
    if (actual <= idealPct) {
      return `${label} esta em ${pctStr}% — dentro do ideal de ate ${idealPct}%.`
    }
    return `${label} esta em ${pctStr}% — ${diff}pp acima do ideal de ${idealPct}%.`
  }

  // direction === 'min'
  if (actual >= idealPct) {
    return `${label} esta em ${pctStr}% — acima do minimo ideal de ${idealPct}%.`
  }
  return `${label} esta em ${pctStr}% — faltam ${diff}pp para atingir o minimo de ${idealPct}%.`
}

function getActionTip(rule, status) {
  if (status === 'excellent' || status === 'ok') {
    return rule.direction === 'min' ? rule.tipOver : rule.tipGood
  }
  return rule.direction === 'min' ? rule.tip : rule.tipOver
}

export function analyzeFinances({ receita, fixas, cartao, invest }) {
  if (!receita || receita <= 0) {
    return { rules: [], overallScore: 'empty', overallMessage: '', source: SOURCE }
  }

  const values = { fixas, cartao, invest }
  let dangerCount = 0
  let warningCount = 0

  const rules = RULES.map(rule => {
    const spent = values[rule.category] || 0
    const actual = (spent / receita) * 100
    const status = getStatus(actual, rule.idealPct, rule.direction)
    const message = buildMessage(rule, actual)
    const actionTip = getActionTip(rule, status)

    if (status === 'danger') dangerCount++
    if (status === 'warning') warningCount++

    return {
      category: rule.category,
      label: rule.label,
      idealPct: rule.idealPct,
      direction: rule.direction,
      actual: Math.round(actual * 10) / 10,
      status,
      message,
      tip: rule.tip,
      actionTip,
      source: SOURCE,
    }
  })

  let overallScore = 'healthy'
  let overallMessage = 'Suas financas estao saudaveis! Continue assim.'

  if (dangerCount >= 2) {
    overallScore = 'critical'
    overallMessage = 'Atencao urgente: suas financas precisam de ajustes importantes em mais de uma area.'
  } else if (dangerCount >= 1 || warningCount >= 2) {
    overallScore = 'attention'
    overallMessage = 'Algumas categorias precisam de atencao. Revise os pontos destacados abaixo.'
  } else if (warningCount >= 1) {
    overallScore = 'attention'
    overallMessage = 'Quase tudo em ordem, mas ha um ponto que merece atencao.'
  }

  return { rules, overallScore, overallMessage, source: SOURCE }
}

export { RULES, SOURCE }
