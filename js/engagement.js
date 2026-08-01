'use strict';
// ═══ УВЕДОМЛЕНИЯ СООБЩЕСТВА ═══════════════════════════════════════════════════
// Чистая логика (тестируется): сравнивает текущее число лайков/комментариев на
// МОИХ выездах с тем, что видели в прошлый раз, и делает список уведомлений о
// приросте. Первый прогон — только запоминает базу, без спама.
import { byId } from './data.js';
import { tripHeaviest } from './leaderboard.js';

function plural(n, a, b, c) {
  const m = n % 10, d = n % 100;
  if (m === 1 && d !== 11) return a;
  if (m >= 2 && m <= 4 && (d < 10 || d >= 20)) return b;
  return c;
}

// mine — мои выезды из ленты [{id, likes, comments, water_name, fish}]
// seen — прошлый снимок { [tripId]: {likes, comments} }
// → { notifs:[{id,kind,title,body}], next:{...} }
export function engagementNotifs(mine, seen) {
  const notifs = [], next = {};
  for (const t of (mine || [])) {
    const likes = Number(t.likes) || 0, comments = Number(t.comments) || 0;
    next[t.id] = { likes, comments };
    const prev = seen && seen[t.id];
    if (!prev) continue;                         // первый раз — только базовая отметка
    const hf = tripHeaviest(t);
    const nm = hf ? ((byId(hf.species) || {}).n || hf.species) : 'улов';
    const where = t.water_name ? ' · ' + t.water_name : '';
    if (likes > (prev.likes || 0)) {
      notifs.push({ id: `like-${t.id}-${likes}`, kind: 'like', trip: t.id,
        title: '❤️ Твой улов оценили',
        body: `«${nm}»${where} — уже ${likes} ${plural(likes, 'лайк', 'лайка', 'лайков')}. Так держать!` });
    }
    if (comments > (prev.comments || 0)) {
      notifs.push({ id: `cm-${t.id}-${comments}`, kind: 'comment', trip: t.id,
        title: '💬 Новый комментарий',
        body: `к твоему улову «${nm}»${where}. Нажми, чтобы прочитать и ответить.` });
    }
  }
  return { notifs, next };
}
