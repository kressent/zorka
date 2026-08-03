-- Индексы для быстрых аналитических вью (event_totals / event_daily). Идемпотентно.
create index if not exists events_name_idx on events (name);
create index if not exists events_created_idx on events (created_at);
