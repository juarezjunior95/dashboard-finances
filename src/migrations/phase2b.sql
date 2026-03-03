CREATE TABLE IF NOT EXISTS user_categories (
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
