'use strict';
// ═══ ТУРИСТИЧЕСКИЕ ЗОНЫ на водоёмах ══════════════════════════════════════════
// «Где людно»: базы отдыха, кемпинги, гостевые домики у воды. Прокси плотности
// народу — полезно ОБЕИМ аудиториям: «результатнику» (объехать толпу) и
// «процесснику» (снять домик, отдохнуть с семьёй). Без тумблера-режима.
//
// Данные — два источника:
//   1) СИД (этот файл) — проверенный ручной набор ключевых зон Башкирии; работает
//      офлайн и сразу, как справочник водоёмов (waterref.js). Даёт строку в прогнозе.
//   2) OSM / Overpass API (fetchZones) — живые точки размещения по bbox для слоя
//      на карте. Бесплатно, легально (ODbL + атрибуция «© OpenStreetMap»),
//      кэшируется. Глубинка в OSM бедная — сид её подстраховывает.
// Чистая логика (запросы/парсинг/близость) вынесена и покрыта node-тестом.

import { haversineKm } from './geo.js';
import { inRefRegion } from './waterref.js';

// Ручной сид ключевых турзон Башкирии (координаты приблизительные, у берега).
// kind: 'база'|'кемпинг'|'домики'|'гостиница'. Проверено веб-ресёрчем 2026-08.
export const TZ_SEED = [
  { name: 'Павловский Парк',        water: 'Павловское вдхр',  lat: 55.44, lon: 56.66, kind: 'база',    url: 'https://pavlovpark.ru' },
  { name: 'База «Урман»',           water: 'Павловское вдхр',  lat: 55.41, lon: 56.63, kind: 'домики' },
  { name: 'Базы Павловки',          water: 'Павловское вдхр',  lat: 55.46, lon: 56.70, kind: 'база' },
  { name: 'ТК «Нугуш»',             water: 'Нугушское вдхр',   lat: 53.02, lon: 56.50, kind: 'база',    url: 'https://tknugush.ru' },
  { name: 'База «Лесная сказка»',   water: 'Нугушское вдхр',   lat: 53.00, lon: 56.53, kind: 'база' },
  { name: 'Гостевые дома, с. Нугуш',water: 'Нугушское вдхр',   lat: 52.99, lon: 56.47, kind: 'домики' },
  { name: 'Базы Кандрыкуля',        water: 'Озеро Кандрыкуль', lat: 54.50, lon: 54.11, kind: 'база' },
  { name: 'Кемпинги Кандрыкуля',    water: 'Озеро Кандрыкуль', lat: 54.51, lon: 54.14, kind: 'кемпинг' },
  { name: 'Базы Аслыкуля',          water: 'Озеро Аслыкуль',   lat: 54.31, lon: 54.58, kind: 'база' },
  { name: 'База «Белое озеро»',     water: 'Озеро Белое',      lat: 54.13, lon: 56.62, kind: 'домики' },
  { name: 'Базы Банного (Яктыкуль)',water: 'Озеро Яктыкуль',   lat: 53.60, lon: 58.63, kind: 'база' },
  { name: 'Турбаза «Юрюзань»',      water: 'Река Юрюзань',     lat: 55.18, lon: 58.30, kind: 'домики' },
];

// теги OSM, покрывающие «где живут отдыхающие» (по вики: домики = chalet/apartment)
const OSM_TAGS = 'camp_site|chalet|guest_house|apartment|resort|hotel|motel|hostel';

// человекочитаемый тип по тегу tourism
export function kindOf(tags = {}) {
  switch (tags.tourism) {
    case 'camp_site': return 'кемпинг';
    case 'chalet': case 'apartment': return 'домики';
    case 'guest_house': return 'гостевой дом';
    case 'resort': return 'база отдыха';
    case 'hotel': case 'motel': case 'hostel': return 'гостиница';
    default: return 'размещение';
  }
}

// Overpass QL по bbox [south, west, north, east]. Чистая строка (тестируется).
export function buildOverpassQuery(bbox) {
  const [s, w, n, e] = bbox;
  const b = `${s},${w},${n},${e}`;
  return `[out:json][timeout:40];`
    + `(nwr["tourism"~"${OSM_TAGS}"](${b}););`
    + `out center tags 200;`;
}

// Разбор ответа Overpass → [{name, lat, lon, kind}]. Ways/relations дают center.
export function parseOverpass(json) {
  const els = (json && json.elements) || [];
  const out = [];
  for (const el of els) {
    const lat = el.lat != null ? el.lat : (el.center && el.center.lat);
    const lon = el.lon != null ? el.lon : (el.center && el.center.lon);
    if (lat == null || lon == null) continue;
    const t = el.tags || {};
    out.push({ name: t.name || kindOf(t), lat, lon, kind: kindOf(t) });
  }
  return dedupe(out);
}

// убрать дубли по близким координатам (~120 м) и имени
function dedupe(list) {
  const seen = [], res = [];
  for (const z of list) {
    const dup = seen.find(s => Math.abs(s.lat - z.lat) < 0.0012 && Math.abs(s.lon - z.lon) < 0.0012);
    if (dup) continue;
    seen.push(z); res.push(z);
  }
  return res;
}

// зоны в радиусе maxKm от точки, по возрастанию расстояния (+ _km)
export function nearbyZones(zones, lat, lon, maxKm = 12) {
  if (lat == null || lon == null) return [];
  return (zones || [])
    .filter(z => z && z.lat != null && z.lon != null)
    .map(z => ({ ...z, _km: Math.round(haversineKm(lat, lon, z.lat, z.lon) * 10) / 10 }))
    .filter(z => z._km <= maxKm)
    .sort((a, b) => a._km - b._km);
}

// Строка «людно» для прогноза по месту (из сида, синхронно, офлайн). null — если нечего.
export function crowdNote(zones, lat, lon, maxKm = 12) {
  const near = nearbyZones(zones, lat, lon, maxKm);
  if (!near.length) return null;
  if (near.length >= 3)
    return `🏕 Оживлённая турзона рядом (${near.length} баз/кемпингов) — в выходные и праздники людно, хорошее место занимай пораньше или ищи тише.`;
  return `🏕 Рядом «${near[0].name}» (${near[0].kind}) — можно снять домик; в выходные бывает людно.`;
}

// Строка для прогноза на основе встроенного сида (только стартовый регион).
export function seedCrowdNote(lat, lon) {
  if (!inRefRegion(lat, lon)) return null;
  return crowdNote(TZ_SEED, lat, lon);
}

// ── Живая выгрузка из OSM для слоя на карте (браузер; с кэшем) ────────────────
const OVERPASS = 'https://overpass-api.de/api/interpreter';
const CACHE_KEY = 'zorka_tz_cache';
const TTL_MS = 30 * 24 * 3600 * 1000; // 30 дней — турбазы меняются медленно

function bboxKey(bbox) { return bbox.map(x => Math.round(x * 10) / 10).join(','); }

function readCache(key) {
  try {
    const all = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
    const hit = all[key];
    if (hit && (Number(hit.t) || 0) + TTL_MS > new Date().getTime()) return hit.z;
  } catch (e) {}
  return null;
}
function writeCache(key, zones) {
  try {
    const all = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
    all[key] = { t: new Date().getTime(), z: zones };
    localStorage.setItem(CACHE_KEY, JSON.stringify(all));
  } catch (e) {}
}

// Точки размещения в bbox: OSM (кэш) + сид региона. Не падает без сети (вернёт сид).
export async function fetchZones(bbox) {
  const key = bboxKey(bbox);
  const seed = TZ_SEED.filter(z =>
    z.lat >= bbox[0] && z.lat <= bbox[2] && z.lon >= bbox[1] && z.lon <= bbox[3]);
  const cached = readCache(key);
  if (cached) return mergeZones(cached, seed);
  try {
    const res = await fetch(OVERPASS, { method: 'POST', body: 'data=' + encodeURIComponent(buildOverpassQuery(bbox)) });
    if (!res.ok) throw new Error('overpass ' + res.status);
    const zones = parseOverpass(await res.json());
    writeCache(key, zones);
    return mergeZones(zones, seed);
  } catch (e) {
    return seed; // офлайн/лимит Overpass — показываем хотя бы сид
  }
}

// объединить OSM-точки и сид, убрав совпадения по близости
function mergeZones(osm, seed) { return dedupe([...(osm || []), ...(seed || [])]); }
