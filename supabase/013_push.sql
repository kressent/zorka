-- ═══ ЗОРЬКА · подписки на пуш-уведомления (Web Push) ════════════════════════
-- Запусти в Supabase → SQL Editor, когда будешь настраивать пуш (docs/PUSH-SETUP.md).
-- Идемпотентно. Хранит браузерные push-подписки устройств рыбака.

create table if not exists push_subscriptions (
  endpoint   text primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz default now()
);
alter table push_subscriptions enable row level security;
drop policy if exists push_own on push_subscriptions;
create policy push_own on push_subscriptions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists push_sub_user_idx on push_subscriptions(user_id);
grant select, insert, update, delete on push_subscriptions to authenticated;
