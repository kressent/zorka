'use strict';
// ═══ ЛИЧНЫЕ РЕКОРДЫ РЫБАКА ════════════════════════════════════════════════════
// Чистая логика (тестируется): из дневника считаем личные рекорды и итоги сезона.
import { byId, isTrophy } from './data.js';

export function personalRecords(entries) {
  const list = entries || [];
  const biggest = {}, lureCount = {}, speciesCount = {};
  let totalFish = 0, totalG = 0, trophies = 0;
  const days = new Set();
  for (const e of list) {
    const cs = e.catches || [];
    if (cs.length && e.date) days.add(e.date);
    for (const c of cs) {
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
    speciesCount: Object.keys(speciesCount).length,
    favLure: favLure ? { lure: favLure[0], n: favLure[1] } : null,
    topSpecies: topSpecies ? { species: topSpecies[0], name: (byId(topSpecies[0]) || {}).n || topSpecies[0], n: topSpecies[1] } : null,
    personalBest: pb ? { ...pb, name: (byId(pb.species) || {}).n || pb.species } : null,
    biggest,
  };
}
