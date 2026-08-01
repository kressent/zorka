'use strict';
// ═══ УВЕДОМЛЕНИЕ «СКОРО ЖОР» ═════════════════════════════════════════════════
// Удержание: если впереди заметно сильный день — зовём рыбака на воду.
// Чистая логика (тестируется). upcoming: [{date, name, score}] из computeForecast.

export function goodDayAlert(upcoming, todayScore = 0, opts = {}) {
  const minScore = opts.minScore != null ? opts.minScore : 4.2; // «отличный» день
  const horizon = opts.horizon != null ? opts.horizon : 5;      // ближайшие N дней
  const strong = (upcoming || []).slice(0, horizon).filter(u => u && Number(u.score) >= minScore);
  if (!strong.length) return null;
  const best = strong.reduce((b, u) => (u.score > b.score ? u : b));
  if (Number(todayScore) >= best.score) return null;            // сегодня и так не хуже — молчим
  return {
    id: 'goodday-' + (best.date || best.name),
    kind: 'forecast',
    title: '🔥 Скоро отличный клёв',
    body: `${best.name}: ${Number(best.score).toFixed(1)}/5. Готовь снасти — грех пропустить такой день! 🎣`,
  };
}
