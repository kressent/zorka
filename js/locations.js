'use strict';
// ═══ ГОРОДА И МЕСТА ══════════════════════════════════════════════════════════
const PLACES_KEY = 'zorka_places';

export const CITIES = [
  {n:'Москва',c:'Россия',lat:55.75,lon:37.62},{n:'Санкт-Петербург',c:'Россия',lat:59.93,lon:30.32},
  {n:'Екатеринбург',c:'Россия',lat:56.83,lon:60.60},{n:'Новосибирск',c:'Россия',lat:54.99,lon:82.90},
  {n:'Казань',c:'Россия',lat:55.80,lon:49.12},{n:'Уфа',c:'Россия',lat:54.74,lon:55.97},
  {n:'Салават',c:'Россия',lat:53.36,lon:55.92},{n:'Стерлитамак',c:'Россия',lat:53.62,lon:55.95},
  {n:'Белорецк',c:'Россия',lat:53.97,lon:58.40},{n:'Мелеуз',c:'Россия',lat:52.96,lon:55.93},
  {n:'Кумертау',c:'Россия',lat:52.76,lon:55.79},{n:'Самара',c:'Россия',lat:53.20,lon:50.15},
  {n:'Оренбург',c:'Россия',lat:51.77,lon:55.10},{n:'Пермь',c:'Россия',lat:58.00,lon:56.23},
  {n:'Челябинск',c:'Россия',lat:55.15,lon:61.37},{n:'Тюмень',c:'Россия',lat:57.15,lon:65.53},
  {n:'Омск',c:'Россия',lat:54.99,lon:73.37},{n:'Красноярск',c:'Россия',lat:56.01,lon:92.85},
  {n:'Иркутск',c:'Россия',lat:52.29,lon:104.28},{n:'Владивосток',c:'Россия',lat:43.12,lon:131.89},
  {n:'Ростов-на-Дону',c:'Россия',lat:47.23,lon:39.72},{n:'Краснодар',c:'Россия',lat:45.04,lon:38.98},
  {n:'Воронеж',c:'Россия',lat:51.67,lon:39.18},{n:'Волгоград',c:'Россия',lat:48.72,lon:44.52},
  {n:'Саратов',c:'Россия',lat:51.53,lon:46.03},{n:'Астрахань',c:'Россия',lat:46.35,lon:48.03},
  {n:'Архангельск',c:'Россия',lat:64.54,lon:40.54},{n:'Тольятти',c:'Россия',lat:53.51,lon:49.42},
  {n:'Ижевск',c:'Россия',lat:56.85,lon:53.22},{n:'Томск',c:'Россия',lat:56.50,lon:84.97},
  {n:'Барнаул',c:'Россия',lat:53.35,lon:83.75},{n:'Нижний Новгород',c:'Россия',lat:56.32,lon:44.00},
  {n:'Минск',c:'Беларусь',lat:53.90,lon:27.57},{n:'Гомель',c:'Беларусь',lat:52.43,lon:30.99},
  {n:'Брест',c:'Беларусь',lat:52.10,lon:23.68},{n:'Алматы',c:'Казахстан',lat:43.25,lon:76.92},
  {n:'Астана',c:'Казахстан',lat:51.19,lon:71.45},{n:'Уральск',c:'Казахстан',lat:51.24,lon:51.37},
  {n:'Киев',c:'Украина',lat:50.45,lon:30.52},{n:'Харьков',c:'Украина',lat:49.99,lon:36.23},
  {n:'Ташкент',c:'Узбекистан',lat:41.30,lon:69.27},{n:'Бишкек',c:'Кыргызстан',lat:42.87,lon:74.59},
];

export function searchCities(q) {
  q = (q || '').trim().toLowerCase();
  if (!q) return CITIES.slice(0, 30);
  return CITIES.filter(c => c.n.toLowerCase().includes(q) || c.c.toLowerCase().includes(q)).slice(0, 30);
}

export function nearestCity(lat, lon) {
  let best = null, bd = Infinity;
  for (const c of CITIES) {
    const d = (c.lat - lat) ** 2 + (c.lon - lon) ** 2;
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

// сохранённые места пользователя
export function getPlaces() {
  try { return JSON.parse(localStorage.getItem(PLACES_KEY) || '[]'); } catch (e) { return []; }
}
export function savePlaces(p) {
  try { localStorage.setItem(PLACES_KEY, JSON.stringify(p)); } catch (e) {}
}
export function addPlace(place) {
  const p = getPlaces();
  if (!p.find(x => x.name === place.name && Math.abs(x.lat - place.lat) < 0.01)) {
    p.push(place); savePlaces(p);
  }
}
export function removePlace(i) { const p = getPlaces(); p.splice(i, 1); savePlaces(p); }

// геолокация браузера → Promise<{lat, lon}>
export function geolocate() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('нет геолокации'));
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      err => reject(err),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 }
    );
  });
}
