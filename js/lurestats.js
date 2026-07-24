'use strict';
// ═══ РЕЙТИНГ ПРИМАНОК ════════════════════════════════════════════════════════
// Чистая логика (тестируется): из реальных уловов сообщества строим «что на что
// берёт». Это ядро «маховика данных» — экспертные подсказки дополняются реальной
// статистикой. rows приходят из вью lure_rating: [{species, lure, n, avg_g}].

// species → отсортированный по частоте список приманок
export function indexLureStats(rows) {
  const by = {};
  for (const r of (rows || [])) {
    if (!r || !r.species || !r.lure) continue;
    (by[r.species] = by[r.species] || []).push({
      lure: r.lure,
      n: Number(r.n) || 0,
      avg_g: (r.avg_g != null ? Number(r.avg_g) : null),
    });
  }
  for (const k in by) by[k].sort((a, b) => b.n - a.n || String(a.lure).localeCompare(String(b.lure)));
  return by;
}

// топ-N приманок для вида
export function topLures(index, species, n = 3) {
  return ((index || {})[species] || []).slice(0, n);
}
