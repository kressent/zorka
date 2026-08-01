// Тест личных рекордов и достижений (чистые функции).
import assert from 'node:assert';
import { personalRecords, fishingYear } from '../js/records.js';
import { achievements } from '../js/achievements.js';

let pass = 0, fail = 0;
const check = (name, fn) => { try { fn(); console.log('  ✓ ' + name); pass++; }
  catch (e) { console.log('  ✗ ' + name + ' — ' + e.message); fail++; } };

console.log('\nЗорька · тест рекордов и достижений\n');

const entries = [
  { date: '2026-07-24', spot: 'Зирган', catches: [
    { species: 'pike',  weight: 5200, lure: 'воблер' },   // трофей (порог 5000)
    { species: 'perch', weight: 200,  lure: 'воблер' },
  ]},
  { date: '2026-07-25', spot: 'Нугуш', catches: [
    { species: 'perch', weight: 300,  lure: 'микроджиг' },
    { species: 'pike',  weight: 1000, lure: 'воблер' },
  ]},
];

check('personalRecords — итоги и рекорды', () => {
  const r = personalRecords(entries);
  assert.equal(r.totalFish, 4);
  assert.equal(r.totalG, 6700);
  assert.equal(r.trophies, 1);
  assert.equal(r.days, 2);
  assert.equal(r.speciesCount, 2);
  assert.equal(r.favLure.lure, 'воблер');
  assert.equal(r.favLure.n, 3);
  assert.equal(r.personalBest.species, 'pike');
  assert.equal(r.personalBest.weight, 5200);
  assert.equal(r.biggest.perch.weight, 300);
  assert.equal(r.waters, 2);        // Зирган + Нугуш
  assert.equal(r.luresUsed, 2);     // воблер + микроджиг
});

check('personalRecords — пустой дневник', () => {
  const r = personalRecords([]);
  assert.equal(r.totalFish, 0);
  assert.equal(r.favLure, null);
  assert.equal(r.personalBest, null);
});

check('fishingYear — год-скоуп + лучший день/месяц', () => {
  const mixed = entries.concat([
    { date: '2025-08-10', spot: 'Старое', catches: [{ species: 'carp', weight: 4000, lure: 'бойл' }] },
    { date: '2026-06-01', spot: 'Зирган', catches: [{ species: 'roach', weight: 100 }] },
  ]);
  const y = fishingYear(mixed, 2026);
  assert.equal(y.year, '2026');
  assert.equal(y.totalFish, 5);                 // 4 (июль) + 1 (июнь), без 2025
  assert.equal(y.hasData, true);
  assert.equal(y.bestMonth.month, 6);           // июль (индекс 6) — 4 рыбы
  assert.equal(y.bestMonth.count, 4);
  assert.equal(y.bestDay.date, '2026-07-24');   // 2 рыбы в день
  assert.equal(y.byMonth[6], 4);
  assert.equal(y.byMonth[5], 1);                // июнь
});

check('fishingYear — год без данных', () => {
  const y = fishingYear(entries, 2020);
  assert.equal(y.hasData, false);
  assert.equal(y.totalFish, 0);
  assert.equal(y.bestMonth, null);
});

check('achievements — открытые/закрытые бейджи', () => {
  const a = achievements(entries);
  const by = Object.fromEntries(a.map(x => [x.id, x]));
  assert.equal(by.first.done, true);
  assert.equal(by.trophy1.done, true);
  assert.equal(by.ten.done, false);
  assert.equal(by.ten.cur, 4);
  assert.equal(by.sp5.done, false);
});

console.log('\nИтог: ' + pass + ' ✓, ' + fail + ' ✗\n');
if (fail) process.exit(1);
