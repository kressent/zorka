-- ═══ НА КРЮЧКЕ · расписание пуша «завтра жор» ══════════════════════════════
-- Запусти в Supabase → SQL Editor ПОСЛЕ деплоя функции forecast-push.
-- Раз в день (вечером) дёргает forecast-push — она сама решает, кому слать
-- (сильный день впереди) и не чаще раза в сутки на устройство. Идемпотентно.
--
-- 15:00 UTC ≈ 18:00 МСК / 20:00 Екб — прогноз на завтра к вечеру актуален.

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$ begin
  perform cron.unschedule('forecast-push-daily');
exception when others then null; end $$;

select cron.schedule('forecast-push-daily', '0 15 * * *', $cmd$
  select net.http_post(
    url     := 'https://jcazwvivxxlrhkguolfp.supabase.co/functions/v1/forecast-push',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'Authorization', 'Bearer sb_publishable_jJIkC9wwlilYwJOlEqjRxg_QnkvEKlP'),
    body    := '{}'::jsonb
  );
$cmd$);
