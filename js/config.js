'use strict';
// ═══ КОНФИГ ══════════════════════════════════════════════════════════════════
// Публичный (publishable) ключ — ему МОЖНО быть в клиенте и в публичном репо:
// доступ к данным защищает не он, а RLS (правила в supabase/schema.sql).
// СЕКРЕТНЫЙ ключ (sb_secret_…) сюда НИКОГДА не вписывать.

export const CONFIG = {
  SUPABASE_URL: 'https://jcazwvivxxlrhkguolfp.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_jJIkC9wwlilYwJOlEqjRxg_QnkvEKlP',
};

export const cloudEnabled = () => !!(CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY);
