// Тест уведомления «скоро жор» (чистая функция).
import assert from 'node:assert';
import { goodDayAlert } from '../js/forecastAlert.js';

let pass = 0, fail = 0;
const check = (name, fn) => { try { fn(); console.log('  ✓ ' + name); pass++; }
  catch (e) { console.log('  ✗ ' + name + ' — ' + e.message); fail++; } };

console.log('\nЗорька · тест уведомления «скоро жор»\n');

const up = [
  { date: '2026-07-26', name: 'Завтра', score: 3.5 },
  { date: '2026-07-27', name: 'Вс 27', score: 4.5 },
  { date: '2026-07-28', name: 'Пн 28', score: 4.0 },
];

check('сильный день впереди → зовёт', () => {
  const a = goodDayAlert(up, 3.0);
  assert.ok(a, 'должно вернуть уведомление');
  assert.equal(a.id, 'goodday-2026-07-27'); // лучший из сильных (4.5)
  assert.ok(a.body.includes('4.5'));
  assert.equal(a.kind, 'forecast');
});

check('сегодня и так не хуже → молчит', () => {
  assert.equal(goodDayAlert(up, 4.6), null);
});

check('нет сильных дней → молчит', () => {
  assert.equal(goodDayAlert([{ date: 'd', name: 'x', score: 3.0 }], 2), null);
});

check('сильный день за горизонтом → молчит', () => {
  const far = [0,1,2,3,4].map(i => ({ date: 'd' + i, name: 'd', score: 3.0 }))
    .concat([{ date: 'd6', name: 'd6', score: 4.8 }]); // 6-й день, за horizon=5
  assert.equal(goodDayAlert(far, 2), null);
});

check('пустой ввод не падает', () => {
  assert.equal(goodDayAlert(null, 3), null);
  assert.equal(goodDayAlert([], 3), null);
});

console.log('\nИтог: ' + pass + ' ✓, ' + fail + ' ✗\n');
if (fail) process.exit(1);
