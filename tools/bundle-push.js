'use strict';
// Копирует чистые модули движка в папку Edge-функции forecast-push/lib,
// чтобы серверный прогноз был ИДЕНТИЧЕН клиентскому (без дублирования логики).
// Запуск:  node tools/bundle-push.js   (перед деплоем функции, если движок менялся)
import { copyFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'js');
const dst = join(root, 'supabase', 'functions', 'forecast-push', 'lib');
mkdirSync(dst, { recursive: true });

const FILES = ['data.js', 'astro.js', 'score.js', 'forecastAlert.js'];
for (const f of FILES) { copyFileSync(join(src, f), join(dst, f)); console.log('  ✓ ' + f); }
console.log('Готово: движок скопирован в forecast-push/lib (' + FILES.length + ' файла).');
