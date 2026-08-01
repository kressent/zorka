'use strict';
// ═══ ДОСТИЖЕНИЯ (бейджи) ═════════════════════════════════════════════════════
// Геймификация/удержание. Чистая логика (тестируется) на основе личных рекордов.
import { personalRecords } from './records.js';

const DEFS = [
  { id: 'first',   icon: '🎣', name: 'Первый улов',              need: 1,   of: r => r.totalFish },
  { id: 'ten',     icon: '🐟', name: 'Десятка',                  need: 10,  of: r => r.totalFish },
  { id: 'fifty',   icon: '🎏', name: 'Полсотни',                 need: 50,  of: r => r.totalFish },
  { id: 'hundred', icon: '💯', name: 'Сотня',                    need: 100, of: r => r.totalFish },
  { id: 'sp5',     icon: '🌈', name: 'Разнообразие · 5 видов',   need: 5,   of: r => r.speciesCount },
  { id: 'sp10',    icon: '📚', name: 'Знаток · 10 видов',        need: 10,  of: r => r.speciesCount },
  { id: 'trophy1', icon: '🏆', name: 'Трофей',                   need: 1,   of: r => r.trophies },
  { id: 'trophy5', icon: '👑', name: 'Коллекция трофеев · 5',    need: 5,   of: r => r.trophies },
  { id: 'days10',  icon: '📅', name: 'Постоянство · 10 дней',    need: 10,  of: r => r.days },
  { id: 'waters3', icon: '🗺️', name: 'Исследователь · 3 водоёма',need: 3,   of: r => r.waters },
  { id: 'waters10',icon: '🧭', name: 'Странник · 10 водоёмов',   need: 10,  of: r => r.waters },
  { id: 'lures5',  icon: '🧰', name: 'Арсенал · 5 приманок',     need: 5,   of: r => r.luresUsed },
  { id: 'kg10',    icon: '⚖️', name: '10 кг за сезон',           need: 10000, of: r => r.totalG },
];

export function achievements(entries) {
  const r = personalRecords(entries);
  return DEFS.map(d => {
    const cur = d.of(r) || 0;
    return { id: d.id, icon: d.icon, name: d.name, need: d.need, cur, done: cur >= d.need };
  });
}
