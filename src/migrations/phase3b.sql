-- Phase 3b: Fundo de reserva
-- Adiciona saldo total do fundo de reserva ao snapshot mensal.
-- Campo opcional (DEFAULT NULL) para manter retrocompatibilidade.

ALTER TABLE monthly_snapshots
  ADD COLUMN IF NOT EXISTS reserve_total DECIMAL(12,2) DEFAULT NULL;

-- reserve_total: quanto o usuário tem no fundo de reserva/emergência.
-- Se NULL, a seção de reserva não aparece no dashboard.
-- Diferente de reserve_usage (quanto usou da reserva no mês — já existe na phase3).
