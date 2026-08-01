'use strict';
// ═══ ДВИЖОК ПРОГНОЗА ═════════════════════════════════════════════════════════
// Экспертные правила (Фаза 1). Улучшения относительно первой версии:
//  • балл дня выводится из ТОП-активных рыб, а не среднего по всем (честно);
//  • балл рыбы абсолютный — «насколько активна ИМЕННО эта рыба»;
//  • луна реально влияет на оценку;
//  • мутность/подъём воды оцениваются по накопленному дождю;
//  • «жор» на сломе погоды (после падения давления — стабилизация) даёт буст;
//  • почасовая активность честнее: учитывает ночных рыб и время солнца.

import { SPECIES, MI } from './data.js';
import { moonInfo, sunTimes } from './astro.js';

export const mmhg = (hpa) => Math.round(hpa * 0.75006);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const avg = (arr) => arr.reduce((a, b) => a + b, 0) / (arr.length || 1);

// направление ветра "северо-восточной четверти" (для рыб, чувствительных к С/В)
function isNE(d) { return (d >= 315 || d <= 45) || (d > 45 && d <= 135); }

// температура воды: сезонная норма + воздух. lagAir (средний воздух за ~10 дней)
// учитывает тепловую инерцию — вода не следует за одним жарким/холодным днём.
export function waterTemp(maxT, minT, month, lagAir) {
  const a = (lagAir != null) ? lagAir : (maxT + minT) / 2;
  const sea = [2, 3, 8, 14, 19, 22, 22, 20, 14];
  const mi = MI[month];
  const base = mi !== undefined ? sea[mi] : a;
  return Math.round(base * 0.6 + a * 0.4);
}

// разбор одного дня по индексу в массивах Open-Meteo
export function analyzeDay(data, i) {
  const H = data.hourly, D = data.daily;
  const s = i * 24, e = s + 24;
  const temps  = H.temperature_2m.slice(s, e);
  const press  = H.pressure_msl.slice(s, e).map(mmhg);
  const clouds = H.cloudcover.slice(s, e);
  const pprob  = (H.precipitation_probability || []).slice(s, e);
  const winds  = H.windspeed_10m.slice(s, e);
  const wdirs  = H.winddirection_10m.slice(s, e);
  const pStart = press[0], pEnd = press[press.length - 1];
  const pdir = pEnd > pStart + 1 ? 'up' : pEnd < pStart - 1 ? 'down' : 'stable';
  const maxT = Math.round(Math.max(...temps));
  const minT = Math.round(Math.min(...temps));
  const cloud = avg(clouds);
  const rain = pprob.some(p => p > 40) || (D.precipitation_sum[i] > 1);
  const wind = Math.round(avg(winds));
  const avgWD = D.winddirection_10m_dominant ? D.winddirection_10m_dominant[i] : Math.round(avg(wdirs));
  const month = new Date(D.time[i]).getMonth() + 1;
  const wt = waterTemp(maxT, minT, month);
  const avgP = Math.round(avg(press));
  return { pdir, avgP, maxT, minT, cloud, rain, wind, avgWD, month, wt,
           wcode: D.weathercode[i], precipSum: D.precipitation_sum[i] };
}

// Уровень/мутность воды «с памятью». По 60-дневной истории осадков считаем
// «заряд» с экспоненциальным затуханием (τ=12 дн): свежий дождь весит больше,
// но ливни 2–3-недельной давности всё ещё держат воду высокой. Плюс тренд.
// Если истории нет — резерв на 3-дневном окне.
export function waterModel(data, todayIdx) {
  const H = data.history;
  if (H && H.precip && H.precip.length > 5) {
    const P = H.precip, n = P.length, ti = n - 1;
    let charge = 0, recent3 = 0, dry = 0;
    for (let i = 0; i < n; i++) { const age = ti - i; charge += (P[i] || 0) * Math.exp(-age / 12); if (age <= 2) recent3 += (P[i] || 0); }
    for (let i = ti; i >= 0; i--) { if ((P[i] || 0) < 1) dry++; else break; }
    const level = charge < 8 ? 0 : charge < 18 ? 1 : charge < 35 ? 2 : 3;
    const trend = recent3 >= 8 ? 'rise' : (recent3 < 2 && dry >= 3) ? 'fall' : 'hold';
    return { level, trend, charge: Math.round(charge), recentMm: Math.round(recent3), dry, label: waterLabel(level, trend), source: 'history' };
  }
  const D = data.daily; let mm = 0;
  for (let i = Math.max(0, todayIdx - 2); i <= todayIdx; i++) mm += D.precipitation_sum[i] || 0;
  const level = mm < 3 ? 0 : mm < 12 ? 1 : mm < 28 ? 2 : 3;
  const trend = mm > 8 ? 'rise' : 'hold';
  return { level, trend, charge: Math.round(mm), recentMm: Math.round(mm), dry: 0, label: waterLabel(level, trend), source: 'short' };
}

function waterLabel(level, trend) {
  const base = ['чистая, норма', 'слегка повышена, лёгкая муть', 'высокая, мутноватая', 'паводок, сильная муть'][level];
  if (level === 0) return base;
  const tr = trend === 'rise' ? 'прибывает' : trend === 'fall' ? 'спадает' : 'держится';
  return base + ' · ' + tr;
}

// «жор» на сломе погоды: падало давление → стабилизировалось = всплеск
function weatherBreak(data, todayIdx) {
  const dayAvgP = (i) => {
    if (i < 0) return null;
    const s = i * 24, e = s + 24;
    const p = data.hourly.pressure_msl.slice(s, e).map(mmhg);
    return p.length ? avg(p) : null;
  };
  const p2 = dayAvgP(todayIdx - 2), p1 = dayAvgP(todayIdx - 1), p0 = dayAvgP(todayIdx);
  if (p1 == null || p0 == null) return { boost: 0, note: null };
  const stableNow = Math.abs(p0 - p1) < 1.6;
  const fellBefore = p2 != null && (p2 - p1) >= 3;
  if (fellBefore && stableNow) return { boost: 0.6, note: 'жор — погода налаживается' };
  if (p2 != null && Math.abs(p2 - p1) < 1.6 && stableNow) return { boost: 0.25, note: 'давление устоялось' };
  return { boost: 0, note: null };
}

// абсолютный балл конкретной рыбы (0..5) + пояснения
export function scoreFish(fish, ctx) {
  const mi = MI[ctx.month];
  if (mi === undefined) return { sc: 0, factors: [] };
  const factors = [];
  if (fish.sp && fish.sp.indexOf(ctx.month) >= 0)
    return { sc: 0, factors: [{ tx: 'нерест', tp: 'bad' }] };

  let s = fish.m[mi];
  const wt = ctx.wt;
  if (wt < fish.mn) return { sc: 0, factors: [{ tx: 'вода холодная ' + wt + '°', tp: 'bad' }] };
  if (wt > fish.mx) {
    s = Math.max(0, s - Math.min(2, Math.round((wt - fish.mx) / 3)));
    factors.push({ tx: 'вода жарковата ' + wt + '°', tp: 'bad' });
  } else if (wt >= fish.mn + 4 && wt <= fish.mx - 4) {
    s += 0.5; factors.push({ tx: 'вода ' + wt + '° ✓', tp: 'good' });
  } else {
    factors.push({ tx: 'вода ' + wt + '°', tp: 'neutral' });
  }

  // давление
  const pb = ctx.pdir === 'up' ? fish.pU : ctx.pdir === 'down' ? fish.pD : fish.pS;
  s += (pb - 3) / 3;
  if (ctx.pdir === 'down' && fish.pD >= 4) factors.push({ tx: 'давление падает ↓', tp: 'good' });
  else if (ctx.pdir === 'up' && fish.pU <= 2) factors.push({ tx: 'давление растёт ↑', tp: 'bad' });
  else factors.push({ tx: 'давление стабильно', tp: 'good' });

  // ветер
  if (fish.wB && isNE(ctx.wind)) { s -= 0.5; factors.push({ tx: 'с/в ветер', tp: 'bad' }); }
  else if (!isNE(ctx.wind)) { s += 0.2; }

  // облачность / дождь
  if (ctx.cloud && fish.cl) { s += 0.2; factors.push({ tx: 'пасмурно ✓', tp: 'good' }); }
  if (ctx.rain && fish.rn) { s += 0.2; factors.push({ tx: 'дождь ✓', tp: 'good' }); }

  // похолодание
  if (ctx.drop >= 6) { s -= 1; factors.push({ tx: 'резкое похолодание', tp: 'bad' }); }
  else if (ctx.drop >= 3) { s -= 0.5; factors.push({ tx: 'похолодало', tp: 'bad' }); }

  // луна (глобально)
  s += ctx.moonAdj;
  if (ctx.moonAdj >= 0.25) factors.push({ tx: 'фаза луны ✓', tp: 'good' });
  else if (ctx.moonAdj <= -0.12) factors.push({ tx: 'луна против', tp: 'bad' });

  // мутность/подъём воды (ночные и донные переносят лучше)
  if (ctx.turbidity >= 2 && !fish.noct) { s -= 0.4; factors.push({ tx: 'вода мутная', tp: 'bad' }); }
  else if (ctx.turbidity === 1 && !fish.noct) { s -= 0.15; }

  // жор на сломе погоды
  if (ctx.breakBoost > 0 && s > 0) {
    s += ctx.breakBoost;
    if (ctx.breakNote) factors.push({ tx: ctx.breakNote + ' ✓', tp: 'good' });
  }

  return { sc: clamp(Math.round(s), 0, 5), factors };
}

// профиль активности вида по часу суток (0..1)
function hourProfile(fish, h, srH, ssH) {
  const g = (x, c, w) => Math.exp(-((x - c) * (x - c)) / (2 * w * w));
  if (fish.noct) {
    // ночь + рассвет
    const night = Math.max(g(h, 1, 3), g(h, 24, 3), g(h, 25, 3));
    const dawn = g(h, srH + 0.5, 1.4);
    return clamp(0.12 + 0.9 * Math.max(night, 0.7 * dawn), 0, 1);
  }
  // дневная: зорьки утром и вечером, спад в полдень
  const dawn = g(h, srH + 0.75, 1.7);
  const dusk = g(h, ssH - 0.9, 1.6);
  const base = (h > srH + 1 && h < ssH - 1) ? 0.38 : 0.12;
  return clamp(base + 0.85 * Math.max(dawn, dusk), 0, 1);
}

// уверенность прогноза — честно: полнота данных + стабильность погоды.
// Возвращает { level:'high'|'medium'|'low', label, why:[...] } — почему не выше.
export function forecastConfidence(water, today, drop) {
  let s = 3; const why = [];
  if (water && water.source === 'history') s += 1;
  else { s -= 1; why.push('пока мало истории по воде — уточнится со временем'); }
  if (drop >= 6) { s -= 1; why.push('резкая смена температуры — погода нестабильна'); }
  else if (drop >= 3) { s -= 0.4; why.push('заметное похолодание'); }
  if (today && today.rain) { s -= 0.5; why.push('осадки — прогноз по вероятности, погода капризна'); }
  if (today && today.pdir === 'stable') s += 0.5;
  const level = s >= 3.6 ? 'high' : s >= 2.2 ? 'medium' : 'low';
  const label = level === 'high' ? 'высокая' : level === 'medium' ? 'средняя' : 'ниже обычной';
  return { level, label, why };
}

function dayLabel(score) {
  if (score >= 4.3) return 'Отличный день';
  if (score >= 3.4) return 'Хороший день';
  if (score >= 2.4) return 'Средний день';
  if (score >= 1.3) return 'Слабый клёв';
  return 'Клёва почти нет';
}

function pressureTip(pdir) {
  return pdir === 'up'   ? 'Давление растёт — выходи пораньше, до рассвета.'
       : pdir === 'down' ? 'Давление падает — рыба активна, хороший момент.'
       :                   'Давление стабильное — утро и вечер лучшее время.';
}

function activeSpecies(filter, custom) {
  if (filter === 'predator') return SPECIES.filter(f => f.t === 'p');
  if (filter === 'peaceful') return SPECIES.filter(f => f.t === 'm');
  if (filter === 'custom') { const set = new Set(custom || []); return SPECIES.filter(f => set.has(f.id)); }
  return SPECIES.slice();
}

// главный расчёт на сегодня
export function computeForecast(data, opts = {}) {
  const { filter = 'all', custom = null, todayIdx = 2 } = opts;
  const today = analyzeDay(data, todayIdx);
  // температура воды с лагом по многодневной истории воздуха (тепловая инерция)
  if (data.history && data.history.tmax && data.history.tmax.length > 7) {
    const H = data.history, n = H.tmax.length; let s = 0, k = 0;
    for (let i = Math.max(0, n - 10); i < n; i++) { s += ((H.tmax[i] || 0) + (H.tmin[i] || 0)) / 2; k++; }
    if (k) today.wt = waterTemp(today.maxT, today.minT, today.month, s / k);
  }
  const yest  = todayIdx > 0 ? analyzeDay(data, todayIdx - 1) : today;
  const drop  = Math.max(0, yest.maxT - today.maxT);
  const mDate = (data.daily && data.daily.time && data.daily.time[todayIdx]) ? new Date(data.daily.time[todayIdx] + 'T12:00:00') : new Date();
  const moon  = moonInfo(mDate);
  const moonAdj = (moon.sc - 3) * 0.15;
  const water = waterModel(data, todayIdx);
  const brk   = weatherBreak(data, todayIdx);

  const ctx = {
    month: today.month, wt: today.wt, cloud: today.cloud > 40, rain: today.rain,
    pdir: today.pdir, wind: today.avgWD, drop, moonAdj,
    turbidity: water.level, breakBoost: brk.boost, breakNote: brk.note,
  };

  const fish = activeSpecies(filter, custom)
    .map(f => { const r = scoreFish(f, ctx); return { ...f, sc: r.sc, factors: r.factors }; })
    .sort((a, b) => b.sc - a.sc);

  // балл дня = среднее топ-3 активных (sc>0), а не среднее по всем
  const top = fish.filter(f => f.sc > 0).slice(0, 3);
  const dayScore = top.length ? Math.round(avg(top.map(f => f.sc)) * 10) / 10 : 0;

  // солнце: из Open-Meteo, иначе расчёт
  let srH = 5, ssH = 21;
  try {
    if (data.daily.sunrise && data.daily.sunset) {
      srH = hourOf(data.daily.sunrise[todayIdx]);
      ssH = hourOf(data.daily.sunset[todayIdx]);
    } else { const st = sunTimes(opts.lat || 55, opts.lon || 55); srH = st.srH; ssH = st.ssH; }
  } catch (e) { /* дефолты */ }

  // почасовая активность 0..23 (честно: топ-рыбы + их профили)
  const topForHours = fish.filter(f => f.sc > 0).slice(0, 4);
  const hourly = [];
  for (let h = 0; h < 24; h++) {
    let v = 0;
    for (const f of topForHours) v = Math.max(v, (f.sc / 5) * hourProfile(f, h, srH, ssH));
    hourly.push({ h, sc: Math.round(v * 50) / 10 }); // 0..5, десятые
  }

  // прогноз на 2 недели (планировщик)
  const upcoming = [];
  const days = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
  for (let i = todayIdx + 1; i < data.daily.time.length && i <= todayIdx + 13; i++) {
    const d = analyzeDay(data, i);
    const prev = analyzeDay(data, i - 1);
    const dMoon = moonInfo(new Date(data.daily.time[i] + 'T12:00:00'));
    const dctx = { ...ctx, month: d.month, wt: d.wt, cloud: d.cloud > 40, rain: d.rain,
                   pdir: d.pdir, wind: d.avgWD, drop: Math.max(0, prev.maxT - d.maxT),
                   moonAdj: (dMoon.sc - 3) * 0.15 };
    const sc = activeSpecies(filter, custom).map(f => scoreFish(f, dctx).sc)
      .filter(x => x > 0).sort((a, b) => b - a).slice(0, 3);
    const dt = new Date(data.daily.time[i]);
    upcoming.push({
      name: (i === todayIdx + 1) ? 'Завтра' : `${days[dt.getDay()]} ${dt.getDate()}`,
      date: data.daily.time[i],
      score: sc.length ? Math.round(avg(sc) * 10) / 10 : 0,
      maxT: d.maxT, minT: d.minT, avgP: d.avgP, pdir: d.pdir, wcode: d.wcode,
    });
  }
  // лучший день (учитывая сегодня)
  const bestDay = [{ name: 'Сегодня', score: dayScore }, ...upcoming]
    .reduce((b, x) => (x.score > b.score ? x : b), { name: 'Сегодня', score: dayScore });

  const best = fish.find(f => f.sc >= 3) || fish[0];
  let advice = best && best.sc >= 2
    ? `Лучший вариант — ${best.n.toLowerCase()} (${best.lr[0]}). ${pressureTip(today.pdir)} Вода ~${today.wt}°C.`
    : 'Условия сложные — клёв слабый по большинству видов. Хороший день просто побыть у воды.';
  if (water.level >= 2) advice += ' Вода мутновата — бери приманки поярче/пошумнее, ищи чистые струи и бровки.';

  return {
    day: { score: dayScore, label: dayLabel(dayScore) },
    confidence: forecastConfidence(water, today, drop),
    conditions: today, moon, sun: { srH, ssH },
    water, weatherBreak: brk,
    fish, hourly, upcoming, bestDay, advice,
    windows: windowRanges(hourly),
    bestWindows: windowRanges(hourly).map(([a, b]) =>
      `${String(a).padStart(2,'0')}:00–${String(b % 24).padStart(2,'0')}:00`),
  };
}

function hourOf(iso) { // "2026-07-24T05:12" → 5.2
  const t = iso.slice(11, 16).split(':');
  return parseInt(t[0], 10) + parseInt(t[1], 10) / 60;
}

// найти лучшие окна клёва (непрерывные участки высокой активности) → [[a,b],...]
function windowRanges(hourly) {
  const thr = Math.max(2.5, Math.max(...hourly.map(x => x.sc)) * 0.7);
  const win = []; let start = null;
  for (let h = 0; h < 24; h++) {
    if (hourly[h].sc >= thr) { if (start === null) start = h; }
    else if (start !== null) { win.push([start, h]); start = null; }
  }
  if (start !== null) win.push([start, 24]);
  return win;
}

export { dayLabel };
