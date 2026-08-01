// ═══ ЗОРЬКА · отправка пуша при новом лайке/комментарии ═════════════════════
// Supabase Edge Function (Deno). Вызывается Database Webhook при INSERT в
// trip_comments / trip_likes. Находит владельца выезда (префикс trip_key = его
// uuid), берёт его push-подписки и шлёт уведомление. Свои действия не шлёт.
//
// Деплой и настройка — в docs/PUSH-SETUP.md. Нужны секреты функции:
//   VAPID_PUBLIC, VAPID_PRIVATE  (сгенерировать), и стандартные SUPABASE_URL /
//   SUPABASE_SERVICE_ROLE_KEY (проставляются автоматически).
import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2';

const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC')!;
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE')!;
const SUPA_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

webpush.setVapidDetails('mailto:admin@zorka.app', VAPID_PUBLIC, VAPID_PRIVATE);
const db = createClient(SUPA_URL, SERVICE);

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    const rec = payload.record || payload;
    const table = payload.table || '';
    const tripKey: string = rec.trip_key;
    if (!tripKey) return new Response('no trip_key', { status: 200 });

    const owner = String(tripKey).split(':')[0];
    if (owner === rec.user_id) return new Response('self', { status: 200 }); // свой лайк/коммент — не шлём

    const { data: subs } = await db.from('push_subscriptions').select('*').eq('user_id', owner);
    if (!subs || !subs.length) return new Response('no subs', { status: 200 });

    const isComment = table === 'trip_comments';
    const body = JSON.stringify({
      title: isComment ? '💬 Новый комментарий' : '❤️ Твой улов оценили',
      body: isComment ? 'Кто-то прокомментировал твой улов в «На крючке» 🎣' : 'Твой улов получил лайк 🎣',
      url: './',
    });

    await Promise.all(subs.map((s: any) =>
      webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body)
        .catch(async (err: any) => {
          if (err?.statusCode === 404 || err?.statusCode === 410) {
            await db.from('push_subscriptions').delete().eq('endpoint', s.endpoint); // подписка мертва — убрать
          }
        })
    ));
    return new Response('ok', { status: 200 });
  } catch (e) {
    return new Response('err: ' + ((e as Error)?.message || e), { status: 200 });
  }
});
