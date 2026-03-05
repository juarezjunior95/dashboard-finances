# Correção: Coerência entre Previsão do Mês e Alertas Inteligentes

## Contexto

O card "Previsão do Mês" e o "Alertas Inteligentes" estão mostrando informações CONTRADITÓRIAS ao usuário, destruindo a confiança no produto.

### O problema concreto (screenshot real, dia 5 de 31):

**ForecastCard diz:**
- Receita: R$ 8.959 | Já gasto: R$ 7.869 | Disponível: R$ 1.089 | R$ 41,89/dia
- Mensagem: "Você pode gastar até R$ 41,89/dia nos próximos 26 dias para terminar o mês no positivo."

**SmartAlerts diz:**
- "Projeção: gastos vão superar receita"
- "No ritmo atual, o mês terminará com saldo negativo de R$ 2.860,28."
- "Dica: Reduza gastos variáveis nos próximos dias."

**Isso não faz sentido para o usuário.** Um diz "está tudo bem, gaste R$41/dia" e o outro grita "PERIGO, vai faltar R$2.860!"

### Causa raiz técnica

O ForecastCard KPIs usam dados REAIS:
```
currentSaldo = receita - fixas - cartao - invest = 8.959 - 7.869 = +1.089 ✓
orcamentoDiario = 1.089 / 26 = 41,89 ✓
```

O SmartAlerts usa `forecast.riskLevel` e `forecast.projectedSaldo` que são baseados na SOMA DAS PROJEÇÕES POR CATEGORIA:
```
totalExpensesProjected = fixas_proj + cartao_proj + invest_proj
                       = 5.828 + 5.241 + 750
                       = 11.819

projectedSaldo = 8.959 - 11.819 = -2.860 ← é daqui que vem o alerta de perigo
```

O problema é que o Cartão projetado R$5.241 (confiança BAIXA, dia 5) infla o total projetado artificialmente. E o riskLevel é calculado com base nessa soma inflada:

```javascript
// forecast.js linha 130-132
let riskLevel = 'safe'
if (projectedSaldo < -(receita * 0.1)) riskLevel = 'danger'
else if (projectedSaldo < 0) riskLevel = 'attention'
```

### Stack e padrões
- React 19, Tailwind CSS, dark mode via `dark:`
- Cores: emerald (receita/ok), rose (fixas), orange (cartão), indigo (invest), âmbar (warning), vermelho (danger)
- Formatação BRL, date-fns ptBR
- Toasts via useToast(), ConfirmModal para ações destrutivas
- Não adicionar dependências novas

### Arquivos a modificar
```
src/utils/forecast.js              # Lógica de riskLevel e projeções
src/utils/generateAlerts.js        # Lógica de geração do alerta de forecast
src/components/ForecastCard.jsx    # Seção "Detalhes por categoria"
```

---

## HISTÓRIA 1 — Alinhar riskLevel com a realidade do usuário

**Como usuário, quero que o nível de risco reflita minha situação real (saldo disponível), não uma projeção especulativa de baixa confiança.**

### Regra de negócio

O `riskLevel` deve ser determinado por uma combinação do saldo REAL com a confiança da projeção:

```
SE saldoAtual < 0:
  → riskLevel = 'danger' (já estourou, fato concreto)
  
SE saldoAtual > 0 E saldoAtual < 10% da receita:
  → riskLevel = 'attention' (margem apertada, fato concreto)
  
SE saldoAtual > 10% da receita:
  → SE projeçãoConfiável (confiança alta) E projectedSaldo < 0:
      → riskLevel = 'attention' (a projeção indica risco, mas hoje está ok)
  → SENÃO:
      → riskLevel = 'safe' (hoje está ok, projeção incerta não deveria alarmar)
```

### Implementação em `forecast.js`

Substituir o cálculo do riskLevel (linhas 130-132):

```javascript
// Calcular riskLevel baseado na REALIDADE + confiança da projeção
let riskLevel = 'safe'

if (currentSaldo < 0) {
  // Já estourou — fato, não projeção
  riskLevel = 'danger'
} else if (currentSaldo < receitaProjetada * 0.1) {
  // Margem apertada — fato
  riskLevel = 'attention'
} else if (confidence === 'high' && projectedSaldo < 0) {
  // Projeção confiável (dia 20+ ou 3+ meses de histórico) indica risco
  riskLevel = 'attention'
} else {
  // Saldo positivo com folga, projeção incerta não gera alarme
  riskLevel = 'safe'
}
```

**Resultado para o cenário do screenshot (dia 5):**
- `currentSaldo = +1.089` (positivo, > 10% de 8.959 = 895)
- `confidence = 'low'` (dia 5, poucos dados)
- Projeção negativa MAS confiança baixa → `riskLevel = 'safe'`
- Alerta de "saldo negativo" NÃO é disparado ✓
- ForecastCard e SmartAlerts agora concordam ✓

**Resultado para cenário dia 25:**
- `currentSaldo = +500` (positivo mas < 10% de 8.959)
- `confidence = 'high'` (dia 25)
- → `riskLevel = 'attention'`
- Alerta ameno, não alarmista ✓

**Resultado para cenário já estourado:**
- `currentSaldo = -200` (negativo)
- → `riskLevel = 'danger'`
- Alerta urgente, totalmente justificado ✓

### Aceite
- Dia 5, saldo +1.089 → riskLevel 'safe' (sem alerta de forecast)
- Dia 5, saldo -200 → riskLevel 'danger' (alerta de saldo negativo real)
- Dia 25, saldo +300, projeção negativa → riskLevel 'attention' (alerta suave)
- Dia 25, saldo +2.000, projeção positiva → riskLevel 'safe'

---

## HISTÓRIA 2 — Reformular o alerta de projeção no generateAlerts

**Como usuário, quero que alertas de projeção financeira sejam úteis e acionáveis, não alarmistas baseados em dados incertos.**

### Implementação em `generateAlerts.js`

Substituir o alerta de forecast (linhas 82-93) por uma lógica mais nuançada:

```javascript
// 3. Alerta baseado na projeção — SOMENTE se confiável e relevante
if (!hasSaldoNegativo && isCurrentMonth && forecast) {
  
  // Cenário A: Saldo real ainda positivo, mas margem apertada
  if (forecast.currentSaldo > 0 && forecast.currentSaldo < (totals.receita * 0.1)) {
    alerts.push({
      id: 'forecast-tight',
      type: 'forecast-tight',
      severity: 'warning',
      icon: '⚠️',
      title: 'Margem apertada',
      message: `Sobram ${BRL(forecast.currentSaldo)} para os próximos ${forecast.daysRemaining} dias (${BRL(forecast.orcamentoDiario)}/dia).`,
      action: 'Controle gastos variáveis para fechar o mês positivo.',
      dismissable: true,
    })
  }
  
  // Cenário B: Projeção negativa COM confiança alta — alerta informativo, não alarmista
  else if (forecast.confidence === 'high' && forecast.projectedSaldo < 0 && forecast.currentSaldo > 0) {
    alerts.push({
      id: 'forecast-trend',
      type: 'forecast-trend',
      severity: 'warning',
      icon: '📊',
      title: 'Tendência de gastos acima da receita',
      message: `Com base no seu histórico, os gastos podem chegar a ${BRL(forecast.totalExpensesProjected)}. Hoje você ainda tem ${BRL(forecast.currentSaldo)} disponível.`,
      action: `Mantenha gastos abaixo de ${BRL(forecast.orcamentoDiario)}/dia para fechar no positivo.`,
      dismissable: true,
    })
  }
  
  // NÃO gerar alerta se:
  // - Confiança baixa/média e saldo positivo (dados insuficientes para alarmar)
  // - Saldo com folga e projeção ok
}
```

**O que muda:**
1. **Remove o alerta alarmista "Saldo negativo de R$2.860"** quando o saldo real é +R$1.089
2. **Adiciona alerta de "margem apertada"** quando o saldo real é baixo (< 10% da receita)
3. **Alerta de tendência** só aparece com confiança alta, e sempre mostra o saldo real disponível junto
4. **A dica é acionável:** "Mantenha gastos abaixo de R$41/dia" (consistente com o ForecastCard)

### Aceite
- Dia 5, saldo +1.089, confiança baixa → nenhum alerta de forecast
- Dia 5, saldo +200 (< 10% de 8.959=895) → "Margem apertada: sobram R$200 para 26 dias"
- Dia 25, saldo +1.000, confiança alta, projeção negativa → "Tendência de gastos acima da receita. Hoje você ainda tem R$1.000."
- Nunca contradizer o ForecastCard

---

## HISTÓRIA 3 — Reformular "Detalhes por categoria" para ser útil, não confuso

**Como usuário, quero que os detalhes por categoria me ajudem a entender ONDE estou gastando e QUANTO posso gastar em cada área, em vez de mostrar projeções que não fazem sentido.**

### Problema atual
O "Projetado" é um número solto que o usuário não entende. Exemplos:
- "Contas Fixas: Projetado R$5.828" — O que faço com essa informação? Já paguei R$5.557 em contas fixas, provavelmente não vou gastar mais R$270. E se gastar, como isso me ajuda?
- "Cartão: Projetado R$5.241" — Confiança BAIXA, dia 5. Esse número é praticamente um chute.
- "Investimentos: Projetado R$750" — "Estimativa conservadora (sem histórico)". Sem histórico, esse número não ajuda.

### Redesign proposto

**Trocar a perspectiva de "quanto vou gastar" para "como estou em relação ao meu padrão".**

Novo layout por categoria:

```
┌─────────────────────────────────────────────────────────┐
│ ● Contas Fixas                                          │
│                                                         │
│   Gasto atual           Média mensal         Status     │
│   R$ 5.557,90           R$ 5.828,23          ✓ Normal   │
│                                                         │
│   ██████████████████████████████████████████░ 95%        │
│   95% da sua média mensal                               │
│                                                         │
│   Mês anterior: R$ 6.298,00 (12% a menos que antes)    │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ ● Cartão                                     ⚠ Atenção  │
│                                                         │
│   Gasto atual           Ritmo diário         Projeção   │
│   R$ 1.812,00           R$ 362/dia           ~R$ 5.241  │
│                                                         │
│   ██████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░ 73%        │
│   73% do mês anterior (R$ 2.466)                        │
│                                                         │
│   ⚠ No ritmo atual, pode ultrapassar o mês anterior.   │
│   Dia 5 — projeção incerta, acompanhe nos próximos dias │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ ● Investimentos                              ✓ Ok       │
│                                                         │
│   Aporte realizado                                      │
│   R$ 500,00                                             │
│                                                         │
│   Mês anterior: R$ 100,00 (+400%)                       │
└─────────────────────────────────────────────────────────┘
```

### Implementação em `ForecastCard.jsx`

**Substituir a seção "Detalhes por categoria" (linhas 199-277) pela nova lógica:**

Para cada categoria, determinar um **status** e exibir informações contextuais diferentes:

```javascript
function getCategoryStatus(cat, proj, dayOfMonth, prevValue, avgHistorical) {
  const { current, projected, method, confidence } = proj
  
  // Categorias lump_sum (fixas, invest): comparar com média/anterior
  if (method.startsWith('lump_') || method.startsWith('receita')) {
    const reference = avgHistorical || prevValue || 0
    if (reference === 0) return { status: 'neutral', label: 'Sem referência' }
    const pct = (current / reference) * 100
    if (pct > 120) return { status: 'warning', label: 'Acima da média' }
    if (pct > 90) return { status: 'ok', label: 'Normal' }
    return { status: 'good', label: 'Abaixo da média' }
  }
  
  // Categorias lineares (cartão): analisar ritmo
  if (dayOfMonth < 10) {
    return { status: 'neutral', label: 'Acompanhe' }
  }
  const reference = prevValue || avgHistorical || projected
  if (projected > reference * 1.2) return { status: 'warning', label: 'Acima do padrão' }
  if (projected > reference) return { status: 'attention', label: 'Atenção' }
  return { status: 'ok', label: 'Normal' }
}
```

**Layout diferente por tipo de categoria:**

1. **Fixas e Invest (lump_sum):**
   - Mostrar: "Gasto atual" + "Média mensal" + "Status"
   - Barra: atual vs. média (não projeção)
   - Subtexto: comparação com mês anterior (se disponível)
   - Se sem histórico: mostrar apenas o valor atual, sem projeção fake
   - NÃO mostrar "Projetado" como coluna principal — é confuso para despesas pontuais

2. **Cartão (linear):**
   - Mostrar: "Gasto atual" + "Ritmo diário" + "Projeção estimada"
   - A projeção fica com label "~R$ X" (til indica estimativa)
   - Barra: atual vs. mês anterior
   - Subtexto: se dia < 10: "Poucos dias — projeção incerta, acompanhe"
   - Se dia >= 10: "No ritmo de R$ X/dia, pode chegar a R$ Y"
   - Se projeção > mês anterior: aviso "Pode ultrapassar o mês anterior"

3. **Para TODAS as categorias:**
   - Mês anterior sempre visível (se disponível) como âncora de comparação
   - Nunca mostrar "Projetado R$ X" como número definitivo sem contexto
   - Sempre acompanhar de uma explicação em linguagem natural

### Aceite
- Fixas dia 5: mostra "R$5.557 atual | Média R$5.828 | Normal ✓" (sem projeção confusa)
- Cartão dia 5: mostra "R$1.812 atual | R$362/dia | ~R$5.241" + "Poucos dias, acompanhe"
- Cartão dia 20: mostra "R$3.500 atual | R$175/dia | ~R$4.025" + "Pode ultrapassar mês anterior"
- Invest dia 5: mostra "Aporte: R$500 | Mês anterior: R$100" (sem projeção linear)
- Sem histórico: mostra apenas atual, sem números inventados
- Nenhum número projetado sem explicação do método

---

## HISTÓRIA 4 — ForecastCard deve exportar dados coerentes para o SmartAlerts

**Como sistema, quero que o forecast retorne um campo `alertSuggestion` pré-calculado para que o SmartAlerts não precise interpretar projeções por conta própria.**

### Implementação em `forecast.js`

Adicionar ao retorno do `forecastMonth`:

```javascript
return {
  // ... campos existentes ...
  
  // NOVO: sugestão de alerta pré-calculada (se necessário)
  alertSuggestion: buildAlertSuggestion({
    currentSaldo, receitaProjetada, orcamentoDiario, 
    daysRemaining, confidence, projectedSaldo
  }),
}

function buildAlertSuggestion({ currentSaldo, receitaProjetada, orcamentoDiario, daysRemaining, confidence, projectedSaldo }) {
  // Já estourou — fato concreto
  if (currentSaldo < 0) {
    return {
      shouldAlert: true,
      severity: 'danger',
      title: 'Gastos acima da receita',
      message: `Seus gastos já ultrapassaram a receita em ${BRL(Math.abs(currentSaldo))}.`,
      action: 'Evite novos gastos e revise despesas que podem ser canceladas.',
    }
  }
  
  // Margem apertada — fato concreto
  if (currentSaldo > 0 && currentSaldo < receitaProjetada * 0.1) {
    return {
      shouldAlert: true,
      severity: 'warning',
      title: 'Margem apertada',
      message: `Sobram ${BRL(currentSaldo)} para os próximos ${daysRemaining} dias.`,
      action: `Limite seus gastos a ${BRL(orcamentoDiario)}/dia para terminar no positivo.`,
    }
  }
  
  // Projeção negativa com confiança alta — alerta informativo
  if (confidence === 'high' && projectedSaldo < 0 && currentSaldo > 0) {
    return {
      shouldAlert: true,
      severity: 'info',
      title: 'Tendência de gastos elevados',
      message: `Com base no seu padrão, os gastos podem se aproximar da receita. Disponível hoje: ${BRL(currentSaldo)}.`,
      action: `Mantenha gastos abaixo de ${BRL(orcamentoDiario)}/dia.`,
    }
  }
  
  // Tudo ok
  return { shouldAlert: false }
}
```

Atualizar `generateAlerts.js` para usar `forecast.alertSuggestion`:

```javascript
// Substituir o bloco de linhas 82-93 por:
if (!hasSaldoNegativo && isCurrentMonth && forecast?.alertSuggestion?.shouldAlert) {
  const sug = forecast.alertSuggestion
  alerts.push({
    id: 'forecast-alert',
    type: 'forecast-alert',
    severity: sug.severity,
    icon: sug.severity === 'danger' ? '🚨' : sug.severity === 'warning' ? '⚠️' : '📊',
    title: sug.title,
    message: sug.message,
    action: sug.action,
    dismissable: true,
  })
}
```

### Aceite
- O SmartAlerts NUNCA contradiz o ForecastCard
- A mensagem do alerta é sempre consistente com "Disponível" e "R$/dia" do card
- O alerta vem pré-montado do forecast (fonte única de verdade)
- Se confiança baixa e saldo positivo → sem alerta de forecast

---

## Resumo e ordem de implementação

| # | História | Impacto | Prioridade |
|---|----------|---------|------------|
| 1 | Alinhar riskLevel com realidade | **Crítico** — elimina a contradição | 1º |
| 4 | Forecast exporta alertSuggestion | **Alto** — fonte única de verdade | 2º |
| 2 | Reformular alerta no generateAlerts | **Alto** — mensagens úteis | 3º |
| 3 | Redesign detalhes por categoria | **Médio** — UX mais clara | 4º |

**Histórias 1 + 4 + 2** devem ser implementadas JUNTAS (são dependentes).
**História 3** pode ser implementada separadamente depois.

---

## Critérios globais

1. **Regra de ouro: ForecastCard e SmartAlerts NUNCA devem se contradizer.** Se o card diz "disponível R$1.089", o alerta NÃO pode dizer "saldo negativo R$2.860"
2. **Alertas devem ser acionáveis, não alarmistas.** Sempre incluir o que o usuário pode fazer
3. **Projeções incertas (confiança baixa) não geram alarmes.** Só geram alertas se a situação REAL já é preocupante
4. **"Detalhes por categoria" compara com o histórico/mês anterior, não mostra projeções como fatos**
5. Dark mode em tudo
6. Responsividade mobile a desktop  
7. Sem dependências novas
8. Commits: um para histórias 1+2+4 (lógica) e outro para história 3 (UI detalhes)
