// ═══ НА КРЮЧКЕ · отзыв из приложения → в Telegram владельцу ═════════════════
// Supabase Edge Function (Deno). Дёргается триггером при INSERT в feedback
// (024_feedback_notify.sql) и шлёт текст отзыва тебе в личку через бота.
// Секреты: TELEGRAM_BOT_TOKEN (+ FEEDBACK_CHAT_ID — твой chat_id, дефолт ниже).

const TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')!;
const CHAT = Deno.env.get('FEEDBACK_CHAT_ID') || '839960248';

Deno.serve(async (req) => {
  try {
    const payload = await req.json().catch(() => ({}));
    const rec = payload.record || payload || {};
    const msg = String(rec.message || '').slice(0, 3500);
    if (!msg) return new Response('no message', { status: 200 });
    const contact = rec.contact ? `\n\n📇 Контакт: ${rec.contact}` : '';
    const who = rec.user_id ? '\n👤 (вошедший в аккаунт)' : '\n🕶 (аноним)';
    const text = `💬 Новый отзыв в «На крючке»:\n\n${msg}${contact}${who}`;
    await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CHAT, text, disable_web_page_preview: true }),
    });
    return new Response('ok', { status: 200 });
  } catch (e) {
    return new Response('err: ' + ((e as Error)?.message || e), { status: 200 });
  }
});
