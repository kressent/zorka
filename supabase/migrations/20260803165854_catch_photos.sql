-- Фото уловов в облаке (видят все): колонка photo_url + фото во вью ленты + Storage.
alter table catches add column if not exists photo_url text;

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
     where tk.trip_key = c.user_id::text || ':' || c.trip_id) as comments,
  max(c.photo_url)     as photo_url
from catches c
left join angler_stats s on s.user_id = c.user_id
where c.is_public = true and c.trip_id is not null
group by c.user_id, c.trip_id, s.handle, s.points;
grant select on feed_trips to anon, authenticated;

-- публичный бакет для фото уловов
insert into storage.buckets (id, name, public) values ('catch-photos', 'catch-photos', true)
  on conflict (id) do nothing;

-- политики: свой файл в своей папке (path = <user_id>/<entry>.jpg). Чтение публичное (бакет public).
drop policy if exists catch_photos_insert on storage.objects;
create policy catch_photos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'catch-photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists catch_photos_update on storage.objects;
create policy catch_photos_update on storage.objects for update to authenticated
  using (bucket_id = 'catch-photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists catch_photos_delete on storage.objects;
create policy catch_photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'catch-photos' and (storage.foldername(name))[1] = auth.uid()::text);
