-- ═══ ЗОРЬКА · комментарии к уловам ══════════════════════════════════════════
-- Запусти в Supabase → SQL Editor ПОСЛЕ 007. Идемпотентно.
-- Комментарии к выезду (ключ выезда = 'owner_uuid:trip_id', как у лайков).

create table if not exists trip_comments (
  id         uuid primary key default gen_random_uuid(),
  trip_key   text not null,
  user_id    uuid not null references auth.users(id) on delete cascade,
  body       text not null,
  created_at timestamptz default now()
);
alter table trip_comments enable row level security;
drop policy if exists trip_comments_read on trip_comments;
drop policy if exists trip_comments_own  on trip_comments;
create policy trip_comments_read on trip_comments for select using (true);
create policy trip_comments_own  on trip_comments for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists trip_comments_key_idx on trip_comments(trip_key);
grant select on trip_comments to anon, authenticated;
grant insert, delete on trip_comments to authenticated;

-- комментарии с ником автора
create or replace view trip_comments_view as
  select tc.id, tc.trip_key, tc.user_id, tc.body, tc.created_at, p.nickname as handle
  from trip_comments tc
  left join profiles p on p.id = tc.user_id;
grant select on trip_comments_view to anon, authenticated;

-- добавляем счётчик комментариев в ленту выездов (остальное — как в 007)
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
     where tl.trip_key = c.user_id::text || ':' || c.trip_id) as likes,
  (select count(*) from trip_comments tk
     where tk.trip_key = c.user_id::text || ':' || c.trip_id) as comments
from catches c
left join angler_stats s on s.user_id = c.user_id
where c.is_public = true and c.trip_id is not null
group by c.user_id, c.trip_id, s.handle, s.points;

grant select on feed_trips to anon, authenticated;
