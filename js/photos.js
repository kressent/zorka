'use strict';
// ═══ ФОТО УЛОВОВ (локально) ══════════════════════════════════════════════════
// Фото храним ЛОКАЛЬНО (отдельно от записей дневника), чтобы не раздувать облако
// и синхронизацию. Ключ localStorage 'zorka_photos' = { entryId: dataURL(jpeg) }.
// Сжимаем до ~900px / jpeg — одно фото ~40–80 КБ.

const KEY = 'zorka_photos';

function all() { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; } }
export function getPhoto(id) { if (!id) return null; return all()[id] || null; }
export function setPhoto(id, dataUrl) {
  try { const m = all(); m[id] = dataUrl; localStorage.setItem(KEY, JSON.stringify(m)); return true; }
  catch (e) { return false; }   // QuotaExceeded и пр. — молча
}
export function delPhoto(id) { try { const m = all(); delete m[id]; localStorage.setItem(KEY, JSON.stringify(m)); } catch (e) {} }

// сжать выбранный файл-картинку → dataURL(jpeg). maxSide — макс. сторона.
export function compressImage(file, maxSide = 900, quality = 0.6) {
  return new Promise((res, rej) => {
    if (!file) return rej(new Error('нет файла'));
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      let w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
      if (Math.max(w, h) > maxSide) { const k = maxSide / Math.max(w, h); w = Math.round(w * k); h = Math.round(h * k); }
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const g = c.getContext('2d'); g.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      try { res(c.toDataURL('image/jpeg', quality)); } catch (e) { rej(e); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('не удалось прочитать фото')); };
    img.src = url;
  });
}
