'use strict';
// ═══ УВЕДОМЛЕНИЯ ═════════════════════════════════════════════════════════════
// Внутри-приложенческий центр уведомлений (колокольчик + список). Нерест-запреты,
// жор, важное по водоёму. Позже сюда же будут вести push (при HTTPS + сервере).
const KEY = 'zorka_notifs';

export function getNotifs() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { return []; }
}
function save(l) { try { localStorage.setItem(KEY, JSON.stringify(l)); } catch (e) {} }

export function unread() { return getNotifs().filter(n => !n.read).length; }

export function markAllRead() { const l = getNotifs(); let ch = false; l.forEach(n => { if (!n.read) { n.read = true; ch = true; } }); if (ch) save(l); }

// добавить уведомление (идемпотентно по id)
export function addNotif(n) {
  const l = getNotifs();
  if (l.find(x => x.id === n.id)) return;
  l.unshift({ read: false, at: Date.now(), ...n });
  save(l.slice(0, 50));
}

// раз в месяц завести уведомление о нересте, если он идёт
export function ensureSpawn(spawning, month, year) {
  if (!spawning || !spawning.length) return;
  addNotif({
    id: `spawn-${year}-${month}`,
    kind: 'spawn',
    title: '🚫 Нерестовый запрет',
    body: 'Идёт нерест: ' + spawning.map(f => f.n.toLowerCase()).join(', ')
      + '. Во многих регионах ограничения: одна удочка или донка, не более 2 крючков; '
      + 'спиннинг и ловля с лодки запрещены. Проверь правила своего региона.',
  });
}
