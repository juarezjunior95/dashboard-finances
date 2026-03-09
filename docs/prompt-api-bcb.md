# Prompt: Implementar API do Banco Central (Indicadores Econômicos)

## Contexto

Tenho um dashboard financeiro pessoal em React 19 + Vite 7 + Tailwind CSS + Supabase. A aplicação já exibe receita, despesas, saldo real, fundo de reserva e fluxo de caixa mensal. Quero adicionar indicadores econômicos do Banco Central para que o usuário saiba se sua reserva e investimentos estão rendendo acima da inflação.

## Stack atual

- React 19, Vite 7, Tailwind CSS 3.4
- Supabase (auth + banco)
- localStorage como cache/fallback
- Componentes: App.jsx, Dashboard.jsx, ForecastCard.jsx, CashFlowCard.jsx, ReserveCard.jsx
- PWA com service worker

## O que implementar

### 1. Criar `src/services/bcbService.js`

Serviço para buscar indicadores do Banco Central via API pública SGS.

**Endpoint base:**
```
https://api.bcb.gov.br/dados/serie/bcdata.sgs.{codigo}/dados/ultimos/1?formato=json
```

**Séries a buscar:**
| Indicador | Código | Descrição |
|-----------|--------|-----------|
| Selic Meta | 432 | Taxa Selic meta (% a.a.) |
| IPCA 12 meses | 13522 | IPCA acumulado últimos 12 meses |
| CDI | 4389 | CDI acumulado no mês |

**Resposta da API:**
```json
[{ "data": "dd/mm/yyyy", "valor": "13.25" }]
```

**Requisitos do serviço:**
- Função `fetchIndicators()` que busca as 3 séries em paralelo (`Promise.all`)
- Cache em localStorage com chave `bcb_indicators` e TTL de 24 horas
- Se o cache for válido (< 24h), retornar do cache sem fazer request
- Se a API falhar, retornar dados do cache mesmo expirado, com flag `stale: true`
- Se não houver cache nem API, retornar `null`
- Calcular `rendimentoReal = selic - ipca` e incluir no retorno
- Sem autenticação necessária — API pública e gratuita
- Não bloquear o carregamento do dashboard (chamada assíncrona independente)

**Estrutura do retorno:**
```javascript
{
  selic: { valor: 13.25, data: '2025-03-01' },
  ipca: { valor: 5.06, data: '2025-02-01' },
  cdi: { valor: 1.07, data: '2025-03-01' },
  rendimentoReal: 8.19,
  stale: false,
  fetchedAt: '2025-03-15T10:00:00Z'
}
```

### 2. Criar `src/components/EconomicIndicators.jsx`

Card visual com os indicadores econômicos.

**Layout:**
- Card com borda e rounded-2xl, mesmo padrão visual dos outros cards
- Header: ícone 📈 + título "Indicadores Econômicos"
- Grid com 3 mini-cards:
  - **Selic**: valor % a.a., label "Taxa básica de juros"
  - **IPCA**: valor % 12m, label "Inflação acumulada"
  - **CDI**: valor % mês, label "Rendimento CDI"
- Abaixo: card de destaque com rendimento real:
  - Se `rendimentoReal > 0`: badge verde "Reserva rende X% acima da inflação"
  - Se `rendimentoReal <= 0`: badge vermelho "Reserva perde X% para inflação"
- Footer: texto pequeno "Fonte: Banco Central | Atualizado em [data]"
- Se `stale: true`: badge amarelo "Dados de [data] — API indisponível"
- Loading state: skeleton com animate-pulse
- Se `null` (sem dados): não renderizar o componente

**Cores e estilo:**
- Seguir o padrão visual dos outros componentes (bg-white dark:bg-gray-900, border, rounded-2xl)
- Suportar dark mode
- Responsivo (grid cols-1 em mobile, cols-3 em desktop)

### 3. Editar `src/App.jsx`

- Importar `EconomicIndicators` e `fetchIndicators`
- Criar state `indicators` com `useState(null)`
- No `useEffect` de inicialização (quando user logado), chamar `fetchIndicators()` e setar o state
- Renderizar `<EconomicIndicators data={indicators} />` após o bloco de Fundo de Reserva e antes da Visão Orçamentária
- NÃO bloquear o carregamento do dashboard — os indicadores carregam independentemente

## Regras importantes

- Não remover nem alterar nenhum componente existente
- Não quebrar o fluxo atual de importação, transações ou dashboard
- Manter compatibilidade com o padrão visual existente (Tailwind, dark mode)
- Cache deve ser por usuário (usar user_id como parte da chave se necessário)
- Tratar erros silenciosamente — indicadores são informativos, não críticos
- Não adicionar dependências externas desnecessárias (usar fetch nativo)
- Após implementar, rodar `npm run build` para garantir zero erros
