'use strict';
// Считает прогноз для точки, переиспользуя тот же движок, что и приложение.
import { fetchWeather, todayIndex } from '../js/weather.js';
import { computeForecast } from '../js/score.js';

export async function getForecast(place) {
  const { data } = await fetchWeather(place.lat, place.lon);
  const idx = todayIndex(data);
  return computeForecast(data, {
    filter: place.filter || 'all', todayIdx: idx, lat: place.lat, lon: place.lon,
  });
}
