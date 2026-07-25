'use strict';
// ═══ ОТМЕТКИ ВОДЫ ОТ РЫБАКОВ ═════════════════════════════════════════════════
// Народный сигнал о состоянии воды (чистая/муть/сброс) рядом. Чистая логика
// (тестируется): фильтр по близости и свежести + сводка по состояниям.
import { haversineKm } from './geo.js';

export const WATER_STATES = {
  clear: { icon: '🟢', label: 'чистая' },
  murky: { icon: '🟡', label: 'мутновата' },
  flood: { icon: '🔴', label: 'муть / сброс' },
};

export function summarizeWater(reports, lat, lon, opts = {}) {
  const maxKm = opts.maxKm != null ? opts.maxKm : 100;
  const days = opts.days != null ? opts.days : 5;
  const now = opts.now != null ? opts.now : Date.now();
  const from = now - days * 86400000;
  const near = (reports || []).filter(r => {
    if (!r || r.lat == null || r.lon == null || !WATER_STATES[r.state]) return false;
    const t = r.created_at ? new Date(r.created_at).getTime() : 0;
    if (t < from) return false;
    if (lat != null && lon != null && haversineKm(lat, lon, r.lat, r.lon) > maxKm) return false;
    return true;
  });
  const counts = { clear: 0, murky: 0, flood: 0 };
  near.forEach(r => { counts[r.state]++; });
  let dominant = null, max = 0;
  for (const k of ['flood', 'murky', 'clear']) { if (counts[k] > max) { max = counts[k]; dominant = k; } }
  return { counts, total: near.length, dominant };
}
