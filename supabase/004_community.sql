-- ═══ ЗОРЬКА · сообщество (лента уловов + лайки) ═════════════════════════════
-- Запусти в Supabase → SQL Editor после 003. Включает публичную ленту уловов
-- (координаты уже огрубляются триггером fuzz_coords из schema.sql) и лайки.

-- дедуп: чтобы повторная публикация той же записи не плодила строки.
-- Нужно именно ограничение (constraint), а не частичный индекс — иначе upsert
-- (ON CONFLICT user_id,client_id) не работает.
alter table catches add column if not exists client_id text;
drop index if exists catches_user_client;
alter table catches drop constraint if exists catches_user_client_uk;
alter table catches add constraint catches_user_client_uk unique (user_id, client_id);

-- лайки уловов
create table if not exists catch_likes (
  catch_id   uuid references catches(id) on delete cascade,
  user_id    uuid references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (catch_id, user_id)
);
alter table catch_likes enable row level security;
drop policy if exists catch_likes_read on catch_likes;
drop policy if exists catch_likes_own  on catch_likes;
create policy catch_likes_read on catch_likes for select using (true);
create policy catch_likes_own  on catch_likes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- лента: публичные уловы + счётчик лайков (координаты — огрублённые)
create or replace view feed_catches as
  select c.id, c.species, c.weight, c.caught_at, c.water_name,
         c.lat_pub as lat, c.lon_pub as lon, c.lure, c.forecast_score, c.created_at,
         coalesce(lk.cnt, 0) as likes
  from catches c
  left join (select catch_id, count(*) as cnt from catch_likes group by catch_id) lk on lk.catch_id = c.id
  where c.is_public = true;
