'use strict';
// Ежедневный постер: считает прогноз по PLACES и постит в Telegram-канал.
// Запуск по расписанию (cron/Планировщик задач Windows) — напр. в 18:00.
//   node bot/daily.js          # постит в канал (нужны ZORKA_BOT_TOKEN, ZORKA_CHANNEL)
//   node bot/daily.js --dry    # печатает в консоль, ничего не отправляет (тест)
import { getForecast } from './forecast.js';
import { forecastPost } from '../js/postgen.js';
import { PLACES } from './places.js';

const TOKEN = process.env.ZORKA_BOT_TOKEN;
const CHANNEL = process.env.ZORKA_CHANNEL;      // @username канала или числовой chat_id
const dry = process.argv.includes('--dry');

async function send(chat, text) {
  const r = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chat, text, disable_web_page_preview: true }),
  });
  const j = await r.json();
  if (!j.ok) throw new Error(JSON.stringify(j));
}

if (!dry && (!TOKEN || !CHANNEL)) {
  console.error('Нужны переменные окружения ZORKA_BOT_TOKEN и ZORKA_CHANNEL. Или запусти с --dry.');
  process.exit(1);
}

for (const p of PLACES) {
  try {
    const fc = await getForecast(p);
    const text = forecastPost(fc, p.name);
    if (dry) console.log('\n===== ' + p.name + ' =====\n' + text + '\n');
    else { await send(CHANNEL, text); console.log('✓ отправлено:', p.name); }
  } catch (e) {
    console.error('✗ ошибка для', p.name, '—', e.message);
  }
}
