# FASE 2 — Prompt C: Previsão de Gastos + Alertas Inteligentes

## Contexto do Projeto

Dashboard de Finanças pessoal construído com **React 19 + Vite 7 + Tailwind CSS 3.4 + Chart.js + Supabase**.
App single-page com autenticação Supabase, entrada manual, importação de arquivos, dashboard com KPIs e gráficos, regra 50-30-20, limites de orçamento, planejamento de investimentos, sistema de transações individuais, comparativo mensal, e categorias customizáveis.

**Pressuponha que TUDO anterior já está implementado:**
- Fase 1: modal de confirmação, onboarding, toasts, skeletons
- Fase 2A: transações individuais (TransactionList) + comparativo mensal (MonthlyTrend)
- Fase 2B: categorias customizáveis (CategoryManager, categoryService)

### Stack e padrões
- **Tailwind CSS** utility-first, dark mode via `darkMode: 'class'`
- **Cards:** `bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 sm:p-6`
- **Inputs:** `rounded-xl border focus:ring-2 focus:ring-indigo-400 dark:bg-gray-800 dark:text-gray-100`
- **Botões primários:** `bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl`
- **Cores semânticas:** emerald (receita/sucesso), rose (fixas), orange (cartão), indigo (invest)
- **Componentes funcionais** com hooks, sem biblioteca UI externa
- **Persistência:** Supabase + localStorage fallback
- **Idioma:** pt-BR
- **Formatação:** BRL via `toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })`
- **Datas:** date-fns com locale ptBR
- **Não adicionar dependências novas**

### Estrutura de arquivos (após 2A e 2B)
```
src/
├── App.jsx
├── components/
│   ├── Dashboard.jsx                # KPIs, gráficos doughnut/bar, export CSV
│   ├── FileImporter.jsx             # Import com transações + mapeamento de categorias
│   ├── TransactionList.jsx          # Lista de transações do mês
│   ├── MonthlyTrend.jsx             # Evolução mensal (line chart + tabela)
│   ├── CategoryManager.jsx          # Gerenciamento de categorias
│   ├── MonthSelector.jsx
│   ├── BudgetProgress.jsx           # Limites por categoria/subcategoria
│   ├── InvestmentPlanner.jsx
│   ├── InvestmentTrendChart.jsx
│   ├── FinancialInsights.jsx        # Score de saúde financeira (regra 50-30-20)
│   ├── ConfirmModal.jsx
│   ├── Toast.jsx
│   └── Skeleton.jsx
├── services/
│   ├── snapshotService.js           # getSnapshot, upsertSnapshot, listMonths, listAllSnapshots
│   ├── transactionService.js        # CRUD transações, getTransactionTotals, bulkInsert
│   ├── categoryService.js           # CRUD categorias, getCategoryMap, groupByParent
│   ├── budgetService.js             # CRUD limites (category pode ser key de subcategoria)
│   └── investmentService.js         # CRUD investimentos e metas
├── hooks/
│   ├── useDarkMode.js
│   └── useToast.js
├── utils/
│   ├── financialRules.js            # analyzeFinances() — regra 50-30-20
│   ├── calculateInvestmentPlan.js
│   └── toNumberBR.js
├── lib/supabaseClient.js
└── migrations/
    ├── phase2a.sql                  # Tabela transactions
    └── phase2b.sql                  # Tabela user_categories
```

### Dados disponíveis no App.jsx (estado)

```javascript
// Estado principal
const [selectedMonth, setSelectedMonth] = useState(currentMonth)     // 'YYYY-MM'
const [totals, setTotals] = useState({ receita: 0, fixas: 0, cartao: 0, invest: 0 })
const [prevTotals, setPrevTotals] = useState(null)                   // totals do mês anterior ou null
const [availableMonths, setAvailableMonths] = useState([])           // ['2025-01', '2025-02', ...]
const [showDash, setShowDash] = useState(false)
const [budgetAlerts, setBudgetAlerts] = useState({})                 // { fixas: { pct, level }, ... }
```

### Como a regra 50-30-20 funciona (financialRules.js)

```javascript
analyzeFinances({ receita, fixas, cartao, invest })
// Retorna:
{
  rules: [
    {
      category: 'fixas',
      label: 'Contas Fixas',
      idealPct: 50,
      direction: 'max',          // 'max' = menos é melhor, não ultrapassar
      actual: 45.2,              // percentual real
      status: 'ok',              // 'excellent'|'ok'|'warning'|'danger'
      message: 'Contas Fixas esta em 45.2% — dentro do ideal de ate 50%.',
      idealAmount: 2500,         // valor ideal em BRL
      spentAmount: 2260,         // valor gasto real
      availableAmount: 240,      // diferença (positivo = sobra, negativo = excede)
      tip, actionTip, source,
    },
    // ... cartao e invest
  ],
  overallScore: 'healthy',       // 'healthy'|'attention'|'critical'|'empty'
  overallMessage: 'Suas financas estao saudaveis...',
  source: 'Regra 50-30-20 (Elizabeth Warren, "All Your Worth")',
}
```

### Como o BudgetProgress emite alertas

```javascript
// BudgetProgress calcula alertas e passa para o App via onBudgetAlerts:
budgetAlerts = {
  fixas: { pct: 95, level: 'warning' },    // 80-99% = warning
  cartao: { pct: 110, level: 'exceeded' },  // 100%+ = exceeded
}
```

### Como o InvestmentPlanner funciona

O plan calculado contém:
```javascript
plan = {
  status: 'active',             // 'active'|'completed'|'overdue'|'empty'
  percent: 45.2,                // % atingido da meta
  totalReal: 22600,             // total investido
  remaining: 27400,             // quanto falta
  monthsRemaining: 8,
  recommendedPerMonth: 3425,    // aporte mensal sugerido
  nextMonthSuggestion: 3425,    // sugestão para o mês atual
  schedule: [...],              // cronograma mês a mês
  warnings: [],
}
```

---

## TAREFA 2.5 — Previsão de Gastos

### Problema
O usuário não sabe como vai terminar o mês. Se no dia 15 já gastou 70% da receita, deveria ver uma projeção e receber um aviso.

### O que implementar

#### 2.5.1 — Utility de previsão

Criar `src/utils/forecast.js`:

```javascript
import { getDaysInMonth, getDate } from 'date-fns'

/**
 * Calcula previsão de gastos para o mês.
 *
 * @param {Object} params
 * @param {Object} params.currentTotals - { receita, fixas, cartao, invest }
 * @param {number} params.dayOfMonth - dia atual (1-31)
 * @param {number} params.daysInMonth - total de dias no mês
 * @param {Array} params.historicalSnapshots - snapshots dos últimos meses [{ receita, fixas, cartao, invest }]
 * @returns {Object} previsão
 */
export function forecastMonth({ currentTotals, dayOfMonth, daysInMonth, historicalSnapshots = [] }) {
  // ...
}
```

**Lógica de projeção por categoria (fixas, cartao, invest):**

1. **Projeção por ritmo atual:**
   - `projectedByPace = (gastoAtual / diasPassados) * diasNoMês`
   - Se `dayOfMonth < 5`, ritmo é pouco confiável — peso menor

2. **Projeção por média histórica:**
   - `avgHistorical = média dos últimos 3-6 meses para a categoria`
   - Se menos de 2 meses de histórico, não usar

3. **Projeção combinada:**
   - Se `dayOfMonth >= 20`: 80% ritmo + 20% histórico (ritmo já é confiável)
   - Se `dayOfMonth >= 10`: 60% ritmo + 40% histórico
   - Se `dayOfMonth < 10`: 30% ritmo + 70% histórico
   - Se não tem histórico: 100% ritmo

4. **Receita:** projetar da mesma forma, mas separadamente

5. **Saldo projetado:** `projectedReceita - projectedFixas - projectedCartao - projectedInvest`

**Retorno:**
```javascript
{
  projections: {
    receita: { current: 5000, projected: 5000, confidence: 'high' },
    fixas:   { current: 1200, projected: 2400, confidence: 'medium' },
    cartao:  { current: 800,  projected: 1600, confidence: 'medium' },
    invest:  { current: 500,  projected: 1000, confidence: 'medium' },
  },
  projectedSaldo: 0,           // receita projetada - despesas projetadas
  currentSaldo: 2500,          // saldo atual real
  totalExpensesProjected: 5000, // fixas + cartao + invest projetados
  confidence: 'medium',        // 'high' (>20 dias ou >3 meses) | 'medium' (10-20 dias) | 'low' (<10 dias e <2 meses)
  riskLevel: 'safe',           // 'safe' (saldo projetado > 0) | 'attention' (saldo entre -10% e 0) | 'danger' (saldo < -10% receita)
  percentUsed: 50,             // % da receita já gasta
  percentProjected: 100,       // % da receita que será gasta (projeção)
  daysRemaining: 15,
  message: 'No ritmo atual, você terminará o mês com saldo positivo de R$ 400.',
}
```

**Geração da mensagem contextual:**
- Safe: "No ritmo atual, você terminará o mês com saldo positivo de R$ {saldo}."
- Attention: "Atenção: no ritmo atual, seus gastos vão consumir quase toda a receita. Saldo projetado: R$ {saldo}."
- Danger: "Cuidado: no ritmo atual, seus gastos vão ultrapassar a receita em R$ {abs(saldo)}."
- Se `dayOfMonth < 5`: "Poucos dados — previsão preliminar. Continue registrando para maior precisão."

#### 2.5.2 — Componente ForecastCard

Criar `src/components/ForecastCard.jsx`:

**Condição de exibição:** Só mostrar quando o mês selecionado é o mês atual (`selectedMonth === currentMonth`) E há dados (`showDash === true`)

**Layout:**
- Card com header "Previsão do Mês" + badge de confiança (Alta/Média/Baixa com cores)
- **Barra de progresso principal:**
  - Mostra % da receita já gasta vs. projetada
  - Seção preenchida até o gasto atual (cor sólida)
  - Seção tracejada/transparente até a projeção (cor semi-transparente)
  - Marcador vertical na posição da receita (100%)
  - Se projeção > receita, a barra ultrapassa com cor vermelha
  - Labels: "Gasto atual: R$ X" e "Projeção: R$ Y"

- **KPIs em mini grid (2x2):**
  - "Gasto atual": valor + % da receita
  - "Projeção fim do mês": valor projetado
  - "Saldo projetado": verde se positivo, vermelho se negativo
  - "Dias restantes": número + barra de progresso do mês

- **Mensagem contextual:** texto gerado pelo forecast, com cor baseada no riskLevel:
  - Safe: verde
  - Attention: âmbar
  - Danger: vermelho

- **Breakdown por categoria (colapsável):**
  - Para cada categoria (fixas, cartao, invest):
    - Nome da categoria + badge de cor
    - "Atual: R$ X → Projetado: R$ Y"
    - Mini barra de progresso mostrando atual vs. projetado vs. limite do orçamento (se houver)

**Props:**
```javascript
ForecastCard({ totals, selectedMonth, currentMonth, historicalSnapshots, dark })
```

**Onde o `historicalSnapshots` vem:**
- O App.jsx já pode ter os snapshots do MonthlyTrend, ou pode fazer um `listAllSnapshots()` separado
- O mais limpo: o App.jsx faz `listAllSnapshots()` uma vez e passa para MonthlyTrend e ForecastCard

#### 2.5.3 — Integrar no App.jsx

- Importar ForecastCard
- Buscar `allSnapshots` via `listAllSnapshots()` (se ainda não está sendo feito)
- Renderizar ForecastCard entre o FinancialInsights e os gráficos (dentro da seção Dashboard), ou logo abaixo do Dashboard como card independente
- Passar: `totals`, `selectedMonth`, `currentMonth`, `historicalSnapshots` (filtrar os últimos 6 meses), `dark`

---

## TAREFA 2.3 — Alertas Inteligentes

### Problema
Os alertas atuais são simples e reativos (só aparecem quando já ultrapassou 80% ou 100% do limite). Não há alertas proativos baseados em tendências, nem alertas positivos para reforçar bons comportamentos.

### O que implementar

#### 2.3.1 — Gerador de alertas

Criar `src/utils/generateAlerts.js`:

```javascript
/**
 * Gera alertas inteligentes baseados nos dados financeiros.
 *
 * @param {Object} params
 * @param {Object} params.totals - { receita, fixas, cartao, invest }
 * @param {Object|null} params.prevTotals - totals do mês anterior
 * @param {Object} params.budgetAlerts - { fixas?: { pct, level }, ... }
 * @param {Object|null} params.plan - resultado do calculateInvestmentPlan
 * @param {Object|null} params.forecast - resultado do forecastMonth
 * @param {string} params.selectedMonth - 'YYYY-MM'
 * @param {string} params.currentMonth - 'YYYY-MM'
 * @param {Array} params.historicalSnapshots - snapshots anteriores
 * @returns {Array} alertas
 */
export function generateAlerts({
  totals, prevTotals, budgetAlerts, plan, forecast,
  selectedMonth, currentMonth, historicalSnapshots = [],
}) {
  const alerts = []
  // ... gerar alertas
  return alerts
}
```

**Cada alerta retornado:**
```javascript
{
  id: 'budget-warning-cartao',      // id único para deduplicação e dismiss
  type: 'budget-warning',            // tipo do alerta
  severity: 'warning',               // 'success' | 'warning' | 'danger' | 'info'
  icon: '⚠️',                        // emoji
  title: 'Cartão próximo do limite',
  message: 'Seus gastos com Cartão estão em 87% do limite. Restam R$ 195,00.',
  action: 'Revise seus gastos variáveis este mês.',  // sugestão de ação (opcional)
  category: 'cartao',                // categoria relacionada (opcional)
  dismissable: true,                 // se pode ser dispensado
}
```

**Alertas a implementar (em ordem de prioridade):**

1. **Saldo negativo** (danger):
   - Condição: `receita - fixas - cartao - invest < 0`
   - Título: "Gastos acima da receita"
   - Mensagem: "Seus gastos superam a receita em R$ {abs}. Revise seus gastos urgentemente."

2. **Limite de orçamento ultrapassado** (danger):
   - Condição: `budgetAlerts[categoria].level === 'exceeded'`
   - Para cada categoria que ultrapassou
   - Título: "{Categoria} ultrapassou o limite"
   - Mensagem: "Gastos de {pct}% do limite definido."

3. **Projeção de saldo negativo** (warning):
   - Condição: `forecast?.riskLevel === 'danger'` E mês atual
   - Título: "Projeção: gastos vão superar receita"
   - Mensagem: "No ritmo atual, o mês terminará com saldo negativo de R$ {abs}."

4. **Limite de orçamento próximo** (warning):
   - Condição: `budgetAlerts[categoria].level === 'warning'`
   - Para cada categoria entre 80-99%
   - Título: "{Categoria} próximo do limite"
   - Mensagem: "Gastos em {pct}% do limite. Restam R$ {disponivel}."

5. **Investimento atrasado** (warning):
   - Condição: `plan?.status === 'active'` E mês atual E nenhum investimento neste mês
   - Título: "Investimento pendente"
   - Mensagem: "Você ainda não investiu neste mês. Sugestão: R$ {plan.nextMonthSuggestion}."
   - Action: "Registre seu investimento no Planejamento."

6. **Meta de investimento atrasada** (danger):
   - Condição: `plan?.status === 'overdue'`
   - Título: "Meta de investimento atrasada"
   - Mensagem: "Sua meta está atrasada. Aporte necessário: R$ {plan.remaining}."

7. **Tendência de alta em despesas** (warning):
   - Condição: gastos de fixas ou cartao aumentaram nos últimos 3 meses consecutivos
   - Calcular usando `historicalSnapshots`
   - Título: "{Categoria} em tendência de alta"
   - Mensagem: "Seus gastos com {categoria} aumentaram nos últimos 3 meses."
   - Action: "Avalie se há algum gasto novo que pode ser reduzido."

8. **Melhoria detectada** (success):
   - Condição: `prevTotals` existe E gasto atual de fixas ou cartao é pelo menos 10% menor que o mês anterior
   - Título: "Gastos com {Categoria} reduziram!"
   - Mensagem: "Seus gastos diminuíram {pct}% em relação ao mês passado. Continue assim!"

9. **Investimento acima do ideal** (success):
   - Condição: invest > 20% da receita (regra 50-30-20 ok)
   - Título: "Investimentos acima do ideal"
   - Mensagem: "Você está investindo {pct}% da receita — acima dos 20% recomendados. Excelente!"

10. **Mês sem dados** (info):
    - Condição: mês selecionado é o mês atual E totals são todos zero E não é o primeiro acesso
    - Título: "Registre seus dados de {mês}"
    - Mensagem: "Você ainda não registrou dados deste mês. Importe um arquivo ou insira manualmente."

**Regras de deduplicação:**
- Não mostrar alerta de "projeção negativa" se já há alerta de "saldo negativo" (o real é mais urgente)
- Não mostrar alerta de "limite próximo" se já há "limite ultrapassado" para a mesma categoria
- Limitar a 5 alertas visíveis (priorizar por severidade: danger > warning > info > success)

#### 2.3.2 — Componente SmartAlerts

Criar `src/components/SmartAlerts.jsx`:

**Layout:**
- Painel posicionado logo abaixo do header, acima de tudo
- Header: ícone de sino + "Alertas" + badge numérico com quantidade + botão toggle (expandir/recolher)
- Quando recolhido: só mostra o header com o badge (se não há alertas, não mostra nada)
- Quando expandido: lista vertical de alertas

**Cada alerta:**
- Borda lateral colorida (4px) pela severidade:
  - danger: border-red-500
  - warning: border-amber-500
  - success: border-emerald-500
  - info: border-blue-500
- Fundo sutil pela severidade (red-50, amber-50, emerald-50, blue-50) + dark mode
- Layout: ícone (emoji) | título (bold) + mensagem (texto menor) | botão X (dispensar)
- Se tem `action`: texto itálico abaixo da mensagem: "Dica: {action}"
- Animação: entrada suave com slide-down + fade-in

**Dispensar alertas:**
- Ao clicar no X, o alerta desaparece com animação de fade-out
- Salvar no localStorage key `'dismissed_alerts'` como `{ [alertId]: 'YYYY-MM' }`
- Alertas dispensados não reaparecem no mesmo mês
- No início de um novo mês, limpar alertas dispensados do mês anterior

**Padrão de expansão:**
- Se há alertas de severidade `danger`: expandido por padrão
- Se há apenas `warning`/`info`/`success`: recolhido por padrão
- O usuário pode toggle manualmente

**Props:**
```javascript
SmartAlerts({
  totals,
  prevTotals,
  budgetAlerts,
  plan,              // do InvestmentPlanner (pode ser null se não tem meta)
  forecast,          // do forecastMonth (pode ser null se não é mês atual)
  selectedMonth,
  currentMonth,
  historicalSnapshots,
})
```

#### 2.3.3 — Integrar no App.jsx

**Obter dados do InvestmentPlanner:**
- O plan não é facilmente acessível pois é calculado dentro do InvestmentPlanner
- Opção mais limpa: criar um hook `useInvestmentPlan()` ou elevar o cálculo do plan para o App.jsx
- Opção pragmática: fazer o InvestmentPlanner expor o plan via callback `onPlanCalculated(plan)`:
  ```javascript
  <InvestmentPlanner dark={dark} onPlanCalculated={setPlan} />
  ```
  - Adicionar `const [plan, setPlan] = useState(null)` no App.jsx
  - No InvestmentPlanner, chamar `onPlanCalculated?.(plan)` quando o plan é calculado

**Obter dados do forecast:**
- Calcular no App.jsx usando `forecastMonth()` quando:
  - `selectedMonth === currentMonth`
  - `showDash === true`
  - `totals` tem valores > 0

**Obter historicalSnapshots:**
- Chamar `listAllSnapshots()` uma vez no App.jsx (já feito para MonthlyTrend ou novo)
- Filtrar os últimos 6 meses (excluindo o mês atual)
- Passar para SmartAlerts, ForecastCard e MonthlyTrend

**Renderizar:**
```jsx
{/* Logo abaixo do header, acima do conteúdo principal */}
{showDash && (
  <SmartAlerts
    totals={totals}
    prevTotals={prevTotals}
    budgetAlerts={budgetAlerts}
    plan={plan}
    forecast={forecast}
    selectedMonth={selectedMonth}
    currentMonth={currentMonth}
    historicalSnapshots={historicalSnapshots}
  />
)}
```

---

## Critérios de aceite

1. **Previsão funciona sem histórico** — usa 100% ritmo atual se não há meses anteriores
2. **Alertas são contextuais** — não mostrar alertas de meses passados que não fazem sentido (ex: "investimento pendente" de janeiro quando estamos em março)
3. **Alertas de sucesso existem** — não é só negativo, reforçar bons comportamentos
4. **Performance:** `generateAlerts` é uma função pura, sem side effects, sem async. Toda a lógica é síncrona baseada nos dados recebidos
5. **Não duplicar alertas** com informações que já aparecem em outros componentes (ex: não repetir exatamente o que o FinancialInsights já diz)
6. **Dark mode** em todos os componentes novos
7. **Responsividade:** mobile (320px) a desktop (1280px)
8. **Sem dependências novas**
9. **Testes mentais:** verificar que os alertas fazem sentido em cenários:
   - Mês vazio (sem dados): só alerta info "registre seus dados"
   - Mês saudável: alertas de sucesso
   - Mês estourado: alertas de danger
   - Mês passado (não atual): sem forecast, sem "investimento pendente"
10. **Commits separados:** um para 2.5 (previsão) e outro para 2.3 (alertas), mensagens em português
11. **Ordem de implementação:** implementar 2.5 PRIMEIRO (forecast), depois 2.3 (alertas que usam o forecast)
