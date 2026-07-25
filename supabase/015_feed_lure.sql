-- ═══ ЗОРЬКА · приманка в ленте выездов ══════════════════════════════════════
-- Запусти в Supabase → SQL Editor ПОСЛЕ 009 (и 014). Идемпотентно.
-- Добавляет приманку (lure) в список рыбы каждого выезда — соц-доказательство
-- «на что взял» прямо в ленте. Меняется только содержимое jsonb-поля fish,
-- набор колонок вью тот же → create or replace проходит.

create or replace view feed_trips as
select
  (c.user_id::text || ':' || c.trip_id) as id,
  c.user_id,
  max(c.caught_at)      as caught_at,
  max(c.water_name)     as water_name,
  max(c.lat_pub)        as lat,
  max(c.lon_pub)        as lon,
  max(c.forecast_score) as forecast_score,
  max(c.created_at)     as created_at,
  jsonb_agg(jsonb_build_object('species', c.species, 'weight', c.weight, 'lure', c.lure)
            order by c.weight desc nulls last) as fish,
  s.handle,
  coalesce(s.points, 0) as points,
  (select count(*) from trip_likes tl
     where tl.trip_key = c.user_id::text || ':' || c.trip_id) as likes,
  (select count(*) from trip_comments tk
     where tk.trip_key = c.user_id::text || ':' || c.trip_id) as comments
from catches c
left join angler_stats s on s.user_id = c.user_id
where c.is_public = true and c.trip_id is not null
group by c.user_id, c.trip_id, s.handle, s.points;

grant select on feed_trips to anon, authenticated;
