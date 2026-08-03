-- Активность по каждому зарегистрированному пользователю (кто как часто заходит).
-- Только для владельца (читается в дашборде/SQL Editor); анону НЕ даём — приватность.
create or replace view user_activity as
select
  e.user_id,
  p.nickname                                   as handle,
  count(*) filter (where e.name = 'app_open')  as opens,
  count(distinct e.session)                    as devices,
  count(*) filter (where e.name = 'save_catch') as catches,
  count(*) filter (where e.name = 'invite')     as invites,
  min(e.created_at)                            as first_seen,
  max(e.created_at)                            as last_seen
from events e
left join profiles p on p.id = e.user_id
where e.user_id is not null
group by e.user_id, p.nickname
order by opens desc;
