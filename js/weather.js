'use strict';
// ═══ ПОГОДА (Open-Meteo) ═════════════════════════════════════════════════════
// Бесплатно, без ключа, работает в РФ. Тянем прошлые 2 дня (для мутности и
// тренда давления) + 7 дней вперёд (для планировщика). Кэш на 3 часа — офлайн.

const CACHE_KEY = 'zorka_weather';
const CACHE_TTL = 3 * 3600 * 1000;

export function buildUrl(lat, lon) {
  return 'https://api.open-meteo.com/v1/forecast'
    + '?latitude=' + lat + '&longitude=' + lon
    + '&hourly=temperature_2m,precipitation_probability,precipitation,cloudcover,'
    + 'pressure_msl,windspeed_10m,winddirection_10m,weathercode'
    + '&daily=temperature_2m_max,temperature_2m_min,weathercode,precipitation_sum,'
    + 'winddirection_10m_dominant,sunrise,sunset'
    + '&past_days=2&forecast_days=7&timezone=auto';
}

// Возвращает { data, fromCache }
export async function fetchWeather(lat, lon) {
  const url = buildUrl(lat, lon);
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const data = await r.json();
    saveCache(lat, lon, data);
    return { data, fromCache: false };
  } catch (e) {
    const cached = loadCache(lat, lon);
    if (cached) return { data: cached, fromCache: true };
    throw e;
  }
}

function saveCache(lat, lon, data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ lat, lon, ts: Date.now(), data }));
  } catch (e) { /* приватный режим / нет места — не критично */ }
}

function loadCache(lat, lon) {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    if (!c) return null;
    // тот же город (± небольшая погрешность) и не протух
    const same = Math.abs(c.lat - lat) < 0.2 && Math.abs(c.lon - lon) < 0.2;
    if (same && Date.now() - c.ts < CACHE_TTL) return c.data;
    // на крайний случай отдадим любой кэш (лучше старые данные, чем пусто)
    if (Date.now() - c.ts < CACHE_TTL) return c.data;
    return null;
  } catch (e) { return null; }
}

// Индекс "сегодня" в daily-массивах (из-за past_days смещение).
export function todayIndex(data) {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const i = data.daily.time.indexOf(today);
    return i >= 0 ? i : 2; // past_days=2 → сегодня обычно индекс 2
  } catch (e) { return 2; }
}
