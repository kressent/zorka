-- ═══ Исключение тестеров из аналитики (server-side) ═════════════════════════
-- Владелец исключается клиентским флагом (zorka_owner → события не шлются вовсе).
-- Тестеров (напр. Яна, ник durak-online) так не выключить — их устройства мы не
-- трогаем. Поэтому: таблица excluded_users + чистка их прошлых событий + пересбор
-- вью аналитики с фильтром. Идемпотентно.

create table if not exists excluded_users (
  user_id    uuid primary key,
  note       text,
  created_at timestamptz not null default now()
);
alter table excluded_users enable row level security;  -- без политик: читают только вью/service role

-- Яна — наш тестер (durak-online)
insert into excluded_users (user_id, note)
values ('c7c95a05-2ed1-476c-8e27-5b4b07fa32d8', 'tester Яна (durak-online)')
on conflict (user_id) do nothing;

-- удалить уже накопленные события исключённых (чтобы не портили историю)
delete from events where user_id in (select user_id from excluded_users);

-- ── пересбор вью с исключением тестеров ──
-- анонимные события (user_id is null) считаем как обычный трафик; режем только тестеров.
create or replace view event_totals as
  select name, count(*) as n, max(created_at) as last_at
  from events
  where user_id is null or user_id not in (select user_id from excluded_users)
  group by name order by n desc;

create or replace view event_daily as
  select (created_at at time zone 'Asia/Yekaterinburg')::date as day,
         count(*) filter (where name='app_open')                 as opens,
         count(distinct session) filter (where name='app_open')  as sessions,
         count(*) filter (where name='install')                  as installs,
         count(*) filter (where name='save_catch')               as catches
  from events
  where user_id is null or user_id not in (select user_id from excluded_users)
  group by 1 order by 1 desc;

create or replace view user_activity as
  select
    e.user_id,
    p.nickname                                    as handle,
    count(*) filter (where e.name = 'app_open')   as opens,
    count(distinct e.session)                     as devices,
    count(*) filter (where e.name = 'save_catch') as catches,
    count(*) filter (where e.name = 'invite')     as invites,
    min(e.created_at)                             as first_seen,
    max(e.created_at)                             as last_seen
  from events e
  left join profiles p on p.id = e.user_id
  where e.user_id is not null
    and e.user_id not in (select user_id from excluded_users)
  group by e.user_id, p.nickname
  order by opens desc;
