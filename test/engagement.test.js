// Тест логики уведомлений сообщества (чистая функция).
import assert from 'node:assert';
import { engagementNotifs } from '../js/engagement.js';

let pass = 0, fail = 0;
const check = (name, fn) => { try { fn(); console.log('  ✓ ' + name); pass++; }
  catch (e) { console.log('  ✗ ' + name + ' — ' + e.message); fail++; } };

console.log('\nЗорька · тест уведомлений сообщества\n');

const trip = (likes, comments) => ([{
  id: 'u1:t1', user_id: 'u1', water_name: 'Зирган', likes, comments,
  fish: [{ species: 'pike', weight: 5000 }],
}]);

check('первый раз — без спама, только база', () => {
  const { notifs, next } = engagementNotifs(trip(2, 1), {});
  assert.equal(notifs.length, 0);
  assert.deepEqual(next['u1:t1'], { likes: 2, comments: 1 });
});

check('прирост лайков → уведомление', () => {
  const { notifs } = engagementNotifs(trip(3, 0), { 'u1:t1': { likes: 2, comments: 0 } });
  assert.equal(notifs.length, 1);
  assert.equal(notifs[0].kind, 'like');
  assert.ok(notifs[0].body.includes('3'));
});

check('прирост комментариев → уведомление', () => {
  const { notifs } = engagementNotifs(trip(0, 2), { 'u1:t1': { likes: 0, comments: 1 } });
  assert.equal(notifs.length, 1);
  assert.equal(notifs[0].kind, 'comment');
});

check('лайк + комментарий сразу → два уведомления', () => {
  const { notifs } = engagementNotifs(trip(5, 3), { 'u1:t1': { likes: 4, comments: 2 } });
  assert.equal(notifs.length, 2);
});

check('без изменений → тишина', () => {
  const { notifs } = engagementNotifs(trip(3, 1), { 'u1:t1': { likes: 3, comments: 1 } });
  assert.equal(notifs.length, 0);
});

check('пустой ввод не падает', () => {
  const { notifs, next } = engagementNotifs(null, null);
  assert.deepEqual(notifs, []); assert.deepEqual(next, {});
});

console.log('\nИтог: ' + pass + ' ✓, ' + fail + ' ✗\n');
if (fail) process.exit(1);
