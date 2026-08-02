'use strict';
// ═══ ГЕНЕРАТОР ПОСТОВ ════════════════════════════════════════════════════════
// Превращает результат прогноза в готовый текст поста — для Telegram-бота,
// канала и (позже) кнопки «поделиться прогнозом» в приложении. Чистая функция.

const WD = ['С','СВ','В','ЮВ','Ю','ЮЗ','З','СЗ'];
const wdName = (d) => WD[Math.round((d || 0) / 45) % 8];
const pdirPhrase = (p) => p === 'up' ? 'давление растёт — выходи пораньше'
  : p === 'down' ? 'давление падает — рыба активна, момент хороший'
  : 'давление стабильное — утро и вечер лучшее время';
const scEmoji = (s) => s >= 5 ? '🔥' : s >= 4 ? '🟢' : s >= 3 ? '🟡' : s >= 2 ? '🟠' : '⚪';

// fc — результат computeForecast; place — название водоёма/города
export function forecastPost(fc, place, opts = {}) {
  const c = fc.conditions;
  const top = fc.fish.filter(f => f.sc > 0).slice(0, opts.topN || 3);
  const windows = (fc.bestWindows && fc.bestWindows.length) ? fc.bestWindows.join(', ') : 'ровный день без выраженных окон';
  const L = [];
  L.push(`🎣 Прогноз клёва — ${place}`);
  L.push('');
  L.push(`Балл дня: ${fc.day.score.toFixed(1)}/5 — ${fc.day.label.toLowerCase()}.`);
  L.push(`Погода: ${c.maxT}°/${c.minT}°, ${wdName(c.avgWD)} ${c.wind} м/с, ${pdirPhrase(c.pdir)}.`);
  L.push(`Вода ~${c.wt}° · ${fc.water.label}.`);
  L.push(`Окна клёва: ${windows}.`);
  L.push('');
  if (top.length) {
    for (const f of top) L.push(`${scEmoji(f.sc)} ${f.n} ${f.sc}/5 — ${f.lr[0]} · ${f.ti}`);
  } else {
    L.push('Сегодня по большинству видов клёв слабый — хороший день просто побыть у воды.');
  }
  if (fc.bestDay && fc.bestDay.name !== 'Сегодня') {
    L.push('');
    L.push(`🏆 Лучший день впереди — ${fc.bestDay.name} (${fc.bestDay.score.toFixed(1)}/5).`);
  }
  L.push('');
  L.push('Подробный прогноз по часам, дневник уловов и карта мест — в приложении «На крючке»:');
  L.push(opts.appUrl || 'https://kressent.github.io/zorka/');
  L.push('');
  L.push('Ни хвоста ни чешуи! 🐟');
  return L.join('\n');
}

// дайджест по нескольким водоёмам — один пост в канал.
// items: [{ place, fc }]; opts.dateLabel — «3 августа», opts.appUrl, opts.bot.
export function forecastDigest(items, opts = {}) {
  const L = [];
  L.push(`🎣 Клёв в Башкирии${opts.dateLabel ? ' — ' + opts.dateLabel : ''}`);
  L.push('');
  for (const it of (items || [])) {
    const fc = it && it.fc; if (!fc) continue;
    const best = fc.fish.find(f => f.sc >= 3) || fc.fish[0];
    const w = (fc.bestWindows && fc.bestWindows[0]) ? `, окно ${fc.bestWindows[0]}` : '';
    const fishTxt = (best && best.sc > 0) ? `${best.n.toLowerCase()} на ${best.lr[0]}${w}` : 'клёв слабый';
    L.push(`${scEmoji(fc.day.score)} ${it.place} — ${fc.day.score.toFixed(1)}/5 · ${fishTxt}`);
  }
  L.push('');
  L.push('Подробный прогноз по часам, дневник уловов и карта мест — в приложении:');
  L.push(opts.appUrl || 'https://kressent.github.io/zorka/');
  if (opts.bot) L.push(`Прогноз на любой свой водоём — ${opts.bot}`);
  L.push('');
  L.push('Ни хвоста ни чешуи! 🐟');
  return L.join('\n');
}

// короткий вариант (для пуша/тизера)
export function forecastTeaser(fc, place) {
  const best = fc.fish.find(f => f.sc >= 3);
  const w = (fc.bestWindows && fc.bestWindows[0]) ? `, окно ${fc.bestWindows[0]}` : '';
  if (best) return `${place}: клёв ${fc.day.score.toFixed(1)}/5. Лучше всего ${best.n.toLowerCase()} на ${best.lr[0]}${w}.`;
  return `${place}: сегодня клёв слабый (${fc.day.score.toFixed(1)}/5). Скорее для души, чем за уловом.`;
}
