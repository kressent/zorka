-- Совместные выезды («напарники»): доска планов рыбалок + отклики «я поеду». Идемпотентно.
create table if not exists co_trips (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  handle     text,
  place      text not null,
  trip_date  date,
  note       text,
  created_at timestamptz not null default now()
);
alter table co_trips enable row level security;
drop policy if exists co_trips_select on co_trips;
create policy co_trips_select on co_trips for select to anon, authenticated using (true);
drop policy if exists co_trips_insert on co_trips;
create policy co_trips_insert on co_trips for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists co_trips_delete on co_trips;
create policy co_trips_delete on co_trips for delete to authenticated using (auth.uid() = user_id);
grant select on co_trips to anon, authenticated;
grant insert, delete on co_trips to authenticated;

create table if not exists co_joins (
  trip_id    bigint not null references co_trips(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  handle     text,
  created_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);
alter table co_joins enable row level security;
drop policy if exists co_joins_select on co_joins;
create policy co_joins_select on co_joins for select to anon, authenticated using (true);
drop policy if exists co_joins_ins on co_joins;
create policy co_joins_ins on co_joins for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists co_joins_del on co_joins;
create policy co_joins_del on co_joins for delete to authenticated using (auth.uid() = user_id);
grant select on co_joins to anon, authenticated;
grant insert, delete on co_joins to authenticated;

-- доска с числом откликов
create or replace view co_trips_view as
  select t.*, coalesce(j.n, 0) as joins
  from co_trips t
  left join (select trip_id, count(*) n from co_joins group by trip_id) j on j.trip_id = t.id;
grant select on co_trips_view to anon, authenticated;
