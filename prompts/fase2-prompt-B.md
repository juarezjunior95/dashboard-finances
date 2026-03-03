# FASE 2 — Prompt B: Categorias Customizáveis

## Contexto do Projeto

Dashboard de Finanças pessoal construído com **React 19 + Vite 7 + Tailwind CSS 3.4 + Chart.js + Supabase**.
App single-page (sem React Router) com autenticação Supabase, entrada manual, importação de arquivos, dashboard com KPIs e gráficos, regra 50-30-20, limites de orçamento, e planejamento de investimentos.

**Pressuponha que as tarefas anteriores já foram implementadas:**
- Fase 1: modal de confirmação, onboarding, toasts, skeletons
- Fase 2A: sistema de transações individuais + comparativo mensal

### Stack e padrões
- **Tailwind CSS** utility-first, dark mode via `darkMode: 'class'`
- **Cards:** `bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 sm:p-6`
- **Inputs:** `rounded-xl border focus:ring-2 focus:ring-indigo-400 dark:bg-gray-800 dark:text-gray-100`
- **Botões primários:** `bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl`
- **Cores semânticas das 4 categorias base:** emerald (receita), rose (fixas), orange (cartão), indigo (invest)
- **Componentes funcionais** com hooks, sem biblioteca UI externa
- **Persistência:** Supabase + localStorage fallback
- **Idioma:** pt-BR
- **Formatação:** BRL via `toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })`
- **Datas:** date-fns com locale ptBR
- **Não adicionar dependências novas**

### Estrutura de arquivos (após Fase 2A)
```
src/
├── App.jsx
├── components/
│   ├── Dashboard.jsx                # KPIs, gráficos doughnut/bar, export CSV
│   ├── FileImporter.jsx             # Import com suporte a transações individuais
│   ├── TransactionList.jsx          # (2A) Lista de transações do mês
│   ├── MonthlyTrend.jsx             # (2A) Evolução mensal (line chart)
│   ├── MonthSelector.jsx
│   ├── BudgetProgress.jsx           # Limites por categoria (fixas, cartao, invest)
│   ├── InvestmentPlanner.jsx
│   ├── InvestmentTrendChart.jsx
│   ├── FinancialInsights.jsx        # Score de saúde financeira (regra 50-30-20)
│   ├── ConfirmModal.jsx
│   ├── Toast.jsx
│   └── Skeleton.jsx
├── services/
│   ├── snapshotService.js           # getSnapshot, upsertSnapshot, listMonths, listAllSnapshots
│   ├── transactionService.js        # (2A) CRUD transações
│   ├── budgetService.js             # CRUD limites de orçamento
│   └── investmentService.js
├── hooks/
│   ├── useDarkMode.js
│   └── useToast.js
├── utils/
│   ├── financialRules.js            # analyzeFinances() — regra 50-30-20
│   ├── calculateInvestmentPlan.js
│   └── toNumberBR.js
├── lib/supabaseClient.js
└── migrations/
    └── phase2a.sql                  # Tabela transactions
```

### Modelo de dados atual

**Tabelas Supabase:**
```
monthly_snapshots: { id, user_id, month, receita, fixas, cartao, invest, created_at, updated_at }
budgets:           { id, user_id, category ('fixas'|'cartao'|'invest'), limit_amount, created_at, updated_at }
investment_goals:  { id, user_id, title, target_amount, target_date, created_at }
investments:       { id, user_id, month, amount, created_at }
transactions:      { id, user_id, month, category, description, amount, date, source, created_at }
```

### Como as categorias funcionam hoje

**4 categorias hardcoded em todo o sistema:**
- `receita` — renda, salário
- `fixas` — contas fixas, moradia, essenciais
- `cartao` — gastos variáveis, desejos
- `invest` — investimentos, reserva

**Onde estão hardcoded:**

1. **FileImporter.jsx** — `CATEGORY_MAP` (dicionário fixo de sinônimos → categoria)
2. **BudgetProgress.jsx** — `CATEGORIES` array:
   ```javascript
   const CATEGORIES = [
     { key: 'fixas', label: 'Contas Fixas', color: 'rose' },
     { key: 'cartao', label: 'Cartao', color: 'orange' },
     { key: 'invest', label: 'Investimentos', color: 'indigo' },
   ]
   ```
3. **Dashboard.jsx** — `LABELS` e `COLORS` objects:
   ```javascript
   const LABELS = { fixas: 'Contas Fixas', cartao: 'Cartão', invest: 'Investimentos', receita: 'Receitas', saldo: 'Saldo Livre' }
   const COLORS = {
     fixas:   { bg: '#f43f5e', light: '#fff1f2', darkLight: '#4c0519' },
     cartao:  { bg: '#f97316', light: '#fff7ed', darkLight: '#431407' },
     invest:  { bg: '#6366f1', light: '#eef2ff', darkLight: '#1e1b4b' },
     receita: { bg: '#10b981', light: '#ecfdf5', darkLight: '#052e16' },
     saldo:   { bg: '#22c55e', light: '#f0fdf4', darkLight: '#052e16' },
   }
   ```
4. **financialRules.js** — `RULES` array (regra 50-30-20):
   ```javascript
   const RULES = [
     { category: 'fixas', label: 'Contas Fixas', idealPct: 50, direction: 'max', ... },
     { category: 'cartao', label: 'Cartao', idealPct: 30, direction: 'max', ... },
     { category: 'invest', label: 'Investimentos', idealPct: 20, direction: 'min', ... },
   ]
   ```
5. **App.jsx** — `EMPTY` object e `InputField` para as 4 categorias:
   ```javascript
   const EMPTY = { receita: 0, fixas: 0, cartao: 0, invest: 0 }
   ```
6. **TransactionList.jsx** — badges de categoria e filtro de dropdown
7. **MonthlyTrend.jsx** — linhas do gráfico por categoria

### Princípio de design importante

**A regra 50-30-20 opera sobre 4 pilares fixos.** Subcategorias são uma forma de detalhar, mas SEMPRE se agregam num dos 4 pilares para fins de cálculo e KPIs. Por exemplo:

- "Aluguel" → subcategoria de `fixas`
- "Restaurante" → subcategoria de `cartao`
- "Tesouro Direto" → subcategoria de `invest`
- "Freelance" → subcategoria de `receita`

Isso garante que a regra 50-30-20, os KPIs, e os snapshots continuem funcionando.

---

## TAREFA 2.4 — Categorias Customizáveis

### O que implementar

#### 2.4.1 — Migration SQL

Criar/atualizar `src/migrations/phase2b.sql`:

```sql
CREATE TABLE user_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  key VARCHAR(30) NOT NULL,
  label VARCHAR(50) NOT NULL,
  color VARCHAR(20) NOT NULL,
  parent_category VARCHAR(20) NOT NULL,
  icon VARCHAR(10) DEFAULT '',
  is_default BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE user_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own categories"
  ON user_categories FOR ALL
  USING (auth.uid() = user_id);

CREATE UNIQUE INDEX idx_categories_user_key ON user_categories(user_id, key);
```

#### 2.4.2 — Service de categorias

Criar `src/services/categoryService.js`:

**Constantes — categorias padrão do sistema:**
```javascript
const DEFAULT_CATEGORIES = [
  { key: 'receita', label: 'Receitas', color: 'emerald', parent_category: 'receita', icon: '💰', is_default: true, sort_order: 0 },
  { key: 'fixas', label: 'Contas Fixas', color: 'rose', parent_category: 'fixas', icon: '🏠', is_default: true, sort_order: 1 },
  { key: 'cartao', label: 'Cartão', color: 'orange', parent_category: 'cartao', icon: '💳', is_default: true, sort_order: 2 },
  { key: 'invest', label: 'Investimentos', color: 'indigo', parent_category: 'invest', icon: '📈', is_default: true, sort_order: 3 },
]
```

**Métodos:**
- `listCategories()` — lista todas as categorias do usuário. Se nenhuma existe, faz seed das 4 padrão e retorna. Ordena por `sort_order`, depois `label`
- `upsertCategory({ key?, label, color, parent_category, icon, sort_order })` — cria ou atualiza. Se `key` não for fornecido, gera slug a partir do label (minúsculo, sem acentos, espaços → underscore)
- `deleteCategory(id)` — deleta. Rejeitar se `is_default === true` (retornar erro). Ao deletar, transações com essa categoria devem ser atualizadas para o `parent_category`
- `getCategoryMap()` — retorna um Map de `key → { label, color, parent_category, icon }` para lookup rápido
- `groupByParent(totalsPerCategory)` — recebe `{ aluguel: 1500, energia: 200, restaurante: 300, ... }` e retorna `{ fixas: 1700, cartao: 300, ... }` agrupando por parent_category

**localStorage key:** `'user_categories'`
**Padrão:** Supabase + localStorage fallback, cache local após sucesso

**Cores disponíveis** (paleta Tailwind que o componente de seleção deve oferecer):
```javascript
const AVAILABLE_COLORS = [
  { key: 'rose', bg: '#f43f5e', label: 'Rosa' },
  { key: 'orange', bg: '#f97316', label: 'Laranja' },
  { key: 'amber', bg: '#f59e0b', label: 'Âmbar' },
  { key: 'emerald', bg: '#10b981', label: 'Verde' },
  { key: 'teal', bg: '#14b8a6', label: 'Teal' },
  { key: 'cyan', bg: '#06b6d4', label: 'Ciano' },
  { key: 'indigo', bg: '#6366f1', label: 'Índigo' },
  { key: 'violet', bg: '#8b5cf6', label: 'Violeta' },
  { key: 'pink', bg: '#ec4899', label: 'Pink' },
  { key: 'lime', bg: '#84cc16', label: 'Lima' },
  { key: 'sky', bg: '#0ea5e9', label: 'Azul' },
  { key: 'red', bg: '#ef4444', label: 'Vermelho' },
]
```

#### 2.4.3 — Componente CategoryManager

Criar `src/components/CategoryManager.jsx`:

**Acesso:**
- Botão "Categorias" no header do `BudgetProgress` (ao lado do título "Limites por Categoria")
- Ao clicar, abre/fecha o painel de gerenciamento (toggle, não modal)

**Layout do painel:**
- Agrupado por categoria-pai (4 seções: Receita, Contas Fixas, Cartão, Investimentos)
- Cada seção tem header com o nome da categoria-pai e badge com quantidade de subcategorias
- Dentro de cada seção: lista de subcategorias
  - A categoria padrão aparece primeiro, com badge "Padrão" e sem botão de excluir
  - Cada subcategoria mostra: emoji (se tiver) + nome + bolinha de cor + botão editar + botão excluir

**Formulário de nova subcategoria (inline, dentro da seção):**
- Botão "+ Adicionar" em cada seção de categoria-pai
- Ao clicar: mostra formulário inline com:
  - Nome (text input, obrigatório)
  - Emoji (text input, opcional, max 2 chars)
  - Cor (seletor visual: grid de bolinhas coloridas, selecionar uma)
  - Botões: Salvar + Cancelar
- A `parent_category` é inferida pela seção onde o botão foi clicado
- O `key` é gerado automaticamente: nome em minúsculo, sem acentos, espaços → underscore

**Editar subcategoria:**
- Ao clicar em editar, a linha vira editável (mesmos campos)
- Não permite editar categorias padrão (is_default)

**Excluir subcategoria:**
- Abre ConfirmModal: "Excluir categoria '{nome}'? As transações desta categoria serão movidas para '{nome da categoria-pai}'."
- Ao confirmar: chama deleteCategory (que já move transações para o parent)
- Não permite excluir categorias padrão

**Empty state por seção:**
- Só mostra a categoria padrão com texto "Adicione subcategorias para detalhar seus gastos"

**Props:**
```javascript
CategoryManager({ onCategoriesChanged })
// onCategoriesChanged: callback chamado quando categorias são criadas/editadas/excluídas
```

#### 2.4.4 — Integrar com FileImporter

Atualizar `FileImporter.jsx`:

1. **Ao montar**, carregar as categorias do usuário via `listCategories()`
2. **Expandir o `CATEGORY_MAP`** dinamicamente com as categorias custom:
   ```javascript
   // Mapa base (hardcoded) + categorias custom do usuário
   // Para cada categoria custom: { key: 'aluguel', ... }
   // Adicionar ao mapa: 'aluguel' → 'aluguel'
   // E também o label: 'Aluguel' → 'aluguel'
   ```
3. **Se uma categoria do arquivo não for reconhecida:**
   - Em vez de ignorar silenciosamente (como faz hoje), coletar todas as categorias não reconhecidas
   - Após o parse, se houver categorias não reconhecidas, mostrar um **painel de mapeamento**:
     - Lista cada categoria não reconhecida com a quantidade de lançamentos
     - Dropdown para mapear para uma categoria existente (listar todas: padrão + custom)
     - Opção "Criar nova subcategoria" que abre mini-form inline (nome, cor, parent)
     - Botão "Aplicar mapeamento" que reprocessa o arquivo com o mapeamento definido
   - Se todas as categorias forem reconhecidas, importar normalmente sem parar

#### 2.4.5 — Integrar com TransactionList

Atualizar `TransactionList.jsx`:

1. **Filtro de categoria:** atualizar dropdown para incluir todas as categorias (padrão + custom), agrupadas por parent
2. **Badge de categoria:** usar a cor da categoria custom (não só as 4 cores padrão)
3. **Formulário de adicionar/editar:** dropdown de categoria com todas as opções disponíveis
4. **Ao adicionar transação:** se a categoria é custom, armazenar o key da subcategoria no campo `category` da transação

#### 2.4.6 — Integrar com Dashboard

Atualizar `Dashboard.jsx`:

1. **KPIs:** continuam mostrando os 4 pilares (receita, fixas, cartao, invest). Os valores devem ser agrupados por parent_category usando `groupByParent()`
2. **Gráfico de rosca (Doughnut):**
   - Se o usuário tem subcategorias: mostrar breakdown detalhado no gráfico
   - Ex: em vez de um pedaço "Contas Fixas", mostrar "Aluguel", "Energia", "Internet" (subcategorias de fixas)
   - Usar a cor de cada subcategoria
   - Se não tem subcategorias: comportamento atual (4 fatias)
   - Tooltip: "Aluguel (Fixas): R$ 1.500 (30%)"
3. **Gráfico de barras:** manter agrupamento por parent (4 barras)

#### 2.4.7 — Integrar com BudgetProgress

Atualizar `BudgetProgress.jsx`:

1. **Carregar categorias** do usuário ao montar
2. **Exibir limites por subcategoria** (opcionalmente):
   - Se o usuário tem subcategorias, mostrar um toggle "Ver por subcategoria"
   - Quando ativo: barras de progresso para cada subcategoria, agrupadas sob a categoria-pai
   - Quando inativo: comportamento atual (3 barras)
3. **Limites de subcategoria** salvos na mesma tabela `budgets`, usando o `key` da subcategoria como `category`

#### 2.4.8 — financialRules.js NÃO muda

- A função `analyzeFinances({ receita, fixas, cartao, invest })` continua recebendo os 4 totais agregados
- O agrupamento por parent_category deve acontecer ANTES de chamar analyzeFinances
- Nenhuma mudança necessária neste arquivo
- O App.jsx deve fazer o agrupamento antes de passar os dados

---

## Critérios de aceite

1. **Retrocompatibilidade total:** usuários sem categorias custom veem o app exatamente como antes. As 4 categorias padrão são criadas automaticamente (seed)
2. **A regra 50-30-20 continua funcionando** — subcategorias se agregam nos 4 pilares
3. **Snapshots mensais não mudam de schema** — continuam com receita, fixas, cartao, invest (agregados)
4. **Dark mode** em todos os componentes novos/modificados
5. **Responsividade:** mobile a desktop
6. **Sem dependências novas**
7. **Offline fallback** no categoryService
8. **Erros exibidos via toast** (Fase 1)
9. **Loading states** com skeletons onde necessário
10. **SQL migration** em `src/migrations/phase2b.sql`
11. **Commit único** com mensagem descritiva em português: "feat: adicionar sistema de categorias customizáveis"
