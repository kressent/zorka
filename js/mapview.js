'use strict';
// ═══ КАРТА (Leaflet) ═════════════════════════════════════════════════════════
// Настоящая интерактивная карта: спутник (Esri) + схема (OSM), тап по карте
// ставит точку (можно из дома). Бесплатно, без ключей. Библиотека грузится
// лениво с CDN (нужна сеть; офлайн карта не работает — остальное приложение да).

let _L = null, _loading = null, _map = null, _base = {}, _spotLayer = null, _pin = null;

function loadLeaflet() {
  if (_L) return Promise.resolve(_L);
  if (_loading) return _loading;
  _loading = new Promise((res, rej) => {
    if (!document.getElementById('leaflet-css')) {
      const l = document.createElement('link');
      l.id = 'leaflet-css'; l.rel = 'stylesheet';
      l.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(l);
    }
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    s.onload = () => { _L = window.L; res(_L); };
    s.onerror = () => rej(new Error('нет сети'));
    document.head.appendChild(s);
  });
  return _loading;
}

export async function initMap(elId, center, places, onPick, layer) {
  const el = document.getElementById(elId); if (!el) return;
  try {
    const L = await loadLeaflet();
    if (!document.getElementById(elId)) return;           // экран уже сменили
    if (_map) { try { _map.remove(); } catch (e) {} _map = null; }
    _map = L.map(el, { zoomControl: true }).setView([center.lat, center.lon], 12);
    _base.osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      { maxZoom: 19, attribution: '© OpenStreetMap' });
    _base.sat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 19, attribution: '© Esri' });
    (layer === 'scheme' ? _base.osm : _base.sat).addTo(_map);
    _spotLayer = L.layerGroup().addTo(_map);
    drawSpots(L, places);
    _map.on('click', (e) => {
      if (_pin) _spotLayer.removeLayer(_pin);
      _pin = L.circleMarker([e.latlng.lat, e.latlng.lng], { radius: 8, color: '#C58A2E', fillColor: '#C58A2E', fillOpacity: .9, weight: 2 }).addTo(_spotLayer);
      if (onPick) onPick(e.latlng.lat, e.latlng.lng);
    });
    setTimeout(() => { try { _map.invalidateSize(); } catch (e) {} }, 250);
  } catch (e) {
    el.innerHTML = '<div class="empty" style="min-height:auto;padding:2rem 1rem"><div class="ei">🗺</div>'
      + '<p>Карта не загрузилась (нет сети?). Обнови страницу. Места ниже всё равно на месте.</p></div>';
  }
}

function drawSpots(L, places) {
  if (!_spotLayer) return;
  (places || []).forEach(p => {
    if (p.lat && p.lon)
      L.circleMarker([p.lat, p.lon], { radius: 7, color: '#2C6E5A', fillColor: '#C58A2E', fillOpacity: .9, weight: 2 })
        .addTo(_spotLayer).bindPopup('<b>' + (p.name || '') + '</b>' + (p.depth ? '<br>' + p.depth : ''));
  });
}

export function setLayer(which) {
  if (!_map || !_base.osm) return;
  if (which === 'satellite') { _map.removeLayer(_base.osm); _base.sat.addTo(_map); }
  else { _map.removeLayer(_base.sat); _base.osm.addTo(_map); }
}
