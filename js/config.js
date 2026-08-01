'use strict';
// ═══ КОНФИГ ══════════════════════════════════════════════════════════════════
// Публичный (publishable) ключ — ему МОЖНО быть в клиенте и в публичном репо:
// доступ к данным защищает не он, а RLS (правила в supabase/schema.sql).
// СЕКРЕТНЫЙ ключ (sb_secret_…) сюда НИКОГДА не вписывать.

export const CONFIG = {
  SUPABASE_URL: 'https://jcazwvivxxlrhkguolfp.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_jJIkC9wwlilYwJOlEqjRxg_QnkvEKlP',
  // Пуш на телефон: сюда вписать ПУБЛИЧНЫЙ VAPID-ключ (безопасно, он публичный).
  // Пока пусто — кнопка «пуш на телефон» скрыта. Настройка: docs/PUSH-SETUP.md
  VAPID_PUBLIC: 'BC-PYsqHNqFQVTU8TdA3KIeUJGDfdINpeZAgTZlD4uE_Sg31nYiH4Q9Z1MDMbHfrPzB0ZK8SPEvj216QWP8oVzA',
  // Affiliate «купить приманку» (монетизация). Пусто/enabled:false = кнопки скрыты.
  // url — шаблон, {q} заменяется на приманку (поиск в магазине-партнёре).
  // Включаем, когда появится реальный партнёр (Ozon/WB/рыболовный). docs/MONETIZATION.md
  AFFILIATE: { enabled: false, label: 'Купить', url: '' },
};

export const cloudEnabled = () => !!(CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY);
