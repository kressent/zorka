'use strict';
// ═══ ПОГОДА (Open-Meteo) ═════════════════════════════════════════════════════
// Бесплатно, без ключа, работает в РФ.
//  • основной запрос: почасово + 7 дней вперёд (+2 дня назад);
//  • история: 60 дней осадков и температур — для уровня/мутности воды «с памятью»
//    (ливни двухнедельной давности всё ещё держат воду высокой) и лага темп. воды.
// Кэш в localStorage: погода 3 ч, история 12 ч → офлайн.

const CACHE_KEY = 'zorka_weather';
const HIST_KEY  = 'zorka_hist';
const CACHE_TTL = 3 * 3600 * 1000;
const HIST_TTL  = 12 * 3600 * 1000;

export function buildUrl(lat, lon) {
  return 'https://api.open-meteo.com/v1/forecast'
    + '?latitude=' + lat + '&longitude=' + lon
    + '&hourly=temperature_2m,precipitation_probability,precipitation,cloudcover,'
    + 'pressure_msl,windspeed_10m,winddirection_10m,weathercode'
    + '&daily=temperature_2m_max,temperature_2m_min,weathercode,precipitation_sum,'
    + 'winddirection_10m_dominant,sunrise,sunset'
    + '&past_days=2&forecast_days=14&timezone=auto';
}

export function historyUrl(lat, lon) {
  return 'https://api.open-meteo.com/v1/forecast'
    + '?latitude=' + lat + '&longitude=' + lon
    + '&daily=precipitation_sum,temperature_2m_max,temperature_2m_min'
    + '&past_days=60&forecast_days=1&timezone=auto';
}

// Возвращает { data, fromCache }. data.history = {time,precip,tmax,tmin} | null
export async function fetchWeather(lat, lon) {
  const histP = fetchHistory(lat, lon);          // параллельно
  let data, fromCache = false;
  try {
    const r = await fetch(buildUrl(lat, lon));
    if (!r.ok) throw new Error('HTTP ' + r.status);
    data = await r.json();
    saveCache(lat, lon, data);
  } catch (e) {
    data = loadCache(lat, lon);
    if (!data) { throw e; }
    fromCache = true;
  }
  try { data.history = await histP; } catch (e) { data.history = null; }
  return { data, fromCache };
}

export async function fetchHistory(lat, lon) {
  try {
    const r = await fetch(historyUrl(lat, lon));
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    const h = { time: j.daily.time, precip: j.daily.precipitation_sum,
                tmax: j.daily.temperature_2m_max, tmin: j.daily.temperature_2m_min };
    saveHist(lat, lon, h);
    return h;
  } catch (e) {
    return loadHist(lat, lon) || null;
  }
}

// ── кэш ──
function near(a, b) { return Math.abs(a.lat - b.lat) < 0.2 && Math.abs(a.lon - b.lon) < 0.2; }
function saveCache(lat, lon, data) { try { localStorage.setItem(CACHE_KEY, JSON.stringify({ lat, lon, ts: Date.now(), data })); } catch (e) {} }
function loadCache(lat, lon) {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    if (c && Date.now() - c.ts < CACHE_TTL) return c.data;
    return null;
  } catch (e) { return null; }
}
function saveHist(lat, lon, h) { try { localStorage.setItem(HIST_KEY, JSON.stringify({ lat, lon, ts: Date.now(), h })); } catch (e) {} }
function loadHist(lat, lon) {
  try {
    const c = JSON.parse(localStorage.getItem(HIST_KEY) || 'null');
    if (c && near(c, { lat, lon }) && Date.now() - c.ts < HIST_TTL) return c.h;
    return null;
  } catch (e) { return null; }
}

// Индекс "сегодня" в daily-массивах (из-за past_days смещение).
export function todayIndex(data) {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const i = data.daily.time.indexOf(today);
    return i >= 0 ? i : 2;
  } catch (e) { return 2; }
}
