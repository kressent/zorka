# 🖼 Иконки для сторов — как получить PNG из `icons/icon.svg`

> В вебе иконка уже векторная (`icons/icon.svg`) + есть `icon-192.png` / `icon-512.png`.
> Для сторов и обёртки нужны PNG нужных размеров. Браузерные/оффлайн-рецепты ниже.

## Нужные размеры
- **512×512** — стор-иконка (RuStore, Google Play), маскируемая.
- **192×192** — PWA/ярлык (уже есть).
- **1024×1024** — про запас (Play, ассеты).
- **maskable** — с «безопасным полем»: держи ключевой рисунок в центральных ~80%.

## Способ 1 — онлайн-конвертер (быстро)
1. Открой [svgtopng.com](https://svgtopng.com) / [cloudconvert.com](https://cloudconvert.com)
   или [realfavicongenerator.net](https://realfavicongenerator.net).
2. Загрузи `icons/icon.svg`, выставь размер (512, затем 192, 1024), фон — как в SVG
   (бумажный/прозрачный по контексту), скачай PNG.
3. Положи в `icons/`, при необходимости обнови ссылки в `manifest.webmanifest`.

## Способ 2 — локально, скриптом (без интернета)
Нужен Node с рендером SVG. Вариант через `sharp`:
```
npm i -D sharp
node -e "const s=require('sharp');['192','512','1024'].forEach(n=>s('icons/icon.svg').resize(+n,+n).png().toFile('icons/icon-'+n+'.png').then(()=>console.log(n+' ✓')))"
```
Или через ImageMagick/Inkscape, если установлены:
```
inkscape icons/icon.svg -w 512 -h 512 -o icons/icon-512.png
magick -background none -density 384 icons/icon.svg -resize 512x512 icons/icon-512.png
```

## Способ 3 — прямо в браузере (Canvas)
Открой `icons/icon.svg` на странице, нарисуй в `<canvas>` 512×512, `canvas.toBlob` →
скачать. (Могу собрать мини-страничку-конвертер, если понадобится.)

## Проверка
- Иконка читается на светлом и тёмном фоне телефона.
- В maskable-режиме ничего важного не обрезается по краям (проверь на
  [maskable.app](https://maskable.app)).
