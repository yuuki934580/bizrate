-- pending_forms: 決済前のフォームデータを一時保存（自動で24時間後に削除）
create table if not exists pending_forms (
  id          uuid primary key default gen_random_uuid(),
  form_data   jsonb not null,
  created_at  timestamptz default now()
);

-- RLS: service_roleのみアクセス可
alter table pending_forms enable row level security;

-- 24時間以上経過したレコードを自動削除するポリシー（pg_cronがない場合は手動で定期実行）
-- または select 時にexpiredをチェックする形でも可
