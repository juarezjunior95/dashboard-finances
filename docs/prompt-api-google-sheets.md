# Prompt: Implementar Sincronização com Google Sheets API

## Contexto

Tenho um dashboard financeiro pessoal em React 19 + Vite 7 + Tailwind CSS + Supabase. A aplicação já importa dados de planilhas Excel/CSV via upload manual (`FileImporter.jsx`). Quero permitir que o usuário conecte uma planilha do Google Sheets e sincronize os dados diretamente, sem precisar exportar arquivo e importar manualmente.

## Stack atual

- React 19, Vite 7, Tailwind CSS 3.4
- Supabase (auth + banco)
- localStorage como cache/fallback
- Importador atual: `src/components/FileImporter.jsx`
  - Funções de parsing: `findColumns()`, `normalizeRows()`, `normalizePaymentStatus()`
  - Detecta colunas: categoria, valor, descrição, data, status
  - Mapeia categorias desconhecidas via UI
- Transações salvas via `bulkInsertTransactions()` em `transactionService.js`
- PWA com service worker

## O que implementar

### 1. Configuração do Google Cloud

**Pré-requisitos (manual do desenvolvedor):**
- Criar projeto no Google Cloud Console
- Ativar Google Sheets API
- Criar credencial OAuth 2.0 para aplicação web
- Configurar origens JavaScript autorizadas (localhost + domínio de produção)
- Obter Client ID

**Variável de ambiente:**
```env
VITE_GOOGLE_CLIENT_ID=seu-client-id.apps.googleusercontent.com
```

### 2. Criar `src/services/googleSheetsService.js`

Serviço para autenticação OAuth e leitura de planilhas.

**Funções:**

```javascript
// Inicializa o Google Identity Services (GIS)
initGoogleAuth()

// Solicita acesso read-only ao Google Sheets
requestAccess() → Promise<tokenResponse>

// Busca dados de uma planilha
fetchSheetData(spreadsheetId, sheetName) → Promise<rows[][]>

// Lista abas disponíveis na planilha
fetchSheetTabs(spreadsheetId) → Promise<string[]>

// Extrai spreadsheetId de uma URL do Google Sheets
parseSpreadsheetUrl(url) → string | null

// Salva/recupera configuração de sincronização
saveSheetConfig({ spreadsheetId, sheetName, url }) → void
getSheetConfig() → object | null
clearSheetConfig() → void

// Verifica se o token ainda é válido
isAuthenticated() → boolean

// Revoga acesso
revokeAccess() → void
```

**Requisitos:**
- Usar Google Identity Services (GIS) — não usar a biblioteca gapi legada
- Scope: `https://www.googleapis.com/auth/spreadsheets.readonly` (somente leitura)
- Token armazenado apenas em memória (não persistir token no localStorage)
- Configuração da planilha (spreadsheetId + sheetName) salva em localStorage
- Endpoint de leitura: `GET https://sheets.googleapis.com/v4/spreadsheets/{id}/values/{range}`
- Tratar erro 401 (token expirado) pedindo re-autenticação
- Tratar erro 403 (sem permissão) com mensagem clara
- Tratar erro 404 (planilha não encontrada) com mensagem clara

**Formato da URL do Google Sheets:**
```
https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/edit#gid=0
```
Extrair o `SPREADSHEET_ID` via regex.

### 3. Criar `src/components/GoogleSheetsConnector.jsx`

Componente de UI para conectar e sincronizar com Google Sheets.

**Estados do componente:**

**Estado 1 — Não conectado:**
- Botão "Conectar Google Sheets" com ícone do Google
- Texto explicativo: "Sincronize sua planilha diretamente sem precisar exportar arquivo"

**Estado 2 — Conectado, sem planilha configurada:**
- Campo de input para colar URL da planilha
- Botão "Conectar" que valida a URL e lista as abas
- Dropdown para selecionar a aba com os dados
- Botão "Salvar configuração"

**Estado 3 — Configurado:**
- Mostrar nome/URL da planilha conectada (truncado)
- Mostrar aba selecionada
- Mostrar data/hora da última sincronização
- Botão "Sincronizar agora" (principal)
- Checkbox "Sincronizar ao abrir" (salva preferência em localStorage)
- Botão "Desconectar" (texto pequeno, vermelho)

**Fluxo de sincronização:**
1. Buscar dados da planilha via `fetchSheetData()`
2. Usar as mesmas funções de parsing do FileImporter (`findColumns`, `normalizeRows`, `normalizePaymentStatus`)
3. Se houver categorias não mapeadas, abrir o mesmo painel de mapeamento do FileImporter
4. Salvar via `bulkInsertTransactions()`
5. Chamar `onSync()` callback para atualizar o dashboard
6. Mostrar toast de sucesso com quantidade de transações importadas

**Estilo:**
- Card com mesmo padrão visual (bg-white, border, rounded-2xl)
- Ícone do Google Sheets colorido
- Loading spinner durante sincronização
- Suportar dark mode

### 4. Refatorar `src/components/FileImporter.jsx`

Extrair funções de parsing para um módulo reutilizável.

**Criar `src/utils/sheetParser.js`:**
```javascript
export function findColumns(headers) { ... }
export function normalizePaymentStatus(raw) { ... }
export function normalizeRows(rows, columns, categoryMap) { ... }
```

- Mover as funções de `FileImporter.jsx` para `sheetParser.js`
- Atualizar `FileImporter.jsx` para importar de `sheetParser.js`
- `GoogleSheetsConnector.jsx` também importa de `sheetParser.js`
- Não alterar a lógica de parsing — apenas mover

### 5. Editar `src/App.jsx`

- Importar `GoogleSheetsConnector`
- Renderizar ao lado do `FileImporter` no grid de importação (ou abaixo dele)
- Passar callback `onSync` que faz o mesmo que `handleImport` (recalcula totais, atualiza snapshots)
- Se a preferência "Sincronizar ao abrir" estiver ativa, chamar sync automaticamente no `useEffect` de inicialização

### 6. Editar `index.html`

- Adicionar script do Google Identity Services:
```html
<script src="https://accounts.google.com/gsi/client" async defer></script>
```

## Regras importantes

- Não remover o importador de arquivo atual — Google Sheets é uma alternativa, não substituto
- Não persistir tokens de acesso do Google em localStorage ou banco
- Scope DEVE ser readonly — nunca escrever na planilha do usuário
- Reutilizar 100% da lógica de parsing já existente (findColumns, normalizeRows)
- Se o token expirar, pedir re-autenticação sem perder a configuração da planilha
- Manter o padrão visual e de UX dos outros componentes
- Tratar todos os erros com mensagens claras para o usuário
- Não adicionar bibliotecas pesadas — usar GIS nativo + fetch
- A feature deve funcionar mesmo sem configurar Google (dashboard carrega normalmente)
- Após implementar, rodar `npm run build` para garantir zero erros
- Testar com planilha real antes de dar como pronto

## Exemplo de planilha esperada

A planilha do Google Sheets deve ter o mesmo formato que o importador já aceita:

| Categoria | Valor | Descrição | Data | Status |
|-----------|-------|-----------|------|--------|
| Aluguel | 1500 | Aluguel março | 2025-03-05 | Pago |
| Mercado | 800 | Compras do mês | 2025-03-10 | Pendente |
| Salário | 6000 | Salário março | 2025-03-01 | Pago |

As colunas "Descrição", "Data" e "Status" são opcionais. O importador detecta automaticamente.
