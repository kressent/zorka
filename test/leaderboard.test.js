// Тест логики «Улов недели» (чистые функции, без сети/браузера).
import assert from 'node:assert';
import { weekTop, tripMaxWeight, tripHeaviest } from '../js/leaderboard.js';

let pass = 0, fail = 0;
const check = (name, fn) => { try { fn(); console.log('  ✓ ' + name); pass++; }
  catch (e) { console.log('  ✗ ' + name + ' — ' + e.message); fail++; } };

console.log('\nЗорька · тест лидерборда «Улов недели»\n');

const NOW = Date.parse('2026-07-24T12:00:00Z');
const iso = (daysAgo, h = 10) => {
  const d = new Date(NOW - daysAgo * 86400000); d.setUTCHours(h, 0, 0, 0); return d.toISOString();
};

const A = { id: 'A', handle: 'Аня',  caught_at: iso(0),  likes: 1, fish: [{ species: 'pike',  weight: 2000 }] };
const B = { id: 'B', handle: 'Боря', caught_at: iso(2),  likes: 3, fish: [{ species: 'perch', weight: 400 }, { species: 'zander', weight: 1500 }] };
const C = { id: 'C', handle: 'Слава',caught_at: iso(10), likes: 9, fish: [{ species: 'catfish', weight: 9000 }] };
const D = { id: 'D', handle: 'Дима', caught_at: iso(0),  likes: 1, fish: [{ species: 'chub', weight: 500 }] };
const trips = [A, B, C, D];

check('tripMaxWeight — максимум по рыбам', () => {
  assert.equal(tripMaxWeight(B), 1500);
  assert.equal(tripMaxWeight({ fish: [] }), 0);
  assert.equal(tripMaxWeight({}), 0);
});

check('tripHeaviest — самая крупная рыба', () => {
  assert.equal(tripHeaviest(B).species, 'zander');
  assert.equal(tripHeaviest({ fish: [] }), null);
});

check('weekTop — исключает старше 7 дней', () => {
  const top = weekTop(trips, NOW, 10);
  assert.ok(!top.find(t => t.id === 'C'), 'C (10 дней) не должен попасть');
  assert.equal(top.length, 3);
});

check('weekTop — сортирует: лайки → вес → свежесть', () => {
  const top = weekTop(trips, NOW, 3);
  assert.equal(top[0].id, 'B', 'лидер по лайкам (3)');
  assert.equal(top[1].id, 'A', 'при равных лайках — крупнее рыба (2000>500)');
  assert.equal(top[2].id, 'D');
});

check('weekTop — пустой ввод не падает', () => {
  assert.deepEqual(weekTop([], NOW), []);
  assert.deepEqual(weekTop(null, NOW), []);
});

console.log('\nИтог: ' + pass + ' ✓, ' + fail + ' ✗\n');
if (fail) process.exit(1);
