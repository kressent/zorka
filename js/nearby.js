'use strict';
// ═══ «ЧТО ЛОВЯТ РЯДОМ» ═══════════════════════════════════════════════════════
// Ядро запроса рыбака: «какая рыба клюёт на этом водоёме». Берём реальные уловы
// сообщества рядом с точкой и агрегируем по видам (+ ходовая приманка).
// Чистая логика (тестируется). Это применение «маховика» к конкретному месту.
import { haversineKm } from './geo.js';

export function nearbyCatches(trips, lat, lon, maxKm = 60) {
  if (lat == null || lon == null) return [];
  const bySp = {};
  for (const t of (trips || [])) {
    if (!t || t.lat == null || t.lon == null) continue;
    if (haversineKm(lat, lon, t.lat, t.lon) > maxKm) continue;
    for (const f of (t.fish || [])) {
      if (!f || !f.species) continue;
      const s = bySp[f.species] || (bySp[f.species] = { species: f.species, count: 0, lures: {} });
      s.count++;
      if (f.lure) s.lures[f.lure] = (s.lures[f.lure] || 0) + 1;
    }
  }
  return Object.values(bySp).map(s => {
    const top = Object.entries(s.lures).sort((a, b) => b[1] - a[1])[0];
    return { species: s.species, count: s.count, topLure: top ? top[0] : null };
  }).sort((a, b) => b.count - a.count);
}

// «где ловится этот вид»: выезды с этим видом рядом, по возрастанию расстояния
export function whereSpecies(trips, species, lat, lon, maxKm = 300) {
  const out = [];
  for (const t of (trips || [])) {
    if (!t || t.lat == null || t.lon == null) continue;
    const fish = (t.fish || []).filter(f => f && f.species === species);
    if (!fish.length) continue;
    const km = (lat != null && lon != null) ? Math.round(haversineKm(lat, lon, t.lat, t.lon)) : null;
    if (km != null && km > maxKm) continue;
    const lure = fish.map(f => f.lure).find(Boolean) || null;
    const w = Math.max(0, ...fish.map(f => Number(f.weight) || 0)) || null;
    out.push({ water_name: t.water_name, lat: t.lat, lon: t.lon, km, lure, weight: w, caught_at: t.caught_at });
  }
  return out.sort((a, b) => (a.km == null ? 1e9 : a.km) - (b.km == null ? 1e9 : b.km));
}
