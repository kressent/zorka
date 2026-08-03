'use strict';
// ═══ ОБУЧЕНИЕ ПРОГНОЗА НА ДАННЫХ (гибрид правила + статистика) ═══════════════
// Движок (score.js) даёт балл по экспертным правилам. Здесь — второй слой: считаем
// статистику по РЕАЛЬНЫМ уловам сообщества под похожие условия (регион + сезон) и
// мягко подмешиваем к баллу. ВЕС растёт с объёмом выборки: мало данных → почти без
// влияния (не шумим), много данных → прогноз подтягивается к реальности.
// Чистая логика (тестируется). Активируется сам по мере накопления уловов.
import { haversineKm } from './geo.js';

// сигнал по видам из реальных уловов: недавние ИЛИ того же месяца, в радиусе региона.
// → { score:{species:0..5}, total, counts }
export function learnSignal(catches, opts = {}) {
  const maxKm = opts.maxKm != null ? opts.maxKm : 150;
  const days = opts.days != null ? opts.days : 60;
  const now = opts.now != null ? opts.now : Date.now();
  const month = opts.month;                    // 1..12 — текущий месяц
  const lat = opts.lat, lon = opts.lon;
  const from = now - days * 86400000;

  const counts = {}; let total = 0;
  for (const t of (catches || [])) {
    if (!t) continue;
    const ts = t.caught_at ? new Date(t.caught_at).getTime() : NaN;
    const recent = ts >= from && ts <= now + 86400000;
    const tMonth = t.caught_at ? new Date(t.caught_at).getMonth() + 1 : null;
    const sameMonth = (month != null && tMonth === month);     // тот же месяц в любой год — расширяет выборку
    if (!(recent || sameMonth)) continue;
    if (lat != null && lon != null && t.lat != null && t.lon != null &&
        haversineKm(lat, lon, t.lat, t.lon) > maxKm) continue;
    for (const f of (t.fish || [])) {
      if (!f || !f.species) continue;
      counts[f.species] = (counts[f.species] || 0) + 1; total++;
    }
  }
  const maxC = Math.max(1, ...Object.values(counts));
  const score = {};
  for (const [sp, n] of Object.entries(counts)) score[sp] = Math.round((n / maxC) * 5 * 10) / 10;
  return { score, total, counts };
}

// смешать балл правил с сигналом данных. Вес w = min(wmax, total/sat): при малой
// выборке ≈0 (правила рулят), при большой — данные тянут. Возвращает НОВЫЙ массив.
export function blendForecast(fish, signal, opts = {}) {
  const sat = opts.sat != null ? opts.sat : 200;     // выборка для ~полного доверия
  const wmax = opts.wmax != null ? opts.wmax : 0.4;  // потолок влияния данных
  const total = (signal && signal.total) || 0;
  const w = Math.min(wmax, total / sat);
  const src = fish || [];
  if (!signal || w < 0.02) return src.map(f => ({ ...f, learned: false }));
  const out = src.map(f => {
    const ds = (signal.score && signal.score[f.id] != null) ? signal.score[f.id] : 0;
    const blended = Math.max(0, Math.min(5, Math.round(f.sc * (1 - w) + ds * w)));
    return { ...f, sc: blended, ruleSc: f.sc, learned: blended !== f.sc };
  });
  out.sort((a, b) => b.sc - a.sc);
  return out;
}

// доля влияния данных (0..1) — для честной строки «прогноз уточнён по N уловам»
export function learnWeight(total, opts = {}) {
  const sat = opts.sat != null ? opts.sat : 200;
  const wmax = opts.wmax != null ? opts.wmax : 0.4;
  return Math.min(wmax, (total || 0) / sat);
}
