'use strict';
// ═══ ЛИЧНЫЕ РЕКОРДЫ РЫБАКА ════════════════════════════════════════════════════
// Чистая логика (тестируется): из дневника считаем личные рекорды и итоги сезона.
import { byId, isTrophy } from './data.js';

export function personalRecords(entries) {
  const list = entries || [];
  const biggest = {}, lureCount = {}, speciesCount = {};
  let totalFish = 0, totalG = 0, trophies = 0;
  const days = new Set(), waters = new Set(), luresUsed = new Set();
  for (const e of list) {
    const cs = e.catches || [];
    if (cs.length && e.date) days.add(e.date);
    if (e.spot && String(e.spot).trim()) waters.add(String(e.spot).trim().toLowerCase());
    for (const c of cs) {
      if (c.lure) luresUsed.add(String(c.lure).trim().toLowerCase());
      totalFish++;
      totalG += c.weight || 0;
      speciesCount[c.species] = (speciesCount[c.species] || 0) + 1;
      if (c.weight != null) {
        const b = biggest[c.species];
        if (!b || c.weight > b.weight) biggest[c.species] = { weight: c.weight, date: e.date };
      }
      if (c.lure) lureCount[c.lure] = (lureCount[c.lure] || 0) + 1;
      if (isTrophy(c.species, c.weight)) trophies++;
    }
  }
  const favLure = Object.entries(lureCount).sort((a, b) => b[1] - a[1])[0] || null;
  const topSpecies = Object.entries(speciesCount).sort((a, b) => b[1] - a[1])[0] || null;
  let pb = null;
  for (const [sp, b] of Object.entries(biggest)) if (!pb || b.weight > pb.weight) pb = { species: sp, ...b };
  return {
    totalFish, totalG, trophies,
    days: days.size,
    waters: waters.size,
    luresUsed: luresUsed.size,
    speciesCount: Object.keys(speciesCount).length,
    favLure: favLure ? { lure: favLure[0], n: favLure[1] } : null,
    topSpecies: topSpecies ? { species: topSpecies[0], name: (byId(topSpecies[0]) || {}).n || topSpecies[0], n: topSpecies[1] } : null,
    personalBest: pb ? { ...pb, name: (byId(pb.species) || {}).n || pb.species } : null,
    biggest,
  };
}

// «Твой рыболовный год» — итоги за конкретный год для виральной карточки.
// Год-скоуп поверх personalRecords + лучший день и лучший месяц. Чистая логика.
const MONTHS_RU = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
export function fishingYear(entries, year) {
  const y = String(year);
  const sel = (entries || []).filter(e => e && e.date && String(e.date).slice(0, 4) === y);
  const rec = personalRecords(sel);
  const byMonth = new Array(12).fill(0); const byDay = {};
  for (const e of sel) {
    const cs = e.catches || []; if (!cs.length) continue;
    const m = new Date(e.date + 'T12:00:00').getMonth();
    if (m >= 0 && m < 12) byMonth[m] += cs.length;
    const dd = (byDay[e.date] || (byDay[e.date] = { count: 0, g: 0 }));
    dd.count += cs.length; for (const c of cs) dd.g += c.weight || 0;
  }
  let bestDay = null;
  for (const [date, v] of Object.entries(byDay)) if (!bestDay || v.count > bestDay.count) bestDay = { date, ...v };
  let bmi = -1, bmv = 0; for (let i = 0; i < 12; i++) if (byMonth[i] > bmv) { bmv = byMonth[i]; bmi = i; }
  return {
    year: y, ...rec,
    bestDay, byMonth,
    bestMonth: bmi >= 0 ? { month: bmi, name: MONTHS_RU[bmi], count: bmv } : null,
    hasData: sel.some(e => (e.catches || []).length),
  };
}
export { MONTHS_RU };
