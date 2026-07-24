'use strict';
// ═══ ПРАВИЛА / НЕРЕСТОВЫЙ ЗАПРЕТ ═════════════════════════════════════════════
// Запрет — юридический, по регионам и датам («Правила рыболовства»). Единого API
// нет, точные даты по каждому водоёму утверждает местная рыбоохрана. Поэтому:
//   • для регионов с проверенными датами — показываем точный период и правила;
//   • для остальных — мягкое СЕЗОННОЕ напоминание в общероссийское окно (апр–июн)
//     без ложной конкретики, всегда с «проверь официальные правила».
// Показываем ТОЛЬКО когда сегодня внутри соответствующего периода.

const MONTHS_GEN = ['января','февраля','марта','апреля','мая','июня','июля',
                    'августа','сентября','октября','ноября','декабря'];

// проверенные регионы (точные даты + правила)
const REGS = {
  bashkortostan: {
    name: 'Башкортостан',
    from: '04-25', to: '06-05',
    rules: 'Запрещены ловля с лодки, спиннинг и снасти более чем с 2 крючками. '
      + 'Разрешена ловля с берега одной удочкой/донкой (не более 2 крючков). '
      + 'Сети, электроудочки, взрывчатка — под запретом всегда. Есть и ограничения по размеру рыбы.',
    source: 'Правила рыболовства Волжско-Каспийского бассейна',
  },
  // добавляем регионы по мере проверки дат
};

// общероссийское «сезонное» окно (ориентировочно) для регионов без точных данных
const GENERIC = {
  from: '04-01', to: '06-20',
  rules: 'Обычно запрещены ловля с лодки, спиннинг и снасти более чем с 2 крючками.',
};

// город → регион (пока — Башкирия; расширяем со временем)
const CITY_ZONE = {
  'Уфа': 'bashkortostan', 'Салават': 'bashkortostan', 'Стерлитамак': 'bashkortostan',
  'Белорецк': 'bashkortostan', 'Мелеуз': 'bashkortostan', 'Кумертау': 'bashkortostan',
};

export const zoneOf = (cityName) => CITY_ZONE[cityName] || null;

function mmdd(date) { return String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0'); }
function labelMD(md) { const [m, d] = md.split('-').map(Number); return d + ' ' + MONTHS_GEN[m - 1]; }

// действующий запрет на сегодня: точный (по региону) или сезонный (общий); иначе null
export function activeBan(zone, date = new Date()) {
  const md = mmdd(date);
  const r = REGS[zone];
  if (r && md >= r.from && md <= r.to) {
    return { zone, generic: false, name: r.name, rules: r.rules, source: r.source,
             fromLabel: labelMD(r.from), toLabel: labelMD(r.to) };
  }
  if (md >= GENERIC.from && md <= GENERIC.to) {
    return { zone: 'generic', generic: true, name: 'большинство регионов РФ', rules: GENERIC.rules,
             fromLabel: labelMD(GENERIC.from), toLabel: labelMD(GENERIC.to) };
  }
  return null;
}
