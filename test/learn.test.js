// Тест обучения прогноза на данных (гибрид правила+статистика).
import assert from 'node:assert';
import { learnSignal, blendForecast, learnWeight } from '../js/learn.js';

let pass = 0, fail = 0;
const check = (name, fn) => { try { fn(); console.log('  ✓ ' + name); pass++; }
  catch (e) { console.log('  ✗ ' + name + ' — ' + e.message); fail++; } };

console.log('\nНа крючке · тест обучения прогноза\n');

const NOW = Date.parse('2026-07-24T12:00:00Z');
const iso = (daysAgo) => new Date(NOW - daysAgo * 86400000).toISOString();
const HERE = { lat: 53.36, lon: 55.92 };
const trip = (daysAgo, lat, lon, species) => ({ lat, lon, caught_at: iso(daysAgo), fish: species.map(s => ({ species: s })) });

check('learnSignal — считает виды под условия (регион+окно)', () => {
  const s = learnSignal([
    trip(2, 53.36, 55.92, ['pike', 'pike', 'perch']),
    trip(5, 53.37, 55.93, ['pike']),
    trip(1, 60.0, 30.0, ['roach']),     // далеко — не считаем
    trip(400, 53.36, 55.92, ['zander']), // старое и не тот месяц — не считаем
  ], { lat: HERE.lat, lon: HERE.lon, month: 7, now: NOW });
  assert.equal(s.counts.pike, 3);
  assert.equal(s.counts.perch, 1);
  assert.ok(!s.counts.roach && !s.counts.zander);
  assert.equal(s.score.pike, 5);          // самый частый = 5
  assert.ok(s.score.perch < 5);
});

check('blendForecast — мало данных → почти без влияния', () => {
  const signal = { score: { pike: 5 }, total: 4 };   // выборка 4 → вес ~0.02
  const fish = [{ id: 'perch', sc: 4 }, { id: 'pike', sc: 2 }];
  const out = blendForecast(fish, signal, { sat: 200 });
  assert.equal(out.find(f => f.id === 'perch').sc, 4); // не изменилось
  assert.equal(out.find(f => f.id === 'pike').sc, 2);
});

check('blendForecast — много данных → данные тянут балл', () => {
  const signal = { score: { pike: 5, perch: 0 }, total: 400 }; // вес = wmax 0.4
  const fish = [{ id: 'perch', sc: 4 }, { id: 'pike', sc: 2 }];
  const out = blendForecast(fish, signal, { sat: 200, wmax: 0.4 });
  const pike = out.find(f => f.id === 'pike');
  assert.ok(pike.sc > 2, 'щуку подтянуло вверх по данным (' + pike.sc + ')');
  assert.equal(pike.learned, true);
});

check('blendForecast — без сигнала не падает', () => {
  const out = blendForecast([{ id: 'pike', sc: 3 }], null);
  assert.equal(out[0].sc, 3); assert.equal(out[0].learned, false);
});

check('learnWeight растёт с выборкой и упирается в потолок', () => {
  assert.equal(learnWeight(0), 0);
  assert.equal(learnWeight(40, { sat: 200, wmax: 0.4 }), 0.2);   // 40/200
  assert.equal(learnWeight(10000, { sat: 200, wmax: 0.4 }), 0.4); // упор в потолок
});

console.log('\nИтог: ' + pass + ' ✓, ' + fail + ' ✗\n');
if (fail) process.exit(1);
