// Тест кластеризации водоёмов (чистая функция).
import assert from 'node:assert';
import { clusterWaters } from '../js/waterbodies.js';

let pass = 0, fail = 0;
const check = (name, fn) => { try { fn(); console.log('  ✓ ' + name); pass++; }
  catch (e) { console.log('  ✗ ' + name + ' — ' + e.message); fail++; } };

console.log('\nЗорька · тест водоёмов\n');

const trips = [
  { lat: 53.36, lon: 55.92, water_name: 'Зирган', fish: [{ species: 'pike' }, { species: 'perch' }] },
  { lat: 53.37, lon: 55.93, water_name: 'Зирган', fish: [{ species: 'pike' }] },       // тот же кластер
  { lat: 54.20, lon: 56.10, water_name: 'Нугуш',  fish: [{ species: 'zander' }] },      // другой кластер
];

check('clusterWaters — группирует по ячейкам, имя по частоте, топ-виды', () => {
  const w = clusterWaters(trips);
  assert.equal(w.length, 2);                 // 2 водоёма
  assert.equal(w[0].name, 'Зирган');         // больше уловов
  assert.equal(w[0].count, 2);
  assert.equal(w[0].species[0].species, 'pike'); // щука чаще
  assert.equal(w[0].species[0].count, 2);
  assert.equal(w[1].name, 'Нугуш');
});

check('пусто / без координат — не падает', () => {
  assert.deepEqual(clusterWaters([]), []);
  assert.deepEqual(clusterWaters(null), []);
  assert.deepEqual(clusterWaters([{ water_name: 'x' }]), []); // без координат
});

console.log('\nИтог: ' + pass + ' ✓, ' + fail + ' ✗\n');
if (fail) process.exit(1);
