-- Phase 3: Evolução financeira incremental
-- Separa receita recorrente de extraordinária, adiciona saldo real e status de pagamento
-- Todos os campos são opcionais (DEFAULT NULL) para manter retrocompatibilidade

-- ── monthly_snapshots: novos campos de breakdown de receita e saldo real ──

ALTER TABLE monthly_snapshots
  ADD COLUMN IF NOT EXISTS recurring_income DECIMAL(12,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS extraordinary_income DECIMAL(12,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS reserve_usage DECIMAL(12,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS real_balance DECIMAL(12,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS real_balance_updated_at TIMESTAMPTZ DEFAULT NULL;

-- Regra de compatibilidade:
--   receita continua sendo o total (backward compat).
--   Se recurring_income IS NULL → receita inteira é tratada como recorrente.
--   Se recurring_income IS NOT NULL → usar como base para regra 50-30-20.

-- ── transactions: status de pagamento (pago/pendente) ──

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS payment_status VARCHAR(10) DEFAULT NULL;

-- Valores válidos: 'paid', 'pending', NULL (legado/desconhecido)

-- ── user_categories: tipo de receita para classificação ──

ALTER TABLE user_categories
  ADD COLUMN IF NOT EXISTS income_type VARCHAR(20) DEFAULT NULL;

-- Valores válidos: 'recurring', 'extraordinary', 'reserve', NULL
