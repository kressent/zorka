-- Активировать/обновить вечерний авто-пост из банка стилей (telegram-content) —
-- он был не заведён, поэтому в канал/ВК шёл только утренний прогноз (021), всё
-- однотипно. Делаем ЕЖЕДНЕВНО в 15:00 UTC (20:00 Уфа): утром прогноз, вечером —
-- история/юмор/опрос/эксперт из банка (56 постов, ротация по дню года). Идемпотентно.
create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$ begin
  perform cron.unschedule('telegram-content-evening');
exception when others then null; end $$;

select cron.schedule('telegram-content-evening', '0 15 * * *', $cmd$
  select net.http_post(
    url     := 'https://jcazwvivxxlrhkguolfp.supabase.co/functions/v1/telegram-content',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'Authorization', 'Bearer sb_publishable_jJIkC9wwlilYwJOlEqjRxg_QnkvEKlP'),
    body    := '{}'::jsonb
  );
$cmd$);
