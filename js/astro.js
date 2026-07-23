'use strict';
// ═══ ЛУНА И СОЛНЦЕ ═══════════════════════════════════════════════════════════
// Считается астрономически, без интернета и без ключей.

// Фаза луны на дату. Возвращает иконку, название, долю цикла (0..1),
// day-фактор клёва (2..5) и текст "до ближайшего ново/полнолуния".
export function moonInfo(date = new Date()) {
  const known = new Date(2000, 0, 6);            // известное новолуние
  const days = (date - known) / (1000 * 60 * 60 * 24);
  const phase = ((days % 29.53) + 29.53) % 29.53;
  const pct = phase / 29.53;
  let icon, name, sc;
  if (phase < 1.5 || phase > 28)      { icon = '🌑'; name = 'Новолуние';        sc = 5; }
  else if (phase < 7.5)               { icon = '🌒'; name = 'Растущий серп';    sc = 3; }
  else if (phase < 8.5)               { icon = '🌓'; name = 'Первая четверть';  sc = 4; }
  else if (phase < 13.5)              { icon = '🌔'; name = 'Прибывает';        sc = 4; }
  else if (phase < 15.5)              { icon = '🌕'; name = 'Полнолуние';       sc = 5; }
  else if (phase < 21.5)              { icon = '🌖'; name = 'Убывает';          sc = 3; }
  else if (phase < 22.5)              { icon = '🌗'; name = 'Последняя четверть';sc = 4; }
  else                                { icon = '🌘'; name = 'Убывающий серп';   sc = 2; }
  const dNew  = Math.round(29.53 - phase);
  const dFull = phase < 14.75 ? Math.round(14.75 - phase) : Math.round(29.53 - phase + 14.75);
  const next  = dNew <= dFull ? `Новолуние через ${dNew} д.` : `Полнолуние через ${dFull} д.`;
  return { icon, name, sc, pct, next };
}

// Восход/закат для координат. Простая, но достаточная модель (± несколько минут).
export function sunTimes(lat, lon, date = new Date()) {
  try {
    const rad = Math.PI / 180;
    const doy = Math.floor((date - new Date(date.getFullYear(), 0, 0)) / 86400000);
    const B = (360 / 365) * (doy - 81) * rad;
    const eot = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);
    const clat = Math.min(Math.max(lat, -66), 66);
    const cosHA = -Math.tan(clat * rad) * Math.tan(23.45 * Math.sin(B) * rad);
    if (cosHA < -1 || cosHA > 1) return { sr: '06:00', ss: '20:00', srH: 6, ssH: 20 };
    const ha = Math.acos(cosHA) / rad;
    const tz = Math.round(lon / 15);
    const tzO = date.getTimezoneOffset() / -60;
    const sr = 12 - ha / 15 - (lon - tz * 15) / 15 - eot / 60 + (tz - tzO);
    const ss = 12 + ha / 15 - (lon - tz * 15) / 15 - eot / 60 + (tz - tzO);
    return { sr: hm(sr), ss: hm(ss), srH: sr, ssH: ss };
  } catch (e) {
    return { sr: '06:00', ss: '20:00', srH: 6, ssH: 20 };
  }
}

function hm(h) {
  let hh = Math.floor(((h % 24) + 24) % 24);
  let mm = Math.round((h % 1) * 60);
  if (mm >= 60) { hh = (hh + 1) % 24; mm = 0; }
  if (mm < 0)   { hh = (hh + 23) % 24; mm += 60; }
  return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
}
