'use strict';
// в•ђв•ђв•ђ SERVICE WORKER вЂ” РѕС„Р»Р°Р№РЅ-СЂРµР¶РёРј в•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђв•ђ
// РЎС‚СЂР°С‚РµРіРёСЏ: РѕР±РѕР»РѕС‡РєСѓ РїСЂРёР»РѕР¶РµРЅРёСЏ РєСЌС€РёСЂСѓРµРј (offline-first), РїРѕРіРѕРґСѓ (Open-Meteo)
// РЅРµ РєСЌС€РёСЂСѓРµРј РЅР° СѓСЂРѕРІРЅРµ SW вЂ” Сѓ РїСЂРёР»РѕР¶РµРЅРёСЏ СЃРІРѕР№ РєСЌС€ РІ localStorage РЅР° 3 С‡Р°СЃР°.

const VERSION = 'zorka-v14';
const SHELL = [
  './',
  './index.html',
  './css/style.css',
  './manifest.webmanifest',
  './js/app.js',
  './js/ui.js',
  './js/state.js',
  './js/config.js',
  './js/cloud.js',
  './js/sync.js',
  './js/data.js',
  './js/astro.js',
  './js/weather.js',
  './js/score.js',
  './js/diary.js',
  './js/tackle.js',
  './js/locations.js',
  './js/mapview.js',
  './js/catchcard.js',
  './js/notify.js',
  './js/regulations.js',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // СЃС‚РѕСЂРѕРЅРЅРёРµ Р·Р°РїСЂРѕСЃС‹ (Open-Meteo Рё РїСЂ.) вЂ” С‚РѕР»СЊРєРѕ СЃРµС‚СЊ, Р±РµР· РєСЌС€Р° SW
  if (url.origin !== location.origin) return;

  // РѕР±РѕР»РѕС‡РєР°: СЃРµС‚СЊ РІ РїРµСЂРІСѓСЋ РѕС‡РµСЂРµРґСЊ (СЃРІРµР¶РёР№ РєРѕРґ), РєСЌС€ вЂ” РєР°Рє РѕС„Р»Р°Р№РЅ-СЂРµР·РµСЂРІ
  e.respondWith(
    fetch(req).then(res => {
      const copy = res.clone();
      caches.open(VERSION).then(c => c.put(req, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match(req).then(hit => hit || caches.match('./index.html')))
  );
});
