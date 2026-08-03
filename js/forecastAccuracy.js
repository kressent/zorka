'use strict';
// ═══ СБЫВАЕМОСТЬ ПРОГНОЗА («прогноз vs факт») ════════════════════════════════
// Бьёт в главную боль рыбаков — «прогнозам не верят». Из личного дневника считаем:
// в дни, где прогноз обещал сильный клёв, ловилось ли реально больше, чем в слабые.
// Честно: показываем только когда данных достаточно. Чистая логика (тестируется).

export function forecastAccuracy(entries) {
  const list = (entries || []).filter(e => e && e.forecast && typeof e.forecast.score === 'number');
  const n = list.length;
  const fishOf = e => (e.catches || []).length;

  let goodN = 0, goodFish = 0, weakN = 0, weakFish = 0, allFish = 0;
  for (const e of list) {
    const f = fishOf(e); allFish += f;
    if (e.forecast.score >= 3.5) { goodN++; goodFish += f; }       // сильный прогноз
    else if (e.forecast.score < 2.4) { weakN++; weakFish += f; }    // слабый прогноз
  }
  const avg = (s, c) => (c ? Math.round((s / c) * 10) / 10 : null);
  const goodAvg = avg(goodFish, goodN);
  const weakAvg = avg(weakFish, weakN);
  const allAvg = avg(allFish, n);

  // достаточно данных для честного вывода: ≥6 записей с прогнозом, есть и сильные, и слабые дни
  const enough = n >= 6 && goodN >= 2 && weakN >= 2;
  const works = enough && goodAvg != null && weakAvg != null && goodAvg > weakAvg;

  return { n, goodN, weakN, goodAvg, weakAvg, allAvg, enough, works };
}
