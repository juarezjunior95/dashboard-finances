-- Phase 3c: Amortização de dívida
-- Campo manual para informar valor de amortização/pagamento de dívida no mês.
-- Usado no Fluxo de Caixa Real para separar contas pendentes de dívida.
-- Campo opcional (DEFAULT NULL) para manter retrocompatibilidade.

ALTER TABLE monthly_snapshots
  ADD COLUMN IF NOT EXISTS debt_amortization DECIMAL(12,2) DEFAULT NULL;
