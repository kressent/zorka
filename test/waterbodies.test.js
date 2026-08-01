// Тест кластеризации водоёмов (чистая функция).
import assert from 'node:assert';
import { clusterWaters, waterProfile } from '../js/waterbodies.js';

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

const profTrips = [
  { lat: 53.36, lon: 55.92, water_name: 'Зирган', user_id: 'u1', caught_at: '2026-06-10',
    fish: [{ species: 'pike', weight: 6000, lure: 'воблер' }, { species: 'perch', weight: 300, lure: 'вертушка' }] },
  { lat: 53.37, lon: 55.93, water_name: 'Зирган', user_id: 'u2', caught_at: '2026-06-20',
    fish: [{ species: 'pike', weight: 2000, lure: 'воблер' }] },
  { lat: 53.36, lon: 55.92, water_name: 'Зирган', user_id: 'u1', caught_at: '2026-07-05',
    fish: [{ species: 'pike', weight: 1500, lure: 'блесна' }] },
  { lat: 54.20, lon: 56.10, water_name: 'Нугуш', user_id: 'u3', caught_at: '2026-05-01',
    fish: [{ species: 'zander', weight: 1200 }] },
];

check('waterProfile — виды/приманки/вес/месяцы/рыбаки', () => {
  const key = clusterWaters(profTrips)[0].key;    // Зирган (больше уловов)
  const p = waterProfile(profTrips, key);
  assert.equal(p.name, 'Зирган');
  assert.equal(p.trips, 3);
  assert.equal(p.anglers, 2);                       // u1, u2
  const pike = p.species.find(s => s.species === 'pike');
  assert.equal(pike.count, 3);
  assert.equal(pike.topLure, 'воблер');             // 2 раза воблер
  assert.equal(pike.maxW, 6000);                    // крупнейшая щука
  assert.equal(p.bestMonths[0].month, 5);           // июнь (2 выезда) — индекс 5
});

check('waterProfile — неизвестный ключ = null', () => {
  assert.equal(waterProfile(profTrips, 'n:нетакого'), null);
  assert.equal(waterProfile([], 'x'), null);
});

console.log('\nИтог: ' + pass + ' ✓, ' + fail + ' ✗\n');
if (fail) process.exit(1);
