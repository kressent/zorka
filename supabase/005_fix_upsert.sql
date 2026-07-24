-- ═══ ФИКС: публикация уловов в ленту ════════════════════════════════════════
-- Запусти, если 004 ты уже запускал (лента настроена, но уловы не публикуются).
-- Меняем частичный уникальный индекс на полноценное ограничение, чтобы
-- upsert по (user_id, client_id) заработал.
drop index if exists catches_user_client;
alter table catches drop constraint if exists catches_user_client_uk;
alter table catches add constraint catches_user_client_uk unique (user_id, client_id);
