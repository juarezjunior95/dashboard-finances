-- Phase 3d: Transferência da reserva
-- Valor explicitamente transferido do fundo de reserva para a conta no mês.
-- Campo manual (DEFAULT NULL) para retrocompatibilidade.
-- Diferente de reserve_total (saldo total) e reserve_usage (quanto usou via categorias).

ALTER TABLE monthly_snapshots
  ADD COLUMN IF NOT EXISTS reserve_transferred DECIMAL(12,2) DEFAULT NULL;
