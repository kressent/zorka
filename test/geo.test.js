// Тест гео-логики ленты «рядом» (чистые функции).
import assert from 'node:assert';
import { haversineKm, sortByNear } from '../js/geo.js';

let pass = 0, fail = 0;
const check = (name, fn) => { try { fn(); console.log('  ✓ ' + name); pass++; }
  catch (e) { console.log('  ✗ ' + name + ' — ' + e.message); fail++; } };

console.log('\nЗорька · тест гео «рядом»\n');

check('haversineKm — разумные расстояния', () => {
  assert.ok(haversineKm(0, 0, 0, 0) < 0.001);        // одна точка = 0
  const d = haversineKm(0, 0, 1, 0);                  // 1° широты ≈ 111 км
  assert.ok(d > 110 && d < 112, 'd=' + d);
});

const near = { id: 'a', lat: 53.37, lon: 55.93 };     // ~1 км от Салавата
const far  = { id: 'b', lat: 60.0,  lon: 55.0 };      // сотни км
const noco = { id: 'c', lat: null,  lon: null };
const items = [far, near, noco];

check('sortByNear — фильтрует по радиусу, сортирует, добавляет _km', () => {
  const out = sortByNear(items, 53.36, 55.92, 200);
  assert.equal(out.length, 1, 'только near в радиусе 200 км');
  assert.equal(out[0].id, 'a');
  assert.ok(out[0]._km <= 3, 'km=' + out[0]._km);
});

check('sortByNear — без координат пользователя возвращает как есть', () => {
  assert.deepEqual(sortByNear(items, null, null), items);
});

check('sortByNear — сортирует несколько по близости', () => {
  const b1 = { id: 'x', lat: 53.5, lon: 55.9 };   // дальше
  const b2 = { id: 'y', lat: 53.37, lon: 55.93 };  // ближе
  const out = sortByNear([b1, b2], 53.36, 55.92, 300);
  assert.equal(out[0].id, 'y');
  assert.ok(out[0]._km <= out[1]._km);
});

console.log('\nИтог: ' + pass + ' ✓, ' + fail + ' ✗\n');
if (fail) process.exit(1);
