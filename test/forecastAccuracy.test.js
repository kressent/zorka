// Тест сбываемости прогноза («прогноз vs факт»).
import assert from 'node:assert';
import { forecastAccuracy } from '../js/forecastAccuracy.js';

let pass = 0, fail = 0;
const check = (name, fn) => { try { fn(); console.log('  ✓ ' + name); pass++; }
  catch (e) { console.log('  ✗ ' + name + ' — ' + e.message); fail++; } };

console.log('\nНа крючке · тест сбываемости прогноза\n');

const e = (score, fish) => ({ visited: true, forecast: { score }, catches: Array(fish).fill({ species: 'pike' }) });

check('мало данных → enough=false', () => {
  const a = forecastAccuracy([e(4, 3), e(2, 0)]);
  assert.equal(a.enough, false);
});

check('прогноз работает: сильные дни ловятся лучше слабых', () => {
  const a = forecastAccuracy([e(4.5, 4), e(4, 3), e(3.8, 5), e(2, 0), e(1.5, 1), e(2.2, 0)]);
  assert.equal(a.enough, true);
  assert.ok(a.goodAvg > a.weakAvg, 'good > weak');
  assert.equal(a.works, true);
});

check('прогноз НЕ подтверждается → works=false (честно)', () => {
  const a = forecastAccuracy([e(4.5, 0), e(4, 0), e(2, 3), e(1.5, 4), e(4.2, 1), e(2.1, 5)]);
  assert.equal(a.enough, true);
  assert.equal(a.works, false);
});

check('записи без прогноза игнорируются', () => {
  const a = forecastAccuracy([{ visited: true, catches: [] }, e(4, 3)]);
  assert.equal(a.n, 1);
});

check('пустой ввод не падает', () => {
  const a = forecastAccuracy([]);
  assert.equal(a.n, 0); assert.equal(a.enough, false);
  forecastAccuracy(null);
});

console.log('\nИтог: ' + pass + ' ✓, ' + fail + ' ✗\n');
if (fail) process.exit(1);
