-- ═══ ЗОРЬКА · синхронизация данных пользователя ═════════════════════════════
-- Хранит дневник/места/снасти пользователя одним документом (jsonb) для
-- синхронизации между устройствами. Запусти в Supabase → SQL Editor.
-- (Общая лента уловов / рейтинг приманок пойдут из таблицы catches — отдельно.)

create table if not exists user_data (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

alter table user_data enable row level security;

-- каждый видит и правит ТОЛЬКО свои данные
drop policy if exists user_data_owner on user_data;
create policy user_data_owner on user_data
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
