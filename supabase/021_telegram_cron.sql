-- ═══ НА КРЮЧКЕ · расписание утреннего дайджеста в Telegram-канал ════════════
-- Запусти в Supabase → SQL Editor ПОСЛЕ деплоя функции telegram-daily.
-- Раз в день утром дёргает telegram-daily → она постит дайджест в канал. Идемпотентно.
-- 02:00 UTC ≈ 05:00 МСК / 07:00 Уфа — к утренней рыбалке.

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$ begin
  perform cron.unschedule('telegram-daily-digest');
exception when others then null; end $$;

select cron.schedule('telegram-daily-digest', '0 2 * * *', $cmd$
  select net.http_post(
    url     := 'https://jcazwvivxxlrhkguolfp.supabase.co/functions/v1/telegram-daily',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'Authorization', 'Bearer sb_publishable_jJIkC9wwlilYwJOlEqjRxg_QnkvEKlP'),
    body    := '{}'::jsonb
  );
$cmd$);
