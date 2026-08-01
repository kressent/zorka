-- ═══ ЗОРЬКА · триггеры пуша (замена Database Webhooks через SQL) ════════════
-- Запусти в Supabase → SQL Editor ПОСЛЕ деплоя функции push-notify.
-- При новом лайке/комментарии дёргает Edge-функцию push-notify (она шлёт пуш).
-- Идемпотентно.

create extension if not exists pg_net;

create or replace function notify_push() returns trigger
language plpgsql security definer as $$
begin
  perform net.http_post(
    url     := 'https://jcazwvivxxlrhkguolfp.supabase.co/functions/v1/push-notify',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'Authorization', 'Bearer sb_publishable_jJIkC9wwlilYwJOlEqjRxg_QnkvEKlP'),
    body    := jsonb_build_object('table', TG_TABLE_NAME, 'record', to_jsonb(NEW))
  );
  return NEW;
end $$;

drop trigger if exists push_on_like on trip_likes;
create trigger push_on_like after insert on trip_likes
  for each row execute function notify_push();

drop trigger if exists push_on_comment on trip_comments;
create trigger push_on_comment after insert on trip_comments
  for each row execute function notify_push();
