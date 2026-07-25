// Тест сводки отметок воды (чистая функция).
import assert from 'node:assert';
import { summarizeWater } from '../js/water.js';

let pass = 0, fail = 0;
const check = (name, fn) => { try { fn(); console.log('  ✓ ' + name); pass++; }
  catch (e) { console.log('  ✗ ' + name + ' — ' + e.message); fail++; } };

console.log('\nЗорька · тест отметок воды\n');

const now = Date.parse('2026-07-25T12:00:00Z');
const iso = d => new Date(now - d * 86400000).toISOString();

check('summarizeWater — фильтр по близости и свежести + сводка', () => {
  const reports = [
    { state: 'murky', lat: 53.37, lon: 55.93, created_at: iso(1) },   // рядом
    { state: 'murky', lat: 53.40, lon: 55.90, created_at: iso(2) },   // рядом
    { state: 'clear', lat: 53.36, lon: 55.92, created_at: iso(0) },   // рядом
    { state: 'flood', lat: 60.0,  lon: 55.0,  created_at: iso(1) },   // далеко → мимо
    { state: 'clear', lat: 53.37, lon: 55.93, created_at: iso(10) },  // старое → мимо
  ];
  const s = summarizeWater(reports, 53.36, 55.92, { maxKm: 100, days: 5, now });
  assert.equal(s.total, 3);
  assert.equal(s.counts.murky, 2);
  assert.equal(s.counts.clear, 1);
  assert.equal(s.counts.flood, 0);
  assert.equal(s.dominant, 'murky');
});

check('dominant — тревожное состояние в приоритете', () => {
  const reports = [
    { state: 'clear', lat: 53.36, lon: 55.92, created_at: iso(0) },
    { state: 'flood', lat: 53.36, lon: 55.92, created_at: iso(0) },
  ];
  const s = summarizeWater(reports, 53.36, 55.92, { now });
  assert.equal(s.dominant, 'flood'); // при равенстве — flood важнее
});

check('пусто / без координат — не падает', () => {
  assert.equal(summarizeWater([], 53, 55, { now }).total, 0);
  assert.equal(summarizeWater(null, 53, 55, { now }).total, 0);
  assert.equal(summarizeWater([{ state: 'clear' }], 53, 55, { now }).total, 0); // нет координат
});

console.log('\nИтог: ' + pass + ' ✓, ' + fail + ' ✗\n');
if (fail) process.exit(1);
