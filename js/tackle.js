'use strict';
// ═══ СНАСТИ ══════════════════════════════════════════════════════════════════
// Комплекты + учёт остатка приманок с напоминанием докупить.
import { uid } from './state.js';

const KEY = 'zorka_tackle';

export function getKits() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { return []; }
}
function save(list) { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) {} }
export function replaceKits(list) { save(Array.isArray(list) ? list : []); }

// kit: {id, name, icon, rod, reel, line, target:[ids], lures:[{name,type,color,qty,minQty}]}
export function upsertKit(kit) {
  const list = getKits();
  const i = list.findIndex(k => k.id === kit.id);
  if (i >= 0) list[i] = kit; else list.push({ id: uid(), ...kit });
  save(list);
  return list;
}
export function deleteKit(id) { save(getKits().filter(k => k.id !== id)); }

export function adjustLure(kitId, lureIdx, delta) {
  const list = getKits();
  const k = list.find(x => x.id === kitId);
  if (k && k.lures && k.lures[lureIdx]) {
    const l = k.lures[lureIdx];
    l.qty = Math.max(0, (l.qty || 0) + delta);
    save(list);
  }
  return list;
}

export function lowStock(kit) {
  return (kit.lures || []).filter(l => l.qty !== undefined && l.qty <= (l.minQty ?? 1));
}

// рекомендация комплекта под топ-рыбу дня
// комплект, заточенный под конкретный вид (по target) — для детали рыбы
export function kitForSpecies(id) {
  return getKits().find(k => (k.target || []).includes(id)) || null;
}

export function recommendKit(topFish) {
  const kits = getKits();
  if (!kits.length || !topFish || !topFish.length) return null;
  const active = topFish.filter(f => f.sc >= 2).slice(0, 3);
  let best = null, bestScore = -1;
  for (const kit of kits) {
    let s = 0;
    for (const f of active) if (kit.target && kit.target.includes(f.id)) s += f.sc;
    if (s > bestScore) { bestScore = s; best = kit; }
  }
  return best || kits[0];
}
