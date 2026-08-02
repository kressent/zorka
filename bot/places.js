'use strict';
// Водоёмы, по которым бот постит ежедневный прогноз в канал.
// Начинаем с одного региона (density-стратегия) — Белая, Башкирия.
export const PLACES = [
  { name: 'Павловское вдхр',  lat: 55.42, lon: 56.65, filter: 'all' },
  { name: 'Нугушское вдхр',   lat: 53.02, lon: 56.50, filter: 'all' },
  { name: 'Белая · Салават',  lat: 53.36, lon: 55.92, filter: 'all' },
  { name: 'Озеро Аслыкуль',   lat: 54.30, lon: 54.58, filter: 'all' },
  { name: 'Белая · Уфа',      lat: 54.74, lon: 55.97, filter: 'all' },
];
