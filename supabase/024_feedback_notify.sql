-- ═══ НА КРЮЧКЕ · отзыв → тебе в Telegram ═══════════════════════════════════
-- Запусти в SQL Editor ПОСЛЕ деплоя функции feedback-notify. Идемпотентно.
-- При новом отзыве (INSERT в feedback) дёргает feedback-notify → пуш тебе в личку.

create extension if not exists pg_net;

create or replace function notify_feedback() returns trigger
language plpgsql security definer as $$
begin
  perform net.http_post(
    url     := 'https://jcazwvivxxlrhkguolfp.supabase.co/functions/v1/feedback-notify',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'Authorization', 'Bearer sb_publishable_jJIkC9wwlilYwJOlEqjRxg_QnkvEKlP'),
    body    := jsonb_build_object('record', to_jsonb(NEW))
  );
  return NEW;
end $$;

drop trigger if exists feedback_notify on feedback;
create trigger feedback_notify after insert on feedback
  for each row execute function notify_feedback();
