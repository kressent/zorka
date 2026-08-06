-- ПОСТОЯННЫЙ ФИКС входа. Заменяет выключенный тумблер «Confirm email»: каждый новый
-- аккаунт сразу помечается подтверждённым, поэтому вход почта+пароль работает без
-- письма (как и задумано). Если позже выключить подтверждение в дашборде — триггер
-- просто станет безвредным no-op. Идемпотентно.
create or replace function public.zorka_autoconfirm() returns trigger
language plpgsql security definer as $$
begin
  if new.email_confirmed_at is null then
    new.email_confirmed_at := now();
  end if;
  return new;
end $$;

drop trigger if exists zorka_autoconfirm_trg on auth.users;
create trigger zorka_autoconfirm_trg
  before insert on auth.users
  for each row execute function public.zorka_autoconfirm();
