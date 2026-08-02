'use strict';
// ═══ УМНЫЙ ВВОД УЛОВА ════════════════════════════════════════════════════════
// При добавлении улова подсказываем вероятные виды, чтобы записать в один тап.
// Приоритет сигналов: реально ловят рядом (сообщество) > типично для водоёмов
// региона > активны в этом сезоне. Нерестящиеся сейчас — не предлагаем.
// Чистая логика (тестируется).
import { SPECIES, MI } from './data.js';

export function suggestSpecies(opts = {}) {
  const { signal, refSpecies, month, limit = 6 } = opts;
  const score = new Map(), reason = new Map();
  const bump = (id, pts, why) => {
    score.set(id, (score.get(id) || 0) + pts);
    if (!reason.has(id)) reason.set(id, why);   // первый (сильнейший) источник задаёт причину
  };

  // 1) сообщество реально ловит рядом — сильнейший сигнал
  if (signal && typeof signal.forEach === 'function')
    signal.forEach((s, id) => bump(id, 100 + Math.min(s.count || 0, 10), 'ловят рядом'));

  // 2) типично для водоёмов региона (справочник)
  for (const id of (refSpecies || [])) bump(id, 40, 'типично здесь');

  // 3) сезонная активность вида (нерест — пропускаем)
  if (month != null) {
    const mi = MI[month];
    if (mi !== undefined) for (const f of SPECIES) {
      if (f.sp && f.sp.indexOf(month) >= 0) continue;      // нерест — не предлагаем
      const act = (f.m && f.m[mi]) || 0;
      if (act >= 3) bump(f.id, act, 'в сезоне');
    }
  }

  return [...score.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => ({ species: id, reason: reason.get(id) }));
}
