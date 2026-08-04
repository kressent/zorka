-- Ещё один аккаунт для исключения из аналитики: Red67 — это САМ владелец
-- (вошёл на устройстве, где не стоял клиентский флаг zorka_owner). Вью уже
-- фильтруют excluded_users — достаточно добавить и почистить его события. Идемпотентно.

insert into excluded_users (user_id, note)
values ('b1268a02-e481-4eb4-a81c-2b3e534e3d88', 'owner (Red67)')
on conflict (user_id) do nothing;

delete from events where user_id in (select user_id from excluded_users);
