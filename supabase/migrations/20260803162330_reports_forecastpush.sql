-- 018 reports
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

-- 019 push_location
-- ═══ НА КРЮЧКЕ · координаты подписки для пуша «завтра жор» ══════════════════
-- Запусти в Supabase → SQL Editor. Идемпотентно.
-- Чтобы сервер знал, для какой точки считать прогноз конкретному устройству.
-- last_fpush — дата последнего прогнозного пуша (антидубль: не чаще раза в день).

alter table push_subscriptions add column if not exists lat        double precision;
alter table push_subscriptions add column if not exists lon        double precision;
alter table push_subscriptions add column if not exists place      text;
alter table push_subscriptions add column if not exists last_fpush date;

-- клиент обновляет свои строки (RLS push_own из 013 уже покрывает update).

-- 020 forecast_cron
-- ═══ НА КРЮЧКЕ · расписание пуша «завтра жор» ══════════════════════════════
-- Запусти в Supabase → SQL Editor ПОСЛЕ деплоя функции forecast-push.
-- Раз в день (вечером) дёргает forecast-push — она сама решает, кому слать
-- (сильный день впереди) и не чаще раза в сутки на устройство. Идемпотентно.
--
-- 15:00 UTC ≈ 18:00 МСК / 20:00 Екб — прогноз на завтра к вечеру актуален.

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$ begin
  perform cron.unschedule('forecast-push-daily');
exception when others then null; end $$;

select cron.schedule('forecast-push-daily', '0 15 * * *', $cmd$
  select net.http_post(
    url     := 'https://jcazwvivxxlrhkguolfp.supabase.co/functions/v1/forecast-push',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'Authorization', 'Bearer sb_publishable_jJIkC9wwlilYwJOlEqjRxg_QnkvEKlP'),
    body    := '{}'::jsonb
  );
$cmd$);
