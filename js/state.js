'use strict';
// ═══ СОСТОЯНИЕ ═══════════════════════════════════════════════════════════════
import { allIds } from './data.js';

const SETTINGS_KEY = 'zorka_settings';

export const ST = {
  city: null,             // {name, country, lat, lon}
  filter: 'predator',     // all | predator | peaceful | custom
  custom: allIds(),       // выбранные виды для "своя"
  weather: null,          // сырой ответ Open-Meteo
  fromCache: false,
  tab: 'forecast',        // forecast | diary | map | tackle
  mapView: 'satellite',   // satellite | scheme
};

export function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    if (s.city) ST.city = s.city;
    if (s.filter) ST.filter = s.filter;
    if (Array.isArray(s.custom) && s.custom.length) ST.custom = s.custom;
  } catch (e) { /* ignore */ }
}

export function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({
      city: ST.city, filter: ST.filter, custom: ST.custom,
    }));
  } catch (e) { /* ignore */ }
}

export const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
