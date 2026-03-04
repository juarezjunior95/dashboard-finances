# Melhoria: Projeção por Categoria Inteligente no ForecastCard

## Contexto

O card "Previsão do Mês" funciona corretamente no KPI principal (Receita, Já Gasto, Disponível, R$/dia).
O problema está na seção **"Detalhes por categoria"** que exibe projeções irreais.

### O bug visual (dia 4 de 31):
- Fixas: Atual R$ 5.740 → **Projetado R$ 17.427** (3x o real — absurdo)
- Cartão: Atual R$ 1.741 → **Projetado R$ 5.918** (3.4x)
- Invest: Atual R$ 500 → **Projetado R$ 3.875** (7.7x)

### Causa raiz
A função `projectCategory` em `src/utils/forecast.js` usa projeção linear para TODAS as categorias:
```javascript
const paceProjection = dayOfMonth > 0 ? (currentAmount / dayOfMonth) * daysInMonth : 0
```

Isso funciona para gastos diários (delivery, uber, compras), mas NÃO funciona para:
- **Contas Fixas:** aluguel, energia, internet = pagos 1x no mês, geralmente no início
- **Investimentos:** aportes pontuais, geralmente 1x no mês

### Stack e padrões
- React 19, Tailwind CSS, dark mode via `dark:`
- Cards: `rounded-2xl border p-4 sm:p-6`
- Cores: emerald (receita), rose (fixas), orange (cartão), indigo (invest)
- Formatação BRL: `toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })`
- date-fns com locale ptBR
- Não adicionar dependências novas

### Arquivos a modificar
```
src/utils/forecast.js              # Lógica de projeção
src/components/ForecastCard.jsx    # Exibição dos detalhes
```

---

## HISTÓRIA 1 — Projeção inteligente por tipo de categoria

**Como usuário, quero que a projeção de cada categoria use um modelo adequado ao comportamento real daquela despesa, para que os números façam sentido.**

### Modelo de projeção por categoria

Cada categoria tem um comportamento diferente:

| Categoria | Comportamento | Modelo de projeção |
|-----------|--------------|-------------------|
| **Receita** | Pontual (salário 1-2x/mês) | Valor atual se > 0, senão média histórica (já corrigido) |
| **Fixas** | Pontual (contas pagas no início/meio do mês) | Método "lump sum" |
| **Cartão** | Mix (parcelas fixas + gastos diários) | Método "hybrid" |
| **Invest** | Pontual (aporte 1x/mês) | Método "lump sum" |

### Implementação — Novo `projectCategory` em `forecast.js`

Substituir a função `projectCategory` por uma versão que aceita o tipo de categoria:

```javascript
/**
 * Projeção para categorias com gastos PONTUAIS (fixas, invest).
 * 
 * Lógica: gastos pontuais geralmente já foram pagos.
 * No início do mês (dia 1-10): provável que ainda faltam contas.
 * No meio/fim (dia 11+): a maioria já foi paga.
 * 
 * Usa histórico como referência principal e compara com o gasto atual.
 */
function projectLumpSum(currentAmount, dayOfMonth, daysInMonth, historicalValues) {
  const validHistory = historicalValues.filter(v => v > 0)
  
  // Se tem histórico, usar como teto de referência
  if (validHistory.length >= 2) {
    const avgHistorical = validHistory.reduce((s, v) => s + v, 0) / validHistory.length
    const maxHistorical = Math.max(...validHistory)
    
    if (dayOfMonth >= 20) {
      // Fim do mês: quase tudo já foi pago, projeção ≈ valor atual
      return { projected: Math.max(currentAmount, avgHistorical * 0.9), method: 'lump_late' }
    }
    
    if (dayOfMonth >= 10) {
      // Meio do mês: maioria paga, pode ter 1-2 contas restantes
      // Projeção = máximo entre o atual e a média histórica
      return { projected: Math.max(currentAmount, avgHistorical), method: 'lump_mid' }
    }
    
    // Início do mês (dia 1-10): pode faltar muita conta ainda
    // Se já gastou mais que a média histórica: manter atual (mês atípico)
    // Se gastou menos: projetar que vai chegar perto da média
    if (currentAmount >= avgHistorical) {
      return { projected: currentAmount * 1.05, method: 'lump_early_above' }
    }
    return { projected: avgHistorical, method: 'lump_early_below' }
  }
  
  // Sem histórico suficiente: estimar com buffer conservador
  if (dayOfMonth >= 15) {
    return { projected: currentAmount * 1.1, method: 'lump_no_history_late' }
  }
  // Início do mês sem histórico: pode faltar bastante, buffer maior
  return { projected: currentAmount * 1.5, method: 'lump_no_history_early' }
}

/**
 * Projeção para categorias com gastos DIÁRIOS/CONTÍNUOS (cartão).
 * 
 * Usa projeção linear (pace) combinada com histórico.
 * É a lógica atual, que faz sentido para gastos diários.
 */
function projectLinear(currentAmount, dayOfMonth, daysInMonth, historicalValues) {
  // Manter a lógica atual de projectCategory
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
```

Atualizar o loop principal em `forecastMonth`:

```javascript
const CATEGORY_MODELS = {
  receita: 'receita',    // valor fixo
  fixas: 'lump_sum',     // pagamentos pontuais
  cartao: 'linear',      // gastos diários/contínuos
  invest: 'lump_sum',    // aporte pontual
}

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
  projections[cat] = { current, projected: result.projected, method: result.method, confidence }
}
```

**Resultado esperado para o cenário da screenshot (dia 4 de 31):**

| Categoria | Atual | Projeção antiga | Projeção nova | Lógica |
|-----------|-------|-----------------|---------------|--------|
| Fixas | R$ 5.740 | R$ 17.427 | ~R$ 5.800-6.000 | Lump sum: início do mês, se próximo da média histórica |
| Cartão | R$ 1.741 | R$ 5.918 | ~R$ 4.500-5.500 | Linear: mantém pace + histórico (faz sentido) |
| Invest | R$ 500 | R$ 3.875 | ~R$ 500-600 | Lump sum: aporte provavelmente já foi feito |

**Aceite:**
- Dia 4, fixas R$5.740, média histórica R$6.000 → Projeção ≈ R$6.000 (não R$17.427)
- Dia 4, invest R$500, média histórica R$500 → Projeção ≈ R$500 (não R$3.875)
- Dia 4, cartão R$1.741, média histórica R$4.000 → Projeção ≈ R$4.500 (linear faz sentido aqui)
- Dia 25, fixas R$5.740 → Projeção ≈ R$5.740 (quase tudo pago)

---

## HISTÓRIA 2 — Mostrar a lógica da projeção ao usuário

**Como usuário, quero entender COMO a projeção foi calculada, para confiar nos números.**

### Implementação no ForecastCard.jsx

Para cada categoria nos detalhes, adicionar uma explicação curta abaixo do valor projetado:

```
● Contas Fixas
  Atual: R$ 5.740,83 → Projetado: R$ 6.012,00
  Baseado na sua média mensal (R$ 6.012)                    ← NOVO
  
● Cartão
  Atual: R$ 1.741,00 → Projetado: R$ 4.530,00
  No ritmo atual: R$ 62,18/dia × 27 dias restantes          ← NOVO

● Investimentos
  Atual: R$ 500,00 → Projetado: R$ 500,00
  Aporte já realizado este mês                               ← NOVO
```

**Mapear `method` retornado pela projeção para texto explicativo em pt-BR:**

```javascript
const METHOD_LABELS = {
  receita_actual: 'Receita já registrada',
  receita_historical: 'Baseado na média dos últimos meses',
  receita_none: 'Sem dados para projetar',
  lump_early_below: 'Baseado na sua média mensal',
  lump_early_above: 'Mês acima da média — usando valor atual',
  lump_mid: 'Maioria das contas já pagas — usando média mensal',
  lump_late: 'Quase todas as contas pagas',
  lump_no_history_early: 'Estimativa conservadora (sem histórico)',
  lump_no_history_late: 'Valor atual + margem de segurança',
  linear_pace: 'Projeção por ritmo diário',
  linear_combined: (dayOfMonth, daysRemaining, dailyRate) =>
    `Ritmo atual: ${BRL(dailyRate)}/dia × ${daysRemaining} dias restantes`,
}
```

**Aceite:**
- Cada categoria no detalhe mostra uma linha de explicação
- O texto é específico para o método usado
- O usuário entende de onde veio o número

---

## HISTÓRIA 3 — Indicador de confiança por categoria

**Como usuário, quero saber qual projeção é mais confiável e qual é mais incerta.**

### Implementação

Adicionar um mini badge de confiança ao lado de cada projeção nos detalhes:

```
● Contas Fixas
  Atual: R$ 5.740,83 → Projetado: R$ 6.012,00  [Alta ✓]
  
● Cartão
  Atual: R$ 1.741,00 → Projetado: R$ 4.530,00  [Baixa ⚠]
  
● Investimentos
  Atual: R$ 500,00 → Projetado: R$ 500,00  [Alta ✓]
```

**Regras de confiança por categoria:**

```javascript
function getCategoryConfidence(method, dayOfMonth, historyCount) {
  // Lump sum com histórico = alta confiança (sabemos o padrão)
  if (method.startsWith('lump_') && historyCount >= 3) return 'high'
  if (method.startsWith('lump_') && historyCount >= 1) return 'medium'
  
  // Receita atual = alta confiança
  if (method === 'receita_actual') return 'high'
  
  // Linear no início do mês = baixa confiança
  if (method.startsWith('linear_') && dayOfMonth < 10) return 'low'
  if (method.startsWith('linear_') && dayOfMonth < 20) return 'medium'
  if (method.startsWith('linear_') && dayOfMonth >= 20) return 'high'
  
  // Sem histórico = baixa
  if (method.includes('no_history')) return 'low'
  
  return 'medium'
}
```

**Visual:**
- Alta: badge verde, ícone ✓
- Média: badge âmbar, sem ícone
- Baixa: badge vermelho/cinza, ícone ⚠

**Aceite:**
- Fixas (lump sum com histórico) → Alta
- Cartão (linear no dia 4) → Baixa
- Investimentos (lump sum com histórico) → Alta
- Cartão no dia 25 → Alta

---

## HISTÓRIA 4 — Comparação com mês anterior nos detalhes

**Como usuário, quero ver como meus gastos atuais se comparam ao mês anterior, não só ao valor projetado.**

### Implementação

Adicionar uma terceira coluna nos detalhes: o valor do mês anterior.

**Layout reformulado:**

```
● Contas Fixas
  Atual: R$ 5.740    Projetado: R$ 6.012    Mês anterior: R$ 5.980
  ████████████████████████████████████████░░░ 96% da média
  Baseado na sua média mensal                              [Alta ✓]
  
● Cartão
  Atual: R$ 1.741    Projetado: R$ 4.530    Mês anterior: R$ 3.800
  ███████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░ 46% do mês
  Ritmo atual: R$ 62/dia × 27 dias restantes               [Baixa ⚠]
```

**A barra de progresso deve usar a referência do mês anterior** (ou média histórica) como "100%", não a receita. Isso mostra visualmente "estou gastando mais ou menos que o normal".

**Props adicionais necessárias:**
- `prevTotals` já está disponível no App.jsx (totals do mês anterior)
- Passar para o ForecastCard: `prevTotals={prevTotals}`

**Aceite:**
- Cada categoria mostra: atual, projetado, mês anterior
- Barra de progresso usa mês anterior como referência
- Se não tem mês anterior, omitir essa coluna

---

## Resumo e ordem de implementação

| # | História | Impacto | Esforço |
|---|----------|---------|---------|
| 1 | Projeção inteligente por tipo de categoria | **Crítico** (fix do bug) | Médio |
| 2 | Mostrar lógica da projeção ao usuário | **Alto** (transparência) | Baixo |
| 3 | Indicador de confiança por categoria | Médio (UX) | Baixo |
| 4 | Comparação com mês anterior | Médio (contexto) | Baixo |

**Ordem:** 1 → 2 → 3 → 4

A história 1 é obrigatória (fix do bug). As demais são incrementais de UX.

---

## Critérios globais

1. **O card principal (Receita, Já Gasto, Disponível) NÃO deve mudar** — ele já funciona corretamente
2. **Só os "Detalhes por categoria" devem ser afetados**
3. Dark mode em tudo
4. Responsividade mobile a desktop
5. Sem dependências novas
6. Manter padrão de formatação BRL e date-fns ptBR
7. Retorno do `forecastMonth` deve incluir `method` por categoria para que o ForecastCard possa exibir a explicação
8. Commits separados: um para história 1 (lógica) e um para histórias 2-4 (UI)
