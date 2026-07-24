-- ═══ ЗОРЬКА · рейтинг приманок «что на что реально берёт» ════════════════════
-- Запусти в Supabase → SQL Editor. Идемпотентно.
-- Колонка catches.lure уже есть в schema.sql; приложение теперь заполняет её при
-- публикации улова (быстрый выбор приманки у каждой рыбы в дневнике).
-- Это ядро «маховика данных»: экспертные подсказки дополняются реальной статистикой.

create or replace view lure_rating as
  select species,
         lure,
         count(*)                    as n,
         round(avg(weight)::numeric) as avg_g
  from catches
  where is_public = true and lure is not null and lure <> ''
  group by species, lure;

grant select on lure_rating to anon, authenticated;
