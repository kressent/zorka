'use strict';
// Ежедневный постер канала: считает прогноз по PLACES и постит ОДИН дайджест.
// Запуск по расписанию (Планировщик задач Windows / cron) — напр. в 18:00.
//   node bot/daily.js          # постит в канал (нужны ZORKA_BOT_TOKEN, ZORKA_CHANNEL)
//   node bot/daily.js --dry    # печатает в консоль, ничего не отправляет (тест)
// Токен/канал берутся из bot/.env или из переменных окружения.
import { getForecast } from './forecast.js';
import { forecastDigest } from '../js/postgen.js';
import { PLACES } from './places.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// мини-загрузчик .env (без зависимостей)
try {
  const envPath = join(dirname(fileURLToPath(import.meta.url)), '.env');
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch (e) { /* .env нет — берём из окружения */ }

const TOKEN = process.env.ZORKA_BOT_TOKEN;
const CHANNEL = process.env.ZORKA_CHANNEL;   // @username канала или числовой chat_id
const BOT = process.env.ZORKA_BOT_USERNAME || '@nakryuchke_fish_bot';
const dry = process.argv.includes('--dry');

const MONTHS = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
function dateLabel() { const d = new Date(); return `${d.getDate()} ${MONTHS[d.getMonth()]}`; }

async function send(chat, text) {
  const r = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chat, text, disable_web_page_preview: true }),
  });
  const j = await r.json();
  if (!j.ok) throw new Error(JSON.stringify(j));
}

if (!dry && (!TOKEN || !CHANNEL)) {
  console.error('Нужны ZORKA_BOT_TOKEN и ZORKA_CHANNEL (в bot/.env или окружении). Или запусти с --dry.');
  process.exit(1);
}

const items = [];
for (const p of PLACES) {
  try { items.push({ place: p.name, fc: await getForecast(p) }); }
  catch (e) { console.error('✗ прогноз не собрался для', p.name, '—', e.message); }
}

const text = forecastDigest(items, { dateLabel: dateLabel(), bot: BOT });

if (dry) {
  console.log('\n===== ПРЕВЬЮ ДАЙДЖЕСТА (ничего не отправлено) =====\n');
  console.log(text + '\n');
} else {
  await send(CHANNEL, text);
  console.log('✓ дайджест отправлен в', CHANNEL);
}
