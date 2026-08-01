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

// окна периодов (в днях) для лидербордов
export const PERIOD_DAYS = { week: 7, month: 30, season: 90 };
export const PERIOD_LABEL = { week: 'недели', month: 'месяца', season: 'сезона' };

// топ выездов за период (week|month|season); now — метка времени (для тестов).
// Ранжирование: признание (лайки) → крупнейшая рыба → свежесть.
export function periodTop(trips, period = 'week', now = Date.now(), n = 3) {
  const days = PERIOD_DAYS[period] || 7;
  const from = now - days * 24 * 3600 * 1000;
  const to = now + 24 * 3600 * 1000;           // «сегодня» включительно
  const inP = (trips || []).filter(t => {
    const ts = (t && t.caught_at) ? new Date(t.caught_at).getTime() : NaN;
    return ts >= from && ts <= to;
  });
  inP.sort((a, b) =>
    (Number(b.likes || 0) - Number(a.likes || 0)) ||
    (tripMaxWeight(b) - tripMaxWeight(a)) ||
    (new Date(b.caught_at || 0).getTime() - new Date(a.caught_at || 0).getTime())
  );
  return inP.slice(0, n);
}

// топ выездов за последние 7 дней (обёртка для обратной совместимости)
export function weekTop(trips, now = Date.now(), n = 3) {
  return periodTop(trips, 'week', now, n);
}
