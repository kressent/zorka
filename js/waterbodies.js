'use strict';
// ═══ ВОДОЁМЫ ═════════════════════════════════════════════════════════════════
// Кластеризуем уловы сообщества в «водоёмы» по близости (ячейки ~5 км) — чтобы
// показать список мест с тем, что там ловят. Чистая логика (тестируется).
// Часть killer-фичи «рыба по водоёму».

const CELL = 0.05; // ~5.5 км по широте

// ключ группировки: по названию водоёма, иначе по ячейке ~5 км
function waterKey(t) {
  return (t.water_name && String(t.water_name).trim())
    ? 'n:' + String(t.water_name).trim().toLowerCase()
    : 'g:' + (Math.round(t.lat / CELL) * CELL).toFixed(2) + ',' + (Math.round(t.lon / CELL) * CELL).toFixed(2);
}

const MONTHS_SHORT = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];
function bestMonthIdx(m) { let bi = -1, bv = 0; for (let i = 0; i < 12; i++) if (m[i] > bv) { bv = m[i]; bi = i; } return bi; }
function topMonths(m, n = 3) {
  return m.map((v, i) => ({ i, v })).filter(x => x.v > 0).sort((a, b) => b.v - a.v)
    .slice(0, n).map(x => ({ month: x.i, label: MONTHS_SHORT[x.i], count: x.v }));
}
export { MONTHS_SHORT };

// профиль одного водоёма (по key из clusterWaters):
// виды (с ходовой приманкой, крупнейшим весом, лучшим месяцем), лучшие месяцы, статистика.
// Чистая логика (тестируется). Сердце killer-фичи «рыба по водоёму».
export function waterProfile(trips, key) {
  const sel = (trips || []).filter(t => t && t.lat != null && t.lon != null && waterKey(t) === key);
  if (!sel.length) return null;
  const bySp = {}; const months = new Array(12).fill(0); const users = new Set(); const names = {};
  let lat = sel[0].lat, lon = sel[0].lon;
  for (const t of sel) {
    if (t.user_id) users.add(t.user_id);
    if (t.water_name) names[t.water_name] = (names[t.water_name] || 0) + 1;
    const m = t.caught_at ? new Date(t.caught_at).getMonth() : null;
    for (const f of (t.fish || [])) {
      if (!f || !f.species) continue;
      const s = bySp[f.species] || (bySp[f.species] = { species: f.species, count: 0, lures: {}, maxW: 0, months: new Array(12).fill(0) });
      s.count++;
      if (f.lure) s.lures[f.lure] = (s.lures[f.lure] || 0) + 1;
      const w = Number(f.weight) || 0; if (w > s.maxW) s.maxW = w;
      if (m != null) { s.months[m]++; months[m]++; }
    }
  }
  const species = Object.values(bySp).map(s => {
    const top = Object.entries(s.lures).sort((a, b) => b[1] - a[1])[0];
    const bi = bestMonthIdx(s.months);
    return { species: s.species, count: s.count, topLure: top ? top[0] : null,
             maxW: s.maxW || null, bestMonth: bi >= 0 ? MONTHS_SHORT[bi] : null };
  }).sort((a, b) => b.count - a.count);
  const topName = Object.entries(names).sort((a, b) => b[1] - a[1])[0];
  return {
    key, lat, lon, name: topName ? topName[0] : 'Без названия',
    trips: sel.length, anglers: users.size,
    species, months, bestMonths: topMonths(months, 3),
  };
}

export function clusterWaters(trips) {
  const cl = {};
  for (const t of (trips || [])) {
    if (!t || t.lat == null || t.lon == null) continue;
    const key = waterKey(t); // по названию водоёма, иначе по ячейке ~5 км
    const c = cl[key] || (cl[key] = { lat: t.lat, lon: t.lon, names: {}, species: {}, count: 0 });
    c.count++;
    if (t.water_name) c.names[t.water_name] = (c.names[t.water_name] || 0) + 1;
    for (const f of (t.fish || [])) { if (f && f.species) c.species[f.species] = (c.species[f.species] || 0) + 1; }
  }
  return Object.entries(cl).map(([key, c]) => {
    const topName = Object.entries(c.names).sort((a, b) => b[1] - a[1])[0];
    return {
      key, lat: c.lat, lon: c.lon, count: c.count,
      name: topName ? topName[0] : 'Без названия',
      species: Object.entries(c.species).sort((a, b) => b[1] - a[1]).map(([s, n]) => ({ species: s, count: n })),
    };
  }).sort((a, b) => b.count - a.count);
}
