-- ═══ ЗОРЬКА · рейтинг рыбака (поверх существующей таблицы profiles) ══════════
-- Запусти в Supabase → SQL Editor ПОСЛЕ 004. Идемпотентно — можно повторять.
-- ВАЖНО: таблица profiles уже создана в schema.sql (PK = id → auth.users,
-- ник в поле nickname). Здесь мы её НЕ пересоздаём, а строим агрегаты (очки/ранг)
-- и добавляем ник + очки автора в ленту. Внутри вью id → user_id, nickname → handle.

-- на старых базах гарантируем поле ника
alter table profiles add column if not exists nickname text;

-- агрегаты рыбака + очки.
-- Маховик поощряет: активность (уловы), регулярность (дни), разнообразие (виды),
-- признание (лайки) и стаж (недели с регистрации).
create or replace view angler_stats as
select
  p.id                    as user_id,
  p.nickname              as handle,
  p.created_at            as joined_at,
  coalesce(cc.catches, 0) as catches,
  coalesce(cc.days, 0)    as days,
  coalesce(cc.species, 0) as species,
  coalesce(lk.likes, 0)   as likes,
  ( coalesce(cc.catches,0) * 10
  + coalesce(cc.days,0)    * 5
  + coalesce(cc.species,0) * 15
  + coalesce(lk.likes,0)   * 3
  + floor(extract(epoch from (now() - p.created_at)) / 604800)::int * 2
  )::int as points
from profiles p
left join (
  select user_id,
         count(*)                        as catches,
         count(distinct date(caught_at)) as days,
         count(distinct species)         as species
  from catches
  where is_public = true
  group by user_id
) cc on cc.user_id = p.id
left join (
  select ca.user_id, count(*) as likes
  from catch_likes cl
  join catches ca on ca.id = cl.catch_id
  group by ca.user_id
) lk on lk.user_id = p.id;

-- лента с ником и очками автора (координаты — огрублённые lat_pub/lon_pub)
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
