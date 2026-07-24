-- ═══ ЗОРЬКА · рейтинг «Уважения» (поверх существующей таблицы profiles) ══════
-- Запусти в Supabase → SQL Editor ПОСЛЕ 004. Идемпотентно — можно повторять.
-- profiles уже создана в schema.sql (PK = id → auth.users, ник в поле nickname).
-- Здесь строим агрегаты и очки, добавляем ник + очки автора в ленту.
-- Внутри вью: id → user_id, nickname → handle.
--
-- ФИЛОСОФИЯ РЕЙТИНГА (не накрутить количеством рыбы):
--   • Очки дают ТОЛЬКО лайки других рыбаков (не свои — self-like не считается).
--   • «Выцветание»: каждый лайк весит по полной первые недели и медленно тускнеет
--     (полураспад ~83 дня). Ловишь и делишься → свежие лайки держат рейтинг.
--     Забросил → новых нет, старые тускнеют → рейтинг сам плавно сползает.
--   • Небольшой бонус за сбывшийся прогноз (поймал в день с баллом ≥4) — он тоже
--     выцветает, т.к. завязан на дату улова. Погоду не накрутишь.
--   • Трофей (крупная рыба для своего вида) — добавим на след. шаге, когда наберём
--     базу весов по видам.
-- decay(age) = exp(-age_дней / 120)   → полураспад ≈ 83 дня.

-- на старых базах гарантируем поле ника
alter table profiles add column if not exists nickname text;

create or replace view angler_stats as
select
  p.id                    as user_id,
  p.nickname              as handle,
  p.created_at            as joined_at,
  coalesce(cc.catches, 0) as catches,
  coalesce(cc.days, 0)    as days,
  coalesce(cc.species, 0) as species,
  coalesce(rl.likes, 0)   as likes,
  round( coalesce(rl.recog, 0) * 10 + coalesce(cc.fhit, 0) * 4 )::int as points
from profiles p
left join (
  select user_id,
         count(*)                        as catches,
         count(distinct date(caught_at)) as days,
         count(distinct species)         as species,
         sum(case when forecast_score >= 4
                  then exp(- extract(epoch from (now() - caught_at)) / 86400.0 / 120.0)
                  else 0 end)            as fhit
  from catches
  where is_public = true
  group by user_id
) cc on cc.user_id = p.id
left join (
  select ca.user_id,
         count(*) as likes,
         sum(exp(- extract(epoch from (now() - cl.created_at)) / 86400.0 / 120.0)) as recog
  from catch_likes cl
  join catches ca on ca.id = cl.catch_id
  where ca.is_public = true
    and cl.user_id <> ca.user_id          -- свой лайк не считается
  group by ca.user_id
) rl on rl.user_id = p.id;

-- лента с ником и (выцветающими) очками автора; координаты — огрублённые
create or replace view feed_catches as
  select c.id, c.species, c.weight, c.caught_at, c.water_name,
         c.lat_pub as lat, c.lon_pub as lon, c.lure, c.forecast_score, c.created_at,
         coalesce(lk.cnt, 0)   as likes,
         s.handle,
         coalesce(s.points, 0) as points
  from catches c
  left join (select catch_id, count(*) as cnt from catch_likes group by catch_id) lk on lk.catch_id = c.id
  left join angler_stats s on s.user_id = c.user_id
  where c.is_public = true;

grant select on profiles     to anon, authenticated;
grant select on angler_stats to anon, authenticated;
grant select on feed_catches to anon, authenticated;
