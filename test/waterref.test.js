// Тест справочника водоёмов (региональный сид, чистые функции).
import assert from 'node:assert';
import { WATER_REF, inRefRegion, refWaters, refWhere } from '../js/waterref.js';
import { byId } from '../js/data.js';

let pass = 0, fail = 0;
const check = (name, fn) => { try { fn(); console.log('  ✓ ' + name); pass++; }
  catch (e) { console.log('  ✗ ' + name + ' — ' + e.message); fail++; } };

console.log('\nНа крючке · тест справочника водоёмов\n');

check('все виды справочника есть в базе data.js', () => {
  for (const w of WATER_REF) for (const s of w.species)
    assert.ok(byId(s), 'нет вида: ' + s + ' (' + w.name + ')');
});

check('inRefRegion — Салават внутри, Москва снаружи', () => {
  assert.equal(inRefRegion(53.36, 55.92), true);   // Салават
  assert.equal(inRefRegion(55.75, 37.62), false);  // Москва
  assert.equal(inRefRegion(null, null), false);
});

check('refWaters — сортировка по близости к точке', () => {
  const near = refWaters(53.36, 55.92)[0];         // от Салавата ближе Белая/Юмагузинское
  assert.ok(['Река Белая (Агидель)', 'Юмагузинское вдхр', 'Нугушское вдхр'].includes(near.name), 'ближайший: ' + near.name);
});

check('refWhere — водоёмы для вида', () => {
  const zander = refWhere('zander', 53.36, 55.92);
  assert.ok(zander.length >= 1);
  assert.ok(zander.every(w => w.species.includes('zander')));
});

console.log('\nИтог: ' + pass + ' ✓, ' + fail + ' ✗\n');
if (fail) process.exit(1);
