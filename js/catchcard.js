'use strict';
// ═══ КАРТОЧКА УЛОВА ══════════════════════════════════════════════════════════
// Рисует красивую shareable-картинку улова в стиле «Дневной альманах».
// Виральный движок: рыбак делится хвастовством — мы получаем бесплатный охват
// и социальное доказательство точности прогноза («Прогноз был 4/5 ✅»).
import { byId } from './data.js';

const PAPER='#EFE9DB', CARD='#F4EFE3', INK='#10322D', JADE='#2C6E5A',
      BRASS='#C58A2E', SLATE='#5C6E64', LINE='#D8CFBA';
const SERIF = 'Georgia, "Times New Roman", serif';
const SANS  = '"Segoe UI", system-ui, sans-serif';
const MONTHS = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];

// вес: до 1 кг — в граммах, дальше — в килограммах
function fmtW(gr) {
  const x = Number(gr);
  if (!x || x <= 0) return '';
  return x < 1000 ? Math.round(x) + ' г' : (x / 1000).toFixed(x % 1000 === 0 ? 0 : 1).replace('.', ',') + ' кг';
}

// entry: запись дневника; cityName — водоём/город
export async function makeCatchCard(entry, cityName) {
  const W = 1080, H = 1350;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');

  // фон + двойная рамка
  g.fillStyle = PAPER; g.fillRect(0, 0, W, H);
  g.strokeStyle = INK;   g.lineWidth = 7;  strokeRectR(g, 46, 46, W-92, H-92);
  g.strokeStyle = BRASS; g.lineWidth = 2;  strokeRectR(g, 66, 66, W-132, H-132);

  const cx = W / 2;
  g.textAlign = 'center';

  // шапка
  let y = 168;
  setLS(g, 8);
  g.fillStyle = JADE; g.font = `700 40px ${SERIF}`;
  g.fillText('ЗОРЬКА', cx, y);
  setLS(g, 3);
  g.fillStyle = SLATE; g.font = `600 20px ${SANS}`;
  g.fillText('ПРОГНОЗ КЛЁВА · ДНЕВНИК', cx, y + 32);
  setLS(g, 0);

  // дата и место
  y += 92;
  const d = new Date((entry.date || '') + 'T12:00:00');
  const dateStr = isFinite(d) ? `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}` : '';
  g.fillStyle = INK; g.font = `italic 30px ${SERIF}`;
  g.fillText([dateStr, cityName].filter(Boolean).join('  ·  '), cx, y);

  // разделитель
  y += 40; hr(g, 130, y, W-130);

  // заголовок улова — крупная рыба (самая тяжёлая)
  const catches = (entry.catches || []).slice();
  const heavy = catches.filter(x => x.weight != null).sort((a,b) => b.weight - a.weight)[0] || catches[0];
  y += 96;
  if (heavy) {
    const f = byId(heavy.species);
    g.fillStyle = INK; g.font = `700 84px ${SERIF}`;
    g.fillText(f ? f.n : heavy.species, cx, y);
    if (heavy.weight != null) {
      g.fillStyle = BRASS; g.font = `700 56px ${SERIF}`;
      g.fillText(fmtW(heavy.weight), cx, y + 66);
      y += 66;
    }
  } else {
    g.fillStyle = INK; g.font = `700 64px ${SERIF}`;
    g.fillText('Был на рыбалке', cx, y);
  }

  // остальной улов + итог
  y += 74;
  const others = catches.filter(x => x !== heavy);
  if (others.length) {
    g.fillStyle = SLATE; g.font = `28px ${SANS}`;
    const line = others.map(x => {
      const f = byId(x.species);
      return (f ? f.n : x.species) + (x.weight != null ? ' ' + fmtW(x.weight) : '');
    }).join('  ·  ');
    wrapText(g, '+ ' + line, cx, y, W - 240, 36);
    y += 36 * Math.ceil(g.measureText('+ ' + line).width / (W - 240));
  }
  if (catches.length) {
    const total = catches.reduce((s, x) => s + (x.weight || 0), 0);
    const cnt = catches.length;
    y += 20;
    setLS(g, 2);
    g.fillStyle = INK; g.font = `600 24px ${SANS}`;
    g.fillText(`ИТОГО: ${cnt} ${cnt === 1 ? 'рыба' : 'рыб'}` + (total ? ` · ${fmtW(total)}` : ''), cx, y);
    setLS(g, 0);
  }

  // условия того дня (снимок прогноза)
  const fc = entry.forecast;
  y = H - 430;
  hr(g, 130, y, W-130);
  y += 62;
  if (fc) {
    const chips = [];
    if (fc.maxT != null) chips.push(`🌡 ${fc.maxT}°`);
    if (fc.avgP) chips.push(`📊 ${fc.avgP} мм`);
    if (fc.wt != null) chips.push(`🌊 вода ~${fc.wt}°`);
    g.fillStyle = SLATE; g.font = `26px ${SANS}`;
    g.fillText(chips.join('     '), cx, y);
    y += 20;
    // бейдж «прогноз был X/5» — соц-доказательство
    if (fc.score != null && catches.length) {
      y += 44;
      const txt = `Прогноз был ${fc.score.toFixed(1)}/5  ✅`;
      g.font = `700 30px ${SANS}`;
      const w = g.measureText(txt).width + 56;
      g.fillStyle = BRASS;
      roundRect(g, cx - w/2, y - 34, w, 52, 26); g.fill();
      g.fillStyle = '#fff'; g.fillText(txt, cx, y);
    }
  }

  // заметка
  if (entry.note) {
    y += 66;
    g.fillStyle = SLATE; g.font = `italic 26px ${SERIF}`;
    wrapText(g, '«' + entry.note + '»', cx, y, W - 260, 34);
  }

  // подвал — таглайн
  g.fillStyle = JADE; g.font = `italic 30px ${SERIF}`;
  g.fillText('Зорька знает, когда клюёт', cx, H - 120);

  return await new Promise(res => c.toBlob(b => res(b), 'image/png'));
}

// поделиться (мобильный Web Share, нужен HTTPS) или скачать PNG.
// Возвращает 'shared' | 'saved' | 'cancelled'.
export async function shareCard(blob, filename = 'ulov-zorka.png') {
  try {
    const file = new File([blob], filename, { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], text: 'Мой улов 🎣 Зорька — прогноз клёва' });
      return 'shared';
    }
  } catch (e) { if (e && e.name === 'AbortError') return 'cancelled'; }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return 'saved';
}

// ── помощники рисования ──
function setLS(g, px) { try { g.letterSpacing = px + 'px'; } catch (e) {} }
function hr(g, x1, y, x2) { g.strokeStyle = LINE; g.lineWidth = 2; g.beginPath(); g.moveTo(x1, y); g.lineTo(x2, y); g.stroke(); }
function strokeRectR(g, x, y, w, h) { g.strokeRect(x, y, w, h); }
function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
function wrapText(g, text, cx, y, maxW, lh) {
  const words = String(text).split(' '); let line = '', yy = y;
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (g.measureText(test).width > maxW && line) { g.fillText(line, cx, yy); line = w; yy += lh; }
    else line = test;
  }
  if (line) g.fillText(line, cx, yy);
}
