CREATE TABLE IF NOT EXISTS transactions (
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
