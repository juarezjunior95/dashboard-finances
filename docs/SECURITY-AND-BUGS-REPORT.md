# Relatório de Bugs e Vulnerabilidades

**Projeto:** Dashboard de Finanças  
**Data:** 2025-03-10  
**Escopo:** Código-fonte (React, Supabase, serviços e componentes)

---

## Resumo executivo

O projeto está **bem estruturado** em termos de segurança: usa Supabase com RLS implícito (user_id em todas as queries), não usa `dangerouslySetInnerHTML`/`eval`, e valida formato de mês (YYYY-MM) nos serviços. Foram encontrados **bugs de lógica**, **vazamento de informação em produção** e **melhorias de segurança** recomendadas.

---

## 1. Vulnerabilidades e riscos de segurança

### 1.1 Baixo – Chaves Supabase no client

- **Onde:** `src/lib/supabaseClient.js`
- **Situação:** `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` são expostas no bundle do front-end (esperado no modelo Supabase).
- **Recomendação:** Garantir que no Supabase estejam configurados:
  - **Row Level Security (RLS)** em todas as tabelas (`transactions`, `monthly_snapshots`, `user_categories`) filtrando por `auth.uid() = user_id`.
  - Políticas que permitam apenas leitura/escrita dos próprios dados.
- **Status:** Depende da configuração no Supabase; verificar no painel do projeto.

### 1.2 Baixo – Validação de arquivo por extensão (FileImporter)

- **Onde:** `src/components/FileImporter.jsx` – `getParser(file.name)` e `accept={ACCEPTED}`.
- **Risco:** O tipo é decidido apenas pela extensão (`.csv`, `.xlsx`, `.xml`). Um arquivo malicioso renomeado (ex.: `.exe` → `.csv`) pode ser aceito pelo input.
- **Mitigação atual:** O parsing é feito em memória (Papa.parse, XLSX.read, DOMParser). Conteúdo que não for CSV/XLSX/XML válido tende a falhar no parse, limitando impacto.
- **Recomendação:**
  - Validar **tamanho máximo** do arquivo (ex.: 5–10 MB) para evitar DoS por arquivos gigantes.
  - Opcional: validar magic bytes (assinatura do arquivo) além da extensão.

### 1.3 Baixo – Sem rate limiting no login

- **Onde:** `src/components/Login.jsx` + `AuthContext` (Supabase Auth).
- **Risco:** Tentativas de login (e cadastro) sem limite podem facilitar brute-force.
- **Recomendação:** O Supabase já pode limitar tentativas; verificar nas configurações do projeto. No front, pode-se desabilitar o botão por alguns segundos após N tentativas falhas (UX + camada extra).

### 1.4 Informativo – Dados sensíveis no localStorage

- **Onde:** Vários serviços usam `localStorage` para cache (transações, categorias, snapshots, indicadores BCB).
- **Risco:** Em computador compartilhado, dados ficam disponíveis até logout/limpeza.
- **Recomendação:** Manter como está; considerar limpar caches sensíveis no `signOut` se quiser “logout total” no dispositivo.

---

## 2. Bugs de lógica e qualidade

### 2.1 Console.log em produção (transactionService)

- **Onde:** `src/services/transactionService.js` linha ~224  
  `console.log('[getTransactionTotals]', { month, txCount, detailedTotals, parentMap, totals })`
- **Problema:** Vazamento de informação (totais, estrutura de categorias) no console em produção; poluição de log.
- **Ação:** Remover ou envolver em `if (import.meta.env.DEV)`.

### 2.2 slugify com entrada null/undefined (categoryService)

- **Onde:** `src/services/categoryService.js` – `slugify(text)` e uso em `upsertCategory({ key, label, ... })` com `key || slugify(label)`.
- **Problema:** Se `label` for `undefined` ou `null`, `String(text)` retorna `"undefined"`/`"null"` e o restante do código pode gerar slugs indesejados; em outros contextos, acesso a propriedade de undefined pode lançar.
- **Ação:** Tratar entrada vazia/null no início de `slugify` (ex.: retornar string vazia ou valor seguro).

### 2.3 Totais filtrados ignoram subcategorias (TransactionList)

- **Onde:** `src/components/TransactionList.jsx` – `filteredTotals` é inicializado com `{ fixas: 0, cartao: 0, invest: 0, receita: 0 }` e só incrementa `totals[tx.category]` quando `tx.category in totals`.
- **Problema:** Categorias filhas (ex.: `compras`, `salario`) não entram no objeto; seus valores não são somados no “Saldo” do rodapé quando há filtro.
- **Ação:** Agrupar por `parent_category` (usando `catLookup` ou equivalente) ao calcular `filteredTotals`, ou incluir todas as categorias presentes em `filtered` no objeto de totais.

### 2.4 handleReset não persiste limpeza (App.jsx)

- **Onde:** `App.jsx` – `handleReset` zera estado local (`setTotals`, `setShowDash`, etc.) mas **não** chama serviços para apagar transações/snapshots do mês no backend ou localStorage.
- **Problema:** Ao trocar de mês e voltar, os dados podem reaparecer; comportamento inconsistente com “Limpar dados”.
- **Recomendação:** Chamar `clearTransactions(selectedMonth)` e apagar snapshot do mês (ex.: `deleteSnapshot` ou equivalente) antes ou depois de zerar o estado.

---

## 3. Boas práticas já adotadas

- **Autenticação:** Uso de Supabase Auth com sessão e `user_id` em todas as operações.
- **Proteção de rotas:** Dashboard só é renderizado com `user`; tela de login para não autenticados.
- **Validação de mês:** Formato `YYYY-MM` validado com regex em `transactionService` e `snapshotService`.
- **Sem XSS direto:** Nenhum uso de `dangerouslySetInnerHTML`, `eval` ou `innerHTML` com conteúdo dinâmico; React escapa texto por padrão.
- **Tratamento de erro:** Try/catch e fallback para localStorage quando a API falha (offline/resilience).
- **Variáveis de ambiente:** Uso de `import.meta.env.VITE_*` e `.env` no `.gitignore`; exemplo em `.env.example`.

---

## 4. Checklist pós-relatório

- [ ] Confirmar RLS nas tabelas Supabase (`transactions`, `monthly_snapshots`, `user_categories`).
- [x] Remover ou condicionar `console.log` em `transactionService.js` (condicionado a `import.meta.env.DEV`).
- [x] Tratar `null`/`undefined` em `slugify` em `categoryService.js`.
- [x] Adicionar limite de tamanho de arquivo no `FileImporter` (10 MB).
- [x] Ajustar `filteredTotals` em `TransactionList` para considerar subcategorias (parent).
- [x] Fazer `handleReset` limpar dados no backend/localStorage (transações + snapshot do mês).

---

*Relatório gerado por análise estática do código. Recomenda-se revisão humana e testes antes de deploy.*
