'use strict';
// ═══ КАРТА (Leaflet) ═════════════════════════════════════════════════════════
// Настоящая интерактивная карта: спутник (Esri) + схема (OSM), тап по карте
// ставит точку (можно из дома). Бесплатно, без ключей. Библиотека грузится
// лениво с CDN (нужна сеть; офлайн карта не работает — остальное приложение да).

let _L = null, _loading = null, _map = null, _base = {}, _spotLayer = null, _pin = null, _catchLayer = null, _zoneLayer = null;

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
    if (_map.attributionControl) _map.attributionControl.setPrefix(false); // убрать «Leaflet 🇺🇦»
    _base.osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      { maxZoom: 19, attribution: '© OpenStreetMap' });
    _base.sat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 19, attribution: '© Esri' });
    // подписи (населённые пункты, вода) поверх спутника — гибрид
    _base.labels = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 19 });
    applyBase(layer);
    _spotLayer = L.layerGroup().addTo(_map);
    _catchLayer = L.layerGroup().addTo(_map);
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

// применить базовый слой: схема = OSM; спутник = снимок + подписи (гибрид)
function applyBase(which) {
  if (!_map) return;
  [_base.osm, _base.sat, _base.labels].forEach(l => { if (l && _map.hasLayer(l)) _map.removeLayer(l); });
  if (which === 'scheme') { _base.osm.addTo(_map); }
  else { _base.sat.addTo(_map); if (_base.labels) _base.labels.addTo(_map); }
}

function drawSpots(L, places) {
  if (!_spotLayer) return;
  (places || []).forEach(p => {
    if (p.lat && p.lon)
      L.circleMarker([p.lat, p.lon], { radius: 7, color: '#2C6E5A', fillColor: '#C58A2E', fillOpacity: .9, weight: 2 })
        .addTo(_spotLayer).bindPopup('<b>' + (p.name || '') + '</b>' + (p.depth ? '<br>' + p.depth : ''));
  });
}

// уловы сообщества (огрублённые координаты). marks: [{lat, lon, water_name, label}]
export function drawCatches(marks) {
  if (!_map || !_L) return;
  if (!_catchLayer) _catchLayer = _L.layerGroup().addTo(_map);
  _catchLayer.clearLayers();
  (marks || []).forEach(m => {
    if (m.lat == null || m.lon == null) return;
    _L.circleMarker([m.lat, m.lon], { radius: 6, color: '#C58A2E', fillColor: '#2C6E5A', fillOpacity: .65, weight: 1 })
      .addTo(_catchLayer)
      .bindPopup('🎣 <b>' + (m.water_name || 'Улов') + '</b>' + (m.label ? '<br>' + m.label : ''));
  });
}
export function clearCatches() { if (_catchLayer) _catchLayer.clearLayers(); }

// туристические зоны (базы/кемпинги/домики). zones: [{lat, lon, name, kind}]
export function drawZones(zones) {
  if (!_map || !_L) return;
  if (!_zoneLayer) _zoneLayer = _L.layerGroup().addTo(_map);
  _zoneLayer.clearLayers();
  const icon = _L.divIcon({ className: 'tz-ic', html: '🏕', iconSize: [20, 20], iconAnchor: [10, 10] });
  (zones || []).forEach(z => {
    if (z.lat == null || z.lon == null) return;
    _L.marker([z.lat, z.lon], { icon })
      .addTo(_zoneLayer)
      .bindPopup('🏕 <b>' + (z.name || 'Турзона') + '</b>' + (z.kind ? '<br>' + z.kind : '')
        + (z.url ? '<br><a href="' + z.url + '" target="_blank" rel="noopener">забронировать →</a>' : ''));
  });
  return _zoneLayer.getLayers().length;
}
export function clearZones() { if (_zoneLayer) _zoneLayer.clearLayers(); }
// bbox текущего вида карты [south, west, north, east] — для выгрузки OSM
export function mapBounds() {
  if (!_map) return null;
  try { const b = _map.getBounds(); return [b.getSouth(), b.getWest(), b.getNorth(), b.getEast()]; }
  catch (e) { return null; }
}

// отдельная карта-пикер (для модалки выбора места) — НЕ трогает основную _map
let _pmap = null, _pbase = {};
function pApplyBase(which) {
  if (!_pmap) return;
  [_pbase.osm, _pbase.sat, _pbase.labels].forEach(l => { if (l && _pmap.hasLayer(l)) _pmap.removeLayer(l); });
  if (which === 'scheme') { _pbase.osm.addTo(_pmap); }
  else { _pbase.sat.addTo(_pmap); if (_pbase.labels) _pbase.labels.addTo(_pmap); }
}
export function setPickerLayer(which) { pApplyBase(which === 'scheme' ? 'scheme' : 'sat'); }
export async function initPicker(elId, center, onPick, layer) {
  const el = document.getElementById(elId); if (!el) return;
  try {
    const L = await loadLeaflet();
    if (!document.getElementById(elId)) return;
    if (_pmap) { try { _pmap.remove(); } catch (e) {} _pmap = null; }
    _pmap = L.map(el, { zoomControl: true }).setView([center.lat, center.lon], 11);
    if (_pmap.attributionControl) _pmap.attributionControl.setPrefix(false);
    _pbase.osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' });
    _pbase.sat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: '© Esri' });
    _pbase.labels = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 });
    pApplyBase(layer);
    let pin = null;
    _ppin = (la, lo) => { if (pin) _pmap.removeLayer(pin); pin = L.circleMarker([la, lo], { radius: 8, color: '#C58A2E', fillColor: '#C58A2E', fillOpacity: .9, weight: 2 }).addTo(_pmap); };
    _pmap.on('click', (e) => { _ppin(e.latlng.lat, e.latlng.lng); if (onPick) onPick(e.latlng.lat, e.latlng.lng); });
    setTimeout(() => { try { _pmap.invalidateSize(); } catch (e) {} }, 250);
  } catch (e) {
    el.innerHTML = '<div class="empty" style="min-height:auto;padding:1rem 0.5rem"><p>Карта не загрузилась (нет сети?). Найди место поиском выше.</p></div>';
  }
}
let _ppin = null;
// перевести пикер на точку (после поиска места) + поставить метку
export function panPicker(lat, lon, zoom) {
  if (!_pmap) return;
  try { _pmap.setView([lat, lon], zoom || 13); if (_ppin) _ppin(lat, lon); } catch (e) {}
}
export function destroyPicker() { if (_pmap) { try { _pmap.remove(); } catch (e) {} _pmap = null; _ppin = null; } }

export function setLayer(which) {
  if (!_map || !_base.osm) return;
  applyBase(which === 'scheme' ? 'scheme' : 'sat');
}
