'use strict';
// ═══ ИНТЕРФЕЙС ═══════════════════════════════════════════════════════════════
import { ST, saveSettings, uid } from './state.js';
import { SPECIES, byId } from './data.js';
import { computeForecast } from './score.js';
import { fetchWeather, todayIndex } from './weather.js';
import { moonInfo } from './astro.js';
import { CITIES, searchCities, nearestCity, geolocate,
         getPlaces, addPlace, removePlace } from './locations.js';
import * as Diary from './diary.js';
import * as Tackle from './tackle.js';
import { makeCatchCard, shareCard } from './catchcard.js';
import * as Notify from './notify.js';
import * as Regs from './regulations.js';
import * as Cloud from './cloud.js';
import * as Sync from './sync.js';
import * as MapView from './mapview.js';
import { cloudEnabled } from './config.js';

// ── помощники ────────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const clampI = (v,a,b)=>Math.min(b,Math.max(a,v));

const MONTHS_GEN = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
const DOW = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
function ruDateShort(d=new Date()){ return `${DOW[d.getDay()]} · ${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`; }
function ruDateFull(d){ const w=['Воскресенье','Понедельник','Вторник','Среда','Четверг','Пятница','Суббота'][d.getDay()]; return `${w}, ${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`; }

function wDesc(c){ if(c===0)return'ясно'; if(c<=2)return'переменная облачность'; if(c===3)return'пасмурно'; if(c<=49)return'туман'; if(c<=59)return'морось'; if(c<=69)return'дождь'; if(c<=79)return'снег'; if(c<=84)return'ливень'; return'гроза'; }
function wIcon(c){ if(c===0)return'☀️'; if(c<=2)return'⛅'; if(c===3)return'☁️'; if(c<=49)return'🌫️'; if(c<=69)return'🌧️'; if(c<=79)return'❄️'; return'⛈️'; }
function wdName(d){ return ['С','СВ','В','ЮВ','Ю','ЮЗ','З','СЗ'][Math.round(d/45)%8]; }
function pdirTxt(p){ return p==='up'?'растёт ↑':p==='down'?'падает ↓':'стабильно →'; }

function bars(sc){ const n=clampI(Math.round(sc),0,5); return `<span class="bars s${n}"><i></i><i></i><i></i><i></i><i></i></span>`; }

function toast(msg){
  const t=document.createElement('div'); t.className='toast'; t.textContent=msg;
  document.body.appendChild(t);
  requestAnimationFrame(()=>t.classList.add('show'));
  setTimeout(()=>{ t.classList.remove('show'); setTimeout(()=>t.remove(),320); }, 2800);
}

function hourlyBarsHTML(fc){
  const now=new Date().getHours(); const maxH=34;
  const bars=fc.hourly.map(h=>{
    const col=h.sc>=4?'var(--jade)':h.sc>=3?'var(--brass)':h.sc>=2?'#9aa89f':'var(--empty)';
    const ht=Math.max(3,Math.round(h.sc/5*maxH));
    const lab=[0,6,12,18].includes(h.h)?h.h:'';
    return `<div class="hb-wrap${h.h===now?' now':''}"><div class="hb" style="height:${ht}px;background:${col};opacity:${h.h<now?0.4:1}"></div><div class="hb-l">${lab}</div></div>`;
  }).join('');
  return `<div class="lbl" style="margin-top:16px">Клёв по часам</div><div class="hbars">${bars}</div>`;
}

const NAV = [
  ['forecast','Прогноз','<path d="M3 15c3 0 3-3 6-3s3 3 6 3 3-3 6-3M3 9c3 0 3-3 6-3s3 3 6 3 3-3 6-3"/>'],
  ['diary','Дневник','<path d="M4 5a2 2 0 0 1 2-2h13v18H6a2 2 0 0 1-2-2z"/><path d="M9 3v18"/>'],
  ['feed','Лента','<circle cx="9" cy="8" r="3"/><path d="M3.5 20a5.5 5.5 0 0 1 11 0"/><path d="M16 6a3 3 0 0 1 0 6"/><path d="M20.5 20a5.5 5.5 0 0 0-4-5.3"/>'],
  ['map','Карта','<path d="M12 21s-6-5.5-6-10a6 6 0 0 1 12 0c0 4.5-6 10-6 10z"/><circle cx="12" cy="11" r="2"/>'],
  ['tackle','Снасти','<path d="M4 7h16v13H4z"/><path d="M9 7V4h6v3"/>'],
];
function navHTML(){
  return NAV.map(([id,label,path]) =>
    `<button class="${ST.tab===id?'on':''}" onclick="Z.tab('${id}')">
       <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</svg>${label}</button>`).join('');
}

// ── роутер ───────────────────────────────────────────────────────────────────
export function rerender(){
  const main = $('main'); if(!main) return;
  if(ST.tab==='forecast') main.innerHTML = renderForecast();
  else if(ST.tab==='diary') main.innerHTML = renderDiary();
  else if(ST.tab==='feed') main.innerHTML = renderFeed();
  else if(ST.tab==='map') main.innerHTML = renderMap();
  else main.innerHTML = renderTackle();
  $('tabbar').innerHTML = navHTML();
}
function tab(t){ ST.tab=t; if(t==='forecast'&&!ST.weather&&ST.city){ loadWeather(); } else rerender(); }

// ── ПОГОДА / ЗАГРУЗКА ────────────────────────────────────────────────────────
export async function loadWeather(){
  const main=$('main');
  if(!ST.city){ main.innerHTML = noCity(); $('tabbar').innerHTML=navHTML(); return; }
  main.innerHTML = `<div class="center"><div class="loader"></div><p>Загружаем погоду…</p></div>`;
  try{
    const { data, fromCache } = await fetchWeather(ST.city.lat, ST.city.lon);
    ST.weather = data; ST.fromCache = fromCache; rerender();
  }catch(e){
    main.innerHTML = `<div class="center"><div class="ic">📡</div><h2>Нет связи</h2><p>Не удалось загрузить погоду и нет сохранённой копии.</p><button class="act" style="max-width:220px" onclick="Z.reload()">Повторить</button></div>`;
    $('tabbar').innerHTML=navHTML();
  }
}
function noCity(){
  return `<div class="center"><div class="ic">🎣</div><h2>Зорька</h2>
    <p>Выбери водоём или город — покажу прогноз клёва, погоду и лучшие часы.</p>
    <button class="act" style="max-width:240px" onclick="Z.openCity()">Выбрать место</button>
    <button class="act" style="max-width:240px;border-color:var(--jade);color:var(--jade)" onclick="Z.geo()">📍 По геолокации</button></div>`;
}

// ── ЭКРАН: ПРОГНОЗ ───────────────────────────────────────────────────────────
function comfortMood(c){
  const temp = c.maxT>=25?'Жарко':c.maxT>=18?'Тепло':c.maxT>=10?'Прохладно':'Холодно';
  const wind = c.wind<=3?'тихо':c.wind<=7?'ветерок':'ветрено';
  const rain = c.rain?'возможен дождь':'без дождя';
  const good = !c.rain && c.wind<=6 && c.maxT>=15;
  const verdict = good?'отличный день у воды':(c.rain||c.wind>8)?'погода не балует':'нормально у воды';
  return `«${temp}, ${wind}, ${rain} — ${verdict}.»`;
}
const FILTERS = [['predator','Хищник'],['peaceful','Мирная'],['all','Все'],['custom','Своя']];

function renderForecast(){
  if(!ST.city) return noCity();
  if(!ST.weather) { setTimeout(loadWeather,0); return `<div class="center"><div class="loader"></div></div>`; }
  const idx = todayIndex(ST.weather);
  const fc = computeForecast(ST.weather, { filter:ST.filter, custom:ST.custom, todayIdx:idx, lat:ST.city.lat, lon:ST.city.lon });
  const c = fc.conditions;
  const now = new Date(); const nowFrac = (now.getHours()+now.getMinutes()/60)/24*100;
  const bands = fc.windows.map(([a,b])=>`<div class="band" style="left:${a/24*100}%;width:${(b-a)/24*100}%"></div>`).join('');
  const winLabel = fc.bestWindows[0] ? `◆ окно ${fc.bestWindows.join(', ')}` : '◆ ровный день';

  const fishHTML = fc.fish.map(f=>{
    const lure = f.sc===0 ? (f.factors[0]?f.factors[0].tx:'не клюёт') : f.lr[0];
    const spawn = f.sc===0 && f.factors[0] && f.factors[0].tx.startsWith('нерест');
    return `<div class="fr" onclick="Z.tf(this)">
        <span class="fd" style="width:9px;height:9px;border-radius:50%;background:${f.col};flex:none"></span>
        <div class="fn"><b>${f.n}</b><span>${esc(lure)}</span></div>
        ${bars(f.sc)}<span class="chev">▾</span></div>
      <div class="fbody">
        ${spawn?`<div class="spawn-warn">⚠️ Период нереста — рыба почти не кормится</div>`:''}
        ${f.factors.length?`<div class="factors">${f.factors.map(x=>`<span class="ftag ${x.tp}">${esc(x.tx)}</span>`).join('')}</div>`:''}
        <div class="detail-grid"><div class="dg"><div class="k">⏰ Время</div><div class="v">${esc(f.ti)}</div></div>
          <div class="dg"><div class="k">📏 Глубина</div><div class="v">${esc(f.dp)}</div></div></div>
        <div class="lbl">📍 Места</div><div class="tag-row">${f.sp2.map(s=>`<span class="tg">${esc(s)}</span>`).join('')}</div>
        <div class="lbl">🎣 Приманки</div><div class="tag-row">${f.lr.map(l=>`<span class="tg lure">${esc(l)}</span>`).join('')}</div>
        <div class="fish-tip">${esc(f.tp)}</div></div>`;
  }).join('');

  const bestName = fc.bestDay ? fc.bestDay.name : null;
  const upHTML = fc.upcoming.map(u=>{
    const col = u.score>=4?'#2C6E5A':u.score>=3?'#C58A2E':'#7c8a80';
    const best = u.name===bestName;
    return `<div class="dayrow"${best?' style="background:rgba(197,138,46,.10)"':''}>
      <span class="dn">${esc(u.name)}${best?' 🏆':''}</span><span style="font-size:15px">${wIcon(u.wcode)}</span>
      <span class="di">${u.maxT}° / ${u.minT}° · ${u.avgP||''} мм ${pdirTxt(u.pdir).split(' ')[1]||''}</span>
      <span class="dsc" style="color:${col}">${u.score.toFixed(1)}</span></div>`;
  }).join('');

  const ban = ST.city ? Regs.activeBan(Regs.zoneOf(ST.city.name)) : null;
  if (ban) Notify.ensureBan(ban, now.getFullYear());
  const acct = cloudEnabled() ? Cloud.cachedUser() : null;
  return `${ST.fromCache?'<div class="badge-cache">⚠️ офлайн — данные из кэша</div>':''}
    <div class="wash">
      <div class="mast"><div class="t"><button onclick="Z.openCity()">📍 ${esc(ST.city.name)} <span class="chev">▾</span></button></div>
        <div class="mast-right">
          <div class="mr-icons">
            ${cloudEnabled()?(acct
              ? `<button class="bell acct-on" onclick="Z.openAccount()" aria-label="Аккаунт: ${esc(acct.email)}">👤</button>`
              : `<button class="bell" onclick="Z.openAccount()" aria-label="Войти в аккаунт">👤</button>`):''}
            <button class="bell" onclick="Z.openNotif()" aria-label="Уведомления">🔔${Notify.unread()?`<span class="ndot">${Notify.unread()}</span>`:''}</button>
          </div>
          <span class="d">${ruDateShort(now)}</span>
        </div></div>
      <div class="today">
        <div class="k">Сегодня у воды</div>
        <div class="row"><span class="big">${Math.round(ST.weather.hourly.temperature_2m[idx*24+now.getHours()] ?? c.maxT)}°</span>
          <span class="day">${fc.day.label}<br>${fc.day.score.toFixed(1)} / 5</span></div>
        <div class="sub">${wDesc(c.wcode)} · днём ${c.maxT}°, ночью ${c.minT}° · ${wdName(c.avgWD)} ${c.wind} м/с</div>
        <div class="sub">🌊 вода ~${c.wt}° · ${fc.water.label} · давление ${c.avgP} мм ${pdirTxt(c.pdir)}</div>
        <div class="mood">${comfortMood(c)}</div></div>
    </div>
    <svg class="wave" viewBox="0 0 340 22" preserveAspectRatio="none"><path d="M0,12 C60,3 110,20 170,12 C230,4 280,20 340,10 L340,0 L0,0 Z" fill="#EFE9DB"/></svg>
    <div class="body">
      <div class="seg">${FILTERS.map(([id,l])=>`<button class="${ST.filter===id?'on':''}" onclick="Z.filter('${id}')">${l}</button>`).join('')}</div>
      <div class="alm"><div class="ah"><span>Окна клёва</span><b>${winLabel}</b></div>
        <div class="track">${bands}<div class="now" style="left:${nowFrac}%"></div></div>
        <div class="ticks"><span>00</span><span>06</span><span>12</span><span>18</span><span>24</span></div></div>
      ${hourlyBarsHTML(fc)}
      <div class="lbl" style="margin-top:16px">Клёв сегодня</div>
      ${fishHTML || '<p style="color:var(--slate);font-size:13px;margin-top:10px">Нет выбранных видов.</p>'}
      <div class="adv">${esc(fc.advice)}</div>
      <div class="lbl" style="margin-top:8px">Прогноз на 2 недели</div>
      ${(fc.bestDay && fc.bestDay.name!=='Сегодня') ? `<div style="font-family:var(--font-serif);font-size:13.5px;color:var(--jade);margin:8px 0 2px">🏆 Лучший день — <b>${esc(fc.bestDay.name)}</b> · ${fc.bestDay.score.toFixed(1)}/5</div>` : `<div style="font-size:12.5px;color:var(--slate);margin:8px 0 2px">🏆 Лучший день — сегодня</div>`}
      <div class="days">${upHTML}</div>
      <div class="honesty">Прогноз строится на погоде, давлении, луне, воде и сезоне. Станет точнее, когда рыбаки начнут отмечать уловы — это уже заложено.</div>
      <div style="height:8px"></div>
    </div>`;
}

// ── ЭКРАН: ДНЕВНИК ───────────────────────────────────────────────────────────
function renderDiary(){
  const s = Diary.stats();
  const entries = Diary.getEntries();
  const statHTML = `<div class="stats">
    <div class="stat"><b>${s.trips}</b><span>рыбалок</span></div>
    <div class="stat"><b>${s.withCatch}</b><span>с уловом</span></div>
    <div class="stat"><b>${s.fishCount}</b><span>рыб</span></div>
    <div class="stat"><b>${s.totalKg}</b><span>кг</span></div></div>
    ${s.topSpecies.length?`<div class="lbl" style="margin-top:14px">Чаще всего</div><div class="tag-row">${s.topSpecies.map(([n,c])=>`<span class="tg">${esc(n)} · ${c}</span>`).join('')}</div>`:''}`;

  const entriesHTML = entries.length ? entries.map(e=>{
    const w = Diary.entryWeight(e), cnt = Diary.entryCount(e);
    const catches = (e.catches||[]).map(c=>{
      const f=byId(c.species); return `<div class="cl"><span class="cn">${f?f.n:esc(c.species)}</span><span class="cw">${c.weight?c.weight.toFixed(2)+' кг':'—'}</span></div>`;
    }).join('');
    const d = new Date(e.date+'T12:00:00');
    return `<div class="entry">
      <div class="ed"><span class="dt">${d.getDate()} ${MONTHS_GEN[d.getMonth()]}, ${DOW[d.getDay()].toLowerCase()}</span>
        <span class="st">${'★'.repeat(e.rating||0)}${'☆'.repeat(5-(e.rating||0))}</span></div>
      ${(e.spot||e.forecast)?`<div class="em">${e.spot?`<span class="mchip">${esc(e.spot)}</span>`:''}${e.forecast?`<span class="mchip">${e.forecast.avgP||''} мм</span><span class="mchip">${e.forecast.maxT}°</span>`:''}</div>`:''}
      ${cnt?`<div class="catchlist">${catches}<div class="cl tot"><span class="cn">Итого · ${cnt} ${cnt===1?'рыба':'рыб'}</span><span class="cw">${w?w.toFixed(2)+' кг':'—'}</span></div></div>`
           :(e.visited?`<div style="font-size:12.5px;color:var(--slate);margin-top:8px">Был на рыбалке, без улова</div>`:'')}
      ${e.note?`<div class="en">«${esc(e.note)}»</div>`:''}
      <div style="display:flex;gap:8px;margin-top:11px">
        ${(e.catches&&e.catches.length)?`<button class="act" style="flex:1;margin-top:0;padding:9px;border-color:var(--jade);color:var(--jade)" onclick="Z.shareCatch('${e.id}')">📤 Поделиться</button>`:''}
        <button class="act" style="flex:1;margin-top:0;padding:9px" onclick="Z.editEntry('${e.id}')">Изменить</button>
      </div>
    </div>`;
  }).join('') : `<div class="empty"><div class="ei">📖</div><p>Пока пусто. Запиши первую рыбалку — со временем это станет твоей летописью и будет уточнять прогноз.</p></div>`;

  return `<div class="pad"><div class="mast"><span class="t">Дневник</span><span class="d">сезон ${new Date().getFullYear()}</span></div>
    ${statHTML}
    <div class="lbl" style="margin-top:18px">Записи</div>
    ${entriesHTML}
    <button class="act" onclick="Z.newEntry()">＋ Записать рыбалку</button><div style="height:10px"></div></div>`;
}

// ── ЭКРАН: КАРТА ─────────────────────────────────────────────────────────────
function aerialSVG(){
  return `<svg viewBox="0 0 320 190" preserveAspectRatio="xMidYMid slice">
    <rect width="320" height="190" fill="#47592f"/>
    <path d="M-5,-5 C60,10 40,60 90,70 C130,78 120,20 200,10 L-5,0 Z" fill="#5e7440" opacity=".8"/>
    <ellipse cx="255" cy="152" rx="72" ry="46" fill="#5e7440" opacity=".7"/>
    <ellipse cx="38" cy="152" rx="46" ry="34" fill="#3c4d29" opacity=".7"/>
    <circle cx="70" cy="30" r="10" fill="#37481f" opacity=".7"/><circle cx="112" cy="46" r="8" fill="#37481f" opacity=".6"/><circle cx="232" cy="40" r="12" fill="#37481f" opacity=".55"/>
    <path d="M-10,62 C60,82 90,42 150,74 C210,106 240,76 330,110 L330,152 C240,122 210,152 150,114 C90,80 60,118 -10,98 Z" fill="#3f6f74"/>
    <path d="M-10,60 C60,80 90,40 150,72 C210,104 240,74 330,108" fill="none" stroke="#c7b487" stroke-width="4" opacity=".8"/>
    <path d="M150,74 C149,92 148,102 150,114" stroke="#bfe0df" stroke-width="7" opacity=".5" fill="none"/></svg>`;
}
function schemeSVG(){
  return `<svg viewBox="0 0 320 190" preserveAspectRatio="xMidYMid slice">
    <rect width="320" height="190" fill="#eae3d2"/>
    <path d="M-10,46 C60,66 90,26 150,60 C210,94 240,64 330,98 L330,152 C240,122 210,152 150,114 C90,78 60,118 -10,98 Z" fill="#bcd6cb" fill-opacity="0.7" stroke="#2C6E5A" stroke-opacity=".5"/>
    <path d="M150,60 C150,112 120,152 90,190" fill="none" stroke="#2C6E5A" stroke-opacity=".4" stroke-width="9"/></svg>`;
}
function renderMap(){
  const places = getPlaces();
  const center = ST.city ? {lat:ST.city.lat, lon:ST.city.lon} : {lat:55.75, lon:37.62};
  setTimeout(()=>MapView.initMap('mapEl', center, places, (la,lo)=>Z.mapPick(la,lo), ST.mapView), 30);
  const spots = places.length ? places.map((p,i)=>`<div class="spot"><span class="sp-pin"></span>
      <div class="sp-i"><b>${esc(p.name)}</b>${p.depth?`<div class="dn">🌊 ${esc(p.depth)}</div>`:''}<div class="mt">${p.note?esc(p.note):'сохранённое место'}</div></div>
      <button class="rm" style="background:none;border:none;color:var(--bad);font-size:16px;cursor:pointer" onclick="Z.delPlace(${i})">✕</button></div>`).join('')
    : `<div class="empty"><div class="ei">📍</div><p>Пока нет отмеченных мест. Нажми на карту выше, чтобы поставить точку (можно из дома), или кнопку ниже.</p></div>`;

  return `<div class="pad"><div class="mast"><span class="t">Мои места</span><span class="d">${places.length} точек</span></div>
    <div class="mtoggle"><button class="${ST.mapView==='satellite'?'on':''}" onclick="Z.mapView('satellite')">Спутник</button><button class="${ST.mapView!=='satellite'?'on':''}" onclick="Z.mapView('scheme')">Схема</button></div>
    <div id="mapEl" style="height:300px;margin-top:8px;border:1px solid var(--rule);background:#dfe6e0;z-index:0"></div>
    <p style="font-size:11.5px;color:var(--slate);margin-top:6px">📍 Нажми на карту, чтобы поставить метку места — хоть из дома.</p>
    ${spots}
    <button class="act" onclick="Z.newPlace()">＋ Добавить по геолокации</button><div style="height:10px"></div></div>`;
}

// ── ЭКРАН: СНАСТИ ────────────────────────────────────────────────────────────
function renderTackle(){
  const kits = Tackle.getKits();
  const kitsHTML = kits.length ? kits.map(k=>{
    const low = Tackle.lowStock(k);
    const targets = (k.target||[]).map(id=>{const f=byId(id);return f?`<span class="kt">${f.n}</span>`:'';}).join('');
    return `<div class="kit">
      <div class="kh"><span class="kn">${esc(k.icon||'🎣')} ${esc(k.name)}</span><span class="kc">${(k.lures||[]).length} приманок</span></div>
      ${(k.rod||k.reel||k.line)?`<div class="kspec">${k.rod?'Спиннинг — '+esc(k.rod)+'<br>':''}${k.reel?'Катушка — '+esc(k.reel)+'<br>':''}${k.line?'Леска — '+esc(k.line):''}</div>`:''}
      ${targets?`<div class="ktags">${targets}</div>`:''}
      ${low.length?`<div class="kwarn">⚠ <b>${esc(low.map(l=>l.name).join(', '))}</b> — заканчивается, докупить.</div>`:''}
      <button class="act" style="margin-top:11px;padding:8px" onclick="Z.editKit('${k.id}')">Открыть</button>
    </div>`;
  }).join('') : `<div class="empty"><div class="ei">🎣</div><p>Комплектов пока нет. Добавь свои снасти — буду напоминать, что взять и что заканчивается.</p></div>`;

  return `<div class="pad"><div class="mast"><span class="t">Мои снасти</span><span class="d">${kits.length} компл.</span></div>
    ${kitsHTML}
    <button class="act" onclick="Z.newKit()">＋ Добавить комплект</button><div style="height:10px"></div></div>`;
}

// ── ЭКРАН: ЛЕНТА УЛОВОВ ──────────────────────────────────────────────────────
function renderFeed(){
  setTimeout(loadFeed, 0);
  return `<div class="pad"><div class="mast"><span class="t">Лента уловов</span><span class="d">от рыбаков</span></div>
    <p class="honesty" style="border:none;padding-top:8px;margin-top:8px">Реальные уловы рыбаков. Ставь ❤️ и смотри, что и на что берёт. Чем больше нас — тем точнее прогноз. Места показываются огрублённо.</p>
    <div id="feedBody"><div class="center" style="min-height:180px"><div class="loader"></div></div></div><div style="height:10px"></div></div>`;
}
async function loadFeed(){
  const box=$('feedBody'); if(!box) return;
  if(!cloudEnabled()){ box.innerHTML=feedEmpty('Облако не настроено.'); return; }
  try{
    const items=await Cloud.fetchFeed(40);
    if(!items.length){ box.innerHTML=feedEmpty('Пока пусто. Запиши улов в дневнике — и он появится тут (для всех, место огрублённо).'); return; }
    const liked = Cloud.cachedUser() ? await Cloud.myLikes(items.map(i=>i.id)) : new Set();
    box.innerHTML = items.map(it=>feedCard(it, liked.has(it.id))).join('');
  }catch(e){ box.innerHTML=feedEmpty('Не удалось загрузить ленту. '+(e.message||'')); }
}
function feedEmpty(msg){ return `<div class="empty"><div class="ei">🎣</div><p>${esc(msg)}</p></div>`; }
function feedCard(it, mine){
  const f=byId(it.species); const nm=f?f.n:esc(it.species); const col=f?f.col:'#7c8a80';
  const d=it.caught_at?new Date(it.caught_at):null;
  const dl=d?`${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`:'';
  const w=it.weight!=null?` · ${Number(it.weight).toFixed(2).replace('.',',')} кг`:'';
  const sc=it.forecast_score!=null?`<span class="feed-badge">прогноз был ${Number(it.forecast_score).toFixed(1)}/5 ✅</span>`:'';
  return `<div class="feed-card">
    <div class="fc-top"><span class="dot" style="background:${col}"></span>
      <div style="flex:1;min-width:0"><b>${nm}${w}</b><div class="fc-sub">${it.water_name?esc(it.water_name)+' · ':''}${dl}</div></div></div>
    ${sc?`<div class="fc-badges">${sc}</div>`:''}
    <button class="like-btn${mine?' on':''}" onclick="Z.like('${it.id}',this)">❤ <span class="lc">${it.likes||0}</span></button>
  </div>`;
}
async function feedLike(id, btn){
  if(!Cloud.cachedUser()){ toast('Войди в аккаунт, чтобы ставить лайки'); openAccount(); return; }
  const on=!btn.classList.contains('on'); const lc=btn.querySelector('.lc'); const cur=Number(lc.textContent)||0;
  btn.classList.toggle('on',on); lc.textContent=on?cur+1:Math.max(0,cur-1);
  try{ await Cloud.toggleLike(id,on); }
  catch(e){ btn.classList.toggle('on',!on); lc.textContent=cur; toast('Не удалось: '+(e.message||e)); }
}

// ── МОДАЛКИ ──────────────────────────────────────────────────────────────────
function openModal(html){
  closeModal();
  const m = document.createElement('div'); m.className='modal'; m.id='modal';
  m.innerHTML = `<div class="sheet"><button class="close" onclick="Z.closeModal()">✕</button>${html}</div>`;
  m.addEventListener('click', e=>{ if(e.target===m) closeModal(); });
  document.body.appendChild(m);
}
function closeModal(){ const m=$('modal'); if(m) m.remove(); }

// облако / аккаунт
let authEmail = '';
async function openAccount(){
  openModal(`<h3>Облако Зорьки</h3><div class="center" style="min-height:120px"><div class="loader"></div></div>`);
  const user = await Cloud.currentUser();
  const s = document.querySelector('#modal .sheet'); if(!s) return;
  if(user){
    s.innerHTML = `<button class="close" onclick="Z.closeModal()">✕</button><h3>Облако</h3>
      <p style="font-size:14px;margin-top:6px">Вход выполнен:<br><b>${esc(user.email||'')}</b></p>
      <div class="field" style="margin-top:14px"><label>Задать / сменить пароль — чтобы входить на других устройствах</label>
        <input id="ac_setpass" type="password" autocomplete="new-password" placeholder="новый пароль, минимум 6"></div>
      <button class="act" onclick="Z.setPass()">Сохранить пароль</button>
      <p style="font-size:12px;color:var(--slate);margin-top:8px">Дальше на телефоне/айфоне входи этой же почтой и паролем — без писем.</p>
      <button class="act" style="border-color:var(--jade);color:var(--jade);margin-top:12px" onclick="Z.syncNow()">🔄 Синхронизировать сейчас</button>
      <p style="font-size:11.5px;color:var(--slate);margin-top:6px">Дневник, места и снасти синхронизируются сами. Кнопка — если хочешь обновить вручную.</p>
      <button class="act" style="border-color:var(--bad);color:var(--bad);margin-top:10px" onclick="Z.signOut()">Выйти</button>`;
  } else {
    s.innerHTML = accountEmailStep();
  }
}
function accountEmailStep(){
  return `<button class="close" onclick="Z.closeModal()">✕</button><h3>Вход в облако</h3>
    <p style="font-size:12.5px;color:var(--slate);margin:2px 0 10px">Введи почту и пароль. Нет аккаунта — создастся автоматически. Это включит облако: одинаковые данные на всех устройствах и (дальше) сообщество.</p>
    <div class="field"><label>Почта</label><input id="ac_email" type="email" inputmode="email" autocomplete="email" placeholder="you@mail.ru" value="${esc(authEmail)}"></div>
    <div class="field"><label>Пароль</label><input id="ac_pass" type="password" autocomplete="current-password" placeholder="минимум 6 символов"></div>
    <button class="act" onclick="Z.signIn()">Войти</button>`;
}
async function acSignIn(){
  const em=$('ac_email'), pw=$('ac_pass'); if(!em||!pw) return;
  authEmail=em.value.trim(); const pass=pw.value;
  if(!authEmail || !authEmail.includes('@')){ alert('Введи корректную почту'); return; }
  if(!pass || pass.length<6){ alert('Пароль — минимум 6 символов'); return; }
  const s=document.querySelector('#modal .sheet'); const btn=s&&s.querySelector('.act'); if(btn) btn.textContent='Вхожу…';
  try{ await Cloud.signInOrUp(authEmail, pass); closeModal(); toast('Вход выполнен — облако подключено ☁️'); rerender(); Sync.syncOnLogin(); }
  catch(e){ alert(e.message||String(e)); if(btn) btn.textContent='Войти'; }
}
async function acSetPass(){
  const el=$('ac_setpass'); if(!el) return; const pw=el.value;
  if(!pw || pw.length<6){ alert('Пароль — минимум 6 символов'); return; }
  const btn=document.querySelector('#modal .act'); if(btn) btn.textContent='Сохраняю…';
  try{ await Cloud.setPassword(pw); closeModal(); toast('Пароль сохранён — входи им на других устройствах'); }
  catch(e){ alert('Не удалось: '+(e.message||e)); if(btn) btn.textContent='Сохранить пароль'; }
}
async function acSignOut(){ await Cloud.signOut(); closeModal(); toast('Вышли из облака'); rerender(); }
async function acSyncNow(){
  try{ toast('Синхронизирую…'); await Sync.syncNow(); closeModal(); toast('Синхронизировано ☁️'); rerender(); }
  catch(e){ alert('Не удалось: '+(e.message||e)); }
}

// центр уведомлений
function openNotif(){
  const items = Notify.getNotifs();
  const body = items.length
    ? items.map(n=>`<div class="notif${n.read?'':' unread'}"><div class="nt">${esc(n.title)}</div><div class="nb">${esc(n.body)}</div></div>`).join('')
    : `<div class="empty"><div class="ei">🔔</div><p>Пока уведомлений нет. Здесь будут запреты (нерест), жор и важное по твоему водоёму.</p></div>`;
  openModal(`<h3>Уведомления</h3>${body}`);
  Notify.markAllRead();
  rerender();
}

// город
function openCity(){
  openModal(`<h3>Выбор места</h3>
    <div class="field"><input id="citySearch" placeholder="Поиск города…" oninput="Z.searchCity(this.value)" autocomplete="off"></div>
    <button class="act" style="border-color:var(--jade);color:var(--jade);margin-top:10px" onclick="Z.geo()">📍 По моей геолокации</button>
    <div id="cityResults" style="margin-top:10px"></div>`);
  searchCity('');
  setTimeout(()=>{ const el=$('citySearch'); if(el) el.focus(); }, 200);
}
function searchCity(q){
  const box=$('cityResults'); if(!box) return;
  box.innerHTML = searchCities(q).map(c=>`<div class="city-item" onclick="Z.pickCity('${esc(c.n)}','${esc(c.c)}',${c.lat},${c.lon})"><span>${esc(c.n)}</span><span class="city-sub">${esc(c.c)}</span></div>`).join('');
}
function pickCity(name,country,lat,lon){
  ST.city={name,country,lat,lon}; ST.weather=null; saveSettings();
  addPlace({name,country,lat,lon}); closeModal(); loadWeather();
}
async function geo(){
  try{
    const {lat,lon}=await geolocate();
    const near=nearestCity(lat,lon);
    ST.city={name:near?near.n:'Моё место',country:near?near.c:'',lat,lon};
    ST.weather=null; saveSettings(); closeModal(); loadWeather();
  }catch(e){ alert('Не удалось определить геолокацию. Выбери город вручную.'); }
}

// дневник — запись
let draft = null;
function newEntry(dateStr){
  const date = dateStr || new Date().toISOString().slice(0,10);
  const ex = Diary.entryByDate(date);
  draft = ex ? JSON.parse(JSON.stringify(ex)) : { date, visited:true, catches:[], note:'', rating:0, spot:'' };
  if(!draft.catches) draft.catches=[];
  renderEntry();
}
function editEntry(id){ const e=Diary.getEntries().find(x=>x.id===id); if(e){ draft=JSON.parse(JSON.stringify(e)); renderEntry(); } }
function renderEntry(){
  const d=new Date(draft.date+'T12:00:00');
  const picker = SPECIES.map(f=>`<button onclick="Z.addCatch('${f.id}')"><span class="fd" style="background:${f.col}"></span>${f.n}</button>`).join('');
  const rows = draft.catches.map((c,i)=>{ const f=byId(c.species);
    return `<div class="catchrow"><span class="cname">${f?f.n:esc(c.species)}</span>
      <input type="number" step="0.05" min="0" placeholder="кг" value="${c.weight??''}" oninput="Z.setW(${i},this.value)">
      <button class="rm" onclick="Z.rmCatch(${i})">✕</button></div>`; }).join('');
  const stars = [1,2,3,4,5].map(i=>`<span class="${(draft.rating||0)>=i?'on':''}" onclick="Z.setRating(${i})">★</span>`).join('');
  openModal(`<h3>${ruDateFull(d)}</h3>
    <div class="field"><label>Место (по желанию)</label><input id="e_spot" value="${esc(draft.spot||'')}" placeholder="напр. Устье Нугуша"></div>
    <div class="field"><label>Что поймал — по каждой рыбе свой вес</label><div class="fishpick">${picker}</div></div>
    <div id="catchRows">${rows||'<p style="font-size:12px;color:var(--slate);margin:6px 0">Нажми на рыбу выше, чтобы добавить. Вес пустой = «не взвешивал».</p>'}</div>
    <div class="field"><label>Оценка</label><div class="stars" id="stars">${stars}</div></div>
    <div class="field"><label>Заметка</label><textarea id="e_note" placeholder="что сработало, погода, место…">${esc(draft.note||'')}</textarea></div>
    <button class="act" onclick="Z.saveEntry()">Сохранить</button>
    ${draft.id?`<button class="act" style="border-color:var(--bad);color:var(--bad);margin-top:8px" onclick="Z.delEntry('${draft.id}')">Удалить запись</button>`:''}`);
}
function addCatch(species){ draft.catches.push({species, weight:null}); syncEntryFields(); renderEntry(); }
function rmCatch(i){ draft.catches.splice(i,1); syncEntryFields(); renderEntry(); }
function setW(i,v){ draft.catches[i].weight = v===''?null:parseFloat(v)||null; }
function setRating(r){ draft.rating=r; syncEntryFields(); renderEntry(); }
function syncEntryFields(){ const s=$('e_spot'),n=$('e_note'); if(s)draft.spot=s.value; if(n)draft.note=n.value; }
function saveEntry(){
  syncEntryFields();
  draft.visited=true;
  // приложить снимок погоды, если есть
  if(ST.weather && !draft.forecast){
    try{ const idx=todayIndex(ST.weather); const fc=computeForecast(ST.weather,{filter:'all',todayIdx:idx});
      draft.forecast={maxT:fc.conditions.maxT,minT:fc.conditions.minT,avgP:fc.conditions.avgP,pdir:fc.conditions.pdir,wt:fc.conditions.wt,score:fc.day.score}; }catch(e){}
  }
  const saved = draft;
  Diary.upsertEntry(saved); draft=null; closeModal(); rerender(); Sync.pushSoon();
  if(cloudEnabled() && Cloud.cachedUser())
    Cloud.publishCatches(saved, ST.city?ST.city.name:'', ST.city?{lat:ST.city.lat,lon:ST.city.lon}:{}).catch(e=>console.warn('publish:',e.message));
}
function delEntry(id){ if(confirm('Удалить запись?')){ Diary.deleteEntry(id); draft=null; closeModal(); rerender(); Sync.pushSoon(); } }
async function shareCatch(id){
  const e = Diary.getEntries().find(x => x.id === id); if (!e) return;
  try {
    const blob = await makeCatchCard(e, ST.city ? ST.city.name : '');
    if (!blob) return;
    const res = await shareCard(blob, 'ulov-zorka.png');
    if (res === 'saved') toast('Карточка сохранена — поделись ей из галереи 📤');
  } catch (err) { alert('Не удалось создать карточку: ' + (err && err.message || err)); }
}

// снасти — комплект
let kitDraft = null;
const KIT_ICONS = ['🎣','🐟','🦈','⚓','🌊','🎯'];
function newKit(){ kitDraft={ icon:'🎣', name:'', rod:'', reel:'', line:'', target:[], lures:[] }; renderKit(); }
function editKit(id){ const k=Tackle.getKits().find(x=>x.id===id); if(k){ kitDraft=JSON.parse(JSON.stringify(k)); renderKit(); } }
function renderKit(){
  const icons = KIT_ICONS.map(ic=>`<button onclick="Z.kitIcon('${ic}')" style="font-size:18px;background:${kitDraft.icon===ic?'rgba(44,110,90,.12)':'var(--card)'};border:1px solid ${kitDraft.icon===ic?'var(--jade)':'var(--line)'};padding:6px 9px;cursor:pointer">${ic}</button>`).join('');
  const targets = SPECIES.map(f=>`<button class="${(kitDraft.target||[]).includes(f.id)?'on':''}" onclick="Z.kitTarget('${f.id}')"><span class="fd" style="background:${f.col}"></span>${f.n}</button>`).join('');
  const lures = (kitDraft.lures||[]).map((l,i)=>`<div class="lure-row"><div class="li"><b>${esc(l.name)}</b><span>${esc(l.type||'')}${l.color?' · '+esc(l.color):''}</span></div>
    <div class="qty"><button onclick="Z.lureQty(${i},-1)">−</button><span class="qv ${(l.qty??0)<=(l.minQty??1)?'low':''}">${l.qty??'?'}</span><button onclick="Z.lureQty(${i},1)">＋</button></div>
    <button class="rm" style="background:none;border:none;color:var(--bad);cursor:pointer" onclick="Z.rmLure(${i})">✕</button></div>`).join('');
  openModal(`<h3>${kitDraft.id?'Комплект':'Новый комплект'}</h3>
    <div class="field"><label>Иконка</label><div style="display:flex;gap:6px;flex-wrap:wrap">${icons}</div></div>
    <div class="field"><label>Название</label><input id="k_name" value="${esc(kitDraft.name)}" placeholder="Микроджиг, Твичинг, Фидер…"></div>
    <div class="field"><label>Спиннинг / удилище</label><input id="k_rod" value="${esc(kitDraft.rod||'')}" placeholder="напр. Nautilus 3–5 г"></div>
    <div class="field"><label>Катушка</label><input id="k_reel" value="${esc(kitDraft.reel||'')}" placeholder="напр. Shimano 1000"></div>
    <div class="field"><label>Леска / плетёнка</label><input id="k_line" value="${esc(kitDraft.line||'')}" placeholder="напр. PE #0.6, 150 м"></div>
    <div class="field"><label>На какую рыбу</label><div class="fishpick">${targets}</div></div>
    <div class="field"><label>Приманки (учёт остатка)</label>${lures||'<p style="font-size:12px;color:var(--slate)">Добавь приманку ниже.</p>'}</div>
    <div class="field" style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
      <input id="l_name" placeholder="Название"><input id="l_type" placeholder="Тип (блесна…)">
      <input id="l_qty" type="number" min="0" placeholder="Кол-во"><input id="l_min" type="number" min="0" placeholder="Мин. остаток">
    </div>
    <button class="act" style="padding:8px;margin-top:8px" onclick="Z.addLure()">＋ Добавить приманку</button>
    <button class="act" onclick="Z.saveKit()">Сохранить комплект</button>
    ${kitDraft.id?`<button class="act" style="border-color:var(--bad);color:var(--bad);margin-top:8px" onclick="Z.delKit('${kitDraft.id}')">Удалить</button>`:''}`);
}
function syncKit(){ ['name','rod','reel','line'].forEach(k=>{const el=$('k_'+k); if(el) kitDraft[k]=el.value;}); }
function kitIcon(ic){ syncKit(); kitDraft.icon=ic; renderKit(); }
function kitTarget(id){ syncKit(); kitDraft.target=kitDraft.target||[]; const i=kitDraft.target.indexOf(id); if(i>=0)kitDraft.target.splice(i,1); else kitDraft.target.push(id); renderKit(); }
function addLure(){ syncKit(); const n=$('l_name').value.trim(); if(!n){alert('Название приманки');return;}
  kitDraft.lures=kitDraft.lures||[]; kitDraft.lures.push({name:n,type:$('l_type').value.trim(),color:'',qty:parseInt($('l_qty').value)||0,minQty:parseInt($('l_min').value)||1}); renderKit(); }
function lureQty(i,d){ kitDraft.lures[i].qty=Math.max(0,(kitDraft.lures[i].qty||0)+d); renderKit(); }
function rmLure(i){ kitDraft.lures.splice(i,1); renderKit(); }
function saveKit(){ syncKit(); if(!kitDraft.name){alert('Введи название комплекта');return;} Tackle.upsertKit(kitDraft); kitDraft=null; closeModal(); rerender(); Sync.pushSoon(); }
function delKit(id){ if(confirm('Удалить комплект?')){ Tackle.deleteKit(id); kitDraft=null; closeModal(); rerender(); Sync.pushSoon(); } }

// места
function newPlace(coords){
  const picked = coords && coords.lat != null;
  placeCoords = picked ? {lat:coords.lat, lon:coords.lon} : (ST.city ? {lat:ST.city.lat,lon:ST.city.lon} : null);
  const label = picked ? `точка на карте (${coords.lat.toFixed(4)}, ${coords.lon.toFixed(4)})` : (ST.city?esc(ST.city.name):'—');
  openModal(`<h3>Новое место</h3>
    <div class="field"><label>Название</label><input id="p_name" placeholder="напр. Ивановская яма"></div>
    <div class="field"><label>Глубина / рельеф (по желанию)</label><input id="p_depth" placeholder="напр. яма 4 м, коряги, свал"></div>
    <div class="field"><label>Заметка</label><input id="p_note" placeholder="как подъехать, что ловится…"></div>
    ${picked?'':'<button class="act" style="border-color:var(--jade);color:var(--jade)" onclick="Z.placeGeo()">📍 Взять мои координаты</button>'}
    <button class="act" onclick="Z.savePlace()">Сохранить место</button>
    <p id="p_coords" style="font-size:11px;color:var(--slate);margin-top:8px">Координаты: ${label}</p>`);
}
let placeCoords = null;
async function placeGeo(){ try{ placeCoords=await geolocate(); const el=$('p_coords'); if(el)el.textContent='Координаты: моя геолокация ✓'; }catch(e){ alert('Не удалось получить геолокацию'); } }
function savePlace(){
  const name=$('p_name').value.trim(); if(!name){alert('Введи название');return;}
  const c = placeCoords || (ST.city?{lat:ST.city.lat,lon:ST.city.lon}:{lat:0,lon:0});
  addPlace({name, depth:$('p_depth').value.trim(), note:$('p_note').value.trim(), lat:c.lat, lon:c.lon, country:''});
  closeModal(); rerender(); Sync.pushSoon();
}
function delPlace(i){ if(confirm('Удалить место?')){ removePlace(i); rerender(); Sync.pushSoon(); } }

// ── экспорт API для inline-обработчиков ──────────────────────────────────────
export function initUI(){
  Notify.ensureWelcome();
  Sync.onSynced(() => rerender());
  if (cloudEnabled() && Cloud.cachedUser()) Sync.syncOnLogin();
  // возврат по ссылке из письма: supabase кладёт токен в hash — примем сессию
  if (cloudEnabled() && window.location && /access_token|error_code/.test(window.location.hash || '')) {
    Cloud.currentUser().then(u => {
      if (u) { try { history.replaceState(null, '', window.location.pathname); } catch(e){} toast('Вход выполнен — облако подключено ☁️'); rerender(); }
    }).catch(()=>{});
  }
  window.Z = {
    tab, reload:()=>loadWeather(),
    filter:(f)=>{ ST.filter=f; saveSettings(); rerender(); },
    tf:(el)=>el.classList.toggle('open'),
    openCity, searchCity, pickCity, geo, closeModal, openNotif,
    openAccount, signIn: acSignIn, setPass: acSetPass, signOut: acSignOut, syncNow: acSyncNow, like: feedLike,
    newEntry, editEntry, addCatch, rmCatch, setW, setRating, saveEntry, delEntry, shareCatch,
    newKit, editKit, kitIcon, kitTarget, addLure, lureQty, rmLure, saveKit, delKit,
    mapView:(v)=>{ ST.mapView=v; MapView.setLayer(v); document.querySelectorAll('.mtoggle button').forEach((b,i)=>b.classList.toggle('on',(i===0)===(v==='satellite'))); },
    mapPick:(la,lo)=>newPlace({lat:la,lon:lo}), newPlace, placeGeo, savePlace, delPlace,
  };
}
