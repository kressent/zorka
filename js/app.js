'use strict';
// ═══ СТАРТ ═══════════════════════════════════════════════════════════════════
import { loadSettings } from './state.js';
import { initUI, rerender } from './ui.js';

function boot() {
  try {
    loadSettings();
    initUI();
    rerender();            // отрисует активный экран (прогноз сам подтянет погоду)
  } catch (err) {
    console.error('Init error:', err);
    const m = document.getElementById('main');
    if (m) m.innerHTML = '<div class="center"><div class="ic">⚠️</div><h2>Ошибка</h2>'
      + '<p>Попробуй перезагрузить.</p><button class="act" style="max-width:200px" onclick="location.reload()">Перезагрузить</button></div>';
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();

// офлайн-режим
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(e => console.warn('SW:', e));
  });
}
