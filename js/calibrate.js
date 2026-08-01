'use strict';
// ═══ КАЛИБРОВКА ПРОГНОЗА ПО РЕАЛЬНЫМ УЛОВАМ ══════════════════════════════════
// Первый слой «обучения на данных»: движок (score.js) даёт балл по правилам,
// а сообщество ПОДТВЕРЖДАЕТ его реальными уловами рядом. Мы не искажаем честный
// балл — но помечаем виды, которых реально ловят рядом в последние недели, и при
// РАВНОМ балле поднимаем подтверждённые выше. Чистая логика (тестируется).
import { haversineKm } from './geo.js';

// Сигнал сообщества по видам рядом: Map(species -> {count, lastTs, lures}).
// Берём реальные уловы в радиусе maxKm за последние windowDays дней.
export function nearbySignal(trips, lat, lon, opts = {}) {
  const maxKm = opts.maxKm != null ? opts.maxKm : 60;
  const windowDays = opts.windowDays != null ? opts.windowDays : 21;
  const now = opts.now != null ? opts.now : Date.now();
  const from = now - windowDays * 86400000;
  const sig = new Map();
  if (lat == null || lon == null) return sig;
  for (const t of (trips || [])) {
    if (!t || t.lat == null || t.lon == null) continue;
    const ts = t.caught_at ? new Date(t.caught_at).getTime() : NaN;
    if (!(ts >= from && ts <= now + 86400000)) continue;
    if (haversineKm(lat, lon, t.lat, t.lon) > maxKm) continue;
    for (const f of (t.fish || [])) {
      if (!f || !f.species) continue;
      const s = sig.get(f.species) || { species: f.species, count: 0, lastTs: 0, lures: {} };
      s.count++; if (ts > s.lastTs) s.lastTs = ts;
      if (f.lure) s.lures[f.lure] = (s.lures[f.lure] || 0) + 1;
      sig.set(f.species, s);
    }
  }
  return sig;
}

// Применить сигнал к списку рыб прогноза. Возвращает НОВЫЙ массив с полями:
//   confirmed  — реально ловят рядом (count >= minCount),
//   confCount  — сколько уловов,
//   confLure   — ходовая приманка по этим уловам.
// Тай-брейк: при равном целом балле подтверждённые сообществом идут выше.
export function calibrate(fish, signal, opts = {}) {
  const minCount = opts.minCount != null ? opts.minCount : 1;
  const out = (fish || []).map(f => {
    const s = (signal && signal.get) ? signal.get(f.id) : null;
    const confirmed = !!(s && s.count >= minCount);
    const topLure = s ? Object.entries(s.lures).sort((a, b) => b[1] - a[1])[0] : null;
    return { ...f, confirmed, confCount: confirmed ? s.count : 0, confLure: topLure ? topLure[0] : null };
  });
  out.sort((a, b) =>
    (b.sc - a.sc) ||
    (Number(b.confirmed) - Number(a.confirmed)) ||
    (b.confCount - a.confCount)
  );
  return out;
}
