'use strict';
// ═══ ИНТЕРФЕЙС ═══════════════════════════════════════════════════════════════
import { ST, saveSettings, uid } from './state.js';
import { SPECIES, byId, isTrophy } from './data.js';
import { computeForecast } from './score.js';
import { fetchWeather, todayIndex } from './weather.js';
import { moonInfo } from './astro.js';
import { CITIES, searchCities, nearestCity, geolocate, geoSearch, reverseGeocode,
         getPlaces, addPlace, removePlace, savePlaces } from './locations.js';
import * as Diary from './diary.js';
import * as Tackle from './tackle.js';
import { makeCatchCard, shareCard } from './catchcard.js';
import * as Notify from './notify.js';
import * as Regs from './regulations.js';
import * as Cloud from './cloud.js';
import * as Sync from './sync.js';
import * as MapView from './mapview.js';
import { weekTop, tripHeaviest } from './leaderboard.js';
import { engagementNotifs } from './engagement.js';
import { indexLureStats, topLures } from './lurestats.js';
import { goodDayAlert } from './forecastAlert.js';
import { sortByNear } from './geo.js';
import { summarizeWater, WATER_STATES } from './water.js';
import { nearbyCatches, whereSpecies } from './nearby.js';
import { personalRecords } from './records.js';
import { achievements } from './achievements.js';
import { forecastPost } from './postgen.js';
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
    // удержание: если впереди сильный день — зовём на воду (в колокольчик)
    try{ const idx=todayIndex(data);
      const fc=computeForecast(data,{filter:ST.filter,custom:ST.custom,todayIdx:idx,lat:ST.city.lat,lon:ST.city.lon});
      const a=goodDayAlert(fc.upcoming, fc.day.score); if(a){ Notify.addNotif(a); rerender(); }
    }catch(e){}
    if(cloudEnabled() && !WATER_REPORTS.length) setTimeout(loadWaterReports, 300);
    if(cloudEnabled() && !NEARBY_TRIPS.length) setTimeout(loadNearby, 500);
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
        ${realLureHTML(f.id)}
        <div class="fish-tip">${esc(f.tp)}</div></div>`;
  }).join('');

  const bestName = fc.bestDay ? fc.bestDay.name : null;
  const upHTML = fc.upcoming.map(u=>{
    const col = u.score>=4?'#2C6E5A':u.score>=3?'#C58A2E':'#7c8a80';
    const best = u.name===bestName;
    return `<div class="dayrow" onclick="Z.openDay('${u.date}')" style="cursor:pointer${best?';background:rgba(197,138,46,.10)':''}">
      <span class="dn">${esc(u.name)}${best?' 🏆':''}</span><span style="font-size:15px">${wIcon(u.wcode)}</span>
      <span class="di">${u.maxT}° / ${u.minT}° · ${u.avgP||''} мм ${pdirTxt(u.pdir).split(' ')[1]||''}</span>
      <span class="dsc" style="color:${col}">${u.score.toFixed(1)}</span><span class="chev">▸</span></div>`;
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
      ${nearbyHTML()}
      ${waterReportHTML()}
      <div class="lbl" style="margin-top:8px">Прогноз на 2 недели</div>
      ${(fc.bestDay && fc.bestDay.name!=='Сегодня') ? `<div onclick="Z.openDay('${fc.bestDay.date||''}')" style="cursor:pointer;font-family:var(--font-serif);font-size:13.5px;color:var(--jade);margin:8px 0 2px">🏆 Лучший день — <b>${esc(fc.bestDay.name)}</b> · ${fc.bestDay.score.toFixed(1)}/5 ▸</div>` : `<div style="font-size:12.5px;color:var(--slate);margin:8px 0 2px">🏆 Лучший день — сегодня</div>`}
      <div class="days">${upHTML}</div>
      <button class="act" style="border-color:var(--brass);color:var(--brass)" onclick="Z.openMoon()">🌙 Лунный календарь на 2 недели</button>
      <button class="act" style="border-color:var(--jade);color:var(--jade)" onclick="Z.shareForecast()">📤 Поделиться прогнозом</button>
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
    <div class="stat"><b>${(s.totalG/1000).toFixed(1)}</b><span>кг</span></div></div>
    ${s.topSpecies.length?`<div class="lbl" style="margin-top:14px">Чаще всего</div><div class="tag-row">${s.topSpecies.map(([n,c])=>`<span class="tg">${esc(n)} · ${c}</span>`).join('')}</div>`:''}`;

  const entriesHTML = entries.length ? entries.map(e=>{
    const w = Diary.entryWeight(e), cnt = Diary.entryCount(e);
    const catches = (e.catches||[]).map(c=>{
      const f=byId(c.species); return `<div class="cl"><span class="cn">${f?f.n:esc(c.species)}${c.lure?` <span class="cl-lure">· ${esc(c.lure)}</span>`:''}</span><span class="cw">${c.weight?fmtW(c.weight):'—'}</span></div>`;
    }).join('');
    const d = new Date(e.date+'T12:00:00');
    return `<div class="entry">
      <div class="ed"><span class="dt">${d.getDate()} ${MONTHS_GEN[d.getMonth()]}, ${DOW[d.getDay()].toLowerCase()}${e.private?' <span title="только для тебя">🔒</span>':''}</span>
        <span class="st">${'★'.repeat(e.rating||0)}${'☆'.repeat(5-(e.rating||0))}</span></div>
      ${(e.spot||e.forecast)?`<div class="em">${e.spot?`<span class="mchip">${esc(e.spot)}</span>`:''}${e.forecast?`<span class="mchip">${e.forecast.avgP||''} мм</span><span class="mchip">${e.forecast.maxT}°</span>`:''}</div>`:''}
      ${cnt?`<div class="catchlist">${catches}<div class="cl tot"><span class="cn">Итого · ${cnt} ${cnt===1?'рыба':'рыб'}</span><span class="cw">${w?fmtW(w):'—'}</span></div></div>`
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
    <button class="act" style="margin-top:12px;border-color:var(--brass);color:var(--brass)" onclick="Z.openRecords()">🏆 Мои рекорды и достижения</button>
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
let mapShowCatches=true;
function renderMap(){
  const places = getPlaces();
  const center = ST.city ? {lat:ST.city.lat, lon:ST.city.lon} : {lat:55.75, lon:37.62};
  setTimeout(async ()=>{
    await MapView.initMap('mapEl', center, places, (la,lo)=>Z.mapPick(la,lo), ST.mapView);
    if(cloudEnabled()){
      try{ const items=await getFeed();
        if(mapShowCatches) MapView.drawCatches(items.filter(t=>t.lat!=null&&t.lon!=null).map(t=>({
          lat:t.lat, lon:t.lon, water_name:t.water_name,
          label:(t.fish||[]).filter(f=>f&&f.species).map(f=>{ const b=byId(f.species); return (b?b.n:f.species)+(f.weight?' '+fmtW(f.weight):''); }).join(', ')
        })));
        const sl=$('spotsList'); if(sl) sl.innerHTML=spotsHTML(getPlaces()); // обогатить «рядом ловят»
      }catch(e){}
    }
  }, 30);
  return `<div class="pad"><div class="mast"><span class="t">Мои места</span><span class="d">${places.length} точек</span></div>
    <div class="mtoggle"><button class="${ST.mapView==='satellite'?'on':''}" onclick="Z.mapView('satellite')">Спутник</button><button class="${ST.mapView!=='satellite'?'on':''}" onclick="Z.mapView('scheme')">Схема</button></div>
    <div id="mapEl" style="height:300px;margin-top:8px;border:1px solid var(--rule);background:#dfe6e0;z-index:0"></div>
    ${cloudEnabled()?`<label class="pub-toggle" style="margin:8px 0 0"><input type="checkbox" ${mapShowCatches?'checked':''} onchange="Z.mapCatches(this.checked)"><span>🎣 Показывать уловы рыбаков на карте</span></label>`:''}
    <p style="font-size:11.5px;color:var(--slate);margin-top:6px">📍 Нажми на карту, чтобы поставить метку места — хоть из дома.</p>
    <div id="spotsList">${spotsHTML(places)}</div>
    <button class="act" onclick="Z.newPlace()">＋ Добавить по геолокации</button><div style="height:10px"></div></div>`;
}
function spotsHTML(places){
  if(!places.length) return `<div class="empty"><div class="ei">📍</div><p>Пока нет отмеченных мест. Нажми на карту выше, чтобы поставить точку (можно из дома), или кнопку ниже.</p></div>`;
  return places.map((p,i)=>{
    const near = (_feedCache && p.lat!=null) ? nearbyCatches(_feedCache, p.lat, p.lon, 25).slice(0,3) : [];
    const nearTxt = near.length ? `<div class="sp-catch">🎣 рядом ловят: ${near.map(x=>{const f=byId(x.species);return (f?f.n:esc(x.species))+' ·'+x.count;}).join(', ')}</div>` : '';
    return `<div class="spot"><span class="sp-pin"></span>
      <div class="sp-i"><b>${esc(p.name)}</b>${p.depth?`<div class="dn">🌊 ${esc(p.depth)}</div>`:''}<div class="mt">${p.note?esc(p.note):'сохранённое место'}</div>${nearTxt}</div>
      <button class="rm" style="background:none;border:none;color:var(--bad);font-size:16px;cursor:pointer" onclick="Z.delPlace(${i})">✕</button></div>`;
  }).join('');
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
// вес: до 1 кг — граммы, дальше — кг
function fmtW(gr){
  const x=Number(gr);
  if(!x||x<=0) return '';
  return x<1000 ? Math.round(x)+' г' : (x/1000).toFixed(x%1000===0?0:1).replace('.',',')+' кг';
}

// ── рейтинг рыбака: очки (считает вью angler_stats) → ранг из 5 «рыбок» ──
const RANKS=[
  {n:1,t:'Новичок',min:0},
  {n:2,t:'Рыбак',min:50},
  {n:3,t:'Бывалый',min:150},
  {n:4,t:'Мастер',min:400},
  {n:5,t:'Легенда',min:900},
];
function anglerRank(points){ const p=Number(points)||0; let r=RANKS[0]; for(const x of RANKS) if(p>=x.min) r=x; return r; }
function rankFish(n){ return '<span class="rf">'+'🐟'.repeat(n)+'<span class="rf-off">'+'🐟'.repeat(5-n)+'</span></span>'; }

// ── отметки воды от рыбаков ──
let WATER_REPORTS = [];
async function loadWaterReports(){ if(!cloudEnabled()) return; try{ WATER_REPORTS=await Cloud.fetchWaterReports(); rerender(); }catch(e){} }
function waterReportHTML(){
  if(!cloudEnabled()) return '';
  const sum = ST.city ? summarizeWater(WATER_REPORTS, ST.city.lat, ST.city.lon, {maxKm:100, days:5}) : {counts:{clear:0,murky:0,flood:0},total:0,dominant:null};
  let line;
  if(sum.total){
    const parts=['flood','murky','clear'].filter(k=>sum.counts[k]).map(k=>`${WATER_STATES[k].icon} ${WATER_STATES[k].label} · ${sum.counts[k]}`);
    line=`Рядом отмечают: ${parts.join('   ')} <span class="wr-sub">(за 5 дней, до 100 км)</span>`;
  } else line=`Пока никто не отмечал воду рядом. Отметь первым — поможешь другим рыбакам.`;
  const btn=(s)=>`<button class="wr-btn wr-${s}" onclick="Z.reportWater('${s}')">${WATER_STATES[s].icon} ${WATER_STATES[s].label}</button>`;
  return `<div class="lbl" style="margin-top:16px">🌊 Вода сейчас — от рыбаков</div>
    <div class="wr-line">${line}</div>
    <div class="wr-btns">${btn('clear')}${btn('murky')}${btn('flood')}</div>`;
}
async function reportWater(state){
  if(!Cloud.cachedUser()){ toast('Войди в аккаунт (👤), чтобы отметить воду'); openAccount(); return; }
  if(!ST.city){ toast('Сначала выбери город'); return; }
  try{ await Cloud.reportWater(state, ST.city.lat, ST.city.lon); toast('Спасибо! Отметка учтена 🌊'); loadWaterReports(); }
  catch(e){ toast('Не удалось: '+(e.message||e)); }
}

// ── «что ловят рядом» (маховик по месту) ──
let NEARBY_TRIPS = [];
async function loadNearby(){ if(!cloudEnabled()) return; try{ NEARBY_TRIPS=await getFeed(); rerender(); }catch(e){} }
function nearbyHTML(){
  if(!cloudEnabled() || !ST.city) return '';
  const list = nearbyCatches(NEARBY_TRIPS, ST.city.lat, ST.city.lon, 60).slice(0,6);
  if(!list.length) return '';
  const rows = list.map(x=>{ const f=byId(x.species); const nm=f?f.n:esc(x.species); const col=f?f.col:'#7c8a80';
    return `<div class="nb-row" onclick="Z.where('${x.species}')" style="cursor:pointer"><span class="dot" style="background:${col}"></span><b class="nb-n">${nm}</b><span class="nb-c">${x.count} ${x.count===1?'улов':(x.count<5?'улова':'уловов')}</span>${x.topLure?`<span class="nb-lr">на ${esc(x.topLure)}</span>`:''}<span class="chev">▸</span></div>`; }).join('');
  return `<div class="lbl" style="margin-top:16px">🎣 Здесь реально ловят <span class="lbl-sub">(тапни вид → где его ловят)</span></div><div class="nb-list">${rows}</div>`;
}

function openWhere(species){
  const f=byId(species); const nm=f?f.n:esc(species);
  const lat=ST.city?ST.city.lat:null, lon=ST.city?ST.city.lon:null;
  const list = whereSpecies(NEARBY_TRIPS, species, lat, lon, 300).slice(0,15);
  const rows = list.length ? list.map(x=>{
    const d=x.caught_at?new Date(x.caught_at):null; const dl=d?`${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`:'';
    return `<div class="where-row"><div class="wr-place"><b>${x.water_name?esc(x.water_name):'Без названия'}</b>${x.km!=null?`<span class="wr-km">~${x.km} км</span>`:''}</div><div class="wr-meta">${x.weight?fmtW(x.weight)+' · ':''}${x.lure?'на '+esc(x.lure)+' · ':''}${dl}</div></div>`;
  }).join('') : `<p style="color:var(--slate);font-size:13px;margin-top:8px">Пока никто не отмечал этот вид рядом. Появится, когда рыбаки начнут делиться уловами — это и есть наш маховик. 🎣</p>`;
  openModal(`<h3>Где ловится: ${nm}</h3>
    <p style="font-size:12px;color:var(--slate);margin:2px 0 10px">По реальным уловам рыбаков (места огрублённые, до 300 км от тебя).</p>
    ${rows}`);
}

// ── рейтинг приманок «что на что реально берёт» (маховик данных) ──
let LURE_STATS = {};
async function loadLureStats(){
  if(!cloudEnabled()) return;
  try{ LURE_STATS = indexLureStats(await Cloud.fetchLureRating()); rerender(); }catch(e){}
}
function fmtDate(iso){ try{ const d=new Date(iso+'T12:00:00'); return d.getDate()+' '+MONTHS_GEN[d.getMonth()]; }catch(e){ return ''; } }
function openDay(dateStr){
  if(!ST.weather || !ST.city || !dateStr){ return; }
  const times=ST.weather.daily&&ST.weather.daily.time; const idx=times?times.indexOf(dateStr):-1;
  if(idx<0){ toast('На этот день пока нет данных'); return; }
  let fc; try{ fc=computeForecast(ST.weather,{filter:ST.filter,custom:ST.custom,todayIdx:idx,lat:ST.city.lat,lon:ST.city.lon}); }catch(e){ return; }
  const d=new Date(dateStr+'T12:00:00'); const c=fc.conditions;
  const top=fc.fish.filter(f=>f.sc>0);
  const fishHTML = top.length
    ? top.map(f=>`<div class="dayfish"><span class="fd" style="width:9px;height:9px;border-radius:50%;background:${f.col};flex:none"></span><b class="df-n">${f.n}</b>${bars(f.sc)}<span class="df-lr">${esc(f.lr[0]||'')} · ${esc(f.ti||'')}</span></div>`).join('')
    : `<p style="font-size:13px;color:var(--slate);margin-top:8px">Клёв слабый по большинству видов — день скорее для отдыха у воды.</p>`;
  const col = fc.day.score>=4?'var(--jade)':fc.day.score>=3?'var(--brass)':'var(--slate)';
  const win = (fc.bestWindows&&fc.bestWindows.length) ? fc.bestWindows.join(', ') : 'без выраженных окон';
  openModal(`<h3>${ruDateFull(d)}</h3>
    <div class="dayhdr"><span class="dayscore" style="color:${col}">${fc.day.score.toFixed(1)}<span> / 5</span></span><span class="daylbl">${fc.day.label}</span></div>
    <p style="font-size:12.5px;color:var(--slate);margin:2px 0 12px">${c.maxT}° / ${c.minT}° · давление ${c.avgP||'—'} мм ${pdirTxt(c.pdir)} · вода ~${c.wt}° · окна: ${win}</p>
    <div class="lbl">Что будет клевать</div>
    <div class="dayfish-list">${fishHTML}</div>
    <div class="fish-tip">${esc(fc.advice)}</div>`);
}
function openMoon(){
  const base=new Date(); base.setHours(12,0,0,0);
  const days=[]; for(let i=0;i<14;i++){ const d=new Date(base); d.setDate(base.getDate()+i); days.push({d, m:moonInfo(d)}); }
  const maxSc=Math.max(...days.map(x=>x.m.sc));
  const rows=days.map((x,i)=>{ const best=x.m.sc>=maxSc; const w=Math.round(x.m.sc/5*100);
    return `<div class="moon-row${best?' best':''}"><span class="moon-i">${x.m.icon}</span>
      <div class="moon-d"><b>${i===0?'Сегодня':x.d.getDate()+' '+MONTHS_GEN[x.d.getMonth()]}</b><span>${esc(x.m.name)}</span></div>
      <div class="moon-bar"><i style="width:${w}%"></i></div><span class="moon-sc">${x.m.sc}/5</span></div>`; }).join('');
  openModal(`<h3>🌙 Лунный календарь · 2 недели</h3>
    <p style="font-size:12.5px;color:var(--slate);margin:2px 0 10px">Луна влияет на активность рыбы. Чем ярче полоса — тем лучше по луне. Учитывается и в основном прогнозе.</p>
    ${rows}`);
}
async function shareForecast(){
  if(!(ST.weather && ST.city)) return;
  let text='';
  try{ const idx=todayIndex(ST.weather);
    const fc=computeForecast(ST.weather,{filter:ST.filter,custom:ST.custom,todayIdx:idx,lat:ST.city.lat,lon:ST.city.lon});
    text=forecastPost(fc, ST.city.name);
  }catch(e){ return; }
  try{ if(navigator.share){ await navigator.share({text}); return; } }
  catch(e){ if(e&&e.name==='AbortError') return; }
  try{ await navigator.clipboard.writeText(text); toast('Прогноз скопирован — вставь куда угодно 📋'); }
  catch(e){ toast('Не удалось поделиться'); }
}
function openRecords(){
  const entries = Diary.getEntries();
  const r = personalRecords(entries);
  const ach = achievements(entries);
  const done = ach.filter(a=>a.done).length;
  const pb = r.personalBest;
  const recHTML = `
    <div class="prof-stats prof-stats-3">
      <div><b>${r.totalFish}</b><span>рыб</span></div>
      <div><b>${r.speciesCount}</b><span>видов</span></div>
      <div><b>${r.trophies}</b><span>трофеев</span></div>
    </div>
    ${pb?`<div class="rec-line">🥇 Личный рекорд: <b>${esc(pb.name)} ${fmtW(pb.weight)}</b>${pb.date?` · ${fmtDate(pb.date)}`:''}</div>`:''}
    ${r.favLure?`<div class="rec-line">🎣 Любимая приманка: <b>${esc(r.favLure.lure)}</b> · ${r.favLure.n}</div>`:''}
    ${r.topSpecies?`<div class="rec-line">🐟 Чаще всего: <b>${esc(r.topSpecies.name)}</b> · ${r.topSpecies.n}</div>`:''}
    <div class="rec-line">📅 Дней на воде: <b>${r.days}</b> · всего <b>${(r.totalG/1000).toFixed(1)} кг</b></div>`;
  const trophies = Object.entries(r.biggest).filter(([sp,b])=>isTrophy(sp,b.weight));
  const troHTML = trophies.length ? `<div class="lbl" style="margin-top:16px">🏆 Твои трофеи</div><div class="tag-row">${trophies.map(([sp,b])=>`<span class="tg real">${esc((byId(sp)||{}).n||sp)} ${fmtW(b.weight)}</span>`).join('')}</div>` : '';
  const achHTML = ach.map(a=>`<div class="ach${a.done?' on':''}"><span class="ach-i">${a.icon}</span><span class="ach-n">${esc(a.name)}</span><span class="ach-p">${a.done?'✓':a.cur+'/'+a.need}</span></div>`).join('');
  openModal(`<h3>🏆 Рекорды и достижения</h3>${recHTML}${troHTML}
    <div class="lbl" style="margin-top:16px">Достижения · ${done}/${ach.length}</div>
    <div class="ach-grid">${achHTML}</div>
    <button class="act" style="margin-top:16px" onclick="Z.exportDiary()">📥 Скачать дневник (резервная копия)</button>
    <button class="act" style="margin-top:8px" onclick="Z.importDiary()">📤 Восстановить из файла</button>`);
}
function exportDiary(){
  try{
    const data = { app:'Зорька', version:1, exported:new Date().toISOString(),
      entries:Diary.getEntries(), places:getPlaces(), kits:Tackle.getKits() };
    const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download='zorka-dnevnik.json'; a.click();
    setTimeout(()=>URL.revokeObjectURL(url), 5000);
    toast('Дневник сохранён в файл 📥');
  }catch(e){ toast('Не удалось экспортировать'); }
}
function importDiary(){
  const inp=document.createElement('input'); inp.type='file'; inp.accept='.json,application/json';
  inp.onchange=()=>{ const f=inp.files&&inp.files[0]; if(!f) return;
    const r=new FileReader();
    r.onload=()=>{ try{
      const d=JSON.parse(r.result);
      if(!d || !Array.isArray(d.entries)) throw new Error('это не файл дневника Зорьки');
      if(!confirm('Восстановить дневник из файла? Текущие записи, места и снасти будут заменены.')) return;
      Diary.replaceEntries(d.entries);
      if(Array.isArray(d.places)) savePlaces(d.places);
      if(Array.isArray(d.kits)) Tackle.replaceKits(d.kits);
      closeModal(); rerender(); Sync.pushSoon(); toast('Дневник восстановлен ✅');
    }catch(e){ alert('Не удалось прочитать файл: '+(e.message||e)); } };
    r.readAsText(f);
  };
  inp.click();
}
function realLureHTML(species){
  const top = topLures(LURE_STATS, species, 3);
  if(!top.length) return '';
  const chips = top.map(l=>`<span class="tg real">${esc(l.lure)} <b>·${l.n}</b></span>`).join('');
  return `<div class="lbl">🔥 Реально берут на <span class="lbl-sub">(по уловам рыбаков)</span></div><div class="tag-row">${chips}</div>`;
}

let feedFilter='all', feedSpecies=null;
function renderFeed(){
  setTimeout(loadFeed, 0);
  const btn=(m,l)=>`<button class="${feedFilter===m?'on':''}" onclick="Z.feedMode('${m}')">${l}</button>`;
  return `<div class="pad"><div class="mast"><span class="t">Лента уловов</span><span class="d">от рыбаков</span></div>
    <p class="honesty" style="border:none;padding-top:8px;margin-top:8px">Реальные уловы рыбаков. Ставь ❤️ и смотри, что и на что берёт. Чем больше нас — тем точнее прогноз. Места показываются огрублённо.</p>
    <div class="feed-modes">${btn('all','Все')}${btn('near','📍 Рядом')}${btn('mine','Мои')}</div>
    <div id="feedBody"><div class="center" style="min-height:180px"><div class="loader"></div></div></div><div style="height:10px"></div></div>`;
}
// общий кэш ленты: одна загрузка на ленту/карту/прогноз (force — освежить сразу)
let _feedCache=null, _feedAt=0;
async function getFeed(force){
  const now=Date.now();
  if(!force && _feedCache && (now-_feedAt)<90000) return _feedCache;
  _feedCache = await Cloud.fetchFeed(80); _feedAt=now; return _feedCache;
}
function invalidateFeed(){ _feedCache=null; _feedAt=0; }
async function loadFeed(){
  const box=$('feedBody'); if(!box) return;
  if(!cloudEnabled()){ box.innerHTML=feedEmpty('Облако не настроено.'); return; }
  try{
    const items=await getFeed(true);
    if(!items.length){ box.innerHTML=feedEmpty('Пока пусто. Запиши улов в дневнике — и он появится тут (для всех, место огрублённо).'); return; }
    const me = Cloud.cachedUser() ? await Cloud.currentUserId() : null;
    const liked = me ? await Cloud.myLikes(items.map(i=>i.id)) : new Set();
    const top = weekTop(items, Date.now(), 3);              // «улов недели» — всегда общий
    const lead = top.length?leaderboardHTML(top):'';
    const spAll = [...new Set(items.flatMap(t=>(t.fish||[]).map(f=>f&&f.species).filter(Boolean)))];
    const spChips = spAll.length>1 ? `<div class="feed-sp">${spAll.map(s=>{const b=byId(s);return `<button class="${feedSpecies===s?'on':''}" onclick="Z.feedSp('${s}')">${b?esc(b.n):esc(s)}</button>`;}).join('')}${feedSpecies?'<button class="clr" onclick="Z.feedSp(\'\')">✕</button>':''}</div>` : '';
    let list = items;
    if(feedFilter==='near'){
      if(!ST.city){ box.innerHTML=lead+feedEmpty('Сначала выбери свой город вверху — тогда покажу уловы рядом.'); return; }
      list = sortByNear(items, ST.city.lat, ST.city.lon, 200);
      if(!list.length){ box.innerHTML=lead+feedEmpty('Рядом (до 200 км) уловов пока нет. Будь первым 🎣'); return; }
    } else if(feedFilter==='mine'){
      if(!me){ box.innerHTML=lead+feedEmpty('Войди в аккаунт (👤) — и здесь будут только твои уловы.'); return; }
      list = items.filter(t=>t.user_id===me);
      if(!list.length){ box.innerHTML=lead+feedEmpty('Ты ещё не делился уловами. Запиши рыбалку в дневнике 🎣'); return; }
    }
    if(feedSpecies) list = list.filter(t=>(t.fish||[]).some(f=>f&&f.species===feedSpecies));
    box.innerHTML = lead + spChips + (list.length ? list.map(it=>feedCard(it, liked.has(it.id), me)).join('') : feedEmpty('Нет уловов по этому фильтру.'));
  }catch(e){ box.innerHTML=feedEmpty('Не удалось загрузить ленту. '+(e.message||'')); }
}
function feedEmpty(msg){ return `<div class="empty"><div class="ei">🎣</div><p>${esc(msg)}</p></div>`; }
// одна карточка = один выезд (рыбалка) со списком рыбы
function feedCard(it, mine, myId){
  const d=it.caught_at?new Date(it.caught_at):null;
  const dl=d?`${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`:'';
  const fish=(it.fish||[]).filter(x=>x&&x.species);
  const rows=fish.map(x=>{ const f=byId(x.species); const nm=f?f.n:esc(x.species); const col=f?f.col:'#7c8a80'; const wv=fmtW(x.weight); const tr=isTrophy(x.species,x.weight)?' 🏆':''; const lu=x.lure?`<span class="tc-lure">на ${esc(x.lure)}</span>`:'';
    return `<div class="tc-fish"><span class="dot" style="background:${col}"></span><span class="tc-fn">${nm}${tr}</span>${lu}<span class="tc-fw">${wv||'—'}</span></div>`; }).join('');
  const sc=it.forecast_score!=null?`<span class="feed-badge">прогноз был ${Number(it.forecast_score).toFixed(1)}/5 ✅</span>`:'';
  const rk=anglerRank(it.points);
  const who=`<div class="fc-who"><span class="fc-name">${esc(it.handle||'Рыбак')}</span>${rankFish(rk.n)}<span class="fc-title">${rk.t}</span></div>`;
  const place=it.water_name?esc(it.water_name):'';
  const km=it._km!=null?`${(place||dl)?'<span class="tc-dot">·</span>':''}<span>~${it._km} км</span>`:'';
  const head=`<div class="tc-head">${place?`<b>${place}</b>`:''}${(place&&dl)?'<span class="tc-dot">·</span>':''}${dl?`<span>${dl}</span>`:''}${km}</div>`;
  const isMine = myId && it.user_id===myId;
  const like = isMine
    ? `<div class="tc-own">❤ <span class="lc">${it.likes||0}</span> · твой улов</div>`
    : `<button class="like-btn${mine?' on':''}" onclick="Z.like('${it.id}',this)">❤ <span class="lc">${it.likes||0}</span></button>`;
  const cm = `<button class="cm-btn" onclick="Z.comments('${it.id}')">💬 <span class="cc">${it.comments||0}</span></button>`;
  return `<div class="feed-card">
    ${who}
    ${head}
    <div class="tc-list">${rows||'<div class="tc-fish"><span class="tc-fn" style="color:var(--slate)">Был на рыбалке</span></div>'}</div>
    ${sc?`<div class="fc-badges">${sc}</div>`:''}
    <div class="fc-actions">${like}${cm}</div>
  </div>`;
}
// 🏆 Улов недели — топ выездов за 7 дней (лайки → крупная рыба → свежесть)
function leaderboardHTML(top){
  const win=top[0]; const wh=tripHeaviest(win);
  const wfn=wh?(byId(wh.species)?byId(wh.species).n:esc(wh.species)):'Улов';
  const wfw=wh?fmtW(wh.weight):'';
  const wtr=wh&&isTrophy(wh.species,wh.weight)?' 🏆':'';
  const rows=top.slice(1).map((t,i)=>{ const h=tripHeaviest(t); const nm=h?(byId(h.species)?byId(h.species).n:esc(h.species)):'—'; const w=h?fmtW(h.weight):'';
    return `<div class="lb-row"><span class="lb-pos">${i+2}</span><span class="lb-who">${esc(t.handle||'Рыбак')}</span><span class="lb-fish">${nm}${w?' · '+w:''}</span><span class="lb-likes">❤ ${t.likes||0}</span></div>`; }).join('');
  return `<div class="lb">
    <div class="lb-head">🏆 Улов недели</div>
    <div class="lb-win">
      <div class="lb-win-name">${esc(win.handle||'Рыбак')}</div>
      <div class="lb-win-fish">${wfn}${wfw?` · <b>${wfw}</b>`:''}${wtr}</div>
      <div class="lb-win-sub">${win.water_name?esc(win.water_name)+' · ':''}❤ ${win.likes||0}${win.comments?' · 💬 '+win.comments:''}</div>
    </div>
    ${rows?`<div class="lb-list">${rows}</div>`:''}
  </div>`;
}
async function feedLike(id, btn){
  if(!Cloud.cachedUser()){ toast('Войди в аккаунт, чтобы ставить лайки'); openAccount(); return; }
  const on=!btn.classList.contains('on'); const lc=btn.querySelector('.lc'); const cur=Number(lc.textContent)||0;
  btn.classList.toggle('on',on); lc.textContent=on?cur+1:Math.max(0,cur-1);
  try{ await Cloud.toggleLike(id,on); }
  catch(e){ btn.classList.toggle('on',!on); lc.textContent=cur; toast('Не удалось: '+(e.message||e)); }
}

// ── комментарии к выезду ──
let cmTrip=null;
async function openComments(tripKey){
  cmTrip=tripKey;
  openModal(`<h3>Комментарии</h3><div class="center" style="min-height:100px"><div class="loader"></div></div>`);
  const me = Cloud.cachedUser() ? await Cloud.currentUserId() : null;
  let list=[]; try{ list=await Cloud.fetchComments(tripKey); }catch(e){}
  const s=document.querySelector('#modal .sheet'); if(!s || cmTrip!==tripKey) return;
  s.innerHTML=`<button class="close" onclick="Z.closeModal()">✕</button><h3>Комментарии</h3>
    <div class="cm-list" id="cmList">${renderComments(list, me)}</div>
    ${me?`<div class="cm-add"><input id="cm_input" maxlength="500" placeholder="Написать комментарий…" onkeydown="if(event.key==='Enter')Z.sendComment()"><button class="cm-send" onclick="Z.sendComment()">➤</button></div>`
        :`<p style="font-size:12.5px;color:var(--slate);margin-top:10px">Войди в аккаунт (👤), чтобы комментировать.</p>`}`;
  setTimeout(()=>{ const el=$('cm_input'); if(el) el.focus(); },150);
}
function renderComments(list, me){
  if(!list||!list.length) return `<p class="cm-empty">Пока нет комментариев. Будь первым 🎣</p>`;
  return list.map(c=>{
    const d=c.created_at?new Date(c.created_at):null;
    const dl=d?`${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`:'';
    const mine=me && c.user_id===me;
    return `<div class="cm-item"><div class="cm-h"><b>${esc(c.handle||'Рыбак')}</b><span class="cm-t">${dl}</span>${mine?`<button class="cm-del" onclick="Z.delComment('${c.id}')">✕</button>`:''}</div><div class="cm-b">${esc(c.body)}</div></div>`;
  }).join('');
}
async function refreshComments(){
  const me = Cloud.cachedUser() ? await Cloud.currentUserId() : null;
  let list=[]; try{ list=await Cloud.fetchComments(cmTrip); }catch(e){}
  const box=$('cmList'); if(box) box.innerHTML=renderComments(list, me);
  if(ST.tab==='feed') loadFeed();
}
async function sendComment(){
  const el=$('cm_input'); if(!el) return; const body=el.value.trim(); if(!body) return;
  el.value='';
  try{ await Cloud.addComment(cmTrip, body); await refreshComments(); }
  catch(e){ alert('Не удалось: '+(e.message||e)); }
}
async function delComment(id){
  if(!confirm('Удалить комментарий?')) return;
  try{ await Cloud.deleteComment(id); await refreshComments(); }
  catch(e){ alert('Не удалось: '+(e.message||e)); }
}

// ── уведомления сообщества: лайки/комментарии к моим уловам ──
const SEEN_KEY='zorka_seen_engagement';
function loadSeen(){ try{ return JSON.parse(localStorage.getItem(SEEN_KEY)||'{}'); }catch(e){ return {}; } }
function saveSeen(o){ try{ localStorage.setItem(SEEN_KEY, JSON.stringify(o)); }catch(e){} }
async function checkEngagement(){
  if(!(cloudEnabled() && Cloud.cachedUser())) return;
  let me, items;
  try{ me=await Cloud.currentUserId(); if(!me) return; items=await Cloud.fetchFeed(60); }catch(e){ return; }
  const mine=(items||[]).filter(t=>t.user_id===me);
  if(!mine.length){ return; }
  const { notifs, next } = engagementNotifs(mine, loadSeen());
  notifs.forEach(n=>Notify.addNotif(n));
  saveSeen(next);
  if(notifs.length) rerender();
}

// живое обновление (Realtime): пришло изменение комментария/лайка
let rtTimer=null;
function onCommunityChange(){
  clearTimeout(rtTimer);
  rtTimer=setTimeout(()=>{
    invalidateFeed();                                // данные изменились → кэш устарел
    if(cmTrip && $('cmList')) refreshComments();     // открыта модалка → обновить (она же освежит ленту)
    else if(ST.tab==='feed') loadFeed();             // видна лента → обновить счётчики
    checkEngagement();                               // живой колокольчик
  }, 700);
}

// ── МОДАЛКИ ──────────────────────────────────────────────────────────────────
function openModal(html){
  closeModal();
  const m = document.createElement('div'); m.className='modal'; m.id='modal';
  m.innerHTML = `<div class="sheet"><button class="close" onclick="Z.closeModal()">✕</button>${html}</div>`;
  m.addEventListener('click', e=>{ if(e.target===m) closeModal(); });
  document.body.appendChild(m);
}
function closeModal(){ const m=$('modal'); if(m) m.remove(); try{ MapView.destroyPicker(); }catch(e){} }

// онбординг первого запуска
function maybeOnboard(){
  try{ if(localStorage.getItem('zorka_onboarded')) return; }catch(e){ return; }
  openModal(`<h3>🎣 Добро пожаловать в Зорьку!</h3>
    <div class="onb">
      <div class="onb-row"><span class="onb-i">🌅</span><div class="onb-t"><b>Прогноз клёва</b><p>Каждый день — что клюёт, когда и на что. По погоде, давлению, луне и воде.</p></div></div>
      <div class="onb-row"><span class="onb-i">📖</span><div class="onb-t"><b>Дневник</b><p>Записывай уловы — это твоя летопись, и она уточняет прогноз лично для тебя.</p></div></div>
      <div class="onb-row"><span class="onb-i">🎣</span><div class="onb-t"><b>Что ловят рядом</b><p>Узнай по реальным уловам рыбаков: какая рыба берёт на твоём водоёме и на что. Чем нас больше — тем полезнее.</p></div></div>
    </div>
    <button class="act" onclick="Z.onboardDone()">Поехали! 🐟</button>`);
}
function onboardDone(){ try{ localStorage.setItem('zorka_onboarded','1'); }catch(e){} closeModal(); }

// облако / аккаунт
let authEmail = '';
let deferredPrompt = null;
async function promptInstall(){
  if(deferredPrompt){ deferredPrompt.prompt(); let o={}; try{ o=await deferredPrompt.userChoice; }catch(e){} deferredPrompt=null; if(o.outcome==='accepted') toast('Устанавливается 📲'); return; }
  const iOS=/iphone|ipad|ipod/i.test(navigator.userAgent||'');
  if(iOS) alert('На айфоне: нажми «Поделиться» (квадрат со стрелкой ↑) внизу Safari → «На экран «Домой»». Запускай с иконки — так удобнее и работают уведомления.');
  else alert('В меню браузера (⋮) выбери «Установить приложение» или «Добавить на главный экран».');
}
async function openAccount(){
  openModal(`<h3>Мой профиль</h3><div class="center" style="min-height:120px"><div class="loader"></div></div>`);
  const user = await Cloud.currentUser();
  const s = document.querySelector('#modal .sheet'); if(!s) return;
  if(user){
    await Cloud.ensureProfile().catch(()=>{});
    const st = await Cloud.myStats().catch(()=>null);
    const handle = (st&&st.handle)||'';
    const pts = (st&&st.points)||0;
    const rk = anglerRank(pts);
    const nextR = RANKS.find(r=>r.min>pts);
    const toNext = nextR ? `до «${nextR.t}» — ${nextR.min-pts} очков уважения` : 'высший ранг 🏆';
    s.innerHTML = `<button class="close" onclick="Z.closeModal()">✕</button>
      <div class="prof-head">
        <div class="prof-fish">${rankFish(rk.n)}</div>
        <div class="prof-name">${esc(handle||'Рыбак')}</div>
        <div class="prof-title">${rk.t} · ${pts} очков уважения</div>
        <div class="prof-next">${toNext}</div>
      </div>
      <p class="prof-hint">Очки уважения растут от лайков других рыбаков и медленно тускнеют без рыбалки. Накрутить количеством рыбы нельзя.</p>
      <div class="prof-stats prof-stats-3">
        <div><b>${st?st.catches||0:0}</b><span>уловов</span></div>
        <div><b>${st?st.species||0:0}</b><span>видов</span></div>
        <div><b>${st?st.days||0:0}</b><span>дней</span></div>
      </div>
      <div class="field" style="margin-top:14px"><label>Ник в ленте — как тебя видят другие рыбаки</label>
        <input id="ac_handle" maxlength="24" value="${esc(handle)}" placeholder="напр. Щукарь52"></div>
      <button class="act" onclick="Z.saveHandle()">Сохранить ник</button>
      <button class="act" style="border-color:var(--brass);color:var(--brass);margin-top:10px" onclick="Z.install()">📲 Установить на телефон</button>
      <details class="acc-more"><summary>Аккаунт и синхронизация</summary>
        <p style="font-size:13px;margin-top:8px">Вход выполнен: <b>${esc(user.email||'')}</b></p>
        <div class="field" style="margin-top:10px"><label>Сменить пароль (для входа на других устройствах)</label>
          <input id="ac_setpass" type="password" autocomplete="new-password" placeholder="новый пароль, минимум 6"></div>
        <button class="act" onclick="Z.setPass()">Сохранить пароль</button>
        ${Cloud.pushConfigured()?`<button class="act" style="border-color:var(--jade);color:var(--jade);margin-top:12px" onclick="Z.enablePush()">🔔 Пуш-уведомления на телефон</button>`:''}
        <button class="act" style="border-color:var(--jade);color:var(--jade);margin-top:12px" onclick="Z.syncNow()">🔄 Синхронизировать сейчас</button>
        <button class="act" style="border-color:var(--bad);color:var(--bad);margin-top:10px" onclick="Z.signOut()">Выйти</button>
      </details>`;
  } else {
    s.innerHTML = accountEmailStep();
  }
}
function accountEmailStep(){
  return `<button class="close" onclick="Z.closeModal()">✕</button><h3>Вход в облако</h3>
    <p style="font-size:12.5px;color:var(--slate);margin:2px 0 10px">Введи почту и пароль. Нет аккаунта — создастся автоматически. Это включит облако: одинаковые данные на всех устройствах и (дальше) сообщество.</p>
    <div class="field"><label>Почта</label><input id="ac_email" type="email" inputmode="email" autocomplete="email" placeholder="you@mail.ru" value="${esc(authEmail)}"></div>
    <div class="field"><label>Пароль</label><input id="ac_pass" type="password" autocomplete="current-password" placeholder="минимум 6 символов"></div>
    <button class="act" onclick="Z.signIn()">Войти</button>
    <button class="act" style="border-color:var(--brass);color:var(--brass);margin-top:10px" onclick="Z.install()">📲 Установить на телефон</button>`;
}
function errMsg(e){
  if(!e) return 'Неизвестная ошибка';
  if(typeof e==='string') return e;
  const m = e.message || e.error_description || e.msg || e.error || e.hint;
  if(m && String(m).trim() && String(m)!=='{}') return String(m);
  try{ const s=JSON.stringify(e); if(s && s!=='{}') return s; }catch(_){}
  return 'Не удалось. Проверь связь и настройки, попробуй ещё раз.';
}
async function acSignIn(){
  const em=$('ac_email'), pw=$('ac_pass'); if(!em||!pw) return;
  authEmail=em.value.trim(); const pass=pw.value;
  if(!authEmail || !authEmail.includes('@')){ alert('Введи корректную почту'); return; }
  if(!pass || pass.length<6){ alert('Пароль — минимум 6 символов'); return; }
  const s=document.querySelector('#modal .sheet'); const btn=s&&s.querySelector('.act'); if(btn) btn.textContent='Вхожу…';
  try{ await Cloud.signInOrUp(authEmail, pass); closeModal(); toast('Вход выполнен — облако подключено ☁️'); Cloud.ensureProfile().catch(()=>{}); Cloud.subscribeCommunity(onCommunityChange).catch(()=>{}); setTimeout(checkEngagement,1500); rerender(); Sync.syncOnLogin(); }
  catch(e){ alert(errMsg(e)); if(btn) btn.textContent='Войти'; }
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
async function acEnablePush(){
  try{ await Cloud.enablePush(); toast('Пуш включён — будем присылать на телефон 📲'); }
  catch(e){ alert('Не удалось: '+(e.message||e)); }
}
async function acSaveHandle(){
  const el=$('ac_handle'); if(!el) return; const h=el.value.trim();
  if(h.length<2){ alert('Имя слишком короткое'); return; }
  try{ await Cloud.setHandle(h); toast('Ник сохранён: '+h); if(ST.tab==='feed') loadFeed(); }
  catch(e){ alert('Не удалось: '+(e.message||e)); }
}

// центр уведомлений
function openNotif(){
  const items = Notify.getNotifs();
  const body = items.length
    ? items.map(n=>`<div class="notif${n.read?'':' unread'}"><div class="nt">${esc(n.title)}</div><div class="nb">${esc(n.body)}</div></div>`).join('')
    : `<div class="empty"><div class="ei">🔔</div><p>Пока уведомлений нет. Здесь будут запреты (нерест), жор и важное по твоему водоёму.</p></div>`;
  const clr = items.length ? `<button class="act" style="padding:6px;font-size:12px;margin:0 0 10px;border-color:var(--slate);color:var(--slate)" onclick="Z.clearNotifs()">Очистить всё</button>` : '';
  openModal(`<h3>Уведомления</h3>${clr}${body}`);
  Notify.markAllRead();
  rerender();
}
function clearNotifs(){ Notify.clearAll(); closeModal(); rerender(); }

// город
function openCity(){
  openModal(`<h3>Где ты / куда едешь</h3>
    <div class="field"><input id="citySearch" placeholder="Город, посёлок, село, деревня…" oninput="Z.searchCity(this.value)" autocomplete="off"></div>
    <button class="act" style="border-color:var(--jade);color:var(--jade)" onclick="Z.geo()">📍 По моей геолокации</button>
    <div id="cityResults" style="margin-top:10px"></div>
    <div class="lbl" style="margin-top:14px">Или ткни точку прямо на карте</div>
    <div id="cityMap" style="height:220px;border:1px solid var(--rule);background:#dfe6e0;z-index:0;margin-top:6px"></div>
    <p style="font-size:11px;color:var(--slate);margin-top:6px">Тап по карте поставит прогноз ровно туда, где ты — хоть на конкретный омут.</p>`);
  searchCity('');
  setTimeout(()=>{ const el=$('citySearch'); if(el) el.focus(); }, 200);
  const center = ST.city ? {lat:ST.city.lat,lon:ST.city.lon} : {lat:54.0,lon:56.0};
  setTimeout(()=>MapView.initPicker('cityMap', center, (la,lo)=>Z.cityPick(la,lo), ST.mapView||'satellite'), 80);
}
let citySearchTimer=null;
function cityItemsHTML(list){
  return (list||[]).map(c=>`<div class="city-item" onclick="Z.pickCity('${escJs(c.n)}','${escJs(c.c||'')}',${c.lat},${c.lon})"><span>${esc(c.n)}</span><span class="city-sub">${esc(c.c||'')}</span></div>`).join('');
}
function searchCity(q){
  const box=$('cityResults'); if(!box) return;
  const local = searchCities(q);
  box.innerHTML = cityItemsHTML(local);
  clearTimeout(citySearchTimer);
  if(String(q||'').trim().length<2) return;
  citySearchTimer=setTimeout(async ()=>{
    const inp=$('citySearch'); if(inp && inp.value.trim()!==String(q).trim()) return; // ввод устарел
    const res = await geoSearch(q);
    const inp2=$('citySearch'); if(inp2 && inp2.value.trim()!==String(q).trim()) return; // устарел, пока ждали ответ
    const b=$('cityResults'); if(!b) return;
    if(res.length) b.innerHTML = cityItemsHTML(res);
    else if(!local.length) b.innerHTML = '<p style="font-size:12.5px;color:var(--slate);padding:8px 2px">Ничего не нашлось. Попробуй иначе или ткни точку на карте ниже.</p>';
  }, 550);
}
function pickCity(name,country,lat,lon){
  ST.city={name,country,lat,lon}; ST.weather=null; saveSettings(); closeModal(); loadWeather();
}
async function geo(){
  try{
    const {lat,lon}=await geolocate();
    let p=null; try{ p=await reverseGeocode(lat,lon); }catch(e){}
    if(!p){ const near=nearestCity(lat,lon); p={n:near?near.n:'Моё место',c:near?near.c:''}; }
    ST.city={name:p.n,country:p.c||'',lat,lon};
    ST.weather=null; saveSettings(); closeModal(); loadWeather();
  }catch(e){ alert('Не удалось определить геолокацию. Разреши доступ к геопозиции или ткни точку на карте.'); }
}
async function cityPick(lat,lon){
  let p=null; try{ p=await reverseGeocode(lat,lon); }catch(e){}
  ST.city={ name: p?p.n:'Точка на карте', country: p?(p.c||''):'', lat, lon };
  ST.weather=null; saveSettings(); closeModal(); loadWeather();
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
    const cands = lureCandidates(c.species);
    const chips = cands.map(l=>`<button class="lure-chip${c.lure===l?' on':''}" onclick="Z.setLure(${i},'${escJs(l)}')">${esc(l)}</button>`).join('');
    const customOn = c.lure && !cands.includes(c.lure);
    return `<div class="catchrow"><span class="cname">${f?f.n:esc(c.species)}</span>
      <input type="number" step="10" min="0" inputmode="numeric" placeholder="грамм" value="${c.weight??''}" oninput="Z.setW(${i},this.value)"><span class="cunit">г</span>
      <button class="rm" onclick="Z.rmCatch(${i})">✕</button></div>
      <div class="lure-chips"><span class="lure-lbl">на что:</span>${chips}<button class="lure-chip cust${customOn?' on':''}" onclick="Z.lureCustom(${i})">${customOn?esc(c.lure):'+ своё'}</button></div>`; }).join('');
  const stars = [1,2,3,4,5].map(i=>`<span class="${(draft.rating||0)>=i?'on':''}" onclick="Z.setRating(${i})">★</span>`).join('');
  openModal(`<h3>${ruDateFull(d)}</h3>
    <div class="field"><label>Дата рыбалки</label><input type="date" id="e_date" value="${draft.date}" max="${new Date().toISOString().slice(0,10)}" onchange="Z.setDate(this.value)"></div>
    <div class="field"><label>Место (по желанию)</label><input id="e_spot" value="${esc(draft.spot||'')}" placeholder="напр. Устье Нугуша"></div>
    <div class="field"><label>Точка на карте (по желанию)</label>
      <button class="act" style="margin-top:0;padding:9px;border-color:var(--jade);color:var(--jade)" onclick="Z.pickEntryLoc()">📍 ${draft.lat!=null?`Точка задана ✓ (${draft.lat.toFixed(3)}, ${draft.lon.toFixed(3)}) — изменить`:'Указать место на карте'}</button></div>
    <div class="field"><label>Что поймал — по каждой рыбе свой вес</label><div class="fishpick">${picker}</div></div>
    <div id="catchRows">${rows||'<p style="font-size:12px;color:var(--slate);margin:6px 0">Нажми на рыбу выше, чтобы добавить. Вес пустой = «не взвешивал».</p>'}</div>
    <div class="field"><label>Оценка</label><div class="stars" id="stars">${stars}</div></div>
    <div class="field"><label>Заметка</label><textarea id="e_note" placeholder="что сработало, погода, место…">${esc(draft.note||'')}</textarea></div>
    <label class="pub-toggle"><input type="checkbox" id="e_private" ${draft.private?'checked':''} onchange="Z.setPrivate(this.checked)"><span>🔒 Не показывать в общей ленте — только для меня</span></label>
    <button class="act" onclick="Z.saveEntry()">Сохранить</button>
    ${draft.id?`<button class="act" style="border-color:var(--bad);color:var(--bad);margin-top:8px" onclick="Z.delEntry('${draft.id}')">Удалить запись</button>`:''}`);
}
function addCatch(species){ draft.catches.push({species, weight:null}); syncEntryFields(); renderEntry(); }
function rmCatch(i){ draft.catches.splice(i,1); syncEntryFields(); renderEntry(); }
function setW(i,v){ draft.catches[i].weight = v===''?null:(Math.round(parseFloat(v))||null); }
// безопасно для одинарной JS-строки ВНУТРИ двойного HTML-атрибута onclick
function escJs(s){ return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/\r?\n/g,' '); }
function lureCandidates(species){
  const f=byId(species); const out=[];
  try{ Tackle.getKits().forEach(k=>(k.lures||[]).forEach(l=>{ if(l&&l.name) out.push(l.name); })); }catch(e){}
  if(f&&f.lr) f.lr.forEach(l=>out.push(l));
  return [...new Set(out)].slice(0,6);
}
function setLure(i,l){ if(!draft||!draft.catches[i]) return; syncEntryFields(); draft.catches[i].lure = (draft.catches[i].lure===l)?null:l; renderEntry(); }
function lureCustom(i){ if(!draft||!draft.catches[i]) return; syncEntryFields(); const v=prompt('На что поймал? (приманка/наживка)', draft.catches[i].lure||''); if(v!=null){ const t=v.trim(); draft.catches[i].lure=t||null; renderEntry(); } }
function setRating(r){ draft.rating=r; syncEntryFields(); renderEntry(); }
function setPrivate(v){ if(draft) draft.private=!!v; }
function pickEntryLoc(){
  if(!draft) return; syncEntryFields();
  const center = (draft.lat!=null) ? {lat:draft.lat,lon:draft.lon} : (ST.city?{lat:ST.city.lat,lon:ST.city.lon}:{lat:54,lon:56});
  openModal(`<h3>Место рыбалки на карте</h3>
    <p style="font-size:12.5px;color:var(--slate);margin:2px 0 8px">Найди село/реку в поиске и/или тапни точку (заводь, перекат, яма). Потом «Готово».</p>
    <div class="field"><input id="entrySearch" placeholder="Село, река, ориентир…" oninput="Z.entryLocSearch(this.value)" autocomplete="off"></div>
    <div id="entrySearchRes" style="margin-bottom:8px"></div>
    <div class="mtoggle pk-toggle" style="margin-bottom:6px"><button onclick="Z.pickerLayer('satellite')">Спутник</button><button class="on" onclick="Z.pickerLayer('scheme')">Схема (реки)</button></div>
    <div id="entryMap" style="height:300px;border:1px solid var(--rule);background:#dfe6e0;z-index:0"></div>
    <p id="entryLocLbl" style="font-size:12px;color:var(--slate);margin-top:8px">${draft.lat!=null?`Точка: ${draft.lat.toFixed(4)}, ${draft.lon.toFixed(4)}`:'Точка не выбрана'}</p>
    <button class="act" onclick="Z.entryBack()">← Готово, назад к записи</button>
    ${draft.lat!=null?`<button class="act" style="border-color:var(--bad);color:var(--bad);margin-top:8px" onclick="Z.clearEntryLoc()">Убрать точку</button>`:''}`);
  setTimeout(()=>MapView.initPicker('entryMap', center, (la,lo)=>{ draft.lat=la; draft.lon=lo; const el=$('entryLocLbl'); if(el) el.textContent='Точка: '+la.toFixed(4)+', '+lo.toFixed(4); }, 'scheme'), 80);
}
function entryBack(){ renderEntry(); }
function clearEntryLoc(){ if(draft){ draft.lat=null; draft.lon=null; } renderEntry(); }
let entrySearchTimer=null;
function entryLocSearch(q){
  const box=$('entrySearchRes'); if(!box) return;
  clearTimeout(entrySearchTimer);
  if(String(q||'').trim().length<2){ box.innerHTML=''; return; }
  entrySearchTimer=setTimeout(async ()=>{
    const inp=$('entrySearch'); if(inp && inp.value.trim()!==String(q).trim()) return;
    const res=await geoSearch(q);
    const inp2=$('entrySearch'); if(inp2 && inp2.value.trim()!==String(q).trim()) return;
    const b=$('entrySearchRes'); if(!b) return;
    b.innerHTML = res.slice(0,5).map(c=>`<div class="city-item" onclick="Z.entryLocGo(${c.lat},${c.lon})"><span>${esc(c.n)}</span><span class="city-sub">${esc(c.c||'')}</span></div>`).join('')
      || '<p style="font-size:12px;color:var(--slate);padding:6px 2px">Не нашлось — тапни точку прямо на карте.</p>';
  }, 550);
}
function entryLocGo(lat,lon){
  if(draft){ draft.lat=+lat; draft.lon=+lon; }
  MapView.panPicker(+lat,+lon,13);
  const el=$('entryLocLbl'); if(el) el.textContent='Точка: '+Number(lat).toFixed(4)+', '+Number(lon).toFixed(4);
  const b=$('entrySearchRes'); if(b) b.innerHTML=''; const inp=$('entrySearch'); if(inp) inp.value='';
}
function setDate(v){
  if(!v || !draft) return; syncEntryFields();
  const ex = Diary.entryByDate(v);
  if(ex && ex.id!==draft.id){
    if(confirm('На эту дату уже есть запись — открыть её?')) draft = JSON.parse(JSON.stringify(ex)); else return;
  } else { draft.date = v; }
  renderEntry();
}
function syncEntryFields(){ const s=$('e_spot'),n=$('e_note'),p=$('e_private'); if(s)draft.spot=s.value; if(n)draft.note=n.value; if(p)draft.private=p.checked; }
function saveEntry(){
  syncEntryFields();
  draft.visited=true;
  // приложить снимок прогноза ЗА ДЕНЬ РЫБАЛКИ (если он есть в загруженной погоде)
  if(ST.weather && !draft.forecast){
    try{ const times=ST.weather.daily&&ST.weather.daily.time; const idx=times?times.indexOf(draft.date):-1;
      if(idx>=0){ const fc=computeForecast(ST.weather,{filter:'all',todayIdx:idx});
        draft.forecast={maxT:fc.conditions.maxT,minT:fc.conditions.minT,avgP:fc.conditions.avgP,pdir:fc.conditions.pdir,wt:fc.conditions.wt,score:fc.day.score}; } }catch(e){}
  }
  const saved = draft;
  Diary.upsertEntry(saved); draft=null; closeModal(); rerender(); Sync.pushSoon();
  // синхронизируем ленту: приватный улов — убрать из ленты, обычный — опубликовать
  if(cloudEnabled() && Cloud.cachedUser()){
    if(saved.private){
      Cloud.unpublishEntry(saved.id).then(()=>toast('Сохранено, в ленту не попало 🔒')).catch(e=>console.warn('unpublish:',e));
    } else {
      const coords = (saved.lat!=null&&saved.lon!=null) ? {lat:saved.lat,lon:saved.lon} : (ST.city?{lat:ST.city.lat,lon:ST.city.lon}:{});
      Cloud.publishCatches(saved, ST.city?ST.city.name:'', coords)
        .then(()=>{ invalidateFeed(); if((saved.catches||[]).length) toast('Улов в ленте 🎣'); })
        .catch(e=>{ console.warn('publish:',e); toast('Лента не приняла: '+(e.message||e)); });
    }
  }
}
function delEntry(id){ if(confirm('Удалить запись?')){ Diary.deleteEntry(id);
  if(cloudEnabled() && Cloud.cachedUser()) Cloud.unpublishEntry(id).catch(e=>console.warn('unpublish:',e));
  draft=null; closeModal(); rerender(); Sync.pushSoon(); } }
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
  if(typeof window!=='undefined' && window.addEventListener) window.addEventListener('beforeinstallprompt', e=>{ e.preventDefault(); deferredPrompt=e; });
  if(typeof document!=='undefined' && document.body) setTimeout(maybeOnboard, 900);
  Sync.onSynced(() => rerender());
  if (cloudEnabled() && Cloud.cachedUser()) { Sync.syncOnLogin(); Cloud.ensureProfile().catch(()=>{}); setTimeout(checkEngagement, 1800); }
  if (cloudEnabled()) setTimeout(loadLureStats, 600);
  if (cloudEnabled() && Cloud.cachedUser()) Cloud.subscribeCommunity(onCommunityChange).catch(()=>{});
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
    openCity, searchCity, pickCity, cityPick, geo, closeModal, openNotif, shareForecast, onboardDone, openMoon, openDay, reportWater, clearNotifs,
    openAccount, signIn: acSignIn, setPass: acSetPass, signOut: acSignOut, syncNow: acSyncNow, saveHandle: acSaveHandle, enablePush: acEnablePush, install: promptInstall,
    like: feedLike, comments: openComments, sendComment, delComment, feedMode:(m)=>{ feedFilter=m; rerender(); }, feedSp:(s)=>{ feedSpecies=(s&&s!==feedSpecies)?s:null; loadFeed(); }, where: openWhere,
    newEntry, editEntry, addCatch, rmCatch, setW, setLure, lureCustom, setRating, setPrivate, setDate, pickEntryLoc, entryBack, clearEntryLoc, entryLocSearch, entryLocGo, saveEntry, delEntry, shareCatch, openRecords, exportDiary, importDiary,
    newKit, editKit, kitIcon, kitTarget, addLure, lureQty, rmLure, saveKit, delKit,
    mapView:(v)=>{ ST.mapView=v; MapView.setLayer(v); document.querySelectorAll('.mtoggle button').forEach((b,i)=>b.classList.toggle('on',(i===0)===(v==='satellite'))); },
    mapPick:(la,lo)=>newPlace({lat:la,lon:lo}), newPlace, placeGeo, savePlace, delPlace, mapCatches:(v)=>{ mapShowCatches=!!v; rerender(); },
    pickerLayer:(w)=>{ MapView.setPickerLayer(w); document.querySelectorAll('.pk-toggle button').forEach((b,i)=>b.classList.toggle('on',(i===0)===(w==='satellite'))); },
  };
}
