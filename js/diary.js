'use strict';
// ═══ ДНЕВНИК ═════════════════════════════════════════════════════════════════
// Улов пишется ПО КАЖДОЙ РЫБЕ с её весом. Итог программа суммирует сама.
// weight === null → «не взвешивал» (для мелочи пачкой считаем только штуки).
import { uid } from './state.js';
import { byId } from './data.js';

const KEY = 'zorka_diary';

export function getEntries() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { return []; }
}
function save(list) { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) {} }

export function entryByDate(date) { return getEntries().find(e => e.date === date); }

// entry: {date, spot, visited, catches:[{species, weight|null}], note, rating, forecast}
export function upsertEntry(entry) {
  const list = getEntries();
  const i = list.findIndex(e => e.id === entry.id || (entry.date && e.date === entry.date));
  if (i >= 0) list[i] = { ...list[i], ...entry, id: list[i].id };
  else list.unshift({ id: uid(), ...entry });
  list.sort((a, b) => (a.date < b.date ? 1 : -1));
  save(list);
  return list;
}

export function deleteEntry(id) { save(getEntries().filter(e => e.id !== id)); }

// суммарный вес улова записи (только взвешенные)
export function entryWeight(entry) {
  return (entry.catches || []).reduce((s, c) => s + (c.weight || 0), 0);
}
export function entryCount(entry) { return (entry.catches || []).length; }

export function stats() {
  const list = getEntries();
  const trips = list.filter(e => e.visited);
  const withCatch = trips.filter(e => (e.catches || []).length > 0);
  let fishCount = 0, totalG = 0, ratingSum = 0, ratingN = 0;
  const bySpecies = {};
  for (const e of list) {
    for (const c of (e.catches || [])) {
      fishCount++;
      totalG += c.weight || 0;
      const f = byId(c.species);
      const nm = f ? f.n : c.species;
      bySpecies[nm] = (bySpecies[nm] || 0) + 1;
    }
    if (e.visited && e.rating) { ratingSum += e.rating; ratingN++; }
  }
  const topSpecies = Object.entries(bySpecies).sort((a, b) => b[1] - a[1]).slice(0, 5);
  return {
    trips: trips.length,
    withCatch: withCatch.length,
    fishCount,
    totalG,
    totalKg: Math.round(totalG / 100) / 10, // для показа в кг
    avgRating: ratingN ? Math.round(ratingSum / ratingN * 10) / 10 : null,
    topSpecies,
  };
}
