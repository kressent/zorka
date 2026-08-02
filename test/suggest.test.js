// Тест умного ввода улова (подсказки видов, чистая функция).
import assert from 'node:assert';
import { suggestSpecies } from '../js/suggest.js';
import { byId } from '../js/data.js';

let pass = 0, fail = 0;
const check = (name, fn) => { try { fn(); console.log('  ✓ ' + name); pass++; }
  catch (e) { console.log('  ✗ ' + name + ' — ' + e.message); fail++; } };

console.log('\nНа крючке · тест умного ввода улова\n');

check('приоритет: сообщество рядом > регион > сезон', () => {
  const signal = new Map([['zander', { count: 3 }]]);   // судака ловят рядом
  const out = suggestSpecies({ signal, refSpecies: ['carp'], month: 7, limit: 6 });
  assert.equal(out[0].species, 'zander');
  assert.equal(out[0].reason, 'ловят рядом');
  const carp = out.find(s => s.species === 'carp');
  assert.ok(carp && carp.reason === 'типично здесь');
});

check('нерестящийся вид в этом месяце не предлагается', () => {
  const bream = byId('bream');
  if (bream && bream.sp && bream.sp.length) {
    const m = bream.sp[0];
    const out = suggestSpecies({ month: m, limit: 15 });
    assert.ok(!out.find(s => s.species === 'bream'), 'лещ в нерест не должен предлагаться');
  }
});

check('только сезон (без сигнала/региона) — что-то да предложит летом', () => {
  const out = suggestSpecies({ month: 7, limit: 6 });
  assert.ok(out.length >= 1);
  assert.ok(out.every(s => byId(s.species)));
});

check('пустой ввод не падает', () => {
  assert.deepEqual(suggestSpecies({}), []);
  assert.deepEqual(suggestSpecies(), []);
});

check('limit соблюдается', () => {
  const out = suggestSpecies({ month: 7, limit: 3 });
  assert.ok(out.length <= 3);
});

console.log('\nИтог: ' + pass + ' ✓, ' + fail + ' ✗\n');
if (fail) process.exit(1);
