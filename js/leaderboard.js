'use strict';
// ═══ ЛИДЕРБОРД «Улов недели» ═════════════════════════════════════════════════
// Чистая логика без сети (тестируется в node): из выездов ленты берём последние
// 7 дней и ранжируем по признанию (лайки) → крупнейшей рыбе → свежести.
// Пока лайков мало — наверх всё равно попадёт самый крупный улов недели.

// самый тяжёлый вес рыбы в выезде (0, если не взвешивали)
export function tripMaxWeight(trip) {
  const ws = ((trip && trip.fish) || []).map(f => Number(f && f.weight) || 0);
  return ws.length ? Math.max(...ws) : 0;
}

// самая крупная рыба выезда {species, weight} | null
export function tripHeaviest(trip) {
  const fish = ((trip && trip.fish) || []).filter(f => f && f.species);
  if (!fish.length) return null;
  return fish.reduce((a, b) => ((Number(b.weight) || 0) > (Number(a.weight) || 0) ? b : a));
}

// топ выездов за последние 7 дней; now — метка времени (для тестов)
export function weekTop(trips, now = Date.now(), n = 3) {
  const from = now - 7 * 24 * 3600 * 1000;
  const to = now + 24 * 3600 * 1000;           // «сегодня» включительно
  const inWeek = (trips || []).filter(t => {
    const ts = (t && t.caught_at) ? new Date(t.caught_at).getTime() : NaN;
    return ts >= from && ts <= to;
  });
  inWeek.sort((a, b) =>
    (Number(b.likes || 0) - Number(a.likes || 0)) ||
    (tripMaxWeight(b) - tripMaxWeight(a)) ||
    (new Date(b.caught_at || 0).getTime() - new Date(a.caught_at || 0).getTime())
  );
  return inWeek.slice(0, n);
}
