-- ═══ НА КРЮЧКЕ · обратная связь + аналитика событий ════════════════════════
-- Запусти в Supabase → SQL Editor. Идемпотентно.
-- feedback — сообщения пользователей разработчику (читаешь тут же в дашборде).
-- events — анонимные события (заходы/действия), чтобы видеть живую активность.

-- ── обратная связь ──
create table if not exists feedback (
  id         uuid primary key default gen_random_uuid(),
  message    text not null,
  contact    text,                         -- по желанию: телега/почта пользователя
  user_id    uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table feedback enable row level security;
drop policy if exists feedback_insert on feedback;
create policy feedback_insert on feedback for insert to anon, authenticated with check (true);
grant insert on feedback to anon, authenticated;
-- читать — только владелец проекта (в дашборде/через service role); публичного select нет.

-- ── события (аналитика) ──
create table if not exists events (
  id         bigint generated always as identity primary key,
  name       text not null,                -- app_open, install, save_catch, invite, tg_click, city_select…
  meta       jsonb,
  user_id    uuid references auth.users(id) on delete set null,
  session    text,                         -- случайный id сессии (не личность)
  created_at timestamptz not null default now()
);
alter table events enable row level security;
drop policy if exists events_insert on events;
create policy events_insert on events for insert to anon, authenticated with check (true);
grant insert on events to anon, authenticated;

-- Удобные вью для просмотра (читаешь в SQL Editor):
create or replace view event_totals as
  select name, count(*) as n, max(created_at) as last_at
  from events group by name order by n desc;

create or replace view event_daily as
  select (created_at at time zone 'Asia/Yekaterinburg')::date as day,
         count(*) filter (where name='app_open')            as opens,
         count(distinct session) filter (where name='app_open') as sessions,
         count(*) filter (where name='install')             as installs,
         count(*) filter (where name='save_catch')          as catches
  from events group by 1 order by 1 desc;

-- Как смотреть:
--   select * from event_totals;                     -- сколько каких событий всего
--   select * from event_daily limit 30;             -- активность по дням
--   select message, contact, created_at from feedback order by created_at desc;  -- отзывы
