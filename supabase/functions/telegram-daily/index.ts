// ═══ НА КРЮЧКЕ · утренний дайджест в Telegram-канал (по cron) ═══════════════
// Supabase Edge Function (Deno). Вызывается по расписанию (021_telegram_cron.sql),
// считает прогноз по водоёмам Башкирии и постит ОДИН дайджест в канал.
// Секреты: TELEGRAM_BOT_TOKEN, TELEGRAM_CHANNEL (@username или chat_id).
import { computeForecast } from './lib/score.js';
import { forecastDigest } from './lib/postgen.js';

const TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')!;
const CHANNEL = Deno.env.get('TELEGRAM_CHANNEL')!;
const BOT = Deno.env.get('TELEGRAM_BOT_USERNAME') || '@nakryuchke_fish_bot';

const PLACES = [
  { name: 'Павловское вдхр', lat: 55.42, lon: 56.65 },
  { name: 'Нугушское вдхр',  lat: 53.02, lon: 56.50 },
  { name: 'Белая · Салават', lat: 53.36, lon: 55.92 },
  { name: 'Озеро Аслыкуль',  lat: 54.30, lon: 54.58 },
  { name: 'Белая · Уфа',     lat: 54.74, lon: 55.97 },
];
const MONTHS = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];

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
async function forecastFor(p: any) {
  const r = await fetch(buildUrl(p.lat, p.lon)); const data = await r.json();
  try { const h = await fetch(historyUrl(p.lat, p.lon)); const hj = await h.json();
    data.history = { time: hj.daily.time, precip: hj.daily.precipitation_sum, tmax: hj.daily.temperature_2m_max, tmin: hj.daily.temperature_2m_min };
  } catch { /* без истории */ }
  return computeForecast(data, { filter: 'all', todayIdx: todayIndex(data), lat: p.lat, lon: p.lon });
}

Deno.serve(async () => {
  try {
    const items: any[] = [];
    for (const p of PLACES) {
      try { items.push({ place: p.name, fc: await forecastFor(p) }); } catch { /* пропуск точки */ }
    }
    const d = new Date();
    const text = forecastDigest(items, { dateLabel: `${d.getDate()} ${MONTHS[d.getMonth()]}`, bot: BOT });
    const r = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CHANNEL, text, disable_web_page_preview: true }),
    });
    const j = await r.json();
    return new Response(j.ok ? 'sent' : 'err: ' + JSON.stringify(j), { status: 200 });
  } catch (e) {
    return new Response('err: ' + ((e as Error)?.message || e), { status: 200 });
  }
});
