// ═══ НА КРЮЧКЕ · вечерний авто-пост в канал из банка (по cron) ══════════════
// Supabase Edge Function (Deno). Берёт пост из банка (posts.js) с учётом сезона,
// крутит их по кругу и постит в канал. Дополняет утренний дайджест (telegram-daily).
// Расписание — 022_content_cron.sql. Секреты: TELEGRAM_BOT_TOKEN, TELEGRAM_CHANNEL.
import { POSTS } from './posts.js';

const TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')!;
const CHANNEL = Deno.env.get('TELEGRAM_CHANNEL')!;
const BOT = Deno.env.get('TELEGRAM_BOT_USERNAME') || '@nakryuchke_fish_bot';
const FOOTER = `\n\n🎣 Прогноз клёва на твой водоём — ${BOT}`;

function dayOfYear(d: Date) {
  const start = Date.UTC(d.getUTCFullYear(), 0, 0);
  const now = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return Math.floor((now - start) / 86400000);
}

Deno.serve(async () => {
  try {
    const now = new Date();
    const month = now.getUTCMonth() + 1;
    // сезонный отбор: посты без m — круглогодичные; с m — только в свои месяцы
    const pool = POSTS.filter((p: any) => !p.m || p.m.includes(month));
    if (!pool.length) return new Response('empty pool', { status: 200 });
    const post = pool[dayOfYear(now) % pool.length];

    // мягкий футер, если ссылки/бота ещё нет в тексте
    let text = post.text;
    if (!/kryuchke|zorka|kressent/i.test(text)) text += FOOTER;

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
