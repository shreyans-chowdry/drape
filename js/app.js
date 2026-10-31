import * as db from './db.js';
import {
  CATEGORIES, TYPES, COLORS, PATTERNS, OCCASIONS, SEASONS, typeInfo, colorById, itemF, itemW,
  suggestFor, generateLooks, scoreLabel, pctScore, pairKey, currentSeason, detectColor,
} from './engine.js';

// ---------------------------------------------------------------- state
const S = {
  tab: 'today',
  items: [],
  outfits: [],
  wears: [],
  prefs: {},        // pair feedback map
  weather: null,    // { tempC, hi, lo, code, rain, label, at }
  occasion: 'casual',
  seed: 0,
  closetCat: 'all',
  closetQuery: '',
  matchAnchor: null,
  matchCat: 'top',
  chat: [],
  apiKey: '',
  aiModel: '',
  aiModels: [],
  busy: false,
};

const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const view = $('#view');
const byId = id => S.items.find(i => i.id === id);

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2200);
}

// ---------------------------------------------------------------- images
const urlCache = new Map();
function imgURL(item, which = 'thumb') {
  const blob = item[which] || item.thumb || item.photo;
  if (!(blob instanceof Blob)) return null;
  const key = `${item.id}:${which}:${item.updated || 0}`;
  if (!urlCache.has(key)) urlCache.set(key, URL.createObjectURL(blob));
  return urlCache.get(key);
}
function phHTML(item, which = 'thumb') {
  const u = imgURL(item, which);
  if (u) return `<img src="${u}" alt="${esc(item.name)}" loading="lazy">`;
  const c = colorById(item.color);
  return `<div class="swatch-ph" style="background:${c.hex}"><span>${esc(typeInfo(item).label)}</span></div>`;
}

async function loadImage(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
}
function drawTo(img, max) {
  const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas');
  c.width = Math.round(img.naturalWidth * scale); c.height = Math.round(img.naturalHeight * scale);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c;
}
const canvasBlob = (c, q) => new Promise(res => c.toBlob(res, 'image/jpeg', q));

async function processPhoto(file) {
  const img = await loadImage(file);
  const big = drawTo(img, 1000), small = drawTo(img, 360);
  return { photo: await canvasBlob(big, 0.82), thumb: await canvasBlob(small, 0.78), color: detectColor(small) };
}

// ---------------------------------------------------------------- data
async function loadAll() {
  [S.items, S.outfits, S.wears] = await Promise.all([db.all('items'), db.all('outfits'), db.all('wears')]);
  S.items.sort((a, b) => (b.created || 0) - (a.created || 0));
  S.wears.sort((a, b) => b.date - a.date);
  S.prefs = await db.getPref('pairs', {});
  S.apiKey = await db.getPref('geminiKey', '');
  S.aiModel = await db.getPref('aiModel', '');
  S.aiModels = await db.getPref('aiModels', []);
  S.chat = await db.getPref('chat', []);
  S.weather = await db.getPref('weather', null);
  S.occasion = await db.getPref('occasion', 'casual');
}

async function saveItem(item) {
  item.updated = Date.now();
  await db.put('items', item);
  const i = S.items.findIndex(x => x.id === item.id);
  if (i >= 0) S.items[i] = item; else S.items.unshift(item);
}
async function deleteItem(id) {
  await db.del('items', id);
  S.items = S.items.filter(i => i.id !== id);
  if (S.matchAnchor === id) S.matchAnchor = null;
}

async function feedback(pieces, delta) {
  for (let i = 0; i < pieces.length; i++) for (let j = i + 1; j < pieces.length; j++) {
    const k = pairKey(pieces[i].id, pieces[j].id);
    S.prefs[k] = (S.prefs[k] || 0) + delta;
  }
  await db.setPref('pairs', S.prefs);
}

async function wearPieces(pieces) {
  const now = Date.now();
  const w = { id: db.uid(), date: now, pieces: pieces.map(p => p.id) };
  await db.put('wears', w);
  S.wears.unshift(w);
  for (const p of pieces) { p.wearCount = (p.wearCount || 0) + 1; p.lastWorn = now; await saveItem(p); }
  await feedback(pieces, 1);
}

async function saveOutfit(pieces, name) {
  const o = { id: db.uid(), created: Date.now(), name: name || pieces.map(p => p.name).slice(0, 2).join(' + '), pieces: pieces.map(p => p.id) };
  await db.put('outfits', o);
  S.outfits.unshift(o);
}

// ---------------------------------------------------------------- weather
const WMO = { 0: 'Clear', 1: 'Mostly clear', 2: 'Partly cloudy', 3: 'Overcast', 45: 'Fog', 48: 'Fog', 51: 'Drizzle', 53: 'Drizzle', 55: 'Drizzle', 61: 'Rain', 63: 'Rain', 65: 'Heavy rain', 71: 'Snow', 73: 'Snow', 75: 'Snow', 80: 'Showers', 81: 'Showers', 82: 'Storms', 95: 'Thunderstorm', 96: 'Thunderstorm', 99: 'Thunderstorm' };

async function fetchWeather(lat, lon) {
  // Coordinates are rounded to ~1 km so the request stays coarse.
  const q = new URLSearchParams({
    latitude: lat.toFixed(2), longitude: lon.toFixed(2), timezone: 'auto',
    current: 'temperature_2m,weather_code,precipitation',
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_probability_max', forecast_days: '1',
  });
  const r = await fetch(`https://api.open-meteo.com/v1/forecast?${q}`);
  if (!r.ok) throw new Error('Weather unavailable');
  const d = await r.json();
  const code = d.current.weather_code;
  S.weather = {
    tempC: d.current.temperature_2m, hi: d.daily.temperature_2m_max[0], lo: d.daily.temperature_2m_min[0],
    code, rain: d.current.precipitation > 0 || d.daily.precipitation_probability_max[0] >= 50,
    label: WMO[code] || 'Weather', at: Date.now(), lat, lon, auto: true,
  };
  await db.setPref('weather', S.weather);
}

function locate() {
  return new Promise((res, rej) => {
    if (!navigator.geolocation) return rej(new Error('Location not supported'));
    navigator.geolocation.getCurrentPosition(p => res(p.coords), e => rej(new Error(e.message || 'Location denied')), { timeout: 10000, maximumAge: 36e5 });
  });
}

async function refreshWeatherIfStale() {
  const w = S.weather;
  if (w?.auto && w.lat != null && Date.now() - w.at > 3 * 36e5) {
    try { await fetchWeather(w.lat, w.lon); if (S.tab === 'today') render(); } catch { /* offline: keep old */ }
  }
}

function ctx() {
  const tempC = S.weather?.tempC ?? null;
  return { occasion: S.occasion, tempC, rain: !!S.weather?.rain, season: currentSeason(new Date(), tempC) };
}
function ctxText() {
  const w = S.weather;
  const occ = OCCASIONS.find(o => o.id === S.occasion)?.label;
  const d = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  return `${d}. Occasion: ${occ}. ${w ? `Weather: ${Math.round(w.tempC)}°C, ${w.label}${w.rain ? ', rain likely' : ''}.` : 'Weather unknown.'}`;
}

// ---------------------------------------------------------------- sheet
function openSheet(html, { onMount, onClose } = {}) {
  const root = $('#sheet-root');
  root.innerHTML = `<div class="sheet-backdrop"></div><div class="sheet" role="dialog" aria-modal="true"><div class="grabber"></div>${html}</div>`;
  const back = $('.sheet-backdrop', root), sheet = $('.sheet', root);
  document.body.style.overflow = 'hidden';
  requestAnimationFrame(() => { back.classList.add('open'); sheet.classList.add('open'); });
  const close = () => {
    back.classList.remove('open'); sheet.classList.remove('open');
    document.body.style.overflow = '';
    setTimeout(() => { if (root.contains(sheet)) root.innerHTML = ''; }, 280);
    onClose?.();
  };
  back.onclick = close;
  $$('[data-close]', sheet).forEach(b => (b.onclick = close));
  // swipe down on the grabber to dismiss
  let y0 = null;
  sheet.addEventListener('touchstart', e => { if (sheet.scrollTop <= 0) y0 = e.touches[0].clientY; }, { passive: true });
  sheet.addEventListener('touchmove', e => { if (y0 != null && e.touches[0].clientY - y0 > 90) { y0 = null; close(); } }, { passive: true });
  onMount?.(sheet, close);
  return close;
}

// ---------------------------------------------------------------- router
const TABS = { today: renderToday, closet: renderCloset, match: renderMatch, stylist: renderStylist, me: renderMe };

function go(tab) {
  S.tab = tab;
  try { sessionStorage.setItem('drape.tab', tab); } catch { /* ignore */ }
  render();
  window.scrollTo(0, 0);
}
function render() {
  $$('.tabbar button').forEach(b => b.setAttribute('aria-current', b.dataset.tab === S.tab ? 'page' : 'false'));
  TABS[S.tab]();
}
$$('.tabbar button').forEach(b => (b.onclick = () => go(b.dataset.tab)));

// ---------------------------------------------------------------- shared bits
function lookHTML(look, idx, { actions = true } = {}) {
  const good = look.reasons.filter(r => r.good);
  const bad = look.reasons.filter(r => !r.good);
  const uniq = arr => [...new Map(arr.map(r => [r.t, r])).values()];
  const shown = [...uniq(good).slice(0, 3), ...uniq(bad).slice(0, 1)];
  return `<article class="card look" data-look="${idx}">
    <div class="row between" style="margin-bottom:10px">
      <span class="eyebrow">Look ${idx + 1}</span>
      <span class="score">${scoreLabel(look.s)} · ${pctScore(look.s)}%</span>
    </div>
    <div class="collage" style="--n:${Math.min(look.pieces.length, 4)}">
      ${look.pieces.slice(0, 4).map(p => `<button data-item="${p.id}"><div class="ph">${phHTML(p)}</div><div class="cap">${esc(p.name)}</div></button>`).join('')}
    </div>
    <ul class="reasons">${shown.map(r => `<li class="${r.good ? '' : 'bad'}">${esc(r.t)}</li>`).join('')}</ul>
    ${actions ? `<div class="look-actions">
      <button class="btn sm" data-act="wear">Wear this</button>
      <button class="btn sm secondary" data-act="save">Save</button>
      <button class="btn sm secondary" data-act="nope" aria-label="Not for me" style="flex:0 0 48px">✕</button>
    </div>` : ''}
  </article>`;
}

function bindLooks(container, looks, rerender) {
  $$('[data-item]', container).forEach(b => (b.onclick = e => { e.stopPropagation(); openItem(byId(b.dataset.item)); }));
  $$('[data-look]', container).forEach(el => {
    const look = looks[+el.dataset.look];
    $$('[data-act]', el).forEach(btn => (btn.onclick = async () => {
      const a = btn.dataset.act;
      if (a === 'wear') { await wearPieces(look.pieces); toast('Logged — enjoy the fit'); rerender(); }
      if (a === 'save') { await saveOutfit(look.pieces); toast('Saved to your outfits'); }
      if (a === 'nope') { await feedback(look.pieces, -1); toast("Got it — I'll suggest that less"); S.seed++; rerender(); }
    }));
  });
}

function tileHTML(item, extra = '') {
  const badge = item.laundry ? '<span class="badge">Laundry</span>' : '';
  return `<button class="tile ${item.laundry ? 'dim' : ''}" data-item="${item.id}" ${extra}>
    <div class="ph">${phHTML(item)}</div>${badge}${item.fav ? '<span class="fav">♥</span>' : ''}
    <div class="name">${esc(item.name)}</div>
    <div class="meta row" style="gap:6px"><i class="dot" style="background:${colorById(item.color).hex}"></i>${esc(typeInfo(item).label)}</div>
  </button>`;
}

function emptyCloset(msg) {
  return `<div class="card empty">
    <div class="art">✦</div>
    <h2 style="margin:12px 0 0">Your closet is empty</h2>
    <p>${msg}</p>
    <div class="stack" style="max-width:280px;margin:0 auto">
      <button class="btn block" id="e-add">Add your first piece</button>
      <button class="btn block secondary" id="e-sample">Try with a sample wardrobe</button>
    </div>
  </div>`;
}
function bindEmpty() {
  const a = $('#e-add'); if (a) a.onclick = () => editItem();
  const s = $('#e-sample'); if (s) s.onclick = async () => { await loadSample(); toast('Sample wardrobe added — delete it any time from Me'); render(); };
}

// ---------------------------------------------------------------- TODAY
function renderToday() {
  const hour = new Date().getHours();
  const hello = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const name = db.activeProfile().name;
  const w = S.weather;
  const tops = S.items.filter(i => (i.category === 'top' || i.category === 'onepiece') && !i.archived).length;
  const bottoms = S.items.filter(i => i.category === 'bottom').length;
  const canLook = (tops && bottoms) || S.items.some(i => i.category === 'onepiece');

  const looks = canLook ? generateLooks(S.items, ctx(), S.prefs, { count: 3, seed: S.seed }) : [];

  view.innerHTML = `
    <div class="eyebrow">${new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</div>
    <h1>${hello}${name && name !== 'Me' ? `, ${esc(name)}` : ''}</h1>
    <div class="row wrap" style="margin-bottom:14px">
      <button class="pill" id="wx">${w ? `${wxIcon(w.code)} ${Math.round(w.tempC)}° · ${esc(w.label)}${w.hi != null ? ` <span class="muted small">H${Math.round(w.hi)} L${Math.round(w.lo)}</span>` : ''}` : '☁︎ Add weather'}</button>
      ${canLook ? '<button class="pill" id="shuffle">↻ Shuffle</button>' : ''}
    </div>
    <div class="chips" id="occ">${OCCASIONS.map(o => `<button class="chip" aria-pressed="${o.id === S.occasion}" data-occ="${o.id}">${o.label}</button>`).join('')}</div>
    <div id="looks" style="margin-top:16px">
      ${S.items.length === 0 ? emptyCloset('Add a few tops, bottoms and shoes and I\'ll put outfits together for you every day.')
        : !canLook ? `<div class="card pad muted">Add at least one top and one bottom (or a dress/one-piece) to get daily looks. You have ${tops} top${tops === 1 ? '' : 's'} and ${bottoms} bottom${bottoms === 1 ? '' : 's'}.</div>`
        : looks.map((l, i) => lookHTML(l, i)).join('')}
    </div>
    ${S.wears.length ? `<h2>Recently worn</h2><div class="card pad">${S.wears.slice(0, 3).map(wearRow).join('')}</div>` : ''}
  `;
  bindEmpty();
  $('#wx').onclick = weatherSheet;
  const sh = $('#shuffle'); if (sh) sh.onclick = () => { S.seed++; renderToday(); };
  $$('[data-occ]').forEach(b => (b.onclick = async () => { S.occasion = b.dataset.occ; S.seed = 0; await db.setPref('occasion', S.occasion); renderToday(); }));
  bindLooks($('#looks'), looks, renderToday);
  $$('[data-wear-item]').forEach(b => (b.onclick = () => openItem(byId(b.dataset.wearItem))));
}

function wxIcon(code) {
  if (code == null) return '☁︎';
  if (code === 0 || code === 1) return '☀︎';
  if (code <= 3) return '⛅︎';
  if (code >= 51 && code <= 82) return '☂︎';
  if (code >= 95) return '⚡︎';
  return '☁︎';
}

function wearRow(w) {
  const pieces = w.pieces.map(byId).filter(Boolean);
  const d = new Date(w.date);
  return `<div class="list-row">
    <div class="row" style="gap:4px">${pieces.slice(0, 3).map(p => `<button class="thumb" data-wear-item="${p.id}">${phHTML(p)}</button>`).join('')}</div>
    <div class="grow"><div class="small" style="font-weight:600">${d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</div>
    <div class="small muted" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(pieces.map(p => p.name).join(', ') || 'Deleted items')}</div></div>
  </div>`;
}

function weatherSheet() {
  const w = S.weather;
  openSheet(`
    <div class="sheet-head"><h2>Weather</h2><button class="btn sm ghost" data-close>Done</button></div>
    <p class="muted">Suggestions adjust layers and fabrics to the temperature. Your location is only sent (rounded) to Open-Meteo to get the forecast.</p>
    <button class="btn block" id="w-loc">Use my location</button>
    <label class="field"><span>Or set the temperature yourself: <b id="w-val">${Math.round(w?.tempC ?? 24)}°C</b></span>
      <input type="range" id="w-temp" min="-5" max="42" value="${Math.round(w?.tempC ?? 24)}"></label>
    <label class="row" style="margin-top:12px"><input type="checkbox" id="w-rain" ${w?.rain ? 'checked' : ''}> Rain expected</label>
    <button class="btn block secondary" id="w-manual" style="margin-top:16px">Use this temperature</button>
    ${w ? '<button class="btn block ghost" id="w-clear" style="margin-top:8px">Ignore weather</button>' : ''}
  `, {
    onMount(sheet, close) {
      $('#w-temp', sheet).oninput = e => ($('#w-val', sheet).textContent = `${e.target.value}°C`);
      $('#w-loc', sheet).onclick = async e => {
        e.target.innerHTML = '<span class="spinner"></span> Locating…';
        try { const c = await locate(); await fetchWeather(c.latitude, c.longitude); close(); renderToday(); toast('Weather updated'); }
        catch (err) { e.target.textContent = 'Use my location'; toast(err.message); }
      };
      $('#w-manual', sheet).onclick = async () => {
        const t = +$('#w-temp', sheet).value;
        S.weather = { tempC: t, hi: null, lo: null, code: null, rain: $('#w-rain', sheet).checked, label: 'Set manually', at: Date.now(), auto: false };
        await db.setPref('weather', S.weather); close(); renderToday();
      };
      const c = $('#w-clear', sheet); if (c) c.onclick = async () => { S.weather = null; await db.setPref('weather', null); close(); renderToday(); };
    },
  });
}

// ---------------------------------------------------------------- CLOSET
function renderCloset() {
  const q = S.closetQuery.trim().toLowerCase();
  const list = S.items.filter(i => !i.archived
    && (S.closetCat === 'all' || (S.closetCat === 'laundry' ? i.laundry : S.closetCat === 'fav' ? i.fav : i.category === S.closetCat))
    && (!q || `${i.name} ${typeInfo(i).label} ${colorById(i.color).label} ${i.brand || ''} ${i.notes || ''}`.toLowerCase().includes(q)));
  const counts = Object.fromEntries(CATEGORIES.map(c => [c.id, S.items.filter(i => i.category === c.id && !i.archived).length]));

  view.innerHTML = `
    <div class="eyebrow">${S.items.length} piece${S.items.length === 1 ? '' : 's'}</div>
    <h1>Closet</h1>
    ${S.items.length ? `
    <label class="search"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
      <input class="input" id="q" type="search" placeholder="Search colour, type, brand…" value="${esc(S.closetQuery)}" autocomplete="off"></label>
    <div class="chips" style="margin-top:12px">
      ${[['all', 'All'], ...CATEGORIES.filter(c => counts[c.id]).map(c => [c.id, `${c.label} ${counts[c.id]}`]), ['fav', '♥ Favourites'], ['laundry', 'Laundry']]
        .map(([id, l]) => `<button class="chip" data-cat="${id}" aria-pressed="${S.closetCat === id}">${l}</button>`).join('')}
    </div>
    <div class="grid" id="grid" style="margin-top:14px">${list.map(i => tileHTML(i)).join('') || '<p class="muted">Nothing matches.</p>'}</div>`
    : emptyCloset('Snap a photo of each piece. I\'ll detect the colour and you pick the type — takes about 10 seconds an item.')}
    <button class="fab" id="add" aria-label="Add item"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></button>
  `;
  bindEmpty();
  $('#add').onclick = () => editItem();
  const qi = $('#q');
  if (qi) qi.oninput = e => { S.closetQuery = e.target.value; const pos = e.target.selectionStart; renderCloset(); const n = $('#q'); n.focus(); n.setSelectionRange(pos, pos); };
  $$('[data-cat]').forEach(b => (b.onclick = () => { S.closetCat = b.dataset.cat; renderCloset(); }));
  $$('#grid [data-item]').forEach(b => (b.onclick = () => openItem(byId(b.dataset.item))));
}

function openItem(item) {
  if (!item) return;
  const last = item.lastWorn ? new Date(item.lastWorn).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Never';
  const cpw = item.price && item.wearCount ? (item.price / item.wearCount).toFixed(0) : null;
  openSheet(`
    <div class="sheet-head"><h2 style="font-size:19px">${esc(item.name)}</h2><button class="btn sm ghost" data-close>Close</button></div>
    <div class="card detail-ph">${phHTML(item, 'photo')}</div>
    <div class="row wrap small muted" style="margin-top:12px;gap:14px">
      <span class="row" style="gap:6px"><i class="dot" style="background:${colorById(item.color).hex}"></i>${colorById(item.color).label}${item.color2 ? ' / ' + colorById(item.color2).label : ''}</span>
      <span>${esc(typeInfo(item).label)}</span><span>Formality ${itemF(item)}/5</span><span>Warmth ${itemW(item)}/5</span>
    </div>
    <div class="stat-row" style="margin-top:14px">
      <div class="card stat"><b>${item.wearCount || 0}</b><span>wears</span></div>
      <div class="card stat"><b style="font-size:18px;line-height:26px">${last}</b><span>last worn</span></div>
      <div class="card stat"><b style="font-size:${cpw ? 26 : 18}px;line-height:26px">${cpw ?? '—'}</b><span>cost / wear</span></div>
    </div>
    ${item.notes ? `<p class="muted">${esc(item.notes)}</p>` : ''}
    <div class="stack" style="margin-top:16px">
      <button class="btn block accent" id="i-match">What goes with this?</button>
      <div class="row">
        <button class="btn secondary grow" id="i-worn">Wore it today</button>
        <button class="btn secondary grow" id="i-laundry">${item.laundry ? 'Back from laundry' : 'In the laundry'}</button>
      </div>
      <div class="row">
        <button class="btn secondary grow" id="i-fav">${item.fav ? '♥ Favourite' : '♡ Favourite'}</button>
        <button class="btn secondary grow" id="i-edit">Edit</button>
      </div>
      <button class="btn block danger" id="i-del">Delete</button>
    </div>
  `, {
    onMount(sheet, close) {
      $('#i-match', sheet).onclick = () => { close(); S.matchAnchor = item.id; go('match'); };
      $('#i-worn', sheet).onclick = async () => { await wearPieces([item]); close(); toast('Logged'); render(); };
      $('#i-laundry', sheet).onclick = async () => { item.laundry = !item.laundry; await saveItem(item); close(); render(); };
      $('#i-fav', sheet).onclick = async () => { item.fav = !item.fav; await saveItem(item); close(); render(); };
      $('#i-edit', sheet).onclick = () => { close(); setTimeout(() => editItem(item), 300); };
      $('#i-del', sheet).onclick = async () => { if (confirm(`Delete “${item.name}”? This can't be undone.`)) { await deleteItem(item.id); close(); render(); toast('Deleted'); } };
    },
  });
}

function editItem(existing) {
  const it = existing ? { ...existing } : { id: db.uid(), category: 'top', type: 'tshirt', color: 'black', pattern: 'solid', seasons: [], created: Date.now() };
  let photoURL = existing ? imgURL(existing, 'photo') : null;

  const typeOptions = cat => Object.entries(TYPES[cat]).map(([k, v]) => `<option value="${k}" ${k === it.type ? 'selected' : ''}>${v.label}</option>`).join('');
  const html = `
    <div class="sheet-head"><button class="btn sm ghost" data-close>Cancel</button><h2 style="font-size:19px">${existing ? 'Edit piece' : 'New piece'}</h2><button class="btn sm" id="f-save">Save</button></div>
    <div class="photo-drop" id="f-drop">
      ${photoURL ? `<img src="${photoURL}" alt="">` : ''}
      <div class="hint" ${photoURL ? 'hidden' : ''}><b>Add a photo</b>Lay it flat on a plain background for the best colour match</div>
      <input type="file" accept="image/*" id="f-file" aria-label="Choose photo">
    </div>
    ${S.apiKey ? '<button class="btn block secondary" id="f-ai" style="margin-top:10px" disabled>✦ Auto-fill from photo</button>' : ''}
    <label class="field"><span>Name</span><input class="input" id="f-name" value="${esc(it.name || '')}" placeholder="e.g. Navy zip hoodie"></label>
    <div class="field"><span>Category</span><div class="chips wrap" id="f-cat">${CATEGORIES.map(c => `<button class="chip" data-v="${c.id}" aria-pressed="${c.id === it.category}">${c.one}</button>`).join('')}</div></div>
    <label class="field"><span>Type</span><select class="input" id="f-type">${typeOptions(it.category)}</select></label>
    <div class="field"><span>Main colour <b id="f-cname" style="color:var(--ink)">${colorById(it.color).label}</b></span>
      <div class="swatches" id="f-color">${COLORS.map(c => `<button class="sw" data-v="${c.id}" title="${c.label}" aria-label="${c.label}" aria-pressed="${c.id === it.color}" style="background:${c.hex}"></button>`).join('')}</div></div>
    <label class="field"><span>Second colour (optional)</span><select class="input" id="f-color2"><option value="">None</option>${COLORS.map(c => `<option value="${c.id}" ${c.id === it.color2 ? 'selected' : ''}>${c.label}</option>`).join('')}</select></label>
    <div class="field"><span>Pattern</span><div class="chips wrap" id="f-pat">${PATTERNS.map(p => `<button class="chip" data-v="${p.id}" aria-pressed="${p.id === (it.pattern || 'solid')}">${p.label}</button>`).join('')}</div></div>
    <label class="field"><span>Formality: <b id="f-fv">${itemF(it)}</b>/5</span><input type="range" min="1" max="5" step="1" id="f-form" value="${itemF(it)}"><div class="range-labels"><span>Lounge</span><span>Smart</span><span>Formal</span></div></label>
    <label class="field"><span>Warmth: <b id="f-wv">${itemW(it)}</b>/5</span><input type="range" min="1" max="5" step="1" id="f-warm" value="${itemW(it)}"><div class="range-labels"><span>Hot days</span><span>Mild</span><span>Winter</span></div></label>
    <div class="field"><span>Seasons (leave empty for all year)</span><div class="chips wrap" id="f-sea">${SEASONS.map(s => `<button class="chip" data-v="${s}" aria-pressed="${(it.seasons || []).includes(s)}">${s[0].toUpperCase() + s.slice(1)}</button>`).join('')}</div></div>
    <div class="row" style="gap:10px">
      <label class="field grow"><span>Brand</span><input class="input" id="f-brand" value="${esc(it.brand || '')}"></label>
      <label class="field" style="width:120px"><span>Price</span><input class="input" id="f-price" inputmode="decimal" value="${it.price ?? ''}"></label>
    </div>
    <label class="field"><span>Notes</span><textarea class="input" id="f-notes" placeholder="Fit, fabric, where it's from…">${esc(it.notes || '')}</textarea></label>
  `;

  openSheet(html, {
    onMount(sheet, close) {
      let formTouched = !!existing?.formality, warmTouched = !!existing?.warmth;
      const setPressed = (wrap, v) => $$('[data-v]', wrap).forEach(b => b.setAttribute('aria-pressed', b.dataset.v === v));
      const syncDefaults = () => {
        const t = TYPES[it.category][it.type];
        if (!t) return;
        if (!formTouched) { $('#f-form', sheet).value = t.f; $('#f-fv', sheet).textContent = t.f; }
        if (!warmTouched) { $('#f-warm', sheet).value = t.w; $('#f-wv', sheet).textContent = t.w; }
      };
      const setColor = id => { it.color = id; setPressed($('#f-color', sheet), id); $('#f-cname', sheet).textContent = colorById(id).label; };

      $('#f-file', sheet).onchange = async e => {
        const f = e.target.files[0]; if (!f) return;
        try {
          const p = await processPhoto(f);
          it.photo = p.photo; it.thumb = p.thumb;
          setColor(p.color);
          const drop = $('#f-drop', sheet);
          $('img', drop)?.remove();
          const img = new Image(); img.src = URL.createObjectURL(p.photo); drop.prepend(img);
          $('.hint', drop).hidden = true;
          const ai = $('#f-ai', sheet); if (ai) ai.disabled = false;
          toast(`Detected ${colorById(p.color).label.toLowerCase()} — tap a swatch to change`);
        } catch { toast('Could not read that photo'); }
      };
      const ai = $('#f-ai', sheet);
      if (ai) {
        if (it.photo) ai.disabled = false;
        ai.onclick = async () => {
          ai.innerHTML = '<span class="spinner"></span> Looking at your photo…'; ai.disabled = true;
          try {
            const { tagPhoto } = await import('./ai.js');
            const t = await tagPhoto({ apiKey: S.apiKey, model: S.aiModel, blob: it.photo });
            if (t.name && !$('#f-name', sheet).value) $('#f-name', sheet).value = t.name;
            if (t.category) { it.category = t.category; setPressed($('#f-cat', sheet), t.category); $('#f-type', sheet).innerHTML = typeOptions(t.category); }
            if (t.type) { it.type = t.type; $('#f-type', sheet).value = t.type; } else { it.type = $('#f-type', sheet).value; }
            if (t.color) setColor(t.color);
            if (t.color2) $('#f-color2', sheet).value = t.color2;
            if (t.pattern) { it.pattern = t.pattern; setPressed($('#f-pat', sheet), t.pattern); }
            if (t.formality) { formTouched = true; $('#f-form', sheet).value = t.formality; $('#f-fv', sheet).textContent = t.formality; }
            if (t.warmth) { warmTouched = true; $('#f-warm', sheet).value = t.warmth; $('#f-wv', sheet).textContent = t.warmth; }
            if (t.seasons) { it.seasons = t.seasons.length === 5 ? [] : t.seasons; $$('#f-sea [data-v]', sheet).forEach(b => b.setAttribute('aria-pressed', it.seasons.includes(b.dataset.v))); }
            toast('Filled in — check and save');
          } catch (e) { toast(e.message); }
          ai.textContent = '✦ Auto-fill from photo'; ai.disabled = false;
        };
      }
      $$('#f-cat [data-v]', sheet).forEach(b => (b.onclick = () => {
        it.category = b.dataset.v; setPressed($('#f-cat', sheet), it.category);
        $('#f-type', sheet).innerHTML = typeOptions(it.category); it.type = $('#f-type', sheet).value; syncDefaults();
      }));
      $('#f-type', sheet).onchange = e => { it.type = e.target.value; syncDefaults(); };
      $$('#f-color [data-v]', sheet).forEach(b => (b.onclick = () => setColor(b.dataset.v)));
      $$('#f-pat [data-v]', sheet).forEach(b => (b.onclick = () => { it.pattern = b.dataset.v; setPressed($('#f-pat', sheet), it.pattern); }));
      $$('#f-sea [data-v]', sheet).forEach(b => (b.onclick = () => {
        const s = new Set(it.seasons || []); s.has(b.dataset.v) ? s.delete(b.dataset.v) : s.add(b.dataset.v);
        it.seasons = [...s]; b.setAttribute('aria-pressed', s.has(b.dataset.v));
      }));
      $('#f-form', sheet).oninput = e => { formTouched = true; $('#f-fv', sheet).textContent = e.target.value; };
      $('#f-warm', sheet).oninput = e => { warmTouched = true; $('#f-wv', sheet).textContent = e.target.value; };
      if (!existing) syncDefaults();

      $('#f-save', sheet).onclick = async () => {
        it.type = $('#f-type', sheet).value;
        it.name = $('#f-name', sheet).value.trim() || `${colorById(it.color).label} ${typeInfo(it).label.toLowerCase()}`;
        it.color2 = $('#f-color2', sheet).value || undefined;
        it.formality = +$('#f-form', sheet).value;
        it.warmth = +$('#f-warm', sheet).value;
        it.brand = $('#f-brand', sheet).value.trim() || undefined;
        const price = parseFloat($('#f-price', sheet).value);
        it.price = Number.isFinite(price) ? price : undefined;
        it.notes = $('#f-notes', sheet).value.trim() || undefined;
        await saveItem(it);
        close(); render();
        toast(existing ? 'Saved' : `Added ${it.name}`);
      };
    },
  });
}

// ---------------------------------------------------------------- MATCH
function renderMatch() {
  const anchor = S.matchAnchor && byId(S.matchAnchor);
  if (!anchor) return renderMatchPicker();
  const { groups, looks } = suggestFor(anchor, S.items, ctx(), S.prefs);
  const catLabel = id => CATEGORIES.find(c => c.id === id)?.label;

  view.innerHTML = `
    <div class="row between"><div class="eyebrow">Wearing</div><button class="btn sm ghost" id="m-change">Change</button></div>
    <div class="row" style="gap:14px;margin:6px 0 4px">
      <button class="card detail-ph" style="width:84px;flex:none;aspect-ratio:3/4" data-item="${anchor.id}">${phHTML(anchor)}</button>
      <div class="grow"><h1 style="margin:0 0 4px;font-size:28px">${esc(anchor.name)}</h1>
        <div class="muted small row" style="gap:6px"><i class="dot" style="background:${colorById(anchor.color).hex}"></i>${colorById(anchor.color).label} ${esc(typeInfo(anchor).label.toLowerCase())}</div></div>
    </div>
    <div class="chips" style="margin-top:10px">${OCCASIONS.map(o => `<button class="chip" aria-pressed="${o.id === S.occasion}" data-occ="${o.id}">${o.label}</button>`).join('')}</div>
    ${Object.entries(groups).map(([cat, list]) => list.length ? `
      <h2>${catLabel(cat)} that work</h2>
      <div class="rail">${list.slice(0, 10).map(r => `
        <div><button class="tile" data-sugg="${r.item.id}" style="width:100%"><div class="ph" style="position:relative">${phHTML(r.item)}<span class="match-pct">${pctScore(r.s)}%</span></div>
        <div class="name">${esc(r.item.name)}</div></button>
        <div class="why">${esc(railReason(r))}</div></div>`).join('')}
      </div>` : `<h2>${catLabel(cat)}</h2><p class="muted small">No ${catLabel(cat).toLowerCase()} in your closet yet.</p>`).join('')}
    ${looks.length ? `<h2>Complete looks</h2><div id="m-looks">${looks.slice(0, 3).map((l, i) => lookHTML(l, i)).join('')}</div>` : ''}
  `;
  $('#m-change').onclick = () => { S.matchAnchor = null; renderMatch(); };
  $$('[data-occ]').forEach(b => (b.onclick = async () => { S.occasion = b.dataset.occ; await db.setPref('occasion', S.occasion); renderMatch(); }));
  $$('[data-item]').forEach(b => (b.onclick = () => openItem(byId(b.dataset.item))));
  $$('[data-sugg]').forEach(b => (b.onclick = () => pairSheet(anchor, byId(b.dataset.sugg), Object.values(groups).flat().find(r => r.item.id === b.dataset.sugg))));
  const ml = $('#m-looks'); if (ml) bindLooks(ml, looks, renderMatch);
}

function railReason(r) {
  const pick = r.s < 0.55 ? r.reasons.find(x => !x.good) : r.reasons.find(x => x.good && !x.color) || r.reasons.find(x => x.good);
  return (pick || r.reasons[0] || { t: '' }).t;
}

function pairSheet(a, b, r) {
  openSheet(`
    <div class="sheet-head"><h2>${pctScore(r.s)}% match</h2><button class="btn sm ghost" data-close>Close</button></div>
    <div class="collage" style="--n:2">${[a, b].map(p => `<div><div class="ph">${phHTML(p)}</div><div class="cap">${esc(p.name)}</div></div>`).join('')}</div>
    <ul class="reasons">${[...new Map(r.reasons.map(x => [x.t, x])).values()].map(x => `<li class="${x.good ? '' : 'bad'}">${esc(x.t)}</li>`).join('')}</ul>
    <div class="look-actions">
      <button class="btn sm" id="p-wear">Wear together</button>
      <button class="btn sm secondary" id="p-up">👍</button>
      <button class="btn sm secondary" id="p-down">👎</button>
    </div>
  `, {
    onMount(sheet, close) {
      $('#p-wear', sheet).onclick = async () => { await wearPieces([a, b]); close(); toast('Logged'); renderMatch(); };
      $('#p-up', sheet).onclick = async () => { await feedback([a, b], 1); close(); toast("Noted — I'll rank that higher"); renderMatch(); };
      $('#p-down', sheet).onclick = async () => { await feedback([a, b], -1); close(); toast("Noted — I'll rank that lower"); renderMatch(); };
    },
  });
}

function renderMatchPicker() {
  const list = S.items.filter(i => i.category === S.matchCat && !i.archived);
  const cats = CATEGORIES.filter(c => c.id !== 'accessory' && S.items.some(i => i.category === c.id));
  view.innerHTML = `
    <div class="eyebrow">Pair it</div>
    <h1>What are you wearing?</h1>
    ${S.items.length ? `
      <p class="muted" style="margin-top:-6px">Pick the piece you want to build around — I'll rank everything that goes with it.</p>
      <div class="chips">${(cats.length ? cats : CATEGORIES.slice(0, 4)).map(c => `<button class="chip" data-cat="${c.id}" aria-pressed="${c.id === S.matchCat}">${c.label}</button>`).join('')}</div>
      <div class="grid" style="margin-top:14px">${list.map(i => tileHTML(i)).join('') || `<p class="muted">No ${CATEGORIES.find(c => c.id === S.matchCat).label.toLowerCase()} yet.</p>`}</div>`
      : emptyCloset('Add some clothes first, then pick one here to see what goes with it.')}
  `;
  bindEmpty();
  $$('[data-cat]').forEach(b => (b.onclick = () => { S.matchCat = b.dataset.cat; renderMatchPicker(); }));
  $$('[data-item]').forEach(b => (b.onclick = () => { S.matchAnchor = b.dataset.item; renderMatch(); window.scrollTo(0, 0); }));
}

// ---------------------------------------------------------------- STYLIST
const PROMPTS = [
  'Dinner date tonight — what should I wear?',
  'Style my most neglected piece',
  'Pack 3 days of outfits for a weekend trip',
  'What one item would add the most outfits?',
  'Make me a smart-casual look for work',
];

function renderStylist() {
  if (!S.apiKey) {
    view.innerHTML = `
      <div class="eyebrow">AI stylist</div><h1>Ask anything</h1>
      <div class="card pad">
        <p style="margin-top:0">The stylist is Google Gemini looking at your actual closet. Ask for outfits for an event, packing lists, or what to buy next. It also auto-tags new clothes from their photos.</p>
        <p class="muted small">It needs your own Gemini API key — get one free at aistudio.google.com → Get API key. The key is stored only on this device and is sent only to Google. Everything else in Drape works without it.</p>
        <label class="field"><span>Gemini API key</span><input class="input" id="k" type="password" placeholder="AIza…" autocomplete="off"></label>
        <button class="btn block" id="k-save" style="margin-top:12px">Turn on stylist</button>
      </div>`;
    $('#k-save').onclick = async e => {
      e.target.innerHTML = '<span class="spinner"></span> Checking key…';
      try { await connectKey($('#k').value.trim()); renderStylist(); }
      catch (err) { toast(err.message); e.target.textContent = 'Turn on stylist'; }
    };
    return;
  }
  view.innerHTML = `
    <div class="row between"><div><div class="eyebrow">AI stylist</div><h1 style="margin-bottom:8px">Ask anything</h1></div>
      ${S.chat.length ? '<button class="btn sm ghost" id="c-clear">New chat</button>' : ''}</div>
    <div class="chat" id="chat">
      ${S.chat.length ? S.chat.map(msgHTML).join('') : `<div class="msg bot">Hi! I can see all ${S.items.length} pieces in your closet${S.weather ? ` and that it's ${Math.round(S.weather.tempC)}° out` : ''}. What are we dressing for?</div>`}
      ${S.busy ? '<div class="msg bot typing"><span></span><span></span><span></span></div>' : ''}
    </div>
    ${!S.chat.length ? `<div class="chips wrap" style="margin-top:14px">${PROMPTS.map(p => `<button class="chip" data-p="${esc(p)}" style="height:auto;padding:8px 14px;white-space:normal;text-align:left">${esc(p)}</button>`).join('')}</div>` : ''}
    <form class="composer" id="c-form"><input id="c-in" placeholder="Message your stylist…" autocomplete="off" enterkeyhint="send"><button class="btn sm" ${S.busy ? 'disabled' : ''}>Send</button></form>
  `;
  $$('[data-p]').forEach(b => (b.onclick = () => send(b.dataset.p)));
  $('#c-form').onsubmit = e => { e.preventDefault(); const v = $('#c-in').value.trim(); if (v) send(v); };
  const cc = $('#c-clear'); if (cc) cc.onclick = async () => { S.chat = []; await db.setPref('chat', []); renderStylist(); };
  $$('#chat [data-item]').forEach(b => (b.onclick = () => openItem(byId(b.dataset.item))));
  const last = $('#chat').lastElementChild; if (last && S.chat.length) last.scrollIntoView({ block: 'end' });
}

function findShort(short) { return S.items.find(i => i.id.startsWith(short)); }

function msgHTML(m) {
  if (m.role === 'user') return `<div class="msg user">${esc(m.content)}</div>`;
  const refs = [];
  const body = esc(m.content).replace(/\[\[([a-z0-9-]{4,36})\]\]/gi, (_, id) => {
    const it = findShort(id);
    if (!it) return '';
    if (!refs.includes(it)) refs.push(it);
    return `<button class="ref" data-item="${it.id}"><span class="mini">${phHTML(it)}</span>${esc(it.name)}</button>`;
  });
  return `<div class="msg bot ${m.error ? 'muted' : ''}">${body}${refs.length > 1 ? `<div class="msg-pieces">${refs.map(r => `<button class="ph" data-item="${r.id}">${phHTML(r)}</button>`).join('')}</div>` : ''}</div>`;
}

async function send(text) {
  if (S.busy) return;
  S.chat.push({ role: 'user', content: text });
  S.busy = true; renderStylist();
  try {
    const { askStylist } = await import('./ai.js');
    const history = S.chat.filter(m => !m.error).slice(-16).map(({ role, content }) => ({ role, content }));
    const { text: reply } = await askStylist({ apiKey: S.apiKey, model: S.aiModel, history, items: S.items, context: ctxText() });
    S.chat.push({ role: 'assistant', content: reply });
  } catch (e) {
    S.chat.pop();
    S.chat.push({ role: 'user', content: text }, { role: 'assistant', content: e.message, error: true });
  }
  S.busy = false;
  await db.setPref('chat', S.chat.filter(m => !m.error).slice(-40));
  if (S.tab === 'stylist') renderStylist();
}

// ---------------------------------------------------------------- ME
function renderMe() {
  const prof = db.activeProfile();
  const items = S.items.filter(i => !i.archived);
  const worn = items.filter(i => i.wearCount);
  const never = items.filter(i => !i.wearCount);
  const stale = items.filter(i => i.lastWorn && Date.now() - i.lastWorn > 60 * 864e5);
  const top = [...worn].sort((a, b) => b.wearCount - a.wearCount).slice(0, 5);
  const byCat = CATEGORIES.map(c => [c, items.filter(i => i.category === c.id).length]).filter(([, n]) => n);
  const maxCat = Math.max(1, ...byCat.map(([, n]) => n));
  const colorCounts = Object.entries(items.reduce((m, i) => ((m[i.color] = (m[i.color] || 0) + 1), m), {})).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const value = items.reduce((s, i) => s + (i.price || 0), 0);
  const utilisation = items.length ? Math.round((worn.length / items.length) * 100) : 0;

  view.innerHTML = `
    <div class="eyebrow">Profile</div>
    <h1>${esc(prof.name)}</h1>
    <div class="stat-row">
      <div class="card stat"><b>${items.length}</b><span>pieces</span></div>
      <div class="card stat"><b>${S.wears.length}</b><span>outfits logged</span></div>
      <div class="card stat"><b>${utilisation}%</b><span>of closet worn</span></div>
    </div>

    ${items.length ? `
    <h2>Closet mix</h2>
    <div class="card pad stack">
      ${byCat.map(([c, n]) => `<div><div class="row between small"><span>${c.label}</span><span class="muted">${n}</span></div><div class="bar"><i style="width:${(n / maxCat) * 100}%"></i></div></div>`).join('')}
      <div class="row wrap" style="gap:12px;padding-top:4px">${colorCounts.map(([c, n]) => `<span class="row small" style="gap:6px"><i class="dot" style="background:${colorById(c).hex}"></i>${colorById(c).label} <span class="muted">${n}</span></span>`).join('')}</div>
      ${value ? `<div class="small muted">Closet value ${value.toLocaleString()} · avg cost per wear ${worn.length ? (worn.reduce((s, i) => s + (i.price || 0) / i.wearCount, 0) / worn.length).toFixed(0) : '—'}</div>` : ''}
    </div>` : ''}

    ${top.length ? `<h2>Most worn</h2><div class="card pad">${top.map(i => `<button class="list-row" style="width:100%;text-align:left" data-item="${i.id}"><span class="thumb">${phHTML(i)}</span><span class="grow">${esc(i.name)}</span><span class="muted small">${i.wearCount}×</span></button>`).join('')}</div>` : ''}
    ${never.length || stale.length ? `<h2>Forgotten</h2><p class="muted small" style="margin-top:-6px">${never.length} never worn${stale.length ? `, ${stale.length} not in 60+ days` : ''}. Tap one to style it.</p>
      <div class="rail">${[...never, ...stale].slice(0, 12).map(i => `<div>${tileHTML(i)}</div>`).join('')}</div>` : ''}

    ${S.outfits.length ? `<h2>Saved outfits</h2><div id="saved">${S.outfits.map((o, idx) => {
      const pieces = o.pieces.map(byId).filter(Boolean);
      return `<div class="card pad" style="margin-bottom:10px" data-outfit="${idx}"><div class="row between"><h3>${esc(o.name)}</h3><button class="btn sm ghost" data-del-outfit="${o.id}">Remove</button></div>
        <div class="row" style="gap:6px;margin-top:10px">${pieces.map(p => `<button class="thumb list-row" style="padding:0;border:0;width:56px;height:72px;border-radius:10px;overflow:hidden" data-item="${p.id}">${phHTML(p)}</button>`).join('')}</div>
        <button class="btn sm secondary" style="margin-top:10px" data-wear-outfit="${o.id}">Wear this today</button></div>`;
    }).join('')}</div>` : ''}

    ${S.wears.length ? `<h2>History</h2><div class="card pad">${S.wears.slice(0, 14).map(wearRow).join('')}</div>` : ''}

    <h2>Profiles</h2>
    <p class="muted small" style="margin-top:-6px">Each profile has its own separate closet on this device — handy if someone else wants to use your phone or iPad.</p>
    <div class="card">${db.listProfiles().map(p => `<button class="menu-row" data-prof="${p.id}"><span>${esc(p.name)}</span><span class="chev">${p.id === prof.id ? '✓ Active' : 'Switch ›'}</span></button>`).join('')}
      <button class="menu-row" id="p-add"><span>+ Add profile</span></button>
      <button class="menu-row" id="p-rename"><span>Rename “${esc(prof.name)}”</span></button></div>

    <h2>Settings</h2>
    <div class="card">
      <button class="menu-row" id="s-key"><span>AI stylist key</span><span class="chev">${S.apiKey ? 'On ›' : 'Off ›'}</span></button>
      <button class="menu-row" id="s-export"><span>Back up closet</span><span class="chev">Export ›</span></button>
      <label class="menu-row" style="position:relative"><span>Restore from backup</span><span class="chev">Import ›</span><input type="file" accept="application/json,.json" id="s-import" style="position:absolute;inset:0;opacity:0"></label>
      <button class="menu-row" id="s-install"><span>Add Drape to Home Screen</span><span class="chev">How ›</span></button>
      ${S.items.some(i => i.sample) ? '<button class="menu-row" id="s-sample"><span>Remove sample wardrobe</span><span class="chev">›</span></button>' : ''}
      <button class="menu-row" id="s-wipe" style="color:#c0392b"><span>${db.listProfiles().length > 1 ? 'Delete this profile' : 'Erase all data'}</span></button>
    </div>
    <p class="muted small" style="text-align:center;margin-top:24px">Drape keeps everything on this device. Nothing is uploaded unless you use the AI stylist.</p>
  `;

  $$('[data-item]').forEach(b => (b.onclick = () => openItem(byId(b.dataset.item))));
  $$('[data-wear-item]').forEach(b => (b.onclick = () => openItem(byId(b.dataset.wearItem))));
  $$('[data-del-outfit]').forEach(b => (b.onclick = async () => { await db.del('outfits', b.dataset.delOutfit); S.outfits = S.outfits.filter(o => o.id !== b.dataset.delOutfit); renderMe(); }));
  $$('[data-wear-outfit]').forEach(b => (b.onclick = async () => {
    const o = S.outfits.find(x => x.id === b.dataset.wearOutfit);
    await wearPieces(o.pieces.map(byId).filter(Boolean)); toast('Logged'); renderMe();
  }));
  $$('[data-prof]').forEach(b => (b.onclick = async () => { if (b.dataset.prof === prof.id) return; db.setActiveProfile(b.dataset.prof); await switchProfile(); }));
  $('#p-add').onclick = async () => { const n = prompt('Name for the new profile'); if (n?.trim()) { const p = db.addProfile(n.trim()); db.setActiveProfile(p.id); await switchProfile(); toast(`Switched to ${p.name}`); } };
  $('#p-rename').onclick = () => { const n = prompt('Profile name', prof.name); if (n?.trim()) { db.renameProfile(prof.id, n.trim()); renderMe(); } };
  $('#s-key').onclick = keySheet;
  $('#s-export').onclick = exportBackup;
  $('#s-import').onchange = importBackup;
  $('#s-install').onclick = installSheet;
  const sm = $('#s-sample'); if (sm) sm.onclick = async () => { for (const i of S.items.filter(x => x.sample)) await deleteItem(i.id); toast('Sample wardrobe removed'); renderMe(); };
  $('#s-wipe').onclick = async () => {
    const multi = db.listProfiles().length > 1;
    if (!confirm(multi ? `Delete profile “${prof.name}” and its whole closet? This can't be undone.` : 'Erase your whole closet, history and settings? This can\'t be undone. Export a backup first if you might want it.')) return;
    await db.deleteProfile(prof.id);
    db.setActiveProfile(db.listProfiles()[0].id);
    await switchProfile(); toast(multi ? 'Profile deleted' : 'Erased');
  };
}

async function switchProfile() {
  urlCache.forEach(u => URL.revokeObjectURL(u)); urlCache.clear();
  S.matchAnchor = null; S.seed = 0;
  await loadAll(); render();
}

// Validate a Gemini key by listing its models, then pick the newest stable Flash.
async function connectKey(key) {
  if (!/^AIza[\w-]{20,}$/.test(key)) throw new Error('That does not look like a Gemini API key (it starts with AIza)');
  const { listModels } = await import('./ai.js');
  const models = await listModels(key);
  if (!models.length) throw new Error('This key has no Gemini models available');
  S.apiKey = key; S.aiModels = models;
  if (!models.includes(S.aiModel)) S.aiModel = models[0];
  await db.setPref('geminiKey', key); await db.setPref('aiModels', models); await db.setPref('aiModel', S.aiModel);
}

function keySheet() {
  const opts = S.aiModels.length ? S.aiModels : [S.aiModel].filter(Boolean);
  openSheet(`
    <div class="sheet-head"><h2>AI stylist</h2><button class="btn sm ghost" data-close>Close</button></div>
    <p class="muted">Uses your own Google Gemini API key (free from aistudio.google.com), stored only in this profile on this device. Requests go straight from your phone to Google.</p>
    <label class="field"><span>Gemini API key</span><input class="input" id="k2" type="password" placeholder="AIza…" value="${esc(S.apiKey)}" autocomplete="off"></label>
    ${opts.length ? `<label class="field"><span>Model</span><select class="input" id="k2-model">${opts.map(m => `<option ${m === S.aiModel ? 'selected' : ''}>${esc(m)}</option>`).join('')}</select></label>` : ''}
    <button class="btn block" id="k2-save" style="margin-top:12px">Save</button>
    ${S.apiKey ? '<button class="btn block danger" id="k2-del" style="margin-top:8px">Remove key</button>' : ''}
  `, {
    onMount(sheet, close) {
      $('#k2-save', sheet).onclick = async e => {
        const key = $('#k2', sheet).value.trim();
        const picked = $('#k2-model', sheet)?.value;
        e.target.innerHTML = '<span class="spinner"></span> Checking key…';
        try {
          if (picked) S.aiModel = picked;
          await connectKey(key);
          close(); renderMe(); toast(`Stylist on · ${S.aiModel}`);
        } catch (err) { toast(err.message); e.target.textContent = 'Save'; }
      };
      const d = $('#k2-del', sheet); if (d) d.onclick = async () => {
        S.apiKey = ''; S.aiModels = []; await db.setPref('geminiKey', ''); await db.setPref('aiModels', []); close(); renderMe();
      };
    },
  });
}

async function exportBackup() {
  toast('Preparing backup…');
  const data = await db.exportAll();
  data.prefs = (data.prefs || []).filter(p => p.id !== 'geminiKey'); // never put the key in a file
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const name = `drape-${db.activeProfile().name.toLowerCase().replace(/\W+/g, '-')}-${new Date().toISOString().slice(0, 10)}.json`;
  const file = new File([blob], name, { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'Drape backup' }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

async function importBackup(e) {
  const f = e.target.files[0]; if (!f) return;
  try {
    const data = JSON.parse(await f.text());
    const replace = S.items.length ? confirm(`Replace your current closet with this backup (${(data.items || []).length} pieces)?\n\nCancel = merge them in instead.`) : true;
    await db.importAll(data, { replace });
    await switchProfile(); toast('Backup restored');
  } catch (err) { toast(err.message || 'Could not read that file'); }
}

function installSheet() {
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  openSheet(`
    <div class="sheet-head"><h2>Install on iPhone</h2><button class="btn sm ghost" data-close>Close</button></div>
    ${standalone ? '<p>You are already running Drape from your Home Screen. ✓</p>' : ''}
    <ol class="stack" style="padding-left:20px">
      <li>Open this page in <b>Safari</b>.</li>
      <li>Tap the <b>Share</b> button (square with an arrow).</li>
      <li>Scroll and tap <b>Add to Home Screen</b>, then <b>Add</b>.</li>
      <li>Open Drape from the new icon — it runs full-screen and works offline.</li>
    </ol>
    <p class="muted small">Your closet is stored inside the Home Screen app. Back up now and then from Me → Back up closet so you never lose it.</p>
  `);
}

// ---------------------------------------------------------------- sample wardrobe
const SAMPLE = [
  ['White oxford shirt', 'top', 'shirt', 'white'], ['Black crew tee', 'top', 'tshirt', 'black'], ['Grey marl hoodie', 'top', 'hoodie', 'grey'],
  ['Navy zip hoodie', 'top', 'hoodie', 'navy'], ['Sage linen shirt', 'top', 'linen', 'sage'], ['Burgundy knit', 'top', 'sweater', 'burgundy'],
  ['Cream kurta', 'top', 'kurta', 'cream'], ['Mustard graphic tee', 'top', 'graphic', 'mustard', 'graphic'], ['Light blue formal shirt', 'top', 'dressshirt', 'lightblue'],
  ['Indigo slim jeans', 'bottom', 'jeans', 'denim'], ['Black jeans', 'bottom', 'jeans', 'black'], ['Khaki chinos', 'bottom', 'chinos', 'khaki'],
  ['Charcoal trousers', 'bottom', 'trousers', 'charcoal'], ['Olive cargos', 'bottom', 'cargo', 'olive'], ['Black joggers', 'bottom', 'joggers', 'black'],
  ['Beige shorts', 'bottom', 'shorts', 'beige'], ['White sneakers', 'shoes', 'sneakers', 'white'], ['Brown loafers', 'shoes', 'loafers', 'brown'],
  ['Black runners', 'shoes', 'runners', 'black'], ['Tan juttis', 'shoes', 'juttis', 'khaki'], ['Denim jacket', 'outer', 'denimjacket', 'denim'],
  ['Navy blazer', 'outer', 'blazer', 'navy'], ['Black bomber', 'outer', 'bomber', 'black'],
];
const SHAPES = {
  top: 'M30 22 L46 14 Q60 24 74 14 L90 22 L104 46 L88 54 L86 106 L34 106 L32 54 L16 46 Z',
  outer: 'M28 20 L48 12 L60 40 L72 12 L92 20 L106 50 L92 56 L92 108 L28 108 L28 56 L14 50 Z',
  bottom: 'M36 12 L84 12 L90 108 L66 108 L60 46 L54 108 L30 108 Z',
  shoes: 'M14 74 Q16 58 30 58 L50 60 Q62 70 82 72 Q104 74 106 88 L106 94 L14 94 Z',
};
async function sampleThumb(cat, color) {
  const c = document.createElement('canvas'); c.width = 120; c.height = 160;
  const g = c.getContext('2d');
  g.fillStyle = '#ece7de'; g.fillRect(0, 0, 120, 160);
  g.translate(0, 20);
  const p = new Path2D(SHAPES[cat] || SHAPES.top);
  g.fillStyle = colorById(color).hex; g.fill(p);
  g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 2; g.stroke(p);
  return canvasBlob(c, 0.85);
}
async function loadSample() {
  const now = Date.now();
  for (const [k, [name, category, type, color, pattern]] of SAMPLE.entries()) {
    const thumb = await sampleThumb(category, color);
    await saveItem({ id: db.uid(), name, category, type, color, pattern: pattern || 'solid', seasons: [], created: now - k, sample: true, thumb, photo: thumb });
  }
  S.items.sort((a, b) => (b.created || 0) - (a.created || 0));
}

// ---------------------------------------------------------------- boot
(async function boot() {
  try { const t = sessionStorage.getItem('drape.tab'); if (t && TABS[t]) S.tab = t; } catch { /* ignore */ }
  await loadAll();
  render();
  refreshWeatherIfStale();
  navigator.storage?.persist?.();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
})();
