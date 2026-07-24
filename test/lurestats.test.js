// Тест логики рейтинга приманок (чистые функции).
import assert from 'node:assert';
import { indexLureStats, topLures } from '../js/lurestats.js';

let pass = 0, fail = 0;
const check = (name, fn) => { try { fn(); console.log('  ✓ ' + name); pass++; }
  catch (e) { console.log('  ✗ ' + name + ' — ' + e.message); fail++; } };

console.log('\nЗорька · тест рейтинга приманок\n');

const rows = [
  { species: 'pike',  lure: 'воблер',    n: 5,  avg_g: 3200 },
  { species: 'pike',  lure: 'колебалка', n: 8,  avg_g: 2800 },
  { species: 'perch', lure: 'микроджиг', n: 12, avg_g: 180 },
  { species: 'pike',  lure: 'вертушка',  n: 2,  avg_g: null },
];

check('indexLureStats — группирует по виду и сортирует по частоте', () => {
  const idx = indexLureStats(rows);
  assert.equal(idx.pike.length, 3);
  assert.equal(idx.pike[0].lure, 'колебалка'); // n=8 первый
  assert.equal(idx.pike[1].lure, 'воблер');    // n=5
  assert.equal(idx.pike[2].lure, 'вертушка');  // n=2
  assert.equal(idx.perch[0].lure, 'микроджиг');
  assert.equal(idx.pike[2].avg_g, null);       // null-вес сохранён
});

check('topLures — топ-N для вида', () => {
  const idx = indexLureStats(rows);
  assert.equal(topLures(idx, 'pike', 2).length, 2);
  assert.equal(topLures(idx, 'pike', 2)[0].lure, 'колебалка');
  assert.equal(topLures(idx, 'unknown').length, 0);
  assert.equal(topLures({}, 'pike').length, 0);
});

check('пустой/битый ввод не падает', () => {
  assert.deepEqual(indexLureStats(null), {});
  assert.deepEqual(indexLureStats([{ species: 'x' }, null, { lure: 'y' }]), {}); // без пары вид+приманка — пропуск
});

console.log('\nИтог: ' + pass + ' ✓, ' + fail + ' ✗\n');
if (fail) process.exit(1);
