-- ═══ ЗОРЬКА · СХЕМА БАЗЫ (Supabase / Postgres) ═══════════════════════════════
-- Фундамент «маховика данных»: аккаунты + облако + общая база уловов.
-- Запусти этот файл в Supabase → SQL Editor (после создания проекта).
-- Принцип приватности: точные координаты видит только владелец; в общей ленте —
-- огрублённые (lat_pub/lon_pub округлены до ~1 км). RLS включён везде.

-- ── профиль (расширяет auth.users) ──────────────────────────────────────────
create table if not exists profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  nickname     text,
  home_water   text,
  region       text,
  created_at   timestamptz default now()
);

-- ── места (точки рыбака) ─────────────────────────────────────────────────────
create table if not exists spots (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  lat        double precision,          -- точные (приватные)
  lon        double precision,
  depth_note text,                       -- народная пометка глубины/рельефа
  note       text,
  is_public  boolean default false,
  created_at timestamptz default now()
);

-- ── уловы (главная таблица — топливо для обучения) ───────────────────────────
create table if not exists catches (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  species      text not null,            -- id вида ('pike', 'asp', …)
  weight       double precision,         -- вес ЭТОЙ рыбы (null = не взвешивал)
  caught_at    timestamptz not null default now(),
  water_name   text,                     -- водоём/город
  lat          double precision,         -- точные (приватные, для модели)
  lon          double precision,
  lat_pub      double precision,         -- огрублённые (для общей ленты)
  lon_pub      double precision,
  lure         text,
  method       text,
  conditions   jsonb,                    -- снимок погоды/давления/луны/воды
  forecast_score numeric,                -- балл прогноза в тот день (для «прогноз сбылся»)
  photo_url    text,
  is_public    boolean default true,
  created_at   timestamptz default now()
);

-- ── комплекты снастей ────────────────────────────────────────────────────────
create table if not exists kits (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  icon       text,
  rod        text,
  reel       text,
  line       text,
  target     text[],
  lures      jsonb,
  created_at timestamptz default now()
);

-- индексы для скорости и будущей аналитики
create index if not exists catches_user_idx    on catches(user_id);
create index if not exists catches_species_idx on catches(species);
create index if not exists catches_time_idx    on catches(caught_at);
create index if not exists spots_user_idx       on spots(user_id);
create index if not exists kits_user_idx        on kits(user_id);

-- ── огрубление координат для публичной ленты (≈1 км) ─────────────────────────
create or replace function fuzz_coords() returns trigger language plpgsql as $$
begin
  if new.lat is not null then new.lat_pub := round(new.lat::numeric, 2); end if;
  if new.lon is not null then new.lon_pub := round(new.lon::numeric, 2); end if;
  return new;
end $$;
drop trigger if exists catches_fuzz on catches;
create trigger catches_fuzz before insert or update on catches
  for each row execute function fuzz_coords();

-- ── RLS (Row Level Security) ─────────────────────────────────────────────────
alter table profiles enable row level security;
alter table spots    enable row level security;
alter table catches  enable row level security;
alter table kits     enable row level security;

-- профиль: владелец правит свой; читать могут все (ник в ленте)
create policy profiles_select on profiles for select using (true);
create policy profiles_upsert on profiles for insert with check (auth.uid() = id);
create policy profiles_update on profiles for update using (auth.uid() = id);

-- уловы: владелец видит/правит свои; публичные видят все (для ленты/рейтинга)
create policy catches_owner   on catches for all    using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy catches_public  on catches for select using (is_public = true);

-- места: владелец — свои; публичные видят все
create policy spots_owner  on spots for all    using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy spots_public on spots for select using (is_public = true);

-- снасти: только владелец
create policy kits_owner on kits for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── публичная лента без точных координат (безопасно отдавать всем) ────────────
create or replace view public_catches as
  select id, species, weight, caught_at, water_name,
         lat_pub as lat, lon_pub as lon, lure, method, forecast_score, created_at
  from catches where is_public = true;

-- ── БУДУЩЕЕ: рейтинг приманок по реальным уловам (наш дифференциатор) ─────────
-- Раскомментировать, когда наберётся масса данных:
-- create or replace view lure_rating as
--   select species, lure, count(*) as catches, round(avg(weight)::numeric,2) as avg_kg
--   from catches where lure is not null and is_public = true
--   group by species, lure order by species, catches desc;
