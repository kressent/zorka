'use strict';
// ═══ СИНХРОНИЗАЦИЯ ═══════════════════════════════════════════════════════════
// Дневник/места/снасти живут локально (быстро, офлайн), а при входе в аккаунт
// зеркалятся в облако одним документом. Правило: "последнее изменение выигрывает"
// по времени — для одного пользователя на своих устройствах этого достаточно.
// Любая ошибка сети не ломает приложение: локальные данные — источник правды.
import * as Cloud from './cloud.js';
import { cloudEnabled } from './config.js';

const UPD = 'zorka_updated_at';
export const localUpdatedAt = () => Number(localStorage.getItem(UPD) || 0);
const setLocalT = (t) => { try { localStorage.setItem(UPD, String(t)); } catch (e) {} }
export const markDirty = () => setLocalT(Date.now());

let _cb = null;                 // колбэк для обновления UI после синка
export const onSynced = (cb) => { _cb = cb; };
const notify = (how) => { try { if (_cb) _cb(how); } catch (e) {} };

function snapshot() {
  const read = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
  return { diary: read('zorka_diary') || [], places: read('zorka_places') || [], tackle: read('zorka_tackle') || [] };
}
function applySnapshot(d) {
  try {
    if (d.diary)  localStorage.setItem('zorka_diary',  JSON.stringify(d.diary));
    if (d.places) localStorage.setItem('zorka_places', JSON.stringify(d.places));
    if (d.tackle) localStorage.setItem('zorka_tackle', JSON.stringify(d.tackle));
  } catch (e) {}
}

async function push() {
  if (!cloudEnabled() || !Cloud.cachedUser()) return;
  const iso = await Cloud.pushData(snapshot());
  if (iso) setLocalT(Date.parse(iso));
}

// при входе/загрузке: подтянуть облако или залить локальное (что новее)
export async function syncOnLogin() {
  if (!cloudEnabled() || !Cloud.cachedUser()) return;
  try {
    const remote = await Cloud.pullData();               // {data, updated_at} | null
    const localT = localUpdatedAt();
    const remoteT = remote && remote.updated_at ? Date.parse(remote.updated_at) : 0;
    if (remote && remote.data && remoteT >= localT) {
      applySnapshot(remote.data); setLocalT(remoteT); notify('pulled');
    } else {
      await push(); notify('pushed');
    }
  } catch (e) { console.warn('sync:', e.message); }
}

// дебаунс-пуш после локальных изменений
let _t = null;
export function pushSoon() {
  markDirty();                                           // всегда фиксируем локальное время
  if (!cloudEnabled() || !Cloud.cachedUser()) return;
  clearTimeout(_t);
  _t = setTimeout(() => { push().then(() => notify('pushed')).catch(e => console.warn('push:', e.message)); }, 1500);
}

// ручная синхронизация (кнопка в аккаунте)
export async function syncNow() {
  if (!cloudEnabled() || !Cloud.cachedUser()) throw new Error('Сначала войди в аккаунт');
  await push();
  const remote = await Cloud.pullData();
  if (remote && remote.data) { applySnapshot(remote.data); if (remote.updated_at) setLocalT(Date.parse(remote.updated_at)); }
  notify('synced');
}
