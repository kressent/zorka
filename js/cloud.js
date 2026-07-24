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

// вход по почте+паролю; если аккаунта нет — создаём (без писем и лимитов)
export async function signInOrUp(email, password) {
  const c = await client(); if (!c) throw new Error('Облако не настроено');
  email = String(email).trim(); password = String(password);
  const inRes = await c.auth.signInWithPassword({ email, password });
  if (!inRes.error) return inRes.data.user;
  const msg = (inRes.error.message || '').toLowerCase();
  if (msg.includes('invalid login credentials')) {
    const up = await c.auth.signUp({ email, password });
    if (up.error) {
      if ((up.error.message || '').toLowerCase().includes('already registered'))
        throw new Error('Аккаунт с этой почтой уже есть, но пароль неверный.');
      throw up.error;
    }
    if (up.data.session) return up.data.user; // подтверждение почты выключено → сразу сессия
    throw new Error('Аккаунт создан, но включено подтверждение почты. Отключи «Confirm email» в Supabase → Authentication → Providers → Email.');
  }
  throw inRes.error;
}

// задать/сменить пароль текущему аккаунту (для входа на других устройствах)
export async function setPassword(password) {
  const c = await client(); if (!c) throw new Error('Облако не настроено');
  const { error } = await c.auth.updateUser({ password: String(password) });
  if (error) throw error;
}

// ── синхронизация данных (дневник/места/снасти одним документом) ──
export async function pullData() {
  const c = await client(); if (!c) return null;
  const u = await currentUser(); if (!u) return null;
  const { data, error } = await c.from('user_data').select('data,updated_at').eq('user_id', u.id).maybeSingle();
  if (error) throw error;
  return data; // { data, updated_at } | null
}

export async function pushData(obj) {
  const c = await client(); if (!c) return null;
  const u = await currentUser(); if (!u) return null;
  const now = new Date().toISOString();
  const { error } = await c.from('user_data').upsert({ user_id: u.id, data: obj, updated_at: now });
  if (error) throw error;
  return now;
}

// ── сообщество: публикация уловов, лента, лайки ──
export async function publishCatches(entry, waterName, coords) {
  const c = await client(); if (!c) return; const u = await currentUser(); if (!u) return;
  const cats = (entry.catches || []); if (!cats.length) return;
  const caughtAt = entry.date ? new Date(entry.date + 'T12:00:00').toISOString() : new Date().toISOString();
  const rows = cats.map((x, i) => ({
    user_id: u.id,
    client_id: entry.id + ':' + i,
    species: x.species,
    weight: (x.weight ?? null),
    caught_at: caughtAt,
    water_name: waterName || entry.spot || null,
    lat: (coords && coords.lat) || null,
    lon: (coords && coords.lon) || null,
    conditions: entry.forecast || null,
    forecast_score: (entry.forecast && entry.forecast.score != null) ? entry.forecast.score : null,
    is_public: true,
  }));
  const { error } = await c.from('catches').upsert(rows, { onConflict: 'user_id,client_id' });
  if (error) throw error;
}

export async function fetchFeed(limit = 40) {
  const c = await client(); if (!c) return [];
  const { data, error } = await c.from('feed_catches').select('*').order('caught_at', { ascending: false }).limit(limit);
  if (error) throw error;
  return data || [];
}

export async function myLikes(ids) {
  const c = await client(); const u = await currentUser();
  if (!c || !u || !ids.length) return new Set();
  const { data } = await c.from('catch_likes').select('catch_id').eq('user_id', u.id).in('catch_id', ids);
  return new Set((data || []).map(r => r.catch_id));
}

export async function toggleLike(catchId, on) {
  const c = await client(); const u = await currentUser(); if (!c || !u) throw new Error('Войди в аккаунт');
  if (on) {
    const { error } = await c.from('catch_likes').insert({ catch_id: catchId, user_id: u.id });
    if (error && !String(error.message || '').toLowerCase().includes('duplicate')) throw error;
  } else {
    const { error } = await c.from('catch_likes').delete().eq('catch_id', catchId).eq('user_id', u.id);
    if (error) throw error;
  }
}

export async function signOut() {
  try { const c = await client(); if (c) await c.auth.signOut(); } catch (e) {}
}

// синхронно определить вход по сохранённой сессии (без запроса к серверу)
export function cachedUser() {
  try {
    const raw = localStorage.getItem('zorka_auth');
    if (!raw) return null;
    const o = JSON.parse(raw);
    const u = o.user || (o.currentSession && o.currentSession.user) || (o.session && o.session.user) || null;
    return (u && u.email) ? { email: u.email } : null;
  } catch (e) { return null; }
}
