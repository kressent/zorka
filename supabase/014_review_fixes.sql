-- ═══ ЗОРЬКА · фиксы по ревью (приватность координат + устойчивость рейтинга) ═
-- Запусти в Supabase → SQL Editor ПОСЛЕ 010. Идемпотентно.
--
-- ФИКС 1 (важный, приватность). В 008 стояло `revoke select (lat,lon)`, но
-- column-привилегии в Postgres АДДИТИВНЫ: табличный `grant select` их перекрывает,
-- поэтому точные координаты оставались читаемы анониму напрямую из catches/spots.
-- Правильно: убрать табличный SELECT и выдать обратно ТОЛЬКО не-координатные колонки.
-- Приложение читает уловы только через вью (feed_trips/lure_rating), таблицу
-- напрямую не читает — поэтому lat/lon закрываем без потерь.

revoke select on catches from anon, authenticated;
grant select (id, user_id, species, weight, caught_at, water_name,
              lat_pub, lon_pub, lure, method, conditions, forecast_score,
              photo_url, is_public, created_at, client_id, trip_id, trophy)
  on catches to anon, authenticated;

-- spots таблицей приложение не пользуется (места — локально + в user_data),
-- но на всякий случай тоже закрываем точные координаты.
revoke select on spots from anon, authenticated;
grant select (id, user_id, name, depth_note, note, is_public, created_at)
  on spots to anon, authenticated;

-- ФИКС 2 (устойчивость). Бонус «сбывшийся прогноз» считаем строго ПО ВЫЕЗДУ:
-- группируем по (user_id, trip_id), берём одну дату на выезд — чтобы несколько рыб
-- одного выезда не давали бонус несколько раз, даже если у них разное caught_at.
create or replace view angler_stats as
select
  p.id                    as user_id,
  p.nickname              as handle,
  p.created_at            as joined_at,
  coalesce(cc.catches, 0) as catches,
  coalesce(cc.days, 0)    as days,
  coalesce(cc.species, 0) as species,
  coalesce(rl.likes, 0)   as likes,
  round( coalesce(rl.recog, 0) * 10
       + coalesce(fc.fhit,  0) * 4
       + coalesce(tc.thit,  0) * 8 )::int as points
from profiles p
left join (
  select user_id,
         count(*)                        as catches,
         count(distinct date(caught_at)) as days,
         count(distinct species)         as species
  from catches where is_public = true group by user_id
) cc on cc.user_id = p.id
left join (
  select user_id,
         sum(exp(- extract(epoch from (now() - caught_at)) / 86400.0 / 120.0)) as fhit
  from (select user_id, trip_id, max(caught_at) as caught_at
        from catches where is_public = true and forecast_score >= 4
        group by user_id, trip_id) ft
  group by user_id
) fc on fc.user_id = p.id
left join (
  select user_id,
         sum(exp(- extract(epoch from (now() - caught_at)) / 86400.0 / 120.0)) as thit
  from catches where is_public = true and trophy = true
  group by user_id
) tc on tc.user_id = p.id
left join (
  select t.owner,
         count(*) as likes,
         sum(exp(- extract(epoch from (now() - tl.created_at)) / 86400.0 / 120.0)) as recog
  from trip_likes tl
  join (select distinct user_id as owner, (user_id::text || ':' || trip_id) as trip_key
        from catches where is_public = true and trip_id is not null) t
    on t.trip_key = tl.trip_key
  where t.owner::text <> tl.user_id::text
  group by t.owner
) rl on rl.owner = p.id;

grant select on angler_stats to anon, authenticated;
