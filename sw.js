'use strict';
// ═══ SERVICE WORKER — офлайн-режим ═══════════════════════════════════════════
// Стратегия: оболочку приложения кэшируем (offline-first), погоду (Open-Meteo)
// не кэшируем на уровне SW — у приложения свой кэш в localStorage на 3 часа.

const VERSION = 'zorka-v22';
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

  // сторонние запросы (Open-Meteo и пр.) — только сеть, без кэша SW
  if (url.origin !== location.origin) return;

  // оболочка: сеть в первую очередь + обход HTTP-кэша (всегда свежий код),
  // кэш — как офлайн-резерв
  e.respondWith(
    fetch(req, { cache: 'reload' }).then(res => {
      const copy = res.clone();
      caches.open(VERSION).then(c => c.put(req, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match(req).then(hit => hit || caches.match('./index.html')))
  );
});
