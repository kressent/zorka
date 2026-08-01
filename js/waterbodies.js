'use strict';
// ═══ ВОДОЁМЫ ═════════════════════════════════════════════════════════════════
// Кластеризуем уловы сообщества в «водоёмы» по близости (ячейки ~5 км) — чтобы
// показать список мест с тем, что там ловят. Чистая логика (тестируется).
// Часть killer-фичи «рыба по водоёму».

const CELL = 0.05; // ~5.5 км по широте

export function clusterWaters(trips) {
  const cl = {};
  for (const t of (trips || [])) {
    if (!t || t.lat == null || t.lon == null) continue;
    // группируем по названию водоёма (рыбак его пишет), иначе — по ячейке ~5 км
    const key = (t.water_name && String(t.water_name).trim())
      ? 'n:' + String(t.water_name).trim().toLowerCase()
      : 'g:' + (Math.round(t.lat / CELL) * CELL).toFixed(2) + ',' + (Math.round(t.lon / CELL) * CELL).toFixed(2);
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
