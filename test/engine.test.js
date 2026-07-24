// Проверка движка прогноза в node (без браузера).
// Пытаемся взять живые данные Open-Meteo; если сети нет — синтетика.
import assert from 'node:assert';
import { computeForecast, analyzeDay, scoreFish, waterTemp } from '../js/score.js';
import { moonInfo, sunTimes } from '../js/astro.js';
import { SPECIES } from '../js/data.js';
import { buildUrl, historyUrl, todayIndex } from '../js/weather.js';

const SALAVAT = { lat: 53.36, lon: 55.92 };

function synth() {
  // 9 дней (past_days=2 + forecast_days=7), почасово
  const nDays = 9, nH = nDays * 24;
  const start = new Date(); start.setHours(0,0,0,0); start.setDate(start.getDate() - 2);
  const H = { time:[], temperature_2m:[], precipitation_probability:[], precipitation:[],
    cloudcover:[], pressure_msl:[], windspeed_10m:[], winddirection_10m:[], weathercode:[] };
  for (let i=0;i<nH;i++){
    const hod = i % 24;
    H.time.push('t'+i);
    H.temperature_2m.push(18 + 7*Math.sin((hod-6)/24*2*Math.PI));   // 11..25
    H.precipitation_probability.push(10);
    H.precipitation.push(0);
    H.cloudcover.push(30);
    H.pressure_msl.push(1010 + Math.sin(i/40));                     // стабильно
    H.windspeed_10m.push(3);
    H.winddirection_10m.push(210);                                  // Ю-З
    H.weathercode.push(0);
  }
  const D = { time:[], temperature_2m_max:[], temperature_2m_min:[], weathercode:[],
    precipitation_sum:[], winddirection_10m_dominant:[], sunrise:[], sunset:[] };
  for (let d=0; d<nDays; d++){
    const day = new Date(start); day.setDate(start.getDate()+d);
    D.time.push(day.toISOString().slice(0,10));
    D.temperature_2m_max.push(26); D.temperature_2m_min.push(14);
    D.weathercode.push(0); D.precipitation_sum.push(0);
    D.winddirection_10m_dominant.push(210);
    D.sunrise.push(day.toISOString().slice(0,10)+'T05:12');
    D.sunset.push(day.toISOString().slice(0,10)+'T21:34');
  }
  return { hourly:H, daily:D };
}

async function getData(){
  // По умолчанию — синтетика (детерминированно + чистый выход процесса).
  // Живые данные Open-Meteo — по флагу: ZORKA_LIVE=1 node test/engine.test.js
  if (!process.env.ZORKA_LIVE) { console.log('  · данные: синтетика (живые: ZORKA_LIVE=1)'); return synth(); }
  try {
    const r = await fetch(buildUrl(SALAVAT.lat, SALAVAT.lon), { signal: AbortSignal.timeout(8000) });
    if (r.ok) {
      const data = await r.json();
      try {
        const h = await fetch(historyUrl(SALAVAT.lat, SALAVAT.lon), { signal: AbortSignal.timeout(8000) });
        if (h.ok) { const hj = await h.json(); data.history = { time: hj.daily.time, precip: hj.daily.precipitation_sum, tmax: hj.daily.temperature_2m_max, tmin: hj.daily.temperature_2m_min }; }
      } catch(e) {}
      console.log('  · данные: живой Open-Meteo' + (data.history ? ' + история 60 дней' : ''));
      return data;
    }
  } catch(e) { /* нет сети */ }
  console.log('  · данные: синтетика (сети нет)');
  return synth();
}

let pass = 0, fail = 0;
const check = (name, fn) => { try { fn(); console.log('  ✓ ' + name); pass++; }
  catch(e){ console.log('  ✗ ' + name + ' — ' + e.message); fail++; } };

console.log('\nЗорька · тест движка прогноза\n');

check('база: 15 видов', () => assert.equal(SPECIES.length, 15));
check('waterTemp разумна (июль)', () => { const w = waterTemp(26,14,7); assert.ok(w>=15 && w<=26, 'wt='+w); });
check('moonInfo валиден', () => { const m = moonInfo(new Date()); assert.ok(m.sc>=2 && m.sc<=5); assert.ok(m.icon && m.name); });
check('sunTimes валиден', () => { const s = sunTimes(53.36,55.92); assert.ok(s.srH>2 && s.srH<10); assert.ok(s.ssH>16 && s.ssH<24); });

const data = await getData();
const idx = todayIndex(data);
check('todayIndex найден', () => assert.ok(idx>=0 && idx<data.daily.time.length));

const fc = computeForecast(data, { filter:'predator', todayIdx: idx, lat: SALAVAT.lat, lon: SALAVAT.lon });
check('день: балл 0..5', () => assert.ok(fc.day.score>=0 && fc.day.score<=5, 'score='+fc.day.score));
check('рыбы отсортированы по убыванию', () => { for(let i=1;i<fc.fish.length;i++) assert.ok(fc.fish[i-1].sc >= fc.fish[i].sc); });
check('балл дня согласован с топ-рыбой (не выше лучшей)', () => assert.ok(fc.day.score <= fc.fish[0].sc + 0.001, 'day='+fc.day.score+' top='+fc.fish[0].sc));
check('почасовая: 24 значения 0..5', () => { assert.equal(fc.hourly.length,24); fc.hourly.forEach(h=>assert.ok(h.sc>=0&&h.sc<=5)); });
check('есть окна клёва', () => assert.ok(Array.isArray(fc.bestWindows)));
check('ближайшие дни есть', () => assert.ok(fc.upcoming.length>=1));
check('совет — строка', () => assert.ok(typeof fc.advice==='string' && fc.advice.length>10));
check('вода: уровень 0..3 + метка + тренд', () => {
  assert.ok(fc.water.level>=0 && fc.water.level<=3, 'level='+fc.water.level);
  assert.ok(typeof fc.water.label==='string' && fc.water.label.length>3);
  assert.ok(['rise','hold','fall'].includes(fc.water.trend));
});
check('нерест: майский лещ (спавн) даёт 0', () => {
  const bream = SPECIES.find(f=>f.id==='bream');
  const r = scoreFish(bream, { month:5, wt:18, cloud:false, rain:false, pdir:'stable', wind:210, drop:0, moonAdj:0, turbidity:0, breakBoost:0 });
  assert.equal(r.sc, 0);
});

console.log('\nСводка на сегодня (' + (data.daily.time[idx]) + '):');
console.log('  День: ' + fc.day.score + '/5 — ' + fc.day.label);
console.log('  Луна: ' + fc.moon.icon + ' ' + fc.moon.name);
console.log('  Условия: ' + fc.conditions.maxT + '°/' + fc.conditions.minT + '°, ' +
  fc.conditions.avgP + ' мм ' + fc.conditions.pdir + ', вода ~' + fc.conditions.wt + '°');
console.log('  Вода: ' + fc.water.label + ' (заряд ' + fc.water.charge + ', ' + fc.water.dry + ' сухих дн., источник ' + fc.water.source + ')');
console.log('  Окна клёва: ' + (fc.bestWindows.join(', ') || '—'));
console.log('  Топ рыбы: ' + fc.fish.slice(0,5).map(f=>f.n+' '+f.sc).join(', '));
console.log('  Совет: ' + fc.advice);

console.log('\nИтог: ' + pass + ' ✓, ' + fail + ' ✗\n');
process.exit(fail ? 1 : 0);
