-- ═══ НА КРЮЧКЕ · жалобы на уловы (антиспам/модерация) ══════════════════════
-- Запусти в Supabase → SQL Editor. Идемпотентно.
-- Рыбак может пожаловаться на чужой выезд (фейк/спам). При пороге жалоб выезд
-- прячется из ленты у всех (клиент читает report_counts). Свой — не пожалуешься.

create table if not exists trip_reports (
  id         uuid primary key default gen_random_uuid(),
  trip_key   text not null,                 -- 'owner:trip' (как в лайках/комментах)
  user_id    uuid not null references auth.users(id) on delete cascade,
  reason     text,
  created_at timestamptz not null default now(),
  unique (trip_key, user_id)                -- один рыбак — одна жалоба на выезд
);

alter table trip_reports enable row level security;

drop policy if exists reports_insert_own on trip_reports;
create policy reports_insert_own on trip_reports
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists reports_select_own on trip_reports;
create policy reports_select_own on trip_reports
  for select to authenticated using (auth.uid() = user_id);

grant insert, select on trip_reports to authenticated;

-- Агрегат: сколько жалоб на выезд (только счётчик, без личностей заявителей).
-- Вью-владелец обходит RLS таблицы → считает по всем. Даём читать всем для
-- клиентского авто-скрытия при пороге.
create or replace view report_counts as
  select trip_key, count(*)::int as n
  from trip_reports
  group by trip_key;

grant select on report_counts to anon, authenticated;
