'use strict';
// ═══ СПРАВОЧНИК ВОДОЁМОВ (региональный сид) ══════════════════════════════════
// Холодный старт killer-фичи «рыба по водоёму»: пока реальных уловов сообщества
// мало, показываем ТИПИЧНОЕ для известных водоёмов — честно помечено «справочно».
// Реальные уловы рыбаков всегда в приоритете и постепенно вытесняют справку.
// Первый регион — Башкортостан (наш стартовый рынок). Координаты приблизительные.
import { haversineKm } from './geo.js';

export const WATER_REF = [
  { name: 'Павловское вдхр',   lat: 55.42, lon: 56.65, type: 'водохранилище',
    species: ['zander', 'bream', 'pike', 'perch'], months: [6, 7, 8, 9] },
  { name: 'Нугушское вдхр',    lat: 53.02, lon: 56.50, type: 'водохранилище',
    species: ['pike', 'perch', 'zander', 'bream'], months: [5, 6, 7, 8, 9] },
  { name: 'Юмагузинское вдхр', lat: 53.05, lon: 56.28, type: 'водохранилище',
    species: ['zander', 'asp', 'chub', 'pike'], months: [6, 7, 8] },
  { name: 'Кармановское вдхр', lat: 56.10, lon: 54.18, type: 'водохранилище (тёплая вода ГРЭС)',
    species: ['carp', 'catfish', 'perch', 'pike'], months: [5, 6, 7, 8, 9, 10] },
  { name: 'Озеро Аслыкуль',    lat: 54.30, lon: 54.58, type: 'озеро',
    species: ['pike', 'perch', 'roach', 'crucian'], months: [5, 6, 7, 8, 9] },
  { name: 'Озеро Кандрыкуль',  lat: 54.50, lon: 54.10, type: 'озеро',
    species: ['zander', 'pike', 'roach', 'perch'], months: [6, 7, 8, 9] },
  { name: 'Река Белая (Агидель)', lat: 53.36, lon: 55.92, type: 'река',
    species: ['asp', 'chub', 'ide', 'bream', 'pike', 'catfish'], months: [5, 6, 7, 8, 9] },
  { name: 'Река Дёма',         lat: 54.20, lon: 55.35, type: 'река',
    species: ['chub', 'pike', 'perch', 'ide'], months: [5, 6, 7, 8, 9] },
  { name: 'Озеро Яктыкуль (Банное)', lat: 53.60, lon: 58.63, type: 'озеро (горное)',
    species: ['pike', 'perch', 'roach'], months: [6, 7, 8] },
  { name: 'Река Уфа (Уфимка)', lat: 55.50, lon: 56.55, type: 'река',
    species: ['zander', 'bream', 'chub', 'ide', 'pike'], months: [5, 6, 7, 8, 9] },
  { name: 'Река Юрюзань', lat: 55.00, lon: 58.30, type: 'река (горная)',
    species: ['chub', 'ide', 'pike', 'perch'], months: [5, 6, 7, 8, 9] },
  { name: 'Озеро Талкас', lat: 53.36, lon: 58.37, type: 'озеро (горное)',
    species: ['pike', 'perch', 'roach'], months: [6, 7, 8] },
  { name: 'Озеро Ургун', lat: 54.32, lon: 59.42, type: 'озеро',
    species: ['pike', 'perch', 'roach'], months: [6, 7, 8, 9] },
];

// Показываем справочник, только если точка РЯДОМ с реальными водоёмами сида
// (а не в широком прямоугольнике — он захватывал Оренбург/Самару и «вылезал»
// в чужих городах). Порог ~150 км: покрывает республику от засеянных точек,
// но отсекает соседние области. Так справочник Башкирии не мозолит глаза чужим.
export function nearestRefKm(lat, lon) {
  if (lat == null || lon == null) return Infinity;
  return WATER_REF.reduce((min, w) =>
    Math.min(min, haversineKm(lat, lon, w.lat, w.lon)), Infinity);
}
export function inRefRegion(lat, lon) {
  return nearestRefKm(lat, lon) <= 150;
}

// Справочные водоёмы, отсортированные по близости к точке (если она задана).
export function refWaters(lat, lon) {
  const list = WATER_REF.slice();
  if (lat != null && lon != null) {
    list.sort((a, b) => dist2(a, lat, lon) - dist2(b, lat, lon));
  }
  return list;
}

// Справочные водоёмы, где типичен данный вид.
export function refWhere(species, lat, lon) {
  return refWaters(lat, lon).filter(w => w.species.includes(species));
}

function dist2(w, lat, lon) { const dx = w.lat - lat, dy = (w.lon - lon) * 0.6; return dx * dx + dy * dy; }
