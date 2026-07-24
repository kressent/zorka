-- ═══ ЗОРЬКА · живое обновление ленты (Supabase Realtime) ════════════════════
-- Запусти в Supabase → SQL Editor. Идемпотентно.
-- Включает трансляцию изменений комментариев и лайков, чтобы они появлялись в
-- ленте/модалке без перезагрузки страницы. RLS соблюдается (политики read = true).
-- publication supabase_realtime на Supabase есть по умолчанию.

do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname='supabase_realtime' and schemaname='public' and tablename='trip_comments') then
    alter publication supabase_realtime add table trip_comments;
  end if;
  if not exists (select 1 from pg_publication_tables
                 where pubname='supabase_realtime' and schemaname='public' and tablename='trip_likes') then
    alter publication supabase_realtime add table trip_likes;
  end if;
end $$;
