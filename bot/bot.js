'use strict';
// Telegram-бот «На крючке»: отвечает прогнозом на название города/водоёма.
// Long-polling, без зависимостей. Запуск:  ZORKA_BOT_TOKEN=xxxxx node bot/bot.js
import { getForecast } from './forecast.js';
import { forecastPost } from '../js/postgen.js';
import { searchCities } from '../js/locations.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// мини-загрузчик .env (без зависимостей): bot/.env → process.env
try {
  const envPath = join(dirname(fileURLToPath(import.meta.url)), '.env');
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch (e) { /* .env нет — берём токен из переменной окружения */ }

const TOKEN = process.env.ZORKA_BOT_TOKEN;
if (!TOKEN) { console.error('Нет ZORKA_BOT_TOKEN. Создай bot/.env со строкой ZORKA_BOT_TOKEN=твой_токен (или задай переменную окружения).'); process.exit(1); }
const API = `https://api.telegram.org/bot${TOKEN}`;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function reply(chatId, text) {
  await fetch(`${API}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
  });
}

const HELLO = 'Привет! Это «На крючке» 🎣\nНапиши город или водоём — дам прогноз клёва на сегодня.\nНапример: «Уфа», «Салават» или «прогноз Казань».';

async function handle(update) {
  const m = update.message;
  if (!m || !m.text) return;
  const text = m.text.trim();
  if (/^\/start/.test(text)) return reply(m.chat.id, HELLO);
  if (/^\/help/.test(text)) return reply(m.chat.id, HELLO);
  const q = text.replace(/^\/?(прогноз|прогноз клёва|прогноз клева)\s*/i, '').trim() || text;
  const city = searchCities(q)[0];
  if (!city) return reply(m.chat.id, 'Не нашёл такой город. Напиши крупный ближайший — например, Уфа или Самара.');
  try {
    const fc = await getForecast({ name: city.n, lat: city.lat, lon: city.lon });
    await reply(m.chat.id, forecastPost(fc, city.n));
  } catch (e) {
    await reply(m.chat.id, 'Не смог получить погоду, попробуй ещё раз чуть позже.');
    console.error(e.message);
  }
}

async function loop() {
  let offset = 0;
  console.log('Бот «На крючке» запущен. Ожидаю сообщения…');
  while (true) {
    try {
      const r = await fetch(`${API}/getUpdates?timeout=30&offset=${offset}`);
      const j = await r.json();
      for (const u of j.result || []) { offset = u.update_id + 1; handle(u).catch(e => console.error(e.message)); }
    } catch (e) {
      console.error('poll:', e.message); await sleep(3000);
    }
  }
}

loop();
