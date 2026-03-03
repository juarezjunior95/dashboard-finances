# FASE 2 — Prompt A: Transações Detalhadas + Comparativo Mensal

## Contexto do Projeto

Dashboard de Finanças pessoal construído com **React 19 + Vite 7 + Tailwind CSS 3.4 + Chart.js + Supabase**.
App single-page (sem React Router), com autenticação via Supabase, entrada manual e importação de arquivos (CSV/XLSX/XML), dashboard com KPIs, gráficos de rosca e barra, análise pela regra 50-30-20, limites de orçamento por categoria, e planejamento de investimentos. Possui dark mode (via classe `dark:`) e suporte PWA.

**Pressuponha que a Fase 1 já foi implementada** (modal de confirmação, onboarding, toast de erros, skeleton loaders, remoção do InvestmentTracker.jsx).

### Stack e padrões do projeto
- **Estilização:** Tailwind CSS utility-first, dark mode via `darkMode: 'class'`
- **Cards:** `bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 sm:p-6`
- **Inputs:** `rounded-xl border focus:ring-2 focus:ring-indigo-400`, dark mode com `dark:bg-gray-800 dark:text-gray-100`
- **Botões primários:** `bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl`
- **Cores semânticas:** emerald (sucesso/receita), rose (fixas), orange (cartão), indigo (investimentos)
- **Componentes:** Funcionais com hooks, sem biblioteca UI externa
- **Estado:** useState/useRef local, AuthContext para auth, sem state manager global
- **Persistência:** Supabase + localStorage como fallback offline (todos os services seguem esse padrão)
- **Idioma da UI:** Português brasileiro (pt-BR)
- **Formatação monetária:** `v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })`
- **Datas:** `date-fns` com locale `ptBR`
- **Gráficos:** Chart.js via `react-chartjs-2` (Doughnut, Bar, mixed Bar+Line)
- **Não adicionar dependências novas**

### Estrutura de arquivos relevante
```
src/
├── App.jsx                          # Componente principal, header, inputs manuais, orquestração
├── components/
│   ├── Dashboard.jsx                # KPIs, gráficos doughnut/bar, export CSV
│   ├── FileImporter.jsx             # Import drag-and-drop CSV/XLSX/XML
│   ├── MonthSelector.jsx            # Navegação por mês (prev/next)
│   ├── BudgetProgress.jsx           # Limites por categoria (fixas, cartao, invest)
│   ├── InvestmentPlanner.jsx        # Planejamento de investimentos com cronograma
│   ├── InvestmentTrendChart.jsx     # Gráfico bar+line de investimentos
│   ├── FinancialInsights.jsx        # Score de saúde financeira (regra 50-30-20)
│   ├── ConfirmModal.jsx             # Modal de confirmação (Fase 1)
│   ├── Toast.jsx                    # Notificações toast (Fase 1)
│   └── Skeleton.jsx                 # Skeleton loaders (Fase 1)
├── services/
│   ├── snapshotService.js           # CRUD snapshots mensais (Supabase + localStorage)
│   ├── budgetService.js             # CRUD limites de orçamento
│   └── investmentService.js         # CRUD investimentos e metas
├── hooks/
│   ├── useDarkMode.js
│   └── useToast.js                  # Hook de toast (Fase 1)
├── utils/
│   ├── financialRules.js            # Regra 50-30-20
│   ├── calculateInvestmentPlan.js
│   └── toNumberBR.js
└── lib/supabaseClient.js
```

### Modelo de dados atual no Supabase

```
monthly_snapshots: { id, user_id, month (YYYY-MM), receita, fixas, cartao, invest, created_at, updated_at }
budgets:           { id, user_id, category ('fixas'|'cartao'|'invest'), limit_amount, created_at, updated_at }
investment_goals:  { id, user_id, title, target_amount, target_date, created_at }
investments:       { id, user_id, month (YYYY-MM), amount, created_at }
```

### Padrão dos services existentes (snapshotService.js como referência)

Todos os services seguem o mesmo padrão:
1. Importam `supabase` de `../lib/supabaseClient`
2. Têm helpers `getStore()` e `setStore()` para localStorage
3. Têm helper `getUser()` que retorna o user autenticado
4. Em cada operação: se não há user, operam no localStorage. Se há user, operam no Supabase com fallback para localStorage em caso de erro
5. Dados do Supabase são sempre cacheados no localStorage após sucesso

### Como o FileImporter funciona hoje

O `FileImporter.jsx` recebe um arquivo, detecta o formato (CSV/XLSX/XML), parseia em linhas brutas (array de arrays), e:
1. `normalizeRows(rawData)` — identifica colunas de "categoria" e "valor" pelos headers, normaliza cada categoria via `CATEGORY_MAP` (dicionário fixo), extrai o valor numérico
2. `computeTotals(rows)` — soma valores por categoria: `{ fixas, cartao, invest, receita }`
3. Retorna os totals via `onTotals(totals)` — as linhas individuais são descartadas

O `CATEGORY_MAP` mapeia variações de texto para as 4 categorias:
```javascript
const CATEGORY_MAP = {
  fixa: 'fixas', fixas: 'fixas', 'conta fixa': 'fixas', 'contas fixas': 'fixas',
  'despesa fixa': 'fixas', 'despesas fixas': 'fixas',
  cartao: 'cartao', cartão: 'cartao', 'cartão de crédito': 'cartao',
  credito: 'cartao', crédito: 'cartao',
  invest: 'invest', investimento: 'invest', investimentos: 'invest',
  aplicação: 'invest', aplicacao: 'invest',
  receita: 'receita', receitas: 'receita', renda: 'receita',
  salario: 'receita', salário: 'receita',
}
```

A função `findColumns(headers)` busca colunas de categoria e valor nos headers:
```javascript
function findColumns(headers) {
  const lower = headers.map((h) => String(h).trim().toLowerCase())
  const catIdx = lower.findIndex((h) => ['categoria', 'category', 'tipo', 'type'].includes(h))
  const valIdx = lower.findIndex((h) => ['valor', 'value', 'amount', 'quantia', 'total'].includes(h))
  return { catIdx, valIdx }
}
```

### Como o App.jsx orquestra os dados

- Estado: `totals = { receita, fixas, cartao, invest }`, `selectedMonth`, `showDash`, `prevTotals`
- `handleImport(imported)` — recebe totals do FileImporter, seta em state, schedula save
- `handleInputChange(e)` — atualiza totals campo a campo, schedula save
- `scheduleSave()` — debounce de 600ms, chama `upsertSnapshot({ month, ...totals })`
- `loadMonth(month)` — carrega snapshot do mês, seta totals e prevTotals
- O Dashboard recebe `receita, fixas, cartao, invest` como props separadas

### Como o snapshotService funciona

- `getSnapshot(month)` — busca snapshot de um mês específico
- `upsertSnapshot({ month, receita, fixas, cartao, invest })` — cria ou atualiza
- `listMonths()` — retorna array de meses que têm dados (merge Supabase + localStorage)
- `deleteSnapshot(month)` — deleta snapshot de um mês

---

## TAREFA 2.1 — Histórico de Transações Detalhado

### Problema
O app apenas guarda totais mensais. O usuário importa um arquivo com 50 lançamentos, mas só vê totais. Não consegue ver, corrigir ou analisar transações individuais.

### O que implementar

#### 2.1.1 — Migration SQL para nova tabela

Criar arquivo `src/migrations/phase2a.sql` com:

```sql
CREATE TABLE transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  month VARCHAR(7) NOT NULL,
  category VARCHAR(20) NOT NULL,
  description TEXT DEFAULT '',
  amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  date DATE,
  source VARCHAR(20) DEFAULT 'manual',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own transactions"
  ON transactions FOR ALL
  USING (auth.uid() = user_id);

CREATE INDEX idx_transactions_user_month ON transactions(user_id, month);
```

#### 2.1.2 — Service de transações

Criar `src/services/transactionService.js` seguindo o padrão dos outros services:

- **localStorage key:** `'transactions'` — armazena como `{ [month]: [array de transações] }`
- **Métodos:**
  - `listTransactions(month)` — lista transações do mês, ordenadas por date DESC, created_at DESC
  - `upsertTransaction({ id?, month, category, description, amount, date, source })` — se `id` existe, atualiza; senão, cria. Validar month formato YYYY-MM
  - `deleteTransaction(id)` — deleta pelo id
  - `getTransactionTotals(month)` — retorna `{ receita, fixas, cartao, invest }` calculados pela soma das transações
  - `bulkInsertTransactions(month, transactions)` — insere múltiplas transações de uma vez (para o import). Cada item: `{ category, description, amount, date, source }`
- **Padrão:** Supabase com fallback localStorage, cache local após sucesso, helper getUser()

#### 2.1.3 — Componente TransactionList

Criar `src/components/TransactionList.jsx`:

**Layout:**
- Card com header "Transações do mês" + contador "(23 lançamentos)" + botão "Adicionar"
- Card é colapsável (toggle mostrar/ocultar) — padrão: fechado se existem transações, aberto se não existem
- Filtros: dropdown de categoria (Todas, Fixas, Cartão, Investimentos, Receita) + campo de busca por descrição
- Tabela responsiva com colunas: Data | Descrição | Categoria | Valor | Ações
- No mobile: layout de cards empilhados ao invés de tabela
- Rodapé: total por categoria filtrada + total geral

**Cada linha da tabela:**
- Data: formatada como "15 mar" (date-fns, locale ptBR)
- Descrição: texto truncado com tooltip se muito longo
- Categoria: badge colorido (rose=fixas, orange=cartao, indigo=invest, emerald=receita)
- Valor: verde para receita, vermelho para despesas (fixas/cartao), indigo para invest
- Ações: botão editar (ícone lápis) + botão excluir (ícone lixeira)

**Adicionar transação:**
- Botão "Adicionar" no header abre formulário inline no topo da lista
- Campos: Data (date input), Descrição (text), Categoria (dropdown), Valor (number com prefixo R$)
- Botões: Salvar + Cancelar
- Ao salvar: chama `upsertTransaction`, recarrega lista, recalcula totais

**Editar transação:**
- Ao clicar em editar, a linha vira editável (mesmos campos do formulário de adicionar)
- Botões: Salvar + Cancelar
- Ao salvar: chama `upsertTransaction`, recarrega lista, recalcula totais

**Excluir transação:**
- Ao clicar em excluir, abre ConfirmModal: "Excluir transação? Esta ação não pode ser desfeita."
- Ao confirmar: chama `deleteTransaction`, recarrega lista, recalcula totais

**Empty state:**
- "Nenhuma transação neste mês. Importe um arquivo ou adicione manualmente."

**Props:**
```javascript
TransactionList({ month, onTotalsChanged })
// month: string YYYY-MM (mês selecionado)
// onTotalsChanged: callback({ receita, fixas, cartao, invest }) chamado quando transações mudam
```

#### 2.1.4 — Integrar FileImporter com transações

Modificar `FileImporter.jsx`:

1. **Atualizar `findColumns`** para também detectar colunas de data e descrição:
   ```javascript
   const dateIdx = lower.findIndex(h => ['data', 'date', 'dia', 'dt'].includes(h))
   const descIdx = lower.findIndex(h => ['descricao', 'descrição', 'description', 'desc', 'nome', 'name', 'historico', 'histórico'].includes(h))
   ```

2. **Atualizar `normalizeRows`** para retornar objetos mais ricos:
   ```javascript
   // Cada row retornado agora:
   { categoria, valor, descricao, data }
   // descricao: texto da coluna de descrição (ou texto original da categoria se não houver coluna)
   // data: Date ou null
   ```

3. **Após `computeTotals`**, também salvar as linhas como transações:
   ```javascript
   import { bulkInsertTransactions } from '../services/transactionService'
   // ...
   const totals = computeTotals(normalized)
   // Salvar transações individuais
   await bulkInsertTransactions(selectedMonth, normalized.map(row => ({
     category: row.categoria,
     description: row.descricao || '',
     amount: row.valor,
     date: row.data || null,
     source: 'import',
   })))
   ```

4. **O FileImporter precisa receber o mês selecionado como prop:** `FileImporter({ onTotals, month })`
   - Atualizar no `App.jsx` para passar `selectedMonth`

#### 2.1.5 — Integrar no App.jsx

- Importar e renderizar `TransactionList` logo abaixo do Dashboard (quando `showDash` é true)
- Passar `month={selectedMonth}` e `onTotalsChanged` que:
  1. Atualiza o estado `totals`
  2. Chama `upsertSnapshot` para sincronizar o snapshot
  3. Marca `showDash = true` se algum valor > 0
- Passar `month={selectedMonth}` ao FileImporter

#### 2.1.6 — Sincronização de totais

Quando transações mudam (add/edit/delete):
1. Chamar `getTransactionTotals(month)` para recalcular
2. Atualizar state `totals` no App
3. Chamar `upsertSnapshot({ month, ...newTotals })` para persistir
4. O Dashboard, BudgetProgress, FinancialInsights atualizam automaticamente via props

---

## TAREFA 2.2 — Comparativo Mensal (Evolução ao Longo do Tempo)

### Problema
O dashboard só mostra dados do mês selecionado. Não há visão de como receita e despesas evoluem ao longo dos meses.

### O que implementar

#### 2.2.1 — Novo método no snapshotService

Adicionar `listAllSnapshots()` em `src/services/snapshotService.js`:

```javascript
export async function listAllSnapshots() {
  const user = await getUser()
  if (!user) {
    const store = getStore()
    return Object.values(store).sort((a, b) => a.month.localeCompare(b.month))
  }

  try {
    const { data, error } = await supabase
      .from('monthly_snapshots')
      .select('*')
      .eq('user_id', user.id)
      .order('month', { ascending: true })
    if (error) throw error

    // Cache no localStorage
    const store = getStore()
    for (const snap of (data || [])) {
      store[snap.month] = snap
    }
    setStore(store)
    return data || []
  } catch {
    const store = getStore()
    return Object.values(store).sort((a, b) => a.month.localeCompare(b.month))
  }
}
```

#### 2.2.2 — Componente MonthlyTrend

Criar `src/components/MonthlyTrend.jsx`:

**Dados:**
- Ao montar, chamar `listAllSnapshots()` para obter todos os snapshots
- Se houver menos de 2 meses, mostrar mensagem: "Adicione dados de mais meses para ver a evolução ao longo do tempo."
- Limitar a 12 meses mais recentes no gráfico (se houver mais, mostrar os 12 últimos)

**Gráfico de linhas (Line chart):**
- Usar `Line` de `react-chartjs-2`
- Registrar `LineElement, PointElement` no Chart.js (já registrados no InvestmentTrendChart)
- Eixo X: meses formatados como "jan/25", "fev/25" (date-fns com locale ptBR)
- Eixo Y: valores em BRL (callback: `R$ Xk`)
- 5 linhas:
  - Receita: cor emerald (#10b981), linha sólida, 2.5px
  - Contas Fixas: cor rose (#f43f5e), linha sólida, 2px
  - Cartão: cor orange (#f97316), linha sólida, 2px
  - Investimentos: cor indigo (#6366f1), linha sólida, 2px
  - Saldo: cor green (#22c55e), linha tracejada (borderDash: [6, 3]), 2px
- Cada linha com pontos pequenos (pointRadius: 3) e hover (pointHoverRadius: 5)
- tension: 0.3 para curvas suaves
- Tooltip: mostrar todos os valores do mês no hover, formatados em BRL
- Legenda na parte inferior com pointStyle
- Responsivo: `h-[280px] md:h-[360px]`
- Dark mode: textColor e gridColor adaptáveis (usar o mesmo padrão do Dashboard.jsx)

**Tabela resumo (colapsável, padrão fechada):**
- Toggle "Ver detalhes" / "Ocultar detalhes"
- Colunas: Mês | Receita | Fixas | Cartão | Invest | Saldo
- Cada célula formatada em BRL
- Saldo: verde se positivo, vermelho se negativo
- Highlight no mês atual (fundo indigo sutil)
- Última linha: "Média" com a média de cada coluna
- Overflow horizontal com scroll no mobile

**Indicadores de tendência (no header do card):**
- Para cada categoria, calcular se o último mês subiu ou desceu em relação à média dos 3 meses anteriores
- Mostrar como mini badges: "Fixas ↑ 12%" (vermelho) ou "Invest ↑ 8%" (verde para invest pois mais é melhor)
- A cor da seta depende da categoria: para receita e invest, subir é bom (verde); para fixas e cartao, subir é ruim (vermelho)

**Props:**
```javascript
MonthlyTrend({ dark, selectedMonth })
```

#### 2.2.3 — Integrar no App.jsx

- Importar e renderizar `MonthlyTrend` entre o Dashboard/TransactionList e o BudgetProgress
- Passar `dark={dark}` e `selectedMonth={selectedMonth}`
- O componente faz seu próprio fetch de dados (listAllSnapshots)
- Envolver num card com título "Evolução Mensal"

---

## Critérios de aceite

1. **Dark mode** em todos os componentes novos
2. **Responsividade:** mobile (320px) a desktop (1280px), breakpoints sm/md/lg
3. **Sem dependências novas** — usar apenas o que já está no package.json
4. **Retrocompatibilidade:** dados existentes nos snapshots continuam funcionando. Meses sem transações individuais exibem normalmente seus totais do snapshot
5. **Offline fallback:** transactionService deve ter localStorage fallback
6. **Loading states:** usar skeletons (padrão Fase 1) durante carregamento de transações e snapshots
7. **Erros:** usar toasts (padrão Fase 1) para feedback de erros em operações de transação
8. **Performance:** listAllSnapshots faz 1 request (não N requests). TransactionList pagina ou limita a 50 itens visíveis
9. **Padrão de código:** componentes funcionais, Tailwind, BRL formatting, date-fns ptBR
10. **SQL:** incluir migration em `src/migrations/phase2a.sql`
11. **Commits separados:** um para 2.1 (transações) e outro para 2.2 (comparativo), mensagens em português
