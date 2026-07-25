-- ═══ ЗОРЬКА · отметки состояния воды от рыбаков ═════════════════════════════
-- Запусти в Supabase → SQL Editor. Идемпотентно.
-- Народный сигнал: чистая / мутновата / муть-сброс. Координаты приложение
-- округляет само (~1 км) — точных тут не храним.

create table if not exists water_reports (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  lat        double precision,   -- уже огрублённые
  lon        double precision,
  state      text not null,      -- clear | murky | flood
  created_at timestamptz default now()
);
alter table water_reports enable row level security;
drop policy if exists wr_read on water_reports;
drop policy if exists wr_own  on water_reports;
create policy wr_read on water_reports for select using (true);
create policy wr_own  on water_reports for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists water_reports_time_idx on water_reports(created_at);
grant select on water_reports to anon, authenticated;
grant insert, delete on water_reports to authenticated;
