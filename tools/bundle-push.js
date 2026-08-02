'use strict';
// Копирует чистые модули движка/логики в папки Edge-функций (lib), чтобы серверный
// код был ИДЕНТИЧЕН клиентскому (без дублирования логики). Запуск перед деплоем
// функций, если что-то из движка менялось:  node tools/bundle-push.js
import { copyFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'js');
const fns = join(root, 'supabase', 'functions');

// какой функции какие модули нужны
const TARGETS = {
  'forecast-push': ['data.js', 'astro.js', 'score.js', 'forecastAlert.js'],
  'telegram-bot':  ['data.js', 'astro.js', 'score.js', 'postgen.js', 'locations.js'],
  'telegram-daily':['data.js', 'astro.js', 'score.js', 'postgen.js'],
};

for (const [fn, files] of Object.entries(TARGETS)) {
  const dst = join(fns, fn, 'lib');
  mkdirSync(dst, { recursive: true });
  for (const f of files) copyFileSync(join(src, f), join(dst, f));
  console.log(`  ✓ ${fn}/lib ← ${files.join(', ')}`);
}
console.log('Готово: движок разложен по функциям.');
