// Smoke-тест рендера без браузера: шимлем DOM/localStorage и проверяем,
// что все четыре экрана рисуются без исключений и дают непустой HTML.
import assert from 'node:assert';

// ── минимальные шимы окружения браузера ──
const store = new Map();
globalThis.localStorage = {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: k => store.delete(k),
};
const els = new Map();
function fakeEl(id) {
  if (id && els.has(id)) return els.get(id);
  const el = { id, _html: '', classList: { toggle(){}, add(){}, remove(){}, contains(){return false;} },
    addEventListener(){}, appendChild(){}, remove(){}, focus(){}, value: '',
    get innerHTML(){ return this._html; }, set innerHTML(v){ this._html = v; } };
  if (id) els.set(id, el);
  return el;
}
globalThis.window = {};
globalThis.document = {
  getElementById: id => fakeEl(id),
  createElement: () => fakeEl(null),
  body: { appendChild(){}, },
  addEventListener(){}, readyState: 'complete',
};

const { ST } = await import('../js/state.js');
const { initUI, rerender } = await import('../js/ui.js');

// синтетическая погода (9 дней)
function synth() {
  const nDays = 9, nH = nDays * 24;
  const start = new Date(); start.setHours(0,0,0,0); start.setDate(start.getDate() - 2);
  const H = { time:[], temperature_2m:[], precipitation_probability:[], precipitation:[],
    cloudcover:[], pressure_msl:[], windspeed_10m:[], winddirection_10m:[], weathercode:[] };
  for (let i=0;i<nH;i++){ const hod=i%24;
    H.time.push('t'+i); H.temperature_2m.push(18+7*Math.sin((hod-6)/24*2*Math.PI));
    H.precipitation_probability.push(10); H.precipitation.push(0); H.cloudcover.push(30);
    H.pressure_msl.push(1011); H.windspeed_10m.push(3); H.winddirection_10m.push(210); H.weathercode.push(0); }
  const D = { time:[], temperature_2m_max:[], temperature_2m_min:[], weathercode:[],
    precipitation_sum:[], winddirection_10m_dominant:[], sunrise:[], sunset:[] };
  for (let d=0; d<nDays; d++){ const day=new Date(start); day.setDate(start.getDate()+d);
    const ds=day.toISOString().slice(0,10);
    D.time.push(ds); D.temperature_2m_max.push(26); D.temperature_2m_min.push(14);
    D.weathercode.push(0); D.precipitation_sum.push(0); D.winddirection_10m_dominant.push(210);
    D.sunrise.push(ds+'T05:12'); D.sunset.push(ds+'T21:34'); }
  return { hourly:H, daily:D };
}

let pass=0, fail=0;
const check=(n,f)=>{ try{ f(); console.log('  ✓ '+n); pass++; } catch(e){ console.log('  ✗ '+n+' — '+e.message); fail++; } };

console.log('\nЗорька · smoke-тест интерфейса\n');

initUI();
ST.city = { name:'Салават', country:'Россия', lat:53.36, lon:55.92 };
ST.weather = synth();

check('Z API определён', () => assert.ok(window.Z && typeof window.Z.tab === 'function'));

for (const t of ['forecast','diary','map','tackle']) {
  check('экран "' + t + '" рисуется', () => {
    ST.tab = t; rerender();
    const html = els.get('main')._html;
    assert.ok(typeof html === 'string' && html.length > 50, 'пустой html');
    assert.ok(!/undefined|\[object Object\]|NaN/.test(html), 'мусор в разметке: ' + (html.match(/undefined|\[object Object\]|NaN/)||[''])[0]);
  });
}

check('прогноз содержит блок клёва и рыбу', () => {
  ST.tab='forecast'; rerender();
  const html = els.get('main')._html;
  assert.ok(html.includes('Клёв сегодня'));
  assert.ok(/Жерех|Окунь|Судак|Щука/.test(html));
});
check('навигация нарисована (4 вкладки)', () => {
  const nav = els.get('tabbar')._html;
  ['Прогноз','Дневник','Карта','Снасти'].forEach(x => assert.ok(nav.includes(x), 'нет '+x));
});

console.log('\nИтог: ' + pass + ' ✓, ' + fail + ' ✗\n');
process.exit(fail ? 1 : 0);
