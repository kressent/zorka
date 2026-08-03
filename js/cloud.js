'use strict';
// ═══ ОБЛАКО (Supabase) ═══════════════════════════════════════════════════════
// Слой поверх локального хранилища: аккаунты + (дальше) синхронизация и общая база.
// Приложение полностью работает и без входа — облако это надстройка.
// supabase-js подгружается лениво с CDN только когда реально нужен (онлайн).
import { CONFIG, cloudEnabled } from './config.js';
import { isTrophy } from './data.js';

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

export async function currentUserId() { const u = await currentUser(); return u ? u.id : null; }

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
  // почта не подтверждена — но пароль верный: значит аккаунт есть, ждёт подтверждения
  if (msg.includes('email not confirmed')) {
    throw new Error('Почта ещё не подтверждена. Владелец приложения отключит подтверждение — после этого войди этой же почтой и паролем.');
  }
  if (msg.includes('invalid login credentials')) {
    const redirect = (typeof window !== 'undefined' && window.location)
      ? (window.location.origin + window.location.pathname) : undefined;
    const up = await c.auth.signUp({ email, password, options: { emailRedirectTo: redirect } });
    if (up.error) {
      const em = (up.error.message || '').toLowerCase();
      if (em.includes('already registered'))
        throw new Error('Аккаунт с этой почтой уже есть, но пароль неверный.');
      if (em.includes('sending') || em.includes('smtp') || em.includes('mail') || up.error.status === 500 || !up.error.message)
        throw new Error('Не удалось отправить письмо-подтверждение — проверь SMTP в Supabase (пароль приложения и порт: попробуй 587 вместо 465). Подробности — Supabase → Authentication → Logs.');
      throw up.error;
    }
    if (up.data.session) return up.data.user; // подтверждение почты выключено → сразу сессия
    // Supabase маскирует существующую почту: user без identities = аккаунт уже есть
    if (up.data.user && Array.isArray(up.data.user.identities) && up.data.user.identities.length === 0)
      throw new Error('Аккаунт с этой почтой уже есть — просто неверный пароль. Если забыл, восстанови пароль.');
    throw new Error('Аккаунт создан. Открой письмо-подтверждение и нажми ссылку, потом вернись и войди.');
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

// вставка уловов, устойчивая к «ещё не прогнанной миграции»: если PostgREST
// не находит какую-то колонку (напр. trophy до 010) — выкидываем её и повторяем.
async function insertCatchesResilient(c, rows) {
  let attempt = rows;
  for (let i = 0; i < 4; i++) {
    const { error } = await c.from('catches').insert(attempt);
    if (!error) return;
    const m = /Could not find the '([^']+)' column/.exec(error.message || '');
    if (m && attempt[0] && Object.prototype.hasOwnProperty.call(attempt[0], m[1])) {
      const col = m[1];
      attempt = attempt.map(r => { const { [col]: _drop, ...rest } = r; return rest; });
      continue;
    }
    throw error;
  }
}

// ── сообщество: публикация уловов, лента, лайки ──
// загрузить фото улова в облако (публичный бакет) → вернуть публичный URL | null
export async function uploadCatchPhoto(entryId, dataUrl) {
  try {
    const c = await client(); const u = await currentUser();
    if (!c || !u || !dataUrl) return null;
    const blob = await (await fetch(dataUrl)).blob();
    const path = `${u.id}/${entryId}.jpg`;
    const { error } = await c.storage.from('catch-photos').upload(path, blob, { upsert: true, contentType: 'image/jpeg' });
    if (error) { console.warn('photo upload:', error.message); return null; }
    const { data } = c.storage.from('catch-photos').getPublicUrl(path);
    return (data && data.publicUrl) || null;
  } catch (e) { return null; }
}

export async function publishCatches(entry, waterName, coords, photoUrl) {
  const c = await client(); if (!c) return; const u = await currentUser(); if (!u) return;
  // всегда сперва убираем прошлые строки этой записи — так правки и удаления
  // улова синхронизируются с лентой (даже если рыбу из записи убрали совсем)
  await c.from('catches').delete().eq('user_id', u.id).like('client_id', entry.id + ':%');
  const cats = (entry.catches || []); if (!cats.length) return; // улова нет — просто убрали старое
  const caughtAt = entry.date ? new Date(entry.date + 'T12:00:00').toISOString() : new Date().toISOString();
  // место рыбалки важнее города: показываем spot (напр. «Зирган»), город — запасной
  const place = (entry.spot && entry.spot.trim()) ? entry.spot.trim() : (waterName || null);
  const rows = cats.map((x, i) => ({
    user_id: u.id,
    client_id: entry.id + ':' + i,
    trip_id: entry.id,                 // метка выезда (одна рыбалка = одна карточка)
    species: x.species,
    weight: (x.weight ?? null),
    trophy: isTrophy(x.species, x.weight),
    lure: (x.lure ? String(x.lure).slice(0, 60) : null),
    caught_at: caughtAt,
    water_name: place,
    lat: (coords && coords.lat) || null,
    lon: (coords && coords.lon) || null,
    conditions: entry.forecast || null,
    forecast_score: (entry.forecast && entry.forecast.score != null) ? entry.forecast.score : null,
    photo_url: photoUrl || null,
    is_public: true,
  }));
  await insertCatchesResilient(c, rows);
}

// убрать из ленты все уловы удалённой записи дневника
export async function unpublishEntry(entryId) {
  const c = await client(); if (!c) return; const u = await currentUser(); if (!u) return;
  const { error } = await c.from('catches').delete().eq('user_id', u.id).like('client_id', entryId + ':%');
  if (error) throw error;
}

export async function fetchFeed(limit = 40) {
  const c = await client(); if (!c) return [];
  const { data, error } = await c.from('feed_trips').select('*').order('caught_at', { ascending: false }).limit(limit);
  if (error) throw error;
  return data || [];
}

// ── отметки состояния воды от рыбаков ──
export async function reportWater(state, lat, lon) {
  const c = await client(); const u = await currentUser(); if (!c || !u) throw new Error('Войди в аккаунт');
  const round = v => (v != null ? Math.round(v * 100) / 100 : null);
  const { error } = await c.from('water_reports').insert({ user_id: u.id, state, lat: round(lat), lon: round(lon) });
  if (error) throw error;
}
export async function fetchWaterReports() {
  const c = await client(); if (!c) return [];
  const { data, error } = await c.from('water_reports').select('state,lat,lon,created_at')
    .order('created_at', { ascending: false }).limit(200);
  if (error) throw error;
  return data || [];
}

// статистика приманок «что на что реально берёт» (вью lure_rating)
export async function fetchLureRating() {
  const c = await client(); if (!c) return [];
  const { data, error } = await c.from('lure_rating').select('*');
  if (error) throw error;
  return data || [];
}

// какие выезды я лайкал (ids — ключи выездов 'owner:trip')
export async function myLikes(ids) {
  const c = await client(); const u = await currentUser();
  if (!c || !u || !ids.length) return new Set();
  const { data } = await c.from('trip_likes').select('trip_key').eq('user_id', u.id).in('trip_key', ids);
  return new Set((data || []).map(r => r.trip_key));
}

export async function toggleLike(tripKey, on) {
  const c = await client(); const u = await currentUser(); if (!c || !u) throw new Error('Войди в аккаунт');
  if (on) {
    const { error } = await c.from('trip_likes').insert({ trip_key: tripKey, user_id: u.id });
    if (error && !String(error.message || '').toLowerCase().includes('duplicate')) throw error;
  } else {
    const { error } = await c.from('trip_likes').delete().eq('trip_key', tripKey).eq('user_id', u.id);
    if (error) throw error;
  }
}

// ── жалобы на выезды (антиспам). Устойчивы к «миграция 018 ещё не прогнана» ──
export async function reportTrip(tripKey, reason) {
  const c = await client(); const u = await currentUser(); if (!c || !u) throw new Error('Войди в аккаунт');
  const { error } = await c.from('trip_reports').insert({ trip_key: tripKey, user_id: u.id, reason: reason || null });
  if (error && !String(error.message || '').toLowerCase().includes('duplicate')) throw error;
}
// какие выезды я уже отметил жалобой (для скрытия у себя)
export async function myReports(ids) {
  try {
    const c = await client(); const u = await currentUser();
    if (!c || !u || !ids.length) return new Set();
    const { data } = await c.from('trip_reports').select('trip_key').eq('user_id', u.id).in('trip_key', ids);
    return new Set((data || []).map(r => r.trip_key));
  } catch (e) { return new Set(); }
}
// счётчики жалоб по выездам (для авто-скрытия при пороге); молча пусто, если вью нет
export async function reportCounts(ids) {
  try {
    const c = await client(); if (!c || !ids.length) return {};
    const { data } = await c.from('report_counts').select('*').in('trip_key', ids);
    const m = {}; for (const r of (data || [])) m[r.trip_key] = r.n; return m;
  } catch (e) { return {}; }
}

// ── совместные выезды («напарники») ──
export async function createCoTrip({ place, date, note }) {
  const c = await client(); const u = await currentUser(); if (!c || !u) throw new Error('Войди в аккаунт');
  const handle = await ensureProfile().catch(() => null);
  const row = { user_id: u.id, handle: handle || 'Рыбак', place: String(place).slice(0, 120),
    trip_date: date || null, note: note ? String(note).slice(0, 300) : null };
  const { error } = await c.from('co_trips').insert(row);
  if (error) throw error;
  return true;
}
export async function fetchCoTrips() {
  try {
    const c = await client(); if (!c) return [];
    const today = new Date().toISOString().slice(0, 10);
    // предстоящие (дата не задана или сегодня и позже), свежие сверху
    const { data } = await c.from('co_trips_view').select('*')
      .or(`trip_date.gte.${today},trip_date.is.null`).order('trip_date', { ascending: true }).limit(50);
    return data || [];
  } catch (e) { return []; }
}
export async function myCoJoins(ids) {
  try {
    const c = await client(); const u = await currentUser();
    if (!c || !u || !ids.length) return new Set();
    const { data } = await c.from('co_joins').select('trip_id').eq('user_id', u.id).in('trip_id', ids);
    return new Set((data || []).map(r => r.trip_id));
  } catch (e) { return new Set(); }
}
export async function joinCoTrip(tripId, on) {
  const c = await client(); const u = await currentUser(); if (!c || !u) throw new Error('Войди в аккаунт');
  if (on) {
    const handle = await ensureProfile().catch(() => null);
    const { error } = await c.from('co_joins').insert({ trip_id: tripId, user_id: u.id, handle: handle || 'Рыбак' });
    if (error && !String(error.message || '').toLowerCase().includes('duplicate')) throw error;
  } else {
    const { error } = await c.from('co_joins').delete().eq('trip_id', tripId).eq('user_id', u.id);
    if (error) throw error;
  }
}
export async function deleteCoTrip(tripId) {
  const c = await client(); const u = await currentUser(); if (!c || !u) throw new Error('Войди в аккаунт');
  const { error } = await c.from('co_trips').delete().eq('id', tripId).eq('user_id', u.id);
  if (error) throw error;
}

// ── обратная связь + аналитика (устойчивы к «миграция 023 ещё не прогнана») ──
export async function sendFeedback(message, contact) {
  const c = await client(); if (!c) throw new Error('Облако не настроено');
  const u = await currentUser().catch(() => null);
  const { error } = await c.from('feedback').insert({
    message: String(message).slice(0, 4000), contact: contact ? String(contact).slice(0, 200) : null,
    user_id: u ? u.id : null,
  });
  if (error) throw error;
  return true;
}

// анонимный id сессии (не личность) — чтобы считать «заходы», а не только события
let _session = null;
function sessionId() {
  if (_session) return _session;
  try { _session = localStorage.getItem('zorka_sid'); } catch (e) {}
  if (!_session) {
    _session = Math.random().toString(36).slice(2) + Date.now().toString(36);
    try { localStorage.setItem('zorka_sid', _session); } catch (e) {}
  }
  return _session;
}

// залогировать событие (fire-and-forget, молча падает — аналитика не должна мешать)
export async function logEvent(name, meta) {
  try {
    if (!name) return;
    try { if (localStorage.getItem('zorka_owner')) return; } catch (e) {}  // устройства владельца не считаем
    const c = await client(); if (!c) return;
    const u = await currentUser().catch(() => null);
    await c.from('events').insert({ name: String(name).slice(0, 40), meta: meta || null,
      user_id: u ? u.id : null, session: sessionId() }).then(() => {}, () => {});
  } catch (e) { /* тихо */ }
}

// ── профиль рыбака: ник + рейтинг (очки/ранг считает вью angler_stats) ──
function genHandle() {
  // нейтральный ник по умолчанию (без утечки почты); рыбак сам переименует
  return 'Рыбак-' + Math.floor(1000 + Math.random() * 9000);
}

// создать профиль с ником, если его ещё нет; вернуть актуальный ник
// (таблица profiles из schema.sql: PK = id → auth.users, ник в поле nickname)
export async function ensureProfile(defaultHandle) {
  const c = await client(); if (!c) return null;
  const u = await currentUser(); if (!u) return null;
  const { data } = await c.from('profiles').select('nickname').eq('id', u.id).maybeSingle();
  if (data && data.nickname) return data.nickname;
  const handle = String(defaultHandle || genHandle()).slice(0, 24);
  await c.from('profiles').upsert({ id: u.id, nickname: handle }).then(() => {}, () => {});
  return handle;
}

export async function setHandle(handle) {
  const c = await client(); if (!c) throw new Error('Облако не настроено');
  const u = await currentUser(); if (!u) throw new Error('Войди в аккаунт');
  handle = String(handle).trim().slice(0, 24);
  if (handle.length < 2) throw new Error('Имя слишком короткое');
  const { error } = await c.from('profiles').upsert({ id: u.id, nickname: handle });
  if (error) throw error;
  return handle;
}

// мои агрегаты рыбака (уловы/лайки/дни/виды/очки/ник)
export async function myStats() {
  const c = await client(); if (!c) return null;
  const u = await currentUser(); if (!u) return null;
  const { data } = await c.from('angler_stats').select('*').eq('user_id', u.id).maybeSingle();
  return data;
}

// живое обновление: подписка на изменения комментариев/лайков (Supabase Realtime)
// onChange(kind, payload) вызывается при любом insert/delete. Возвращает канал.
let _rtChannel = null;
export async function subscribeCommunity(onChange) {
  const c = await client(); if (!c) return null;
  if (_rtChannel) return _rtChannel;
  _rtChannel = c.channel('zorka-community')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'trip_comments' }, p => onChange('comment', p))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'trip_likes' }, p => onChange('like', p))
    .subscribe();
  return _rtChannel;
}

// ── комментарии к выезду ──
export async function fetchComments(tripKey) {
  const c = await client(); if (!c) return [];
  const { data, error } = await c.from('trip_comments_view').select('*')
    .eq('trip_key', tripKey).order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function addComment(tripKey, body) {
  const c = await client(); const u = await currentUser(); if (!c || !u) throw new Error('Войди в аккаунт');
  body = String(body).trim().slice(0, 500);
  if (!body) throw new Error('Пустой комментарий');
  const { error } = await c.from('trip_comments').insert({ trip_key: tripKey, user_id: u.id, body });
  if (error) throw error;
}

export async function deleteComment(id) {
  const c = await client(); const u = await currentUser(); if (!c || !u) throw new Error('Войди в аккаунт');
  const { error } = await c.from('trip_comments').delete().eq('id', id).eq('user_id', u.id);
  if (error) throw error;
}

// ── пуш на телефон (Web Push). Работает, когда владелец настроит VAPID+отправку ──
export function pushConfigured() { return !!(CONFIG.VAPID_PUBLIC && CONFIG.VAPID_PUBLIC.length > 20); }

function urlB64ToUint8(b64) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const s = (b64 + pad).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(s);
  return Uint8Array.from([...raw].map(ch => ch.charCodeAt(0)));
}

export async function enablePush(loc) {
  if (!pushConfigured()) throw new Error('Пуши ещё не настроены владельцем приложения.');
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) throw new Error('Браузер не поддерживает пуши.');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Уведомления не разрешены.');
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8(CONFIG.VAPID_PUBLIC) });
  const c = await client(); const u = await currentUser(); if (!c || !u) throw new Error('Войди в аккаунт');
  const j = sub.toJSON();
  const row = { user_id: u.id, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth };
  if (loc && loc.lat != null && loc.lon != null) { row.lat = loc.lat; row.lon = loc.lon; row.place = loc.place || null; }
  const { error } = await c.from('push_subscriptions').upsert(row, { onConflict: 'endpoint' });
  if (error) {
    // столбцы координат появятся после миграции 019 — не валим подписку из-за них
    if (/column .* does not exist/i.test(error.message || '')) {
      const { error: e2 } = await c.from('push_subscriptions').upsert(
        { user_id: u.id, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth }, { onConflict: 'endpoint' });
      if (e2) throw e2;
    } else throw error;
  }
  return true;
}

// обновить точку подписки (когда рыбак сменил город, а пуши уже включены)
export async function updatePushLocation(loc) {
  try {
    if (!(loc && loc.lat != null && loc.lon != null)) return;
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const c = await client(); const u = await currentUser(); if (!c || !u) return;
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription(); if (!sub) return;
    await c.from('push_subscriptions').update({ lat: loc.lat, lon: loc.lon, place: loc.place || null })
      .eq('endpoint', sub.endpoint).then(() => {}, () => {});
  } catch (e) {}
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
