-- ═══ ЗОРЬКА · 🏆 бонус за трофей к рейтингу «Уважения» ═══════════════════════
-- Запусти в Supabase → SQL Editor ПОСЛЕ 007 (порядок с 009 не важен). Идемпотентно.
-- Трофей = рыба крупнее порога своего вида (порог в js/data.js, флаг ставит
-- приложение при публикации в поле catches.trophy). Даёт +8 очков за рыбу,
-- тоже с выцветанием (полураспад ≈83 дня) — как и лайки/прогноз.

alter table catches add column if not exists trophy boolean default false;

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
  from (select distinct user_id, trip_id, caught_at
        from catches where is_public = true and forecast_score >= 4) ft
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
