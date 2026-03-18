-- ========================================
-- AIビジネス構造診断エンジン - DBスキーマ v2
-- Supabase SQL Editorで実行してください
-- ========================================

-- ユーザープロフィール（クレジット管理）
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  credits INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- クレジット取引履歴
CREATE TABLE IF NOT EXISTS credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL
    CHECK (reason IN ('signup_bonus','purchase','diagnose','pdf_generate','cache_hit','refund')),
  stripe_session_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 診断履歴（キャッシュ用 inputs_hash 付き）
CREATE TABLE IF NOT EXISTS diagnoses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  inputs JSONB NOT NULL,
  inputs_hash TEXT,
  result JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- クレジット購入履歴
CREATE TABLE IF NOT EXISTS purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  stripe_session_id TEXT UNIQUE NOT NULL,
  credits_purchased INTEGER NOT NULL,
  amount_jpy INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','completed','failed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- PDF出力履歴
CREATE TABLE IF NOT EXISTS pdf_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  diagnosis_id UUID REFERENCES diagnoses(id) ON DELETE CASCADE,
  file_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_user_profiles_id ON user_profiles(id);
CREATE INDEX IF NOT EXISTS idx_credit_tx_user ON credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_tx_created ON credit_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_diagnoses_user ON diagnoses(user_id);
CREATE INDEX IF NOT EXISTS idx_diagnoses_hash ON diagnoses(inputs_hash);
CREATE INDEX IF NOT EXISTS idx_diagnoses_created ON diagnoses(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_purchases_session ON purchases(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_purchases_user ON purchases(user_id);

-- RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE diagnoses ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE pdf_exports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own profile" ON user_profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "own transactions" ON credit_transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own diagnoses select" ON diagnoses FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "own diagnoses insert" ON diagnoses FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "own purchases" ON purchases FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own pdf_exports" ON pdf_exports FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

-- 新規登録時に3クレジット自動付与
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_profiles (id, credits) VALUES (NEW.id, 3);
  INSERT INTO credit_transactions (user_id, delta, reason) VALUES (NEW.id, 3, 'signup_bonus');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
