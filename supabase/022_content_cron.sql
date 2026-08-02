-- ═══ НА КРЮЧКЕ · расписание вечернего авто-поста в канал ════════════════════
-- Запусти в Supabase → SQL Editor ПОСЛЕ деплоя функции telegram-content.
-- Постит пост из банка (posts.js) в канал 4 раза в неделю по вечерам. Идемпотентно.
-- 15:00 UTC ≈ 18:00 МСК / 20:00 Уфа. Дни: Пн/Ср/Пт/Сб (день недели: 1,3,5,6).
-- Дополняет утренний дайджест (telegram-daily, 02:00 UTC).

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$ begin
  perform cron.unschedule('telegram-content-evening');
exception when others then null; end $$;

select cron.schedule('telegram-content-evening', '0 15 * * 1,3,5,6', $cmd$
  select net.http_post(
    url     := 'https://jcazwvivxxlrhkguolfp.supabase.co/functions/v1/telegram-content',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'Authorization', 'Bearer sb_publishable_jJIkC9wwlilYwJOlEqjRxg_QnkvEKlP'),
    body    := '{}'::jsonb
  );
$cmd$);
