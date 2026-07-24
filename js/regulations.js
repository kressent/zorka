'use strict';
// ═══ ПРАВИЛА / НЕРЕСТОВЫЙ ЗАПРЕТ ═════════════════════════════════════════════
// Запрет — вещь ЮРИДИЧЕСКАЯ: конкретные даты по регионам (из «Правил рыболовства»).
// Официального API нет — ведём свою таблицу по регионам и сверяем с сегодня.
// Показываем ТОЛЬКО когда сегодня внутри периода запрета для региона города.
// Даты годовые (МM-DD); реальные могут чуть смещаться по годам — всегда дисклеймер.

const MONTHS_GEN = ['января','февраля','марта','апреля','мая','июня','июля',
                    'августа','сентября','октября','ноября','декабря'];

// регион → период и правила
const REGS = {
  bashkortostan: {
    name: 'Башкортостан',
    from: '04-25', to: '06-05',
    rules: 'Запрещены ловля с лодки, спиннинг и снасти более чем с 2 крючками. '
      + 'Разрешена ловля с берега одной удочкой/донкой (не более 2 крючков). '
      + 'Сети, электроудочки, взрывчатка — под запретом всегда. Есть и ограничения по размеру рыбы.',
    source: 'Правила рыболовства Волжско-Каспийского бассейна',
  },
  // сюда добавляем другие регионы по мере охвата
};

// город → регион (пока — Башкирия; расширяем со временем)
const CITY_ZONE = {
  'Уфа': 'bashkortostan', 'Салават': 'bashkortostan', 'Стерлитамак': 'bashkortostan',
  'Белорецк': 'bashkortostan', 'Мелеуз': 'bashkortostan', 'Кумертау': 'bashkortostan',
};

export const zoneOf = (cityName) => CITY_ZONE[cityName] || null;

function labelMD(md) {
  const [m, d] = md.split('-').map(Number);
  return d + ' ' + MONTHS_GEN[m - 1];
}

// вернёт объект запрета, если СЕГОДНЯ внутри периода региона; иначе null
export function activeBan(zone, date = new Date()) {
  const r = REGS[zone]; if (!r) return null;
  const md = String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
  if (md >= r.from && md <= r.to) {
    return {
      zone, name: r.name, rules: r.rules, source: r.source,
      fromLabel: labelMD(r.from), toLabel: labelMD(r.to),
    };
  }
  return null;
}
