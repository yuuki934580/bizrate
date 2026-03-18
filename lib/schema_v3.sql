-- ========================================
-- ビジレート DB スキーマ v3（最終版）
-- Supabase SQL Editorで実行してください
-- ※ schema.sql（v2）実行済みの前提
-- ========================================

-- ゲストユーザー管理
CREATE TABLE IF NOT EXISTS guest_users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id      TEXT UNIQUE NOT NULL,
  fingerprint   TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ゲストのクレジット残高
CREATE TABLE IF NOT EXISTS guest_credits (
  guest_id    TEXT PRIMARY KEY REFERENCES guest_users(guest_id) ON DELETE CASCADE,
  credits     INTEGER NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ゲストのクレジット取引履歴
CREATE TABLE IF NOT EXISTS guest_credit_transactions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id          TEXT NOT NULL REFERENCES guest_users(guest_id) ON DELETE CASCADE,
  delta             INTEGER NOT NULL,
  reason            TEXT NOT NULL,
  stripe_session_id TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- 日次無料利用トラッキング
CREATE TABLE IF NOT EXISTS daily_free_usage (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  guest_id    TEXT REFERENCES guest_users(guest_id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  used_count  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT chk_one_id CHECK (
    (user_id IS NOT NULL AND guest_id IS NULL) OR
    (user_id IS NULL     AND guest_id IS NOT NULL)
  ),
  CONSTRAINT uniq_user_date  UNIQUE (user_id, date),
  CONSTRAINT uniq_guest_date UNIQUE (guest_id, date)
);

-- purchases テーブルに guest_id カラムを追加（既存テーブルに追記）
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS guest_id TEXT REFERENCES guest_users(guest_id);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_guest_users_guest_id    ON guest_users(guest_id);
CREATE INDEX IF NOT EXISTS idx_guest_users_fingerprint ON guest_users(fingerprint);
CREATE INDEX IF NOT EXISTS idx_guest_credits_guest_id  ON guest_credits(guest_id);
CREATE INDEX IF NOT EXISTS idx_daily_free_guest_date   ON daily_free_usage(guest_id, date);
CREATE INDEX IF NOT EXISTS idx_daily_free_user_date    ON daily_free_usage(user_id, date);

-- RLS（全テーブル service_role のみ）
ALTER TABLE guest_users               ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_credits             ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_free_usage          ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service only - guest_users"
  ON guest_users FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY "service only - guest_credits"
  ON guest_credits FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY "service only - guest_credit_tx"
  ON guest_credit_transactions FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY "service only - daily_free_usage"
  ON daily_free_usage FOR ALL USING (false) WITH CHECK (false);
