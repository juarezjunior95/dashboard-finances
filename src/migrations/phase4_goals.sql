-- Tabela de metas financeiras
-- Retrocompatível: nova tabela, não altera nenhuma existente
CREATE TABLE IF NOT EXISTS financial_goals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  target_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  current_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  deadline TEXT DEFAULT NULL, -- "YYYY-MM" format
  icon TEXT DEFAULT '🎯',
  color TEXT DEFAULT 'indigo',
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE financial_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own goals"
  ON financial_goals FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Índice
CREATE INDEX IF NOT EXISTS idx_financial_goals_user
  ON financial_goals(user_id);
