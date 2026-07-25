'use strict';
// ═══ ГЕО ═════════════════════════════════════════════════════════════════════
// Расстояние между точками и фильтр ленты «рядом». Чистая логика (тестируется).
// Координаты выездов огрублённые (~1 км) — для «рядом» этого достаточно.

export function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371, toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

// выезды в радиусе maxKm от точки, по возрастанию расстояния; добавляет _km
export function sortByNear(items, lat, lon, maxKm = 200) {
  if (lat == null || lon == null) return items || [];
  return (items || [])
    .map(it => (it && it.lat != null && it.lon != null)
      ? { ...it, _km: Math.round(haversineKm(lat, lon, it.lat, it.lon)) }
      : null)
    .filter(it => it && it._km <= maxKm)
    .sort((a, b) => a._km - b._km);
}
