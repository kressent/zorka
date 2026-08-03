// ═══ НА КРЮЧКЕ · сводка аналитики (для владельца) ══════════════════════════
// Supabase Edge Function (Deno). Служебным ключом читает агрегаты + активность
// по пользователям и отдаёт JSON. Защищена секретом (заголовок x-stats-secret).
// Секреты: STATS_SECRET (+ SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY автоматом).
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPA_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SECRET = Deno.env.get('STATS_SECRET') || '';
const db = createClient(SUPA_URL, SERVICE);

Deno.serve(async (req) => {
  try {
    if (SECRET && req.headers.get('x-stats-secret') !== SECRET) return new Response('forbidden', { status: 401 });
    const [totals, daily, users, cat, trips, fb] = await Promise.all([
      db.from('event_totals').select('*'),
      db.from('event_daily').select('*').limit(21),
      db.from('user_activity').select('*').limit(100),
      db.from('catches').select('id', { count: 'exact', head: true }),
      db.from('co_trips').select('id', { count: 'exact', head: true }),
      db.from('feedback').select('id', { count: 'exact', head: true }),
    ]);
    return Response.json({
      totals: totals.data || [],
      daily: daily.data || [],
      users: users.data || [],
      catches: cat.count ?? 0,
      co_trips: trips.count ?? 0,
      feedback: fb.count ?? 0,
    });
  } catch (e) {
    return new Response('err: ' + ((e as Error)?.message || e), { status: 200 });
  }
});
