'use strict';
// ═══ КОНФИГ ══════════════════════════════════════════════════════════════════
// Пока ключей нет — приложение полностью работает на локальном хранилище
// (localStorage). Как заведём проект Supabase — впиши сюда URL и anon-ключ,
// и подключим облако/аккаунты/общую базу (старт «маховика»). См. supabase/README.md.

export const CONFIG = {
  SUPABASE_URL: '',        // напр. https://xxxx.supabase.co
  SUPABASE_ANON_KEY: '',   // публичный anon-ключ (не секретный, можно в клиенте)
};

export const cloudEnabled = () => !!(CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY);
