// ═══ НА КРЮЧКЕ · утренний пуш «завтра жор» по прогнозу ══════════════════════
// Supabase Edge Function (Deno). Запускается по расписанию (cron, см.
// 020_forecast_cron.sql). Для каждой push-подписки с сохранённой точкой считает
// прогноз тем же движком, что и клиент (lib/*.js — копия js/*.js через
// tools/bundle-push.js), и если ВПЕРЕДИ сильный день лучше сегодняшнего —
// шлёт «собирайся». Не чаще раза в день на устройство (last_fpush).
//
// Деплой и cron — в docs/PUSH-SETUP.md. Секреты: VAPID_PUBLIC, VAPID_PRIVATE
// (+ SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY проставляются автоматически).
import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { computeForecast } from './lib/score.js';
import { goodDayAlert } from './lib/forecastAlert.js';

const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC')!;
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE')!;
const SUPA_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

webpush.setVapidDetails('mailto:admin@zorka.app', VAPID_PUBLIC, VAPID_PRIVATE);
const db = createClient(SUPA_URL, SERVICE);

// URL Open-Meteo — те же параметры, что в js/weather.js
function buildUrl(lat: number, lon: number) {
  return 'https://api.open-meteo.com/v1/forecast'
    + '?latitude=' + lat + '&longitude=' + lon
    + '&hourly=temperature_2m,precipitation_probability,precipitation,cloudcover,'
    + 'pressure_msl,windspeed_10m,winddirection_10m,weathercode'
    + '&daily=temperature_2m_max,temperature_2m_min,weathercode,precipitation_sum,'
    + 'winddirection_10m_dominant,sunrise,sunset'
    + '&past_days=2&forecast_days=14&timezone=auto';
}
function historyUrl(lat: number, lon: number) {
  return 'https://api.open-meteo.com/v1/forecast'
    + '?latitude=' + lat + '&longitude=' + lon
    + '&daily=precipitation_sum,temperature_2m_max,temperature_2m_min'
    + '&past_days=60&forecast_days=1&timezone=auto';
}
function todayIndex(data: any) {
  try { const t = new Date().toISOString().slice(0, 10); const i = data.daily.time.indexOf(t); return i >= 0 ? i : 2; }
  catch { return 2; }
}

Deno.serve(async () => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const { data: subs } = await db.from('push_subscriptions').select('*').not('lat', 'is', null);
    if (!subs || !subs.length) return new Response('no subs', { status: 200 });

    // группируем устройства по округлённой точке (не дёргаем Open-Meteo лишний раз)
    const groups = new Map<string, any[]>();
    for (const s of subs) {
      if (s.last_fpush === today) continue;               // уже слали сегодня — пропуск
      const key = Number(s.lat).toFixed(2) + ',' + Number(s.lon).toFixed(2);
      const arr = groups.get(key); if (arr) arr.push(s); else groups.set(key, [s]);
    }

    let sent = 0;
    for (const [key, list] of groups) {
      const [la, lo] = key.split(',').map(Number);
      let data: any;
      try {
        const r = await fetch(buildUrl(la, lo)); if (!r.ok) continue; data = await r.json();
        try {
          const h = await fetch(historyUrl(la, lo)); const hj = await h.json();
          data.history = { time: hj.daily.time, precip: hj.daily.precipitation_sum, tmax: hj.daily.temperature_2m_max, tmin: hj.daily.temperature_2m_min };
        } catch { /* без истории движок работает на коротком окне */ }
      } catch { continue; }

      const idx = todayIndex(data);
      let fc: any; try { fc = computeForecast(data, { todayIdx: idx, lat: la, lon: lo }); } catch { continue; }

      // «завтра/послезавтра жор»: сильный день впереди и лучше сегодняшнего
      const alert = goodDayAlert(fc.upcoming, fc.day.score, { minScore: 4.2, horizon: 2 });
      if (!alert) continue;

      const body = JSON.stringify({ title: '🔥 Скоро отличный клёв', body: alert.body, url: './' });
      for (const s of list) {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body);
          await db.from('push_subscriptions').update({ last_fpush: today }).eq('endpoint', s.endpoint);
          sent++;
        } catch (err: any) {
          if (err?.statusCode === 404 || err?.statusCode === 410) await db.from('push_subscriptions').delete().eq('endpoint', s.endpoint);
        }
      }
    }
    return new Response('sent ' + sent, { status: 200 });
  } catch (e) {
    return new Response('err: ' + ((e as Error)?.message || e), { status: 200 });
  }
});
