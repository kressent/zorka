-- ═══ НА КРЮЧКЕ · координаты подписки для пуша «завтра жор» ══════════════════
-- Запусти в Supabase → SQL Editor. Идемпотентно.
-- Чтобы сервер знал, для какой точки считать прогноз конкретному устройству.
-- last_fpush — дата последнего прогнозного пуша (антидубль: не чаще раза в день).

alter table push_subscriptions add column if not exists lat        double precision;
alter table push_subscriptions add column if not exists lon        double precision;
alter table push_subscriptions add column if not exists place      text;
alter table push_subscriptions add column if not exists last_fpush date;

-- клиент обновляет свои строки (RLS push_own из 013 уже покрывает update).
