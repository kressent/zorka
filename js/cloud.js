'use strict';
// ═══ ОБЛАКО (Supabase) ═══════════════════════════════════════════════════════
// Слой поверх локального хранилища: аккаунты + (дальше) синхронизация и общая база.
// Приложение полностью работает и без входа — облако это надстройка.
// supabase-js подгружается лениво с CDN только когда реально нужен (онлайн).
import { CONFIG, cloudEnabled } from './config.js';

let _client = null, _loading = null;

export async function client() {
  if (!cloudEnabled()) return null;
  if (_client) return _client;
  if (!_loading) {
    _loading = import('https://esm.sh/@supabase/supabase-js@2').then(m => {
      _client = m.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, storageKey: 'zorka_auth' },
      });
      return _client;
    });
  }
  return _loading;
}

export async function currentUser() {
  try {
    const c = await client(); if (!c) return null;
    const { data } = await c.auth.getUser();
    return data && data.user ? data.user : null;
  } catch (e) { return null; }
}

// отправить ссылку для входа на почту (magic link; работает на бесплатном тарифе)
export async function sendCode(email) {
  const c = await client(); if (!c) throw new Error('Облако не настроено');
  const redirect = (typeof window !== 'undefined' && window.location)
    ? (window.location.origin + window.location.pathname) : undefined;
  const { error } = await c.auth.signInWithOtp({
    email: String(email).trim(),
    options: { shouldCreateUser: true, emailRedirectTo: redirect },
  });
  if (error) throw error;
}

// подтвердить код из письма
export async function verifyCode(email, token) {
  const c = await client(); if (!c) throw new Error('Облако не настроено');
  const { data, error } = await c.auth.verifyOtp({ email: String(email).trim(), token: String(token).trim(), type: 'email' });
  if (error) throw error;
  return data.user;
}

export async function signOut() {
  try { const c = await client(); if (c) await c.auth.signOut(); } catch (e) {}
}
