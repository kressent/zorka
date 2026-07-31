// Тест «что ловят рядом» (чистая функция).
import assert from 'node:assert';
import { nearbyCatches } from '../js/nearby.js';

let pass = 0, fail = 0;
const check = (name, fn) => { try { fn(); console.log('  ✓ ' + name); pass++; }
  catch (e) { console.log('  ✗ ' + name + ' — ' + e.message); fail++; } };

console.log('\nЗорька · тест «что ловят рядом»\n');

const trips = [
  { lat: 53.36, lon: 55.92, fish: [{ species: 'pike', lure: 'колебалка' }, { species: 'perch', lure: 'вертушка' }] },
  { lat: 53.37, lon: 55.93, fish: [{ species: 'pike', lure: 'колебалка' }] },
  { lat: 53.40, lon: 55.90, fish: [{ species: 'pike', lure: 'воблер' }] },
  { lat: 60.00, lon: 55.00, fish: [{ species: 'catfish', lure: 'квок' }] }, // далеко → мимо
];

check('агрегирует по видам рядом, топ-приманка, сортировка', () => {
  const r = nearbyCatches(trips, 53.36, 55.92, 60);
  assert.equal(r.length, 2, 'щука + окунь (сом далеко)');
  assert.equal(r[0].species, 'pike');   // чаще всего
  assert.equal(r[0].count, 3);
  assert.equal(r[0].topLure, 'колебалка'); // 2×колебалка > 1×воблер
  assert.equal(r[1].species, 'perch');
  assert.ok(!r.find(x => x.species === 'catfish'), 'сом за радиусом');
});

check('без координат / пусто — не падает', () => {
  assert.deepEqual(nearbyCatches(trips, null, null), []);
  assert.deepEqual(nearbyCatches([], 53, 55), []);
  assert.deepEqual(nearbyCatches(null, 53, 55), []);
});

console.log('\nИтог: ' + pass + ' ✓, ' + fail + ' ✗\n');
if (fail) process.exit(1);
