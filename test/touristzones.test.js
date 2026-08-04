// Тест логики турзон (Overpass-запрос/парсинг, близость, строка «людно»).
import assert from 'node:assert';
import {
  buildOverpassQuery, parseOverpass, kindOf, nearbyZones, crowdNote,
  seedCrowdNote, TZ_SEED,
} from '../js/touristzones.js';

let pass = 0, fail = 0;
const check = (name, fn) => { try { fn(); console.log('  ✓ ' + name); pass++; }
  catch (e) { console.log('  ✗ ' + name + ' — ' + e.message); fail++; } };

console.log('\nЗорька · тест турзон\n');

check('buildOverpassQuery — bbox и теги в запросе', () => {
  const q = buildOverpassQuery([53, 55, 54, 56]);
  assert.ok(q.includes('53,55,54,56'), 'bbox');
  assert.ok(q.includes('tourism'), 'тег tourism');
  assert.ok(q.includes('camp_site') && q.includes('chalet'), 'ключевые типы');
  assert.ok(q.includes('out center'), 'center для ways/relations');
});

check('kindOf — человекочитаемый тип', () => {
  assert.equal(kindOf({ tourism: 'camp_site' }), 'кемпинг');
  assert.equal(kindOf({ tourism: 'chalet' }), 'домики');
  assert.equal(kindOf({ tourism: 'resort' }), 'база отдыха');
  assert.equal(kindOf({}), 'размещение');
});

check('parseOverpass — node и way(center), дубли схлопнуты', () => {
  const json = { elements: [
    { type: 'node', lat: 55.44, lon: 56.66, tags: { name: 'База А', tourism: 'resort' } },
    { type: 'way', center: { lat: 53.02, lon: 56.50 }, tags: { name: 'База Б', tourism: 'chalet' } },
    { type: 'node', lat: 55.4401, lon: 56.6601, tags: { name: 'База А дубль', tourism: 'resort' } }, // ~11 м → дубль
    { type: 'node', tags: { name: 'Без координат', tourism: 'hotel' } }, // отбрасывается
  ] };
  const out = parseOverpass(json);
  assert.equal(out.length, 2, 'дубль и безкоординатный убраны, len=' + out.length);
  assert.equal(out[1].lat, 53.02, 'way взял center');
  assert.equal(out[1].kind, 'домики');
});

check('parseOverpass — имя из типа, если тега name нет', () => {
  const out = parseOverpass({ elements: [{ type: 'node', lat: 54, lon: 56, tags: { tourism: 'camp_site' } }] });
  assert.equal(out[0].name, 'кемпинг');
});

const zones = [
  { name: 'Ближняя', lat: 55.44, lon: 56.66, kind: 'база' },
  { name: 'Средняя', lat: 55.46, lon: 56.70, kind: 'кемпинг' },
  { name: 'Далёкая', lat: 60.0,  lon: 56.0,  kind: 'база' },
];

check('nearbyZones — радиус, сортировка, _km', () => {
  const out = nearbyZones(zones, 55.44, 56.66, 12);
  assert.equal(out.length, 2, 'далёкая отсеклась');
  assert.equal(out[0].name, 'Ближняя');
  assert.ok(out[0]._km <= out[1]._km, 'по возрастанию');
});

check('nearbyZones — без координат точки пусто', () => {
  assert.deepEqual(nearbyZones(zones, null, null), []);
});

check('crowdNote — нет зон рядом → null', () => {
  assert.equal(crowdNote(zones, 45.0, 40.0), null);
});

check('crowdNote — одна зона → мягкая формулировка с именем', () => {
  const one = [{ name: 'База «Урман»', lat: 55.44, lon: 56.66, kind: 'домики' }];
  const note = crowdNote(one, 55.44, 56.66);
  assert.ok(note && note.includes('Урман'), note);
});

check('crowdNote — 3+ зон → «оживлённая турзона»', () => {
  const many = [
    { name: 'A', lat: 55.44, lon: 56.66, kind: 'база' },
    { name: 'B', lat: 55.45, lon: 56.67, kind: 'база' },
    { name: 'C', lat: 55.46, lon: 56.68, kind: 'кемпинг' },
  ];
  const note = crowdNote(many, 55.44, 56.66);
  assert.ok(note && note.includes('Оживлённая'), note);
});

check('seedCrowdNote — вне стартового региона молчит', () => {
  assert.equal(seedCrowdNote(55.75, 37.62), null); // Москва — не Башкирия
});

check('seedCrowdNote — у Павловки в регионе даёт строку', () => {
  const note = seedCrowdNote(55.44, 56.66); // Павловское вдхр
  assert.ok(note && note.startsWith('🏕'), note);
});

check('TZ_SEED — непустой и с координатами', () => {
  assert.ok(TZ_SEED.length >= 8);
  assert.ok(TZ_SEED.every(z => z.lat != null && z.lon != null && z.name && z.kind));
});

console.log('\nИтог: ' + pass + ' ✓, ' + fail + ' ✗\n');
if (fail) process.exit(1);
