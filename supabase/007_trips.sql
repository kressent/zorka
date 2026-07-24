-- ═══ ЗОРЬКА · лента по «выездам» (одна рыбалка = одна карточка) ══════════════
-- Запусти в Supabase → SQL Editor ПОСЛЕ 004. Идемпотентно. Самодостаточно:
-- включает профиль-ник, рейтинг «Уважения» и ленту выездов (заменяет прежние 006).

-- профиль уже есть в schema.sql (PK id, ник в nickname) — гарантируем поле на старых базах
alter table profiles add column if not exists nickname text;
-- Раньше карточка была на каждую рыбу. Теперь группируем уловы одной рыбалки
-- (по trip_id = id записи дневника) в один «выезд». Лайкается выезд целиком.
-- Строки по каждой рыбе в catches сохраняем — это топливо для будущего рейтинга
-- приманок (какой вид на что берёт).

-- метка выезда на каждой строке улова (= id записи дневника)
alter table catches add column if not exists trip_id text;
-- бэкофилл для уже опубликованных строк (client_id = 'trip:index')
update catches set trip_id = split_part(client_id, ':', 1)
  where trip_id is null and client_id is not null;

-- лайки выезда (ключ выезда = 'owner_uuid:trip_id')
create table if not exists trip_likes (
  trip_key   text not null,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (trip_key, user_id)
);
alter table trip_likes enable row level security;
drop policy if exists trip_likes_read on trip_likes;
drop policy if exists trip_likes_own  on trip_likes;
create policy trip_likes_read on trip_likes for select using (true);
-- свой улов лайкать нельзя: owner (префикс ключа) не должен совпадать с лайкающим
create policy trip_likes_own on trip_likes for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and split_part(trip_key, ':', 1) <> user_id::text);
grant select on trip_likes to anon, authenticated;
grant insert, delete on trip_likes to authenticated;

-- рейтинг «Уважения»: очки от лайков ВЫЕЗДОВ (выцветают), + бонус за сбывшийся
-- прогноз (по выезду, не по каждой рыбе). Считаются только лайки существующих
-- выездов и только чужие. decay(age)=exp(-age_дней/120) → полураспад ≈ 83 дня.
create or replace view angler_stats as
select
  p.id                    as user_id,
  p.nickname              as handle,
  p.created_at            as joined_at,
  coalesce(cc.catches, 0) as catches,
  coalesce(cc.days, 0)    as days,
  coalesce(cc.species, 0) as species,
  coalesce(rl.likes, 0)   as likes,
  round( coalesce(rl.recog, 0) * 10 + coalesce(fc.fhit, 0) * 4 )::int as points
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
  select t.owner,
         count(*) as likes,
         sum(exp(- extract(epoch from (now() - tl.created_at)) / 86400.0 / 120.0)) as recog
  from trip_likes tl
  join (select distinct user_id as owner, (user_id::text || ':' || trip_id) as trip_key
        from catches where is_public = true and trip_id is not null) t
    on t.trip_key = tl.trip_key
  where t.owner::text <> tl.user_id::text     -- не свой лайк
  group by t.owner
) rl on rl.owner = p.id;

-- лента выездов: одна строка = одна рыбалка со списком рыбы
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
  jsonb_agg(jsonb_build_object('species', c.species, 'weight', c.weight)
            order by c.weight desc nulls last) as fish,
  s.handle,
  coalesce(s.points, 0) as points,
  (select count(*) from trip_likes tl
     where tl.trip_key = c.user_id::text || ':' || c.trip_id) as likes
from catches c
left join angler_stats s on s.user_id = c.user_id
where c.is_public = true and c.trip_id is not null
group by c.user_id, c.trip_id, s.handle, s.points;

grant select on profiles     to anon, authenticated;
grant select on angler_stats to anon, authenticated;
grant select on feed_trips   to anon, authenticated;
