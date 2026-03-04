# Correção e Melhoria: Transações do Mês + Previsão do Mês

## Contexto do Projeto

Dashboard de Finanças pessoal construído com **React 19 + Vite 7 + Tailwind CSS 3.4 + Chart.js + Supabase**.
App single-page com autenticação Supabase, dark mode, PWA.

### Stack e padrões
- Tailwind CSS utility-first, dark mode via `darkMode: 'class'`
- Cards: `bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 sm:p-6`
- Cores: emerald (receita), rose (fixas), orange (cartão), indigo (invest)
- Componentes funcionais com hooks, sem lib UI externa
- Persistência: Supabase + localStorage fallback
- Idioma: pt-BR
- Formatação: BRL via `toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })`
- Datas: date-fns com locale ptBR
- Toasts disponíveis via `useToast()` do `ToastContext`
- ConfirmModal disponível para ações destrutivas
- Não adicionar dependências novas

### Arquivos envolvidos nesta tarefa

```
src/
├── App.jsx                          # Orquestração, estado principal, handlers
├── components/
│   ├── TransactionList.jsx          # Lista de transações do mês
│   ├── ForecastCard.jsx             # Card de previsão do mês
│   └── Dashboard.jsx                # KPIs, gráficos (recebe totals como props)
├── services/
│   ├── transactionService.js        # CRUD transações
│   └── snapshotService.js           # CRUD snapshots mensais
└── utils/
    └── forecast.js                  # Lógica de previsão
```

---

## PROBLEMA 1 — Transações do mês apagam dados existentes

### Causa raiz

Existem **duas fontes de verdade conflitantes** para os totais do mês:

1. **Snapshot** (`monthly_snapshots`): armazena `{ receita, fixas, cartao, invest }` — alimentado por entrada manual E importação
2. **Transações** (`transactions`): registros individuais — alimentados por importação E adição via TransactionList

O conflito acontece porque:
- **Entrada manual** (inputs de Receita, Fixas, Cartão, Invest no App.jsx) salva direto no **snapshot**, mas **NÃO cria transações**
- Quando o usuário depois adiciona/edita/exclui uma transação no TransactionList, o `recalcAndNotify()` chama `getTransactionTotals(month)` que **só soma transações** e sobrescreve o snapshot inteiro
- Resultado: valores que vieram dos inputs manuais desaparecem

**Código do bug — `App.jsx` linha 266:**
```javascript
const handleTransactionTotals = useCallback(async (newTotals) => {
  setTotals(newTotals)            // ← SOBRESCREVE totals com soma apenas das transações
  totalsRef.current = newTotals
  // ...
  await upsertSnapshot({ month: selectedMonthRef.current, ...newTotals })  // ← SOBRESCREVE snapshot
}, [])
```

**Código do cálculo — `transactionService.js` linha 181:**
```javascript
export async function getTransactionTotals(month) {
  const txs = await listTransactions(month)
  const totals = { receita: 0, fixas: 0, cartao: 0, invest: 0 }
  for (const tx of txs) {
    if (tx.category in totals) {
      totals[tx.category] += Number(tx.amount) || 0
    }
  }
  return totals  // ← Retorna APENAS o que existe em transações, ignora o snapshot
}
```

### O que corrigir

#### História 1.1 — Transações devem ser ADITIVAS aos totals existentes, não substitutivas

**Como usuário, quero que ao adicionar uma transação no mês, ela seja somada aos valores existentes, sem apagar os dados que já coloquei manualmente ou importei.**

**Regra de negócio:** O total do mês é: `MAX(snapshot_existente, soma_das_transações)` por categoria. Mas na verdade a abordagem mais limpa é:

**Abordagem recomendada — Transações como fonte primária:**

Quando o usuário adiciona uma transação manual pelo TransactionList, ou importa via arquivo, essas viram transações no banco. Os inputs manuais do App.jsx (Receita, Fixas, Cartão, Invest) devem TAMBÉM criar transações em vez de salvar direto no snapshot.

**Implementação:**

1. **Alterar `handleInputChange` e `handleApplyManual` no `App.jsx`:**
   - Quando o usuário clica "Aplicar" com valores nos inputs manuais, em vez de salvar direto no snapshot, criar transações do tipo `source: 'manual_input'` com a **diferença** entre o valor digitado e a soma das transações existentes para aquela categoria
   - Exemplo: se o usuário digitou Receita = 5000, e já existem transações de receita somando 3000, criar uma transação de receita com amount = 2000 (a diferença), description = "Ajuste manual"
   - Se a diferença for negativa (usuário diminuiu o valor), criar transação negativa ou ajustar

2. **Alternativa mais simples (recomendada se a anterior for muito complexa):**
   - Manter os dois sistemas mas **NUNCA deixar `getTransactionTotals` sobrescrever o snapshot diretamente**
   - O `handleTransactionTotals` deve SOMAR a nova transação ao snapshot existente, não substituir:

   ```javascript
   const handleTransactionTotals = useCallback(async (newTotals) => {
     // newTotals vem de getTransactionTotals (soma das transações)
     // Mas o snapshot pode ter valores maiores (de input manual)
     // Usar o MAIOR entre snapshot e transações por categoria
     const merged = {
       receita: Math.max(newTotals.receita, totalsRef.current.receita),
       fixas: Math.max(newTotals.fixas, totalsRef.current.fixas),
       cartao: Math.max(newTotals.cartao, totalsRef.current.cartao),
       invest: Math.max(newTotals.invest, totalsRef.current.invest),
     }
     setTotals(merged)
     totalsRef.current = merged
     // ...
   }, [])
   ```

   **Problema dessa alternativa:** se o usuário excluir uma transação, o total não diminui porque o snapshot tem o valor antigo. Então não é ideal.

3. **Abordagem RECOMENDADA (a mais robusta):**
   - **Unificar a fonte de verdade nas transações**
   - Quando o usuário digita nos inputs manuais e clica "Aplicar":
     - Calcular a diferença entre o novo total e a soma das transações existentes
     - Se diferença > 0: criar uma transação `{ category, amount: diferença, description: 'Ajuste manual', source: 'adjustment' }`
     - Se diferença < 0: criar uma transação com amount negativo `{ category, amount: diferença, description: 'Ajuste manual', source: 'adjustment' }`
     - Se diferença = 0: não criar nada
   - O snapshot sempre reflete a soma das transações
   - `handleTransactionTotals` pode continuar substituindo porque agora TUDO está nas transações

   **Fluxo após a correção:**
   ```
   Usuário digita Receita=5000 e Aplicar
   → getTransactionTotals('2026-03') → { receita: 0, fixas: 0, cartao: 0, invest: 0 }
   → diferença receita = 5000 - 0 = 5000
   → upsertTransaction({ month, category: 'receita', amount: 5000, description: 'Receita (entrada manual)', source: 'adjustment' })
   → recalcAndNotify() → getTransactionTotals() → { receita: 5000, ... }
   → snapshot atualizado com 5000
   
   Depois, usuário adiciona transação "Almoço" fixas R$50 no TransactionList
   → upsertTransaction({ category: 'fixas', amount: 50, ... })
   → recalcAndNotify() → getTransactionTotals() → { receita: 5000, fixas: 50, ... }
   → snapshot atualizado → Dashboard mostra Receita 5000, Fixas 50 ✓ (nada foi apagado!)
   ```

**Aceite:**
- Importar arquivo com 10 lançamentos → Dashboard mostra totais corretos
- Depois adicionar 1 transação manual → Dashboard mostra total anterior + nova transação
- Depois editar uma transação → Dashboard recalcula sem apagar outras
- Depois excluir uma transação → Dashboard diminui apenas aquele valor
- Digitar valor no input manual "Aplicar" → cria transação de ajuste → Dashboard correto
- Alterar input manual para valor MENOR → cria transação negativa de ajuste → Dashboard diminui

#### História 1.2 — Input manual deve informar que há transações existentes

**Como usuário, quero ver no card de "Entrada manual" se já existem transações para este mês, para não sobrescrever sem querer.**

**Implementação:**
- Quando existem transações no mês, os inputs manuais devem mostrar os totals vindos das transações como valor default (pré-preenchidos)
- Adicionar texto informativo: "Valores baseados em {N} transações registradas. Alterações criam ajustes."
- Se o usuário alterar um input e Aplicar, mostrar um mini-resumo: "Receita: R$5.000 → R$5.500 (+R$500)"

**Aceite:**
- Ao abrir um mês que tem transações importadas, inputs já vêm preenchidos com os totais das transações
- Label mostra "12 transações neste mês"
- Ao alterar e aplicar, feedback mostra o delta

#### História 1.3 — Evitar duplicação ao importar arquivo sobre dados existentes

**Como usuário, quero que ao importar um novo arquivo no mesmo mês, tenha a opção de substituir ou somar às transações existentes.**

**Implementação:**
- Se já existem transações no mês (de qualquer source), ao importar um arquivo:
  - Mostrar modal: "Este mês já tem {N} transações. O que deseja fazer?"
  - Opção A: "Substituir todas" — deleta transações existentes, importa novas
  - Opção B: "Adicionar às existentes" — mantém as antigas, importa novas somando
  - Opção C: "Cancelar"
- Se não existem transações, importar direto sem perguntar

**Aceite:**
- Mês sem transações → import direto
- Mês com transações → modal com 3 opções
- "Substituir" limpa e reimporta
- "Adicionar" soma
- Dashboard atualiza corretamente em ambos os casos

---

## PROBLEMA 2 — Previsão do mês não calcula receita corretamente

### Causa raiz

A função `projectCategory` em `forecast.js` usa projeção linear (ritmo diário × dias no mês) para TODAS as categorias, incluindo receita:

```javascript
const paceProjection = dayOfMonth > 0 ? (currentAmount / dayOfMonth) * daysInMonth : 0
```

Isso é absurdo para receita porque salário é pontual (recebido 1-2x no mês), não linear. Se o salário de R$5.000 entra no dia 5, no dia 6 a projeção seria `(5000/6)*31 = R$25.833`.

Além disso, o card de previsão mostra **projeção de gastos** mas o usuário quer saber **"quanto ainda posso gastar"** — é um enquadramento diferente.

### O que corrigir

#### História 2.1 — Receita deve ser tratada como valor fixo, não projeção linear

**Como usuário, quero que a previsão considere minha receita como um valor já definido (ou próximo disso), não como uma projeção linear baseada no dia do mês.**

**Regra de negócio para receita:**
- Se a receita atual é > 0: usar o valor atual como receita do mês (o salário já caiu)
- Se a receita atual é 0 e há histórico: usar a média das receitas dos últimos 3 meses
- Se a receita atual é 0 e não há histórico: retornar null (não é possível prever)
- NÃO aplicar projeção linear para receita

**Implementação em `forecast.js`:**

```javascript
function projectReceita(currentReceita, historicalValues) {
  // Se já tem receita registrada, usar como está (salário já entrou)
  if (currentReceita > 0) {
    return { projected: currentReceita, method: 'actual', confidence: 'high' }
  }
  
  // Se não tem receita mas tem histórico, usar média
  const valid = historicalValues.filter(v => v > 0)
  if (valid.length >= 2) {
    const avg = valid.reduce((s, v) => s + v, 0) / valid.length
    return { projected: Math.round(avg * 100) / 100, method: 'historical', confidence: 'medium' }
  }
  
  // Sem dados suficientes
  return { projected: 0, method: 'none', confidence: 'low' }
}
```

- Usar `projectReceita` em vez de `projectCategory` para a categoria `receita`
- Continuar usando `projectCategory` para fixas, cartao, invest (despesas são lineares)

**Aceite:**
- Receita R$5.000 no dia 5 → Projeção de receita = R$5.000 (não R$25.833)
- Receita R$0 + 3 meses histórico com média R$5.000 → Projeção = R$5.000
- Receita R$0 + sem histórico → Card não exibe projeção (ou exibe "Registre sua receita")

#### História 2.2 — Mostrar "quanto posso gastar" em vez de "projeção de gastos"

**Como usuário, quero ver quanto dinheiro ainda tenho disponível para gastar até o final do mês, baseado na minha receita e nos gastos já realizados.**

**Novo cálculo principal: Orçamento Disponível**

```
saldoAtual = receita - fixas - cartao - invest  (valores reais, já gastos)
gastosPorDia = (fixas + cartao + invest) / diasPassados
gastosProjetadosRestantes = gastosPorDia × diasRestantes
orcamentoDisponivel = saldoAtual - gastosProjetadosRestantes
orcamentoPorDia = orcamentoDisponivel / diasRestantes
```

Ou de forma mais simples:
```
receitaDoMes = receita atual (já definida, vide 2.1)
gastosAteAgora = fixas + cartao + invest
saldoAtual = receitaDoMes - gastosAteAgora
diasRestantes = diasNoMes - diaAtual
orcamentoDiario = saldoAtual / diasRestantes
```

**Implementação — atualizar `forecast.js`:**

Adicionar ao retorno do `forecastMonth`:

```javascript
{
  // ... campos existentes ...
  
  // NOVOS campos
  receitaReal: Number(currentTotals.receita) || 0,   // receita JÁ registrada
  receitaProjetada: projections.receita.projected,     // receita projetada (pode = real)
  saldoAtual: currentSaldo,                            // receita - gastos atuais
  orcamentoDisponivel: saldoAtual,                     // quanto ainda pode gastar
  orcamentoDiario: daysRemaining > 0 
    ? Math.round((currentSaldo / daysRemaining) * 100) / 100 
    : 0,                                                // quanto por dia
  saldoProjetadoFimMes: projectedSaldo,                // como vai terminar o mês
}
```

**Implementação — atualizar `ForecastCard.jsx`:**

Redesenhar o card com foco em "quanto posso gastar":

**Novo layout do card:**

```
┌─────────────────────────────────────────────────────────┐
│ Previsão do Mês                          Dia 15 de 31  │
│                                                         │
│ ┌─────────────┐  ┌─────────────┐  ┌──────────────────┐ │
│ │ Receita     │  │ Já gasto    │  │ Disponível       │ │
│ │ R$ 5.000    │  │ R$ 2.300    │  │ R$ 2.700         │ │
│ │             │  │ 46% da rec  │  │ R$ 168,75/dia    │ │
│ └─────────────┘  └─────────────┘  └──────────────────┘ │
│                                                         │
│ ████████████████████░░░░░░░░░░░░░░░░░░ 46%             │
│ ← gasto atual              receita →                    │
│                                                         │
│ 💡 Você pode gastar R$ 168,75 por dia nos próximos     │
│    16 dias para terminar o mês no positivo.             │
│                                                         │
│ ▸ Detalhes por categoria                                │
│   Fixas:   R$ 1.500 atual → R$ 2.800 projetado         │
│   Cartão:  R$ 600 atual → R$ 1.200 projetado           │
│   Invest:  R$ 200 atual → R$ 400 projetado             │
└─────────────────────────────────────────────────────────┘
```

**KPIs principais (grid 3 colunas):**
1. **Receita:** valor real (não projetado). Label "Receita do mês". Se receita = 0: "Sem receita registrada"
2. **Já gasto:** soma de fixas + cartao + invest atuais. Label "Já gasto". Percentual da receita
3. **Disponível:** receita - gastos. Label "Disponível". Sublabel "R$ X/dia"
   - Verde se positivo
   - Vermelho se negativo ("Estourou R$ X")

**Barra de progresso reformulada:**
- Preenchimento = gastos atuais como % da receita
- Parte tracejada/transparente = projeção de gastos restantes
- Marcador nos 100% (= receita)
- Se projeção > receita: barra vermelha ultrapassa

**Mensagem contextual reformulada:**
- Saldo positivo: "Você pode gastar até R$ {orcamentoDiario}/dia nos próximos {diasRestantes} dias."
- Saldo apertado (< 10% receita restante): "Atenção: sobram apenas R$ {saldo}. Limite seus gastos a R$ {orcamentoDiario}/dia."
- Saldo negativo: "Seus gastos já ultrapassaram a receita em R$ {abs}. Evite novos gastos."
- Sem receita: "Registre sua receita para ver a previsão do mês."

**Aceite:**
- Receita R$5.000, gastos R$2.300, dia 15 de 31 → Disponível R$2.700, R$168,75/dia
- Receita R$0 → Card mostra "Registre sua receita"
- Gastos > Receita → Card vermelho com "Estourou R$ X"
- Adicionar transação de R$50 → "Disponível" diminui R$50, "Já gasto" sobe R$50, orcamentoDiario recalcula

#### História 2.3 — Previsão deve reagir em tempo real às transações

**Como usuário, quero que ao adicionar uma transação no TransactionList, a Previsão do Mês atualize imediatamente mostrando o novo saldo disponível.**

**Implementação:**
- O `ForecastCard` já recebe `totals` como prop e recalcula via `useMemo`
- Garantir que quando `handleTransactionTotals` é chamado (após add/edit/delete no TransactionList), o state `totals` no App.jsx é atualizado
- O `ForecastCard` deve reagir automaticamente (já faz via useMemo sobre totals)
- Verificar que o fluxo funciona end-to-end: TransactionList → recalcAndNotify → handleTransactionTotals → setTotals → ForecastCard re-render

**Aceite:**
- Adicionar transação "Almoço R$50 em Fixas" → Previsão mostra saldo disponível -R$50 instantaneamente
- Excluir transação → saldo disponível sobe
- Editar valor de transação → saldo ajusta

---

## Resumo das histórias e ordem de implementação

| # | História | Prioridade | Dependência |
|---|----------|------------|-------------|
| 1.1 | Transações aditivas (unificar fonte de verdade) | **Crítica** | — |
| 2.1 | Receita como valor fixo (não projeção linear) | **Alta** | — |
| 2.2 | Mostrar "quanto posso gastar" (redesign do ForecastCard) | **Alta** | 2.1 |
| 1.2 | Input manual informa transações existentes | Média | 1.1 |
| 2.3 | Previsão reage em tempo real às transações | Média | 1.1 + 2.2 |
| 1.3 | Modal de substituir/somar ao importar sobre existente | Média | 1.1 |

**Ordem recomendada:** 1.1 → 2.1 → 2.2 → 2.3 → 1.2 → 1.3

A história 1.1 é a mais crítica porque é um bug que causa perda de dados. Deve ser implementada primeiro.

---

## Critérios de aceite globais

1. **Não quebrar features existentes** — Dashboard, gráficos, BudgetProgress, InvestmentPlanner, SmartAlerts devem continuar funcionando
2. **Dark mode** em qualquer componente novo/modificado
3. **Responsividade** mobile a desktop
4. **Sem dependências novas**
5. **Toasts** para erros (usar useToast existente)
6. **ConfirmModal** para ações destrutivas (substituir transações na importação)
7. **Testes manuais recomendados após implementação:**
   - Cenário A: Importar arquivo → adicionar transação manual → dashboard mantém tudo
   - Cenário B: Input manual R$5.000 receita → Aplicar → adicionar transação R$50 fixas → receita continua 5.000
   - Cenário C: Receita 5.000, gastos 2.300, dia 15 → Previsão mostra "Disponível R$2.700, R$168/dia"
   - Cenário D: Adicionar transação → Previsão atualiza imediatamente
   - Cenário E: Receita 0 → Previsão mostra "Registre sua receita"
