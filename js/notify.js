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

// уведомление о нерестовом запрете — только когда он реально действует (по региону+датам)
export function ensureBan(ban, year) {
  if (!ban) return;
  const id = ban.generic ? `ban-${year}-generic` : `ban-${year}-${ban.zone}`;
  const title = ban.generic ? '🚫 Нерестовые ограничения (сезон)' : '🚫 Нерестовый запрет';
  const body = ban.generic
    ? `Примерно с ${ban.fromLabel} по ${ban.toLabel} в большинстве регионов РФ действует нерестовый запрет. ${ban.rules} Точные даты и правила твоего района — на сайте рыбоохраны.`
    : `${ban.name}: запрет с ${ban.fromLabel} по ${ban.toLabel}. ${ban.rules} Проверь актуальные официальные правила своего района — даты и границы участков могут отличаться.`;
  addNotif({ id, kind: 'ban', title, body });
}

// приветствие при первом запуске (добавляется один раз)
export function ensureWelcome() {
  addNotif({
    id: 'welcome',
    kind: 'welcome',
    title: '👋 Добро пожаловать в Зорьку!',
    body: 'Рады видеть тебя у воды 🎣 Здесь ты каждый день узнаёшь, что клюёт, когда и на что — '
      + 'по погоде, давлению, воде и луне. Веди дневник уловов, отмечай места, делись трофеями. '
      + 'Пусть каждая рыбалка будет в радость. Ни хвоста ни чешуи!',
  });
}
