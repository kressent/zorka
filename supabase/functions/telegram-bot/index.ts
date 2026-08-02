// ═══ НА КРЮЧКЕ · Telegram-бот (webhook, 24/7 без always-on процесса) ════════
// Supabase Edge Function (Deno). Telegram шлёт сюда апдейты (setWebhook), функция
// считает прогноз тем же движком, что приложение (lib/*.js — копия js/*.js через
// tools/bundle-push.js), и отвечает. Деплой/настройка — docs/BOT-HOSTING.md.
// Секреты: TELEGRAM_BOT_TOKEN (+ опц. TELEGRAM_WEBHOOK_SECRET).
import { computeForecast } from './lib/score.js';
import { forecastPost } from './lib/postgen.js';
import { searchCities, nearestCity, geoSearch } from './lib/locations.js';

const TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')!;
const SECRET = Deno.env.get('TELEGRAM_WEBHOOK_SECRET') || '';
const API = `https://api.telegram.org/bot${TOKEN}`;

const HELLO = 'Привет! Это «На крючке» 🎣\nНапиши город или водоём — дам прогноз клёва на сегодня.\n'
  + 'Например: «Нугуш», «Павловка», «Уфа» или «прогноз Салават».';

function buildUrl(lat: number, lon: number) {
  return 'https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lon
    + '&hourly=temperature_2m,precipitation_probability,precipitation,cloudcover,pressure_msl,'
    + 'windspeed_10m,winddirection_10m,weathercode'
    + '&daily=temperature_2m_max,temperature_2m_min,weathercode,precipitation_sum,'
    + 'winddirection_10m_dominant,sunrise,sunset&past_days=2&forecast_days=14&timezone=auto';
}
function historyUrl(lat: number, lon: number) {
  return 'https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lon
    + '&daily=precipitation_sum,temperature_2m_max,temperature_2m_min&past_days=60&forecast_days=1&timezone=auto';
}
function todayIndex(data: any) {
  try { const t = new Date().toISOString().slice(0, 10); const i = data.daily.time.indexOf(t); return i >= 0 ? i : 2; }
  catch { return 2; }
}

async function getForecast(place: any) {
  const r = await fetch(buildUrl(place.lat, place.lon)); const data = await r.json();
  try {
    const h = await fetch(historyUrl(place.lat, place.lon)); const hj = await h.json();
    data.history = { time: hj.daily.time, precip: hj.daily.precipitation_sum, tmax: hj.daily.temperature_2m_max, tmin: hj.daily.temperature_2m_min };
  } catch { /* без истории — короткое окно */ }
  return computeForecast(data, { filter: 'all', todayIdx: todayIndex(data), lat: place.lat, lon: place.lon });
}

async function send(chatId: number | string, text: string) {
  await fetch(`${API}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
  });
}

// резолвим запрос → точка: сперва свой список городов, затем Nominatim (сёла/водоёмы)
async function resolve(q: string) {
  const local = searchCities(q)[0];
  if (local && local.n.toLowerCase() === q.toLowerCase()) return local;
  const geo = (await geoSearch(q))[0];
  if (geo) return geo;
  if (local) return local;
  return null;
}

Deno.serve(async (req) => {
  const ok = () => new Response('ok', { status: 200 });
  try {
    if (SECRET && req.headers.get('x-telegram-bot-api-secret-token') !== SECRET) return new Response('forbidden', { status: 401 });
    const update = await req.json();
    const m = update.message || update.edited_message;
    if (!m || !m.text) return ok();
    const chatId = m.chat.id;
    const text = String(m.text).trim();

    if (/^\/(start|help)/i.test(text)) { await send(chatId, HELLO); return ok(); }

    const q = text.replace(/^\/?(прогноз клёва|прогноз клева|прогноз)\s*/i, '').trim() || text;
    const place = await resolve(q);
    if (!place) { await send(chatId, 'Не нашёл такое место. Напиши крупный ближайший город или известный водоём — например, Уфа, Салават, Нугуш.'); return ok(); }
    try {
      const fc = await getForecast(place);
      await send(chatId, forecastPost(fc, place.n));
    } catch (e) {
      await send(chatId, 'Не смог получить погоду, попробуй ещё раз чуть позже.');
    }
    return ok();
  } catch (e) {
    return new Response('err: ' + ((e as Error)?.message || e), { status: 200 });
  }
});
