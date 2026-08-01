// Тест калибровки прогноза по реальным уловам рядом (чистые функции).
import assert from 'node:assert';
import { nearbySignal, calibrate } from '../js/calibrate.js';

let pass = 0, fail = 0;
const check = (name, fn) => { try { fn(); console.log('  ✓ ' + name); pass++; }
  catch (e) { console.log('  ✗ ' + name + ' — ' + e.message); fail++; } };

console.log('\nНа крючке · тест калибровки прогноза\n');

const NOW = Date.parse('2026-07-24T12:00:00Z');
const iso = (daysAgo) => new Date(NOW - daysAgo * 86400000).toISOString();
const HERE = { lat: 53.36, lon: 55.92 };

const trips = [
  { lat: 53.36, lon: 55.92, caught_at: iso(2),  fish: [{ species: 'pike', lure: 'воблер' }, { species: 'pike', lure: 'воблер' }] },
  { lat: 53.37, lon: 55.93, caught_at: iso(5),  fish: [{ species: 'perch', lure: 'вертушка' }] },
  { lat: 53.36, lon: 55.92, caught_at: iso(40), fish: [{ species: 'zander' }] },   // старый — вне окна 21 дн
  { lat: 60.00, lon: 30.00, caught_at: iso(1),  fish: [{ species: 'roach' }] },     // далеко — вне радиуса
];

check('nearbySignal — считает виды рядом за окно', () => {
  const s = nearbySignal(trips, HERE.lat, HERE.lon, { now: NOW });
  assert.equal(s.get('pike').count, 2);
  assert.equal(s.get('perch').count, 1);
  assert.ok(!s.has('zander'), 'старый улов не в окне');
  assert.ok(!s.has('roach'), 'далёкий улов не в радиусе');
});

check('nearbySignal — ходовая приманка вида', () => {
  const s = nearbySignal(trips, HERE.lat, HERE.lon, { now: NOW });
  const top = Object.entries(s.get('pike').lures).sort((a, b) => b[1] - a[1])[0];
  assert.equal(top[0], 'воблер');
});

check('nearbySignal — без координат пусто', () => {
  assert.equal(nearbySignal(trips, null, null, { now: NOW }).size, 0);
  assert.equal(nearbySignal([], HERE.lat, HERE.lon, { now: NOW }).size, 0);
});

check('calibrate — помечает подтверждённые + приманка', () => {
  const sig = nearbySignal(trips, HERE.lat, HERE.lon, { now: NOW });
  const fish = [
    { id: 'pike', sc: 4 }, { id: 'perch', sc: 3 }, { id: 'bream', sc: 2 },
  ];
  const out = calibrate(fish, sig);
  const pike = out.find(f => f.id === 'pike');
  assert.equal(pike.confirmed, true);
  assert.equal(pike.confCount, 2);
  assert.equal(pike.confLure, 'воблер');
  assert.equal(out.find(f => f.id === 'bream').confirmed, false);
});

check('calibrate — тай-брейк: при равном балле подтверждённый выше', () => {
  const sig = nearbySignal(trips, HERE.lat, HERE.lon, { now: NOW });
  const fish = [
    { id: 'bream', sc: 3 },   // балл 3, не подтверждён
    { id: 'perch', sc: 3 },   // балл 3, подтверждён рядом
  ];
  const out = calibrate(fish, sig);
  assert.equal(out[0].id, 'perch', 'подтверждённый вид поднялся выше при равном балле');
});

check('calibrate — не меняет порядок при разном балле', () => {
  const sig = nearbySignal(trips, HERE.lat, HERE.lon, { now: NOW });
  const fish = [{ id: 'perch', sc: 5 }, { id: 'pike', sc: 4 }]; // pike подтверждён, но балл ниже
  const out = calibrate(fish, sig);
  assert.equal(out[0].id, 'perch', 'честный балл важнее — 5 выше 4');
});

console.log('\nИтог: ' + pass + ' ✓, ' + fail + ' ✗\n');
if (fail) process.exit(1);
