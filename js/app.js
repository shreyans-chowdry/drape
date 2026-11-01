import * as db from './db.js';
import {
  CATEGORIES, TYPES, COLORS, PATTERNS, OCCASIONS, SEASONS, typeInfo, colorById, itemF, itemW,
  suggestFor, generateLooks, buildAround, similarOwned, scoreLabel, pctScore, pairKey, currentSeason,
} from './engine.js';
import { prepare, thumbOf, cutout, colorIn } from './photo.js';

// ---------------------------------------------------------------- state
const S = {
  tab: 'today',
  items: [],
  outfits: [],
  wears: [],
  places: [],       // [{ id, room, unit, spot }]
  prefs: {},        // pair feedback map
  weather: null,
  occasion: 'casual',
  seed: 0,
  closetCat: 'all',
  closetQuery: '',
  matchAnchor: null,
  matchCat: 'top',
  stylistMode: 'fit',
  builder: { locked: [], need: [], brief: '', looks: null, busy: false, error: '' },
  shop: { status: 'idle' },
  chat: [],
  apiKey: '',
  aiModel: '',
  aiModels: [],
  imageModels: [],
  studioModel: '',
  studioBlocked: false,
  scan: { total: 0, done: 0, failed: 0 },
  busy: false,
};

const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const view = $('#view');
const byId = id => S.items.find(i => i.id === id);
const findShort = short => (short ? S.items.find(i => i.id.startsWith(short)) : undefined);
const aiReady = () => !!S.apiKey;
const ORDER = ['outer', 'top', 'onepiece', 'bottom', 'shoes', 'accessory'];
const byOrder = (a, b) => ORDER.indexOf(a.category) - ORDER.indexOf(b.category);

function toast(msg, ms = 2400) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), ms);
}
const ai = () => import('./ai.js');
const uniq = arr => [...new Set(arr.filter(Boolean))];

// ---------------------------------------------------------------- places
const placeById = id => S.places.find(p => p.id === id);
const placeLabel = id => { const p = placeById(id); return p ? [p.room, p.unit, p.spot].filter(Boolean).join(' › ') : ''; };
const itemPlace = item => placeLabel(item.placeId);
const savePlaces = () => db.setPref('places', S.places);
function findOrCreatePlace(room, unit, spot) {
  const norm = s => (s || '').trim();
  room = norm(room); unit = norm(unit); spot = norm(spot);
  if (!room && !unit && !spot) return null;
  const same = S.places.find(p => p.room.toLowerCase() === (room || 'home').toLowerCase() && (p.unit || '').toLowerCase() === unit.toLowerCase() && (p.spot || '').toLowerCase() === spot.toLowerCase());
  if (same) return same.id;
  const p = { id: db.uid().slice(0, 8), room: room || 'Home', unit, spot };
  S.places.push(p); savePlaces();
  return p.id;
}

function placeFieldHTML(currentId) {
  const opts = [...S.places].sort((a, b) => placeLabel(a.id).localeCompare(placeLabel(b.id)));
  return `<div class="field"><span>Where it's kept</span>
    <select class="input" id="pl-sel">
      <option value="">Not set</option>
      ${opts.map(p => `<option value="${p.id}" ${p.id === currentId ? 'selected' : ''}>${esc(placeLabel(p.id))}</option>`).join('')}
      <option value="__new">+ New place…</option>
    </select>
    <div id="pl-new" hidden style="margin-top:8px">
      <div class="place-grid">
        <input class="input" id="pl-room" placeholder="Room (Bedroom)" list="dl-room" autocomplete="off">
        <input class="input" id="pl-unit" placeholder="Storage (Wardrobe)" list="dl-unit" autocomplete="off">
        <input class="input" id="pl-spot" placeholder="Spot (Shelf 2, blue pouch)" list="dl-spot" autocomplete="off">
      </div>
      <datalist id="dl-room">${uniq(['Bedroom', 'Guest room', 'Hall', ...S.places.map(p => p.room)]).map(v => `<option value="${esc(v)}">`).join('')}</datalist>
      <datalist id="dl-unit">${uniq(['Wardrobe', 'Cupboard', 'Chest of drawers', 'Shoe rack', 'Under-bed box', 'Suitcase', ...S.places.map(p => p.unit)]).map(v => `<option value="${esc(v)}">`).join('')}</datalist>
      <datalist id="dl-spot">${uniq(['Top shelf', 'Middle shelf', 'Bottom shelf', 'Hanging rail', 'Top drawer', 'Box', 'Pouch', ...S.places.map(p => p.spot)]).map(v => `<option value="${esc(v)}">`).join('')}</datalist>
    </div></div>`;
}
function bindPlaceField(sheet) {
  const sel = $('#pl-sel', sheet);
  sel.onchange = () => { $('#pl-new', sheet).hidden = sel.value !== '__new'; if (sel.value === '__new') $('#pl-room', sheet).focus(); };
}
function readPlaceField(sheet) {
  const v = $('#pl-sel', sheet).value;
  if (v !== '__new') return v || undefined;
  return findOrCreatePlace($('#pl-room', sheet).value, $('#pl-unit', sheet).value, $('#pl-spot', sheet).value) || undefined;
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
const PHOTO_MODES = [['studio', 'Studio'], ['cutout', 'Clean'], ['original', 'Original']];
async function setPhotoMode(item, mode) {
  const blob = item[mode] || (mode === 'original' ? item.photo : null);
  if (!blob) return;
  item.photoMode = mode; item.photo = blob; item.thumb = await thumbOf(blob);
}

// ---------------------------------------------------------------- data
async function loadAll() {
  [S.items, S.outfits, S.wears] = await Promise.all([db.all('items'), db.all('outfits'), db.all('wears')]);
  S.items.sort((a, b) => (b.created || 0) - (a.created || 0));
  S.wears.sort((a, b) => b.date - a.date);
  S.outfits.sort((a, b) => b.created - a.created);
  S.prefs = await db.getPref('pairs', {});
  S.places = await db.getPref('places', []);
  S.apiKey = await db.getPref('geminiKey', '');
  S.aiModel = await db.getPref('aiModel', '');
  S.aiModels = await db.getPref('aiModels', []);
  S.imageModels = await db.getPref('imageModels', []);
  S.studioModel = await db.getPref('studioModel', '');
  S.chat = await db.getPref('chat', []);
  S.weather = await db.getPref('weather', null);
  S.occasion = await db.getPref('occasion', 'casual');
  S.studioBlocked = false;
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
  S.builder.locked = S.builder.locked.filter(x => x !== id);
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

// ---------------------------------------------------------------- scanning
function newItem(fields) {
  return { id: db.uid(), created: Date.now(), pattern: 'solid', seasons: [], ...fields };
}

/** Turn one photo into one or more draft items (not saved). */
async function scanFile(file, placeId) {
  const { original, img, color } = await prepare(file);
  const fallback = async () => [newItem({
    name: `${colorById(color).label} piece`, category: 'top', type: 'tshirt', color,
    original, photo: original, photoMode: 'original', thumb: await thumbOf(original), placeId, review: true,
  })];
  if (!aiReady()) return fallback();
  const { scanPhoto } = await ai();
  const garments = await scanPhoto({ apiKey: S.apiKey, model: S.aiModel, blob: original });
  if (!garments.length) return fallback();
  const drafts = [];
  for (const g of garments) {
    const cut = await cutout(img, g);
    drafts.push(newItem({
      name: g.name, category: g.category, type: g.type,
      color: g.color || colorIn(img, g.box_2d), color2: g.color2, pattern: g.pattern,
      formality: g.formality, warmth: g.warmth,
      seasons: (g.seasons || []).length >= 4 ? [] : g.seasons,
      brand: g.brandGuess || undefined,
      ai: { description: g.description, fingerprint: g.fingerprint, material: g.material, styleTags: g.styleTags || [] },
      original, cutout: cut, photo: cut, photoMode: 'cutout', thumb: await thumbOf(cut),
      placeId, review: garments.length > 1,
    }));
  }
  return drafts;
}

/** Upgrade an item's photo to a Gemini studio shot, in the background. */
async function makeStudio(item, { quiet = true } = {}) {
  if (!aiReady() || !S.studioModel || S.studioBlocked || item.studio) return false;
  try {
    const { studioPhoto } = await ai();
    const blob = await studioPhoto({
      apiKey: S.apiKey, model: S.studioModel, blob: item.cutout || item.original || item.photo,
      garment: { name: item.name, description: item.ai?.description, category: item.category },
    });
    const fresh = byId(item.id) || item;
    fresh.studio = blob;
    if (fresh.photoMode !== 'original') await setPhotoMode(fresh, 'studio');
    await saveItem(fresh);
    if (['closet', 'today', 'match'].includes(S.tab) && !$('.sheet.open')) render();
    return true;
  } catch (e) {
    if ([403, 404, 429].includes(e.status) || /not available|quota|not allowed/i.test(e.message)) {
      S.studioBlocked = true;
      toast('Studio photos are not available on this key right now — using clean cut-outs', 3500);
    } else if (!quiet) toast(e.message);
    return false;
  }
}

const studioQueue = [];
let studioRunning = false;
async function queueStudio(items) {
  if (!S.studioModel) return;
  studioQueue.push(...items.filter(i => i.cutout));
  if (studioRunning) return;
  studioRunning = true;
  while (studioQueue.length && !S.studioBlocked) await makeStudio(studioQueue.shift());
  studioQueue.length = 0;
  studioRunning = false;
}

async function scanMany(files, placeId) {
  S.scan = { total: files.length, done: 0, failed: 0 };
  S.closetCat = 'review';
  if (S.tab !== 'closet') go('closet'); else render();
  const added = [];
  for (const f of files) {
    try {
      const drafts = await scanFile(f, placeId);
      for (const d of drafts) { d.review = true; await saveItem(d); added.push(d); }
    } catch (e) { S.scan.failed++; console.warn(e); if (S.scan.failed === 1) toast(e.message); }
    S.scan.done++;
    if (S.tab === 'closet' && !$('.sheet.open')) render();
  }
  const n = added.length;
  S.scan = { total: 0, done: 0, failed: 0 };
  if (S.tab === 'closet') render();
  toast(`Added ${n} piece${n === 1 ? '' : 's'} — check them under “To review”`);
  queueStudio(added);
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
  const d = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  return `${d}. ${w ? `Weather: ${Math.round(w.tempC)}°C, ${w.label}${w.rain ? ', rain likely' : ''}.` : 'Weather unknown.'}`;
}

// ---------------------------------------------------------------- sheet
function openSheet(html, { onMount, onClose } = {}) {
  const root = $('#sheet-root');
  root.innerHTML = `<div class="sheet-backdrop"></div><div class="sheet" role="dialog" aria-modal="true"><div class="grabber"></div>${html}</div>`;
  const back = $('.sheet-backdrop', root), sheet = $('.sheet', root);
  document.body.style.overflow = 'hidden';
  requestAnimationFrame(() => { back.classList.add('open'); sheet.classList.add('open'); });
  let closed = false;
  const close = () => {
    if (closed) return; closed = true;
    back.classList.remove('open'); sheet.classList.remove('open');
    document.body.style.overflow = '';
    setTimeout(() => { if (root.contains(sheet)) root.innerHTML = ''; }, 280);
    onClose?.();
  };
  back.onclick = close;
  $$('[data-close]', sheet).forEach(b => (b.onclick = close));
  let y0 = null;
  sheet.addEventListener('touchstart', e => { if (sheet.scrollTop <= 0 && !e.target.closest('input,textarea,select')) y0 = e.touches[0].clientY; }, { passive: true });
  sheet.addEventListener('touchmove', e => { if (y0 != null && e.touches[0].clientY - y0 > 90) { y0 = null; close(); } }, { passive: true });
  sheet.addEventListener('touchend', () => { y0 = null; }, { passive: true });
  onMount?.(sheet, close);
  return close;
}
/** Close the current sheet, then open another once it has animated away. */
const nextSheet = (close, fn) => { close(); setTimeout(fn, 300); };

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
const PIN = '<svg viewBox="0 0 24 24" class="pin-ic" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>';

function lookHTML(look, idx, { actions = true } = {}) {
  let body;
  if (look.why) {
    body = `<p class="look-why">${esc(look.why)}</p>${look.tips ? `<p class="look-tip">✦ ${esc(look.tips)}</p>` : ''}`;
  } else {
    const good = look.reasons.filter(r => r.good), bad = look.reasons.filter(r => !r.good);
    const dedupe = arr => [...new Map(arr.map(r => [r.t, r])).values()];
    const shown = [...dedupe(good).slice(0, 3), ...dedupe(bad).slice(0, 1)];
    body = `<ul class="reasons">${shown.map(r => `<li class="${r.good ? '' : 'bad'}">${esc(r.t)}</li>`).join('')}</ul>`;
  }
  return `<article class="card look" data-look="${idx}">
    <div class="row between" style="margin-bottom:10px;gap:8px">
      <span class="eyebrow" style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(look.title || `Look ${idx + 1}`)}</span>
      ${look.s != null ? `<span class="score">${scoreLabel(look.s)} · ${pctScore(look.s)}%</span>` : '<span class="score">✦ Gemini</span>'}
    </div>
    <div class="collage" style="--n:${Math.min(look.pieces.length, 4)}">
      ${look.pieces.slice(0, 4).map(p => `<button data-item="${p.id}"><div class="ph">${phHTML(p)}</div><div class="cap">${esc(p.name)}</div></button>`).join('')}
    </div>
    ${look.pieces.length > 4 ? `<div class="small muted" style="margin-top:6px">+ ${look.pieces.slice(4).map(p => `<button class="link" data-item="${p.id}">${esc(p.name)}</button>`).join(', ')}</div>` : ''}
    ${body}
    ${actions ? `<div class="look-actions">
      <button class="btn sm" data-act="wear">Wear this</button>
      <button class="btn sm secondary" data-act="find" aria-label="Where to find these">${PIN} Find</button>
      <button class="btn sm secondary" data-act="save" aria-label="Save outfit" style="flex:0 0 44px">♡</button>
      <button class="btn sm secondary" data-act="nope" aria-label="Not for me" style="flex:0 0 44px">✕</button>
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
      if (a === 'find') whereSheet(look.pieces);
      if (a === 'save') { await saveOutfit(look.pieces, look.title); toast('Saved to your outfits'); }
      if (a === 'nope') { await feedback(look.pieces, -1); toast("Got it — I'll suggest that less"); S.seed++; rerender(); }
    }));
  });
}

/** The "library card": where each piece of a look lives at home. */
function whereSheet(pieces) {
  const groups = new Map();
  for (const p of pieces) {
    const label = itemPlace(p) || '';
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(p);
  }
  const ordered = [...groups.entries()].sort(([a], [b]) => (a ? 0 : 1) - (b ? 0 : 1) || a.localeCompare(b));
  openSheet(`
    <div class="sheet-head"><h2>Where to find them</h2><button class="btn sm ghost" data-close>Done</button></div>
    ${ordered.map(([label, list]) => `
      <div class="card pad" style="margin-bottom:10px">
        <div class="row" style="gap:8px;margin-bottom:4px">${PIN}<h3>${label ? esc(label) : 'No place set yet'}</h3></div>
        ${list.map(p => `<div class="list-row"><span class="thumb">${phHTML(p)}</span><span class="grow">${esc(p.name)}${p.laundry ? ' <span class="muted small">· in laundry</span>' : ''}</span>
          ${label ? '' : `<button class="btn sm secondary" data-set-place="${p.id}">Set</button>`}</div>`).join('')}
      </div>`).join('')}
  `, {
    onMount(sheet, close) {
      $$('[data-set-place]', sheet).forEach(b => (b.onclick = () => nextSheet(close, () => editItem(byId(b.dataset.setPlace), { focus: 'place' }))));
    },
  });
}

function tileHTML(item, extra = '') {
  const badge = item.review ? '<span class="badge new">Review</span>' : item.laundry ? '<span class="badge">Laundry</span>' : '';
  return `<button class="tile ${item.laundry ? 'dim' : ''}" data-item="${item.id}" ${extra}>
    <div class="ph">${phHTML(item)}</div>${badge}${item.fav ? '<span class="fav">♥</span>' : ''}
    <div class="name">${esc(item.name)}</div>
    <div class="meta row" style="gap:6px"><i class="dot" style="background:${colorById(item.color).hex}"></i><span class="grow" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(typeInfo(item).label)}</span>${item.placeId ? `<span class="pin-tag" title="${esc(itemPlace(item))}">${PIN}</span>` : ''}</div>
  </button>`;
}

function emptyCloset(msg) {
  return `<div class="card empty">
    <div class="art">✦</div>
    <h2 style="margin:12px 0 0">Your closet is empty</h2>
    <p>${msg}</p>
    <div class="stack" style="max-width:280px;margin:0 auto">
      <button class="btn block" id="e-add">Scan your clothes</button>
      <button class="btn block secondary" id="e-sample">Try with a sample wardrobe</button>
    </div>
  </div>`;
}
function bindEmpty() {
  const a = $('#e-add'); if (a) a.onclick = addSheet;
  const s = $('#e-sample'); if (s) s.onclick = async () => { await loadSample(); toast('Sample wardrobe added — remove it any time from Me'); render(); };
}

// ---------------------------------------------------------------- TODAY
function renderToday() {
  const hour = new Date().getHours();
  const hello = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const name = db.activeProfile().name;
  const w = S.weather;
  const tops = S.items.filter(i => i.category === 'top' && !i.archived).length;
  const bottoms = S.items.filter(i => i.category === 'bottom').length;
  const canLook = (tops && bottoms) || S.items.some(i => i.category === 'onepiece');
  const looks = canLook ? generateLooks(S.items, ctx(), S.prefs, { count: 3, seed: S.seed }) : [];

  view.innerHTML = `
    <div class="eyebrow">${new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</div>
    <h1>${hello}${name && name !== 'Me' ? `, ${esc(name)}` : ''}</h1>
    <div class="row wrap" style="margin-bottom:14px">
      <button class="pill" id="wx">${w ? `${wxIcon(w.code)} ${Math.round(w.tempC)}° · ${esc(w.label)}${w.hi != null ? ` <span class="muted small">H${Math.round(w.hi)} L${Math.round(w.lo)}</span>` : ''}` : '☁︎ Add weather'}</button>
      ${canLook ? '<button class="pill" id="shuffle">↻ Shuffle</button>' : ''}
      ${S.items.length ? '<button class="pill" id="ask-fit">✦ Style me for…</button>' : ''}
    </div>
    <div class="chips" id="occ">${OCCASIONS.map(o => `<button class="chip" aria-pressed="${o.id === S.occasion}" data-occ="${o.id}">${o.label}</button>`).join('')}</div>
    <div id="looks" style="margin-top:16px">
      ${S.items.length === 0 ? emptyCloset("Snap your clothes — one at a time or a whole shelf at once — and I'll put outfits together for you every day.")
        : !canLook ? `<div class="card pad muted">Add at least one top and one bottom (or a dress/one-piece) to get daily looks. You have ${tops} top${tops === 1 ? '' : 's'} and ${bottoms} bottom${bottoms === 1 ? '' : 's'}.</div>`
        : looks.map((l, i) => lookHTML(l, i)).join('')}
    </div>
    ${S.wears.length ? `<h2>Recently worn</h2><div class="card pad">${S.wears.slice(0, 3).map(wearRow).join('')}</div>` : ''}
  `;
  bindEmpty();
  $('#wx').onclick = weatherSheet;
  const sh = $('#shuffle'); if (sh) sh.onclick = () => { S.seed++; renderToday(); };
  const af = $('#ask-fit'); if (af) af.onclick = () => { S.stylistMode = 'fit'; go('stylist'); setTimeout(() => $('#b-brief')?.focus(), 50); };
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
        try { const c = await locate(); await fetchWeather(c.latitude, c.longitude); close(); render(); toast('Weather updated'); }
        catch (err) { e.target.textContent = 'Use my location'; toast(err.message); }
      };
      $('#w-manual', sheet).onclick = async () => {
        const t = +$('#w-temp', sheet).value;
        S.weather = { tempC: t, hi: null, lo: null, code: null, rain: $('#w-rain', sheet).checked, label: 'Set manually', at: Date.now(), auto: false };
        await db.setPref('weather', S.weather); close(); render();
      };
      const c = $('#w-clear', sheet); if (c) c.onclick = async () => { S.weather = null; await db.setPref('weather', null); close(); render(); };
    },
  });
}

// ---------------------------------------------------------------- CLOSET
function renderCloset() {
  const q = S.closetQuery.trim().toLowerCase();
  const active = S.items.filter(i => !i.archived);
  const reviewN = active.filter(i => i.review).length;
  if (S.closetCat === 'review' && !reviewN && !S.scan.total) S.closetCat = 'all';
  const match = i =>
    (S.closetCat === 'all' || S.closetCat === 'places' || (S.closetCat === 'laundry' ? i.laundry : S.closetCat === 'fav' ? i.fav : S.closetCat === 'review' ? i.review : i.category === S.closetCat))
    && (!q || `${i.name} ${typeInfo(i).label} ${colorById(i.color).label} ${i.brand || ''} ${i.size || ''} ${i.notes || ''} ${i.ai?.description || ''} ${i.ai?.fingerprint || ''} ${itemPlace(i)}`.toLowerCase().includes(q));
  const list = active.filter(match);
  const counts = Object.fromEntries(CATEGORIES.map(c => [c.id, active.filter(i => i.category === c.id).length]));
  const sc = S.scan;

  let gridHTML;
  if (S.closetCat === 'places') {
    const groups = new Map();
    for (const i of list) { const l = itemPlace(i) || 'No place set'; if (!groups.has(l)) groups.set(l, []); groups.get(l).push(i); }
    gridHTML = [...groups.entries()].sort(([a], [b]) => (a === 'No place set') - (b === 'No place set') || a.localeCompare(b))
      .map(([l, arr]) => `<h3 class="group-h">${PIN} ${esc(l)} <span class="muted">${arr.length}</span></h3><div class="grid">${arr.map(i => tileHTML(i)).join('')}</div>`).join('');
  } else {
    gridHTML = `<div class="grid">${list.map(i => tileHTML(i)).join('') || '<p class="muted">Nothing matches.</p>'}</div>`;
  }

  view.innerHTML = `
    <div class="eyebrow">${active.length} piece${active.length === 1 ? '' : 's'}</div>
    <h1>Closet</h1>
    ${sc.total ? `<div class="card pad scan-card"><div class="row between"><b class="small">Scanning ${Math.min(sc.done + 1, sc.total)} of ${sc.total}…</b><span class="spinner"></span></div>
      <div class="bar" style="margin-top:8px"><i style="width:${(sc.done / sc.total) * 100}%"></i></div>
      <p class="small muted" style="margin:8px 0 0">${aiReady() ? 'Gemini is detecting, describing and cutting out each piece.' : 'Add a Gemini key in Me to auto-detect pieces.'} You can keep using the app.</p></div>` : ''}
    ${active.length ? `
    <label class="search"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
      <input class="input" id="q" type="search" placeholder="Search colour, brand, ‘ripped’, ‘wardrobe’…" value="${esc(S.closetQuery)}" autocomplete="off"></label>
    <div class="chips" style="margin-top:12px">
      ${[['all', 'All'], ...(reviewN ? [['review', `To review ${reviewN}`]] : []), ...CATEGORIES.filter(c => counts[c.id]).map(c => [c.id, `${c.label} ${counts[c.id]}`]), ['places', '📍 By place'], ['fav', '♥ Favourites'], ['laundry', 'Laundry']]
        .map(([id, l]) => `<button class="chip" data-cat="${id}" aria-pressed="${S.closetCat === id}">${l}</button>`).join('')}
    </div>
    <div id="grid" style="margin-top:14px">${gridHTML}</div>`
    : (sc.total ? '' : emptyCloset('Snap each piece, or photograph a whole pile at once. Gemini finds every item, names it, describes it and cleans up the photo.'))}
    <button class="fab" id="add" aria-label="Add clothes"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></button>
  `;
  bindEmpty();
  $('#add').onclick = addSheet;
  const qi = $('#q');
  if (qi) qi.oninput = e => { S.closetQuery = e.target.value; const pos = e.target.selectionStart; renderCloset(); const n = $('#q'); n.focus(); n.setSelectionRange(pos, pos); };
  $$('[data-cat]').forEach(b => (b.onclick = () => { S.closetCat = b.dataset.cat; renderCloset(); }));
  $$('#grid [data-item]').forEach(b => (b.onclick = () => openItem(byId(b.dataset.item))));
}

function addSheet() {
  openSheet(`
    <div class="sheet-head"><h2>Add clothes</h2><button class="btn sm ghost" data-close>Cancel</button></div>
    <label class="add-option card">
      <span class="add-ic">📷</span>
      <span class="grow"><b id="add-label">Scan photos</b><span class="small muted" style="display:block">Take a photo, or pick several from your library. ${aiReady() ? 'Gemini detects each piece — even several in one photo — names it, describes it and makes a clean product image.' : 'Connect Gemini in Me for automatic detection.'}</span></span>
      <input type="file" accept="image/*" multiple id="add-files">
    </label>
    ${placeFieldHTML('')}
    <p class="small muted" style="margin-top:6px">Tip: set the place first when you're scanning a whole shelf or box — every piece gets filed there.</p>
    <button class="btn block secondary" id="add-manual" style="margin-top:14px">Add without a photo</button>
    ${aiReady() ? '' : '<button class="btn block ghost" id="add-key" style="margin-top:6px">Connect Gemini</button>'}
  `, {
    onMount(sheet, close) {
      bindPlaceField(sheet);
      $('#add-files', sheet).onchange = async e => {
        const files = [...e.target.files];
        if (!files.length) return;
        const placeId = readPlaceField(sheet);
        if (files.length > 1) { close(); scanMany(files, placeId); return; }
        $('#add-label', sheet).innerHTML = '<span class="spinner" style="display:inline-block;vertical-align:-3px"></span> Scanning…';
        try {
          const drafts = await scanFile(files[0], placeId);
          if (drafts.length > 1) {
            for (const d of drafts) await saveItem(d);
            close(); S.closetCat = 'review'; go('closet');
            toast(`Found ${drafts.length} pieces in that photo — review them`);
            queueStudio(drafts);
          } else {
            nextSheet(close, () => editItem(drafts[0], { isNew: true }));
          }
        } catch (err) { toast(err.message, 3500); $('#add-label', sheet).textContent = 'Scan photos'; }
      };
      $('#add-manual', sheet).onclick = () => { const p = readPlaceField(sheet); nextSheet(close, () => editItem(null, { placeId: p })); };
      const k = $('#add-key', sheet); if (k) k.onclick = () => nextSheet(close, geminiSheet);
    },
  });
}

function openItem(item) {
  if (!item) return;
  const last = item.lastWorn ? new Date(item.lastWorn).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Never';
  const cpw = item.price && item.wearCount ? (item.price / item.wearCount).toFixed(0) : null;
  const modes = PHOTO_MODES.filter(([m]) => item[m]);
  const canStudio = aiReady() && S.studioModel && !item.studio && (item.cutout || item.original);
  const place = itemPlace(item);
  openSheet(`
    <div class="sheet-head"><h2 style="font-size:19px">${esc(item.name)}</h2><button class="btn sm ghost" data-close>Close</button></div>
    ${item.review ? `<div class="card pad review-banner"><b>Added by a scan.</b> Check the details, then confirm.<div class="row" style="margin-top:10px"><button class="btn sm" id="i-ok">Looks right</button><button class="btn sm secondary" id="i-fix">Edit</button></div></div>` : ''}
    <div class="card detail-ph">${phHTML(item, 'photo')}</div>
    ${modes.length > 1 || canStudio ? `<div class="seg" style="margin-top:10px">
      ${modes.map(([m, l]) => `<button data-mode="${m}" aria-pressed="${(item.photoMode || 'original') === m}">${l}</button>`).join('')}
      ${canStudio ? '<button id="i-studio">✦ Studio</button>' : ''}
    </div>` : ''}
    <button class="place-line" id="i-place">${PIN}<span class="grow">${place ? esc(place) : 'Set where it’s kept'}</span><span class="chev">›</span></button>
    <div class="row wrap small muted" style="gap:14px">
      <span class="row" style="gap:6px"><i class="dot" style="background:${colorById(item.color).hex}"></i>${colorById(item.color).label}${item.color2 ? ' / ' + colorById(item.color2).label : ''}</span>
      <span>${esc(typeInfo(item).label)}</span>${item.brand ? `<span>${esc(item.brand)}</span>` : ''}${item.size ? `<span>Size ${esc(item.size)}</span>` : ''}<span>Formality ${itemF(item)}/5</span><span>Warmth ${itemW(item)}/5</span>
    </div>
    ${item.ai?.description ? `<p style="margin:12px 0 4px">${esc(item.ai.description)}</p>` : ''}
    ${item.ai?.fingerprint ? `<p class="small muted" style="margin:0">Tell-apart: ${esc(item.ai.fingerprint)}</p>` : ''}
    ${item.notes ? `<p class="muted small">${esc(item.notes)}</p>` : ''}
    <div class="stat-row" style="margin-top:14px">
      <div class="card stat"><b>${item.wearCount || 0}</b><span>wears</span></div>
      <div class="card stat"><b style="font-size:18px;line-height:26px">${last}</b><span>last worn</span></div>
      <div class="card stat"><b style="font-size:${cpw ? 26 : 18}px;line-height:26px">${cpw ?? '—'}</b><span>cost / wear</span></div>
    </div>
    <div class="stack" style="margin-top:16px">
      <button class="btn block accent" id="i-style">✦ Build a fit with this</button>
      <button class="btn block secondary" id="i-match">Quick matches</button>
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
      const ok = $('#i-ok', sheet); if (ok) ok.onclick = async () => { item.review = false; await saveItem(item); close(); render(); toast('Confirmed'); };
      const fix = $('#i-fix', sheet); if (fix) fix.onclick = () => nextSheet(close, () => editItem(item));
      $$('[data-mode]', sheet).forEach(b => (b.onclick = async () => {
        await setPhotoMode(item, b.dataset.mode); await saveItem(item);
        render(); nextSheet(close, () => openItem(item));
      }));
      const st = $('#i-studio', sheet);
      if (st) st.onclick = async () => {
        st.innerHTML = '<span class="spinner"></span>'; st.disabled = true;
        S.studioBlocked = false;
        if (await makeStudio(item, { quiet: false })) { nextSheet(close, () => openItem(byId(item.id))); toast('Studio photo ready'); }
        else { st.textContent = '✦ Studio'; st.disabled = false; }
      };
      $('#i-place', sheet).onclick = () => nextSheet(close, () => editItem(item, { focus: 'place' }));
      $('#i-style', sheet).onclick = () => { close(); S.builder = { ...S.builder, locked: [item.id], need: [], looks: null, error: '' }; S.stylistMode = 'fit'; go('stylist'); };
      $('#i-match', sheet).onclick = () => { close(); S.matchAnchor = item.id; go('match'); };
      $('#i-worn', sheet).onclick = async () => { await wearPieces([item]); close(); toast('Logged'); render(); };
      $('#i-laundry', sheet).onclick = async () => { item.laundry = !item.laundry; await saveItem(item); close(); render(); };
      $('#i-fav', sheet).onclick = async () => { item.fav = !item.fav; await saveItem(item); close(); render(); };
      $('#i-edit', sheet).onclick = () => nextSheet(close, () => editItem(item));
      $('#i-del', sheet).onclick = async () => { if (confirm(`Delete “${item.name}”? This can't be undone.`)) { await deleteItem(item.id); close(); render(); toast('Deleted'); } };
    },
  });
}

function editItem(existing, { isNew = false, placeId, focus } = {}) {
  const saved = existing && !isNew;
  const it = existing ? { ...existing, ai: { ...(existing.ai || {}) } } : newItem({ category: 'top', type: 'tshirt', color: 'black', placeId, ai: {} });
  const photoURL = imgURL(it, 'photo');

  const typeOptions = cat => Object.entries(TYPES[cat]).map(([k, v]) => `<option value="${k}" ${k === it.type ? 'selected' : ''}>${v.label}</option>`).join('');
  const html = `
    <div class="sheet-head"><button class="btn sm ghost" data-close>Cancel</button><h2 style="font-size:19px">${saved ? 'Edit piece' : 'New piece'}</h2><button class="btn sm" id="f-save">Save</button></div>
    ${isNew && it.ai?.description ? '<div class="card pad review-banner small">✦ Gemini filled this in from your photo. Check it, then add the brand, size and where it’s kept.</div>' : ''}
    <div class="photo-drop" id="f-drop">
      ${photoURL ? `<img src="${photoURL}" alt="">` : ''}
      <div class="hint" ${photoURL ? 'hidden' : ''}><b>Add a photo</b>${aiReady() ? 'Gemini will detect and describe it' : 'Lay it flat on a plain background for the best colour match'}</div>
      <input type="file" accept="image/*" id="f-file" aria-label="Choose photo">
    </div>
    <label class="field"><span>Name</span><input class="input" id="f-name" value="${esc(it.name || '')}" placeholder="e.g. Navy zip hoodie"></label>
    <div class="field"><span>Category</span><div class="chips wrap" id="f-cat">${CATEGORIES.map(c => `<button class="chip" data-v="${c.id}" aria-pressed="${c.id === it.category}">${c.one}</button>`).join('')}</div></div>
    <label class="field"><span>Type</span><select class="input" id="f-type">${typeOptions(it.category)}</select></label>
    <div class="row" style="gap:10px;align-items:flex-end">
      <label class="field grow"><span>Brand</span><input class="input" id="f-brand" value="${esc(it.brand || '')}" placeholder="Levi's, Zara…"></label>
      <label class="field" style="width:84px"><span>Size</span><input class="input" id="f-size" value="${esc(it.size || '')}" placeholder="M / 32"></label>
      <label class="field" style="width:84px"><span>Price</span><input class="input" id="f-price" inputmode="decimal" value="${it.price ?? ''}"></label>
    </div>
    <div id="f-place-wrap">${placeFieldHTML(it.placeId)}</div>
    <div class="field"><span>Main colour <b id="f-cname" style="color:var(--ink)">${colorById(it.color).label}</b></span>
      <div class="swatches" id="f-color">${COLORS.map(c => `<button class="sw" data-v="${c.id}" title="${c.label}" aria-label="${c.label}" aria-pressed="${c.id === it.color}" style="background:${c.hex}"></button>`).join('')}</div></div>
    <label class="field"><span>Second colour (optional)</span><select class="input" id="f-color2"><option value="">None</option>${COLORS.map(c => `<option value="${c.id}" ${c.id === it.color2 ? 'selected' : ''}>${c.label}</option>`).join('')}</select></label>
    <div class="field"><span>Pattern</span><div class="chips wrap" id="f-pat">${PATTERNS.map(p => `<button class="chip" data-v="${p.id}" aria-pressed="${p.id === (it.pattern || 'solid')}">${p.label}</button>`).join('')}</div></div>
    <label class="field"><span>Description <span class="muted">· what the AI stylist reads</span></span><textarea class="input" id="f-desc" placeholder="Fit, fabric, wash, details…">${esc(it.ai?.description || '')}</textarea></label>
    <label class="field"><span>Tell-apart details</span><input class="input" id="f-fp" value="${esc(it.ai?.fingerprint || '')}" placeholder="e.g. light fade on thighs, rip on left knee, copper buttons"></label>
    <label class="field"><span>Formality: <b id="f-fv">${itemF(it)}</b>/5</span><input type="range" min="1" max="5" step="1" id="f-form" value="${itemF(it)}"><div class="range-labels"><span>Lounge</span><span>Smart</span><span>Formal</span></div></label>
    <label class="field"><span>Warmth: <b id="f-wv">${itemW(it)}</b>/5</span><input type="range" min="1" max="5" step="1" id="f-warm" value="${itemW(it)}"><div class="range-labels"><span>Hot days</span><span>Mild</span><span>Winter</span></div></label>
    <div class="field"><span>Seasons (leave empty for all year)</span><div class="chips wrap" id="f-sea">${SEASONS.map(s => `<button class="chip" data-v="${s}" aria-pressed="${(it.seasons || []).includes(s)}">${s[0].toUpperCase() + s.slice(1)}</button>`).join('')}</div></div>
    <label class="field"><span>Notes</span><textarea class="input" id="f-notes" placeholder="Fit, where it's from, how you like to wear it…">${esc(it.notes || '')}</textarea></label>
  `;

  openSheet(html, {
    onMount(sheet, close) {
      bindPlaceField(sheet);
      if (focus === 'place') setTimeout(() => { $('#f-place-wrap', sheet).scrollIntoView({ block: 'center' }); $('#pl-sel', sheet).focus(); }, 320);
      let formTouched = !!it.formality, warmTouched = !!it.warmth;
      const setPressed = (wrap, v) => $$('[data-v]', wrap).forEach(b => b.setAttribute('aria-pressed', b.dataset.v === v));
      const syncDefaults = () => {
        const t = TYPES[it.category][it.type];
        if (!t) return;
        if (!formTouched) { $('#f-form', sheet).value = t.f; $('#f-fv', sheet).textContent = t.f; }
        if (!warmTouched) { $('#f-warm', sheet).value = t.w; $('#f-wv', sheet).textContent = t.w; }
      };
      const setColor = id => { it.color = id; setPressed($('#f-color', sheet), id); $('#f-cname', sheet).textContent = colorById(id).label; };
      const showPhoto = blob => {
        const drop = $('#f-drop', sheet);
        $('img', drop)?.remove();
        const img = new Image(); img.src = URL.createObjectURL(blob); drop.prepend(img);
        $('.hint', drop).hidden = true;
      };

      $('#f-file', sheet).onchange = async e => {
        const f = e.target.files[0]; if (!f) return;
        const hint = $('.hint', sheet); hint.hidden = false; hint.innerHTML = '<b><span class="spinner" style="display:inline-block"></span></b>Scanning…';
        try {
          const [d] = await scanFile(f, it.placeId);
          Object.assign(it, { original: d.original, cutout: d.cutout, photo: d.photo, thumb: d.thumb, photoMode: d.photoMode, studio: undefined });
          showPhoto(d.photo);
          if (d.ai?.description) {
            if (!$('#f-name', sheet).value) $('#f-name', sheet).value = d.name;
            it.category = d.category; setPressed($('#f-cat', sheet), d.category);
            it.type = d.type; $('#f-type', sheet).innerHTML = typeOptions(d.category); $('#f-type', sheet).value = d.type;
            if (d.color2) $('#f-color2', sheet).value = d.color2;
            it.pattern = d.pattern; setPressed($('#f-pat', sheet), d.pattern);
            formTouched = warmTouched = true;
            $('#f-form', sheet).value = d.formality; $('#f-fv', sheet).textContent = d.formality;
            $('#f-warm', sheet).value = d.warmth; $('#f-wv', sheet).textContent = d.warmth;
            it.seasons = d.seasons || []; $$('#f-sea [data-v]', sheet).forEach(b => b.setAttribute('aria-pressed', it.seasons.includes(b.dataset.v)));
            $('#f-desc', sheet).value = d.ai.description || ''; $('#f-fp', sheet).value = d.ai.fingerprint || '';
            it.ai.material = d.ai.material; it.ai.styleTags = d.ai.styleTags;
            if (d.brand && !$('#f-brand', sheet).value) $('#f-brand', sheet).value = d.brand;
            toast('Filled in by Gemini — check and save');
          }
          setColor(d.color);
        } catch (err) { toast(err.message, 3500); hint.innerHTML = '<b>Add a photo</b>Try again'; }
      };
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
        it.size = $('#f-size', sheet).value.trim() || undefined;
        const price = parseFloat($('#f-price', sheet).value);
        it.price = Number.isFinite(price) ? price : undefined;
        it.placeId = readPlaceField(sheet);
        it.ai.description = $('#f-desc', sheet).value.trim() || undefined;
        it.ai.fingerprint = $('#f-fp', sheet).value.trim() || undefined;
        it.notes = $('#f-notes', sheet).value.trim() || undefined;
        it.review = false;
        if (!it.original && it.photo) it.original = it.photo;
        await saveItem(it);
        close(); render();
        toast(saved ? 'Saved' : `Added ${it.name}`);
        if (!it.studio && it.cutout) queueStudio([it]);
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
        <div class="muted small row" style="gap:6px"><i class="dot" style="background:${colorById(anchor.color).hex}"></i>${colorById(anchor.color).label} ${esc(typeInfo(anchor).label.toLowerCase())}</div>
        <button class="btn sm accent" id="m-ai" style="margin-top:8px">✦ Build a fit with this</button></div>
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
  $('#m-ai').onclick = () => { S.builder = { ...S.builder, locked: [anchor.id], need: [], looks: null, error: '' }; S.stylistMode = 'fit'; go('stylist'); };
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
      <button class="btn sm secondary" id="p-find">${PIN} Find</button>
      <button class="btn sm secondary" id="p-up" style="flex:0 0 44px">👍</button>
      <button class="btn sm secondary" id="p-down" style="flex:0 0 44px">👎</button>
    </div>
  `, {
    onMount(sheet, close) {
      $('#p-wear', sheet).onclick = async () => { await wearPieces([a, b]); close(); toast('Logged'); renderMatch(); };
      $('#p-find', sheet).onclick = () => nextSheet(close, () => whereSheet([a, b]));
      $('#p-up', sheet).onclick = async () => { await feedback([a, b], 1); close(); toast("Noted — I'll rank that higher"); renderMatch(); };
      $('#p-down', sheet).onclick = async () => { await feedback([a, b], -1); close(); toast("Noted — I'll rank that lower"); renderMatch(); };
    },
  });
}

function renderMatchPicker() {
  const list = S.items.filter(i => i.category === S.matchCat && !i.archived);
  const cats = CATEGORIES.filter(c => S.items.some(i => i.category === c.id));
  view.innerHTML = `
    <div class="eyebrow">Pair it</div>
    <h1>What are you wearing?</h1>
    ${S.items.length ? `
      <p class="muted" style="margin-top:-6px">Pick the piece you want to build around — I'll rank everything that goes with it, instantly and offline.</p>
      <div class="chips">${(cats.length ? cats : CATEGORIES.slice(0, 4)).map(c => `<button class="chip" data-cat="${c.id}" aria-pressed="${c.id === S.matchCat}">${c.label}</button>`).join('')}</div>
      <div class="grid" style="margin-top:14px">${list.map(i => tileHTML(i)).join('') || `<p class="muted">No ${CATEGORIES.find(c => c.id === S.matchCat).label.toLowerCase()} yet.</p>`}</div>`
      : emptyCloset('Add some clothes first, then pick one here to see what goes with it.')}
  `;
  bindEmpty();
  $$('[data-cat]').forEach(b => (b.onclick = () => { S.matchCat = b.dataset.cat; renderMatchPicker(); }));
  $$('[data-item]').forEach(b => (b.onclick = () => { S.matchAnchor = b.dataset.item; renderMatch(); window.scrollTo(0, 0); }));
}

// ---------------------------------------------------------------- STYLIST
const NEED = [['top', 'Top'], ['bottom', 'Bottom'], ['shoes', 'Shoes'], ['outer', 'Layer'], ['socks', 'Socks'], ['accessory', 'Accessories']];
const BRIEFS = ['Coffee date', 'Office day', 'Wedding guest', 'Night out', 'Airport / travel', 'Gym', 'Lazy Sunday', 'Rainy day', 'Festive dinner', 'Interview'];

function renderStylist() {
  const modes = [['fit', 'Build a fit'], ['own', 'Own it?'], ['chat', 'Chat']];
  view.innerHTML = `
    <div class="eyebrow">AI stylist · Gemini</div><h1>${S.stylistMode === 'own' ? 'Do I own this?' : S.stylistMode === 'chat' ? 'Ask anything' : 'Build a fit'}</h1>
    <div class="seg" style="margin-bottom:16px">${modes.map(([m, l]) => `<button data-smode="${m}" aria-pressed="${S.stylistMode === m}">${l}</button>`).join('')}</div>
    <div id="smode"></div>`;
  $$('[data-smode]').forEach(b => (b.onclick = () => { S.stylistMode = b.dataset.smode; renderStylist(); }));
  ({ fit: renderFit, own: renderOwn, chat: renderChat })[S.stylistMode]($('#smode'));
}

function keyCard(why) {
  return `<div class="card pad key-card"><b>Connect Gemini</b><p class="small muted" style="margin:6px 0 10px">${why} It's free to start, and the key stays on this phone.</p><button class="btn sm" data-gemini>Connect Gemini</button></div>`;
}
function bindKeyCard(el) { $$('[data-gemini]', el).forEach(b => (b.onclick = geminiSheet)); }

// --- Build a fit ---
function autoNeed(locked) {
  const has = c => locked.some(i => i.category === c || (i.category === 'onepiece' && (c === 'top' || c === 'bottom')));
  const need = ['top', 'bottom', 'shoes'].filter(c => !has(c));
  if (S.weather && S.weather.tempC < 18 && !has('outer')) need.push('outer');
  return need.length ? need : ['accessory'];
}

function renderFit(el) {
  const B = S.builder;
  const locked = B.locked.map(byId).filter(Boolean);
  const need = B.need.length ? B.need : autoNeed(locked);
  el.innerHTML = `
    <div class="card pad">
      <div class="eyebrow" style="margin-bottom:8px">Start from</div>
      <div class="locked-row">
        ${locked.map(p => `<div class="locked"><button data-item="${p.id}" class="ph">${phHTML(p)}</button><button class="x" data-unlock="${p.id}" aria-label="Remove ${esc(p.name)}">×</button></div>`).join('')}
        <button class="locked add" id="b-pick"><span>+</span><small>${locked.length ? 'Add' : 'Pick'}</small></button>
      </div>
      ${locked.length ? '' : '<p class="small muted" style="margin:8px 0 0">Optional: a shirt, shoes, both, anything. Or leave it empty and just describe the vibe.</p>'}

      <div class="eyebrow" style="margin:16px 0 8px">I need ${B.need.length ? '' : '<span class="muted" style="text-transform:none;letter-spacing:0">· auto</span>'}</div>
      <div class="chips wrap">${NEED.map(([id, l]) => `<button class="chip" data-need="${id}" aria-pressed="${need.includes(id)}">${l}</button>`).join('')}</div>

      <div class="eyebrow" style="margin:16px 0 8px">Where are you going? What's the mood?</div>
      <input class="input" id="b-brief" value="${esc(B.brief)}" placeholder="e.g. rooftop dinner, sharp but relaxed" autocomplete="off">
      <div class="chips" style="margin-top:8px">${BRIEFS.map(b => `<button class="chip" data-brief="${esc(b)}">${esc(b)}</button>`).join('')}</div>

      <button class="btn block accent" id="b-go" style="margin-top:16px" ${B.busy ? 'disabled' : ''}>${B.busy ? '<span class="spinner"></span> Styling…' : '✦ Style me'}</button>
      ${aiReady() ? '' : '<p class="small muted" style="margin:8px 0 0;text-align:center">Using the offline engine. Connect Gemini for smarter fits that understand the mood.</p>'}
    </div>
    ${!aiReady() ? `<div style="margin-top:12px">${keyCard('Gemini reads your brief and the detailed description of every piece to style you properly.')}</div>` : ''}
    ${B.error ? `<div class="card pad" style="margin-top:14px;color:var(--warn)">${esc(B.error)}</div>` : ''}
    <div id="b-looks" style="margin-top:16px">
      ${B.looks ? (B.looks.length ? B.looks.map((l, i) => lookHTML(l, i)).join('') : '<div class="card pad muted">No complete look found. Add more pieces to your closet, or loosen the brief.</div>') : ''}
      ${B.missing ? `<div class="card pad small" style="margin-top:12px">🛍 <b>Worth adding:</b> ${esc(B.missing)}</div>` : ''}
    </div>
  `;
  bindKeyCard(el);
  $$('.locked [data-item]', el).forEach(b => (b.onclick = () => openItem(byId(b.dataset.item))));
  $$('[data-unlock]', el).forEach(b => (b.onclick = () => { B.locked = B.locked.filter(x => x !== b.dataset.unlock); B.looks = null; renderStylist(); }));
  $('#b-pick', el).onclick = pickPieces;
  $$('[data-need]', el).forEach(b => (b.onclick = () => {
    const cur = new Set(need); cur.has(b.dataset.need) ? cur.delete(b.dataset.need) : cur.add(b.dataset.need);
    B.need = [...cur]; renderStylist();
  }));
  $('#b-brief', el).oninput = e => { B.brief = e.target.value; };
  $('#b-brief', el).onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); runFit(need); } };
  $$('[data-brief]', el).forEach(b => (b.onclick = () => { B.brief = b.dataset.brief; $('#b-brief', el).value = B.brief; }));
  $('#b-go', el).onclick = () => runFit(need);
  if (B.looks) bindLooks($('#b-looks', el), B.looks, renderStylist);
}

async function runFit(need) {
  const B = S.builder;
  const locked = B.locked.map(byId).filter(Boolean);
  B.busy = true; B.error = ''; B.missing = ''; renderStylist();
  try {
    if (aiReady()) {
      const { styleFit } = await ai();
      const res = await styleFit({
        apiKey: S.apiKey, model: S.aiModel, locked, need: need.map(n => NEED.find(x => x[0] === n)?.[1] || n),
        brief: B.brief, items: S.items, context: ctxText(), placeLabel: itemPlace,
      });
      B.looks = (res.looks || []).map(l => {
        const ids = uniq([...locked.map(p => p.id), ...(l.pieceIds || []).map(s => findShort(String(s).replace(/[^a-z0-9-]/gi, ''))?.id)]);
        return { title: l.title, why: l.why, tips: l.tips, pieces: ids.map(byId).filter(Boolean).sort(byOrder) };
      }).filter(l => l.pieces.length > Math.max(1, locked.length) - 1 && l.pieces.length >= 2);
      B.missing = res.missing || '';
    } else {
      const occ = guessOccasion(B.brief);
      B.looks = buildAround(locked, need.filter(n => ['top', 'bottom', 'shoes', 'outer'].includes(n)), S.items, { ...ctx(), occasion: occ || S.occasion }, S.prefs);
    }
  } catch (e) { B.error = e.message; }
  B.busy = false;
  if (S.tab === 'stylist') renderStylist();
}

function guessOccasion(brief) {
  const b = (brief || '').toLowerCase();
  const map = [['gym', /gym|workout|run|sport/], ['work', /office|work|meeting|interview/], ['formal', /wedding|formal|gala|black tie/], ['festive', /diwali|festive|puja|eid|mehendi|sangeet/],
    ['date', /date|dinner/], ['party', /party|club|night out|bar/], ['lounge', /lazy|home|sunday|chill/], ['casual', /casual|coffee|brunch|travel|airport/]];
  return map.find(([, re]) => re.test(b))?.[0];
}

function pickPieces() {
  const sel = new Set(S.builder.locked);
  let cat = 'all';
  const draw = sheet => {
    const list = S.items.filter(i => !i.archived && (cat === 'all' || i.category === cat));
    $('#pp-grid', sheet).innerHTML = list.map(i => tileHTML(i, `aria-selected="${sel.has(i.id)}"`)).join('') || '<p class="muted">Nothing here yet.</p>';
    $$('#pp-grid [data-item]', sheet).forEach(b => (b.onclick = () => { sel.has(b.dataset.item) ? sel.delete(b.dataset.item) : sel.add(b.dataset.item); b.setAttribute('aria-selected', sel.has(b.dataset.item)); $('#pp-done', sheet).textContent = `Done (${sel.size})`; }));
    $$('[data-pcat]', sheet).forEach(b => b.setAttribute('aria-pressed', b.dataset.pcat === cat));
  };
  openSheet(`
    <div class="sheet-head"><button class="btn sm ghost" data-close>Cancel</button><h2 style="font-size:19px">Pick pieces</h2><button class="btn sm" id="pp-done">Done (${sel.size})</button></div>
    <div class="chips">${[['all', 'All'], ...CATEGORIES.filter(c => S.items.some(i => i.category === c.id)).map(c => [c.id, c.label])].map(([id, l]) => `<button class="chip" data-pcat="${id}">${l}</button>`).join('')}</div>
    <div class="grid" id="pp-grid" style="margin-top:12px"></div>
  `, {
    onMount(sheet, close) {
      draw(sheet);
      $$('[data-pcat]', sheet).forEach(b => (b.onclick = () => { cat = b.dataset.pcat; draw(sheet); }));
      $('#pp-done', sheet).onclick = () => { S.builder.locked = [...sel]; S.builder.need = []; S.builder.looks = null; close(); renderStylist(); };
    },
  });
}

// --- Do I own this? ---
function renderOwn(el) {
  const sh = S.shop;
  if (!aiReady()) {
    el.innerHTML = `<p class="muted" style="margin-top:0">Shopping and not sure you don't already have something like it? Snap it, and Gemini compares it against every piece you own.</p>${keyCard('This check needs Gemini to look at the photo.')}`;
    bindKeyCard(el);
    return;
  }
  const r = sh.result;
  const VERDICT = { identical: ['You already own this', 'warn'], very_similar: ['You have something very similar', 'warn'], similar: ['You have similar pieces', 'mid'], new: ['Nothing like it in your closet', 'good'] };
  el.innerHTML = `
    <p class="muted" style="margin-top:0">In a shop? Snap the item, or use a screenshot from a website. Gemini compares it with everything you own, down to the small details.</p>
    <label class="photo-drop own-drop">
      ${sh.url ? `<img src="${sh.url}" alt="">` : '<div class="hint"><b>📷 Snap the item</b>or choose a screenshot</div>'}
      <input type="file" accept="image/*" id="own-file">
    </label>
    ${sh.status === 'working' ? `<div class="card pad row" style="margin-top:12px"><span class="spinner"></span><span>${esc(sh.step || 'Looking…')}</span></div>` : ''}
    ${sh.status === 'error' ? `<div class="card pad" style="margin-top:12px;color:var(--warn)">${esc(sh.error)}</div>` : ''}
    ${sh.status === 'done' && r ? `
      <div class="card pad verdict ${VERDICT[r.verdict]?.[1] || ''}" style="margin-top:14px">
        <div class="eyebrow">${esc(sh.probe?.name || '')}</div>
        <h2 style="margin:6px 0">${VERDICT[r.verdict]?.[0] || ''}</h2>
        <p style="margin:0">${esc(r.summary)}</p>
        ${r.advice ? `<p class="small muted" style="margin:8px 0 0">${esc(r.advice)}</p>` : ''}
      </div>
      ${r.matches.length ? `<h2>Closest in your closet</h2><div class="card pad">${r.matches.map(m => { const it = findShort(String(m.id)); return it ? `
        <button class="list-row" style="width:100%;text-align:left" data-item="${it.id}"><span class="thumb">${phHTML(it)}</span>
        <span class="grow"><b class="small">${esc(it.name)}</b><span class="small muted" style="display:block">${esc(m.difference)}</span>${itemPlace(it) ? `<span class="small muted row" style="gap:4px">${PIN}${esc(itemPlace(it))}</span>` : ''}</span>
        <span class="score">${m.similarity}%</span></button>` : ''; }).join('')}</div>` : ''}
      ${r.worksWith.length ? `<h2>It would go with</h2><div class="rail">${r.worksWith.map(id => findShort(String(id))).filter(Boolean).map(i => `<div>${tileHTML(i)}</div>`).join('')}</div>` : ''}
      <button class="btn block secondary" id="own-add" style="margin-top:16px">Bought it? Add to my closet</button>
    ` : ''}
  `;
  $('#own-file', el).onchange = e => { const f = e.target.files[0]; if (f) runShopCheck(f); };
  $$('[data-item]', el).forEach(b => (b.onclick = () => openItem(byId(b.dataset.item))));
  const add = $('#own-add', el);
  if (add) add.onclick = () => editItem(sh.draft, { isNew: true });
}

async function runShopCheck(file) {
  const sh = S.shop = { status: 'working', step: 'Scanning the item…', url: URL.createObjectURL(file) };
  renderStylist();
  try {
    const drafts = await scanFile(file);
    const draft = drafts[0];
    if (!draft?.ai?.description) throw new Error('Could not recognise a garment in that photo.');
    sh.probe = draft; sh.draft = draft; sh.step = 'Comparing with your closet…'; renderStylist();
    const sameCat = S.items.filter(i => i.category === draft.category && !i.archived)
      .sort((a, b) => (b.type === draft.type) - (a.type === draft.type) || (b.color === draft.color) - (a.color === draft.color));
    let result;
    if (!sameCat.length) {
      result = { verdict: 'new', summary: `You don't own any ${CATEGORIES.find(c => c.id === draft.category).label.toLowerCase()} yet.`, matches: [], worksWith: [] };
    } else {
      const { shopCheck } = await ai();
      result = await shopCheck({ apiKey: S.apiKey, model: S.aiModel, blob: draft.cutout || draft.original, probe: { name: draft.name, ...draft.ai }, candidates: sameCat, items: S.items, placeLabel: itemPlace });
    }
    result.matches = (result.matches || []).sort((a, b) => b.similarity - a.similarity);
    result.worksWith = result.worksWith || [];
    if (!result.matches.length && result.verdict !== 'new') {
      result.matches = similarOwned(draft, S.items).slice(0, 3).map(m => ({ id: m.item.id, similarity: m.similarity, difference: 'Same type and colour family' }));
    }
    sh.result = result; sh.status = 'done';
  } catch (e) { sh.status = 'error'; sh.error = e.message; }
  if (S.tab === 'stylist') renderStylist();
}

// --- Chat ---
const PROMPTS = [
  'Dinner date tonight — what should I wear?',
  'Style my most neglected piece',
  'Pack 3 days of outfits for a weekend trip',
  'What one item would add the most outfits?',
  'Which of my jeans is the most versatile?',
];

function renderChat(el) {
  if (!aiReady()) { el.innerHTML = keyCard('Chat with a stylist who knows every piece you own.'); bindKeyCard(el); return; }
  el.innerHTML = `
    ${S.chat.length ? '<div class="row" style="justify-content:flex-end;margin-top:-8px"><button class="btn sm ghost" id="c-clear">New chat</button></div>' : ''}
    <div class="chat" id="chat">
      ${S.chat.length ? S.chat.map(msgHTML).join('') : `<div class="msg bot">Hi! I can see all ${S.items.length} pieces in your closet, with their details and where they're kept${S.weather ? `, and that it's ${Math.round(S.weather.tempC)}° out` : ''}. What are we dressing for?</div>`}
      ${S.busy ? '<div class="msg bot typing"><span></span><span></span><span></span></div>' : ''}
    </div>
    ${!S.chat.length ? `<div class="chips wrap" style="margin-top:14px">${PROMPTS.map(p => `<button class="chip" data-p="${esc(p)}" style="height:auto;padding:8px 14px;white-space:normal;text-align:left">${esc(p)}</button>`).join('')}</div>` : ''}
    <form class="composer" id="c-form"><input id="c-in" placeholder="Message your stylist…" autocomplete="off" enterkeyhint="send"><button class="btn sm" ${S.busy ? 'disabled' : ''}>Send</button></form>
  `;
  $$('[data-p]', el).forEach(b => (b.onclick = () => send(b.dataset.p)));
  $('#c-form', el).onsubmit = e => { e.preventDefault(); const v = $('#c-in', el).value.trim(); if (v) send(v); };
  const cc = $('#c-clear', el); if (cc) cc.onclick = async () => { S.chat = []; await db.setPref('chat', []); renderStylist(); };
  $$('#chat [data-item]', el).forEach(b => (b.onclick = () => openItem(byId(b.dataset.item))));
  $$('#chat [data-find]', el).forEach(b => (b.onclick = () => whereSheet(b.dataset.find.split(',').map(byId).filter(Boolean))));
  const last = $('#chat', el).lastElementChild; if (last && S.chat.length) last.scrollIntoView({ block: 'end' });
}

function msgHTML(m) {
  if (m.role === 'user') return `<div class="msg user">${esc(m.content)}</div>`;
  const refs = [];
  const body = esc(m.content).replace(/\[\[([a-z0-9-]{4,36})\]\]/gi, (_, id) => {
    const it = findShort(id);
    if (!it) return '';
    if (!refs.includes(it)) refs.push(it);
    return `<button class="ref" data-item="${it.id}"><span class="mini">${phHTML(it)}</span>${esc(it.name)}</button>`;
  });
  return `<div class="msg bot ${m.error ? 'muted' : ''}">${body}${refs.length > 1 ? `<div class="msg-pieces">${refs.map(r => `<button class="ph" data-item="${r.id}">${phHTML(r)}</button>`).join('')}<button class="btn sm secondary" data-find="${refs.map(r => r.id).join(',')}" style="flex:none;align-self:center">${PIN} Find</button></div>` : ''}</div>`;
}

async function send(text) {
  if (S.busy) return;
  S.chat.push({ role: 'user', content: text });
  S.busy = true; renderStylist();
  try {
    const { askStylist } = await ai();
    const history = S.chat.filter(m => !m.error).slice(-16).map(({ role, content }) => ({ role, content }));
    const { text: reply } = await askStylist({ apiKey: S.apiKey, model: S.aiModel, history, items: S.items, context: ctxText(), placeLabel: itemPlace });
    S.chat.push({ role: 'assistant', content: reply });
  } catch (e) {
    S.chat.push({ role: 'assistant', content: e.message, error: true });
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
  const unplaced = items.filter(i => !i.placeId).length;

  view.innerHTML = `
    <div class="eyebrow">Profile</div>
    <h1>${esc(prof.name)}</h1>
    <div class="stat-row">
      <div class="card stat"><b>${items.length}</b><span>pieces</span></div>
      <div class="card stat"><b>${S.wears.length}</b><span>outfits logged</span></div>
      <div class="card stat"><b>${utilisation}%</b><span>of closet worn</span></div>
    </div>

    <h2>Settings</h2>
    <div class="card">
      <button class="menu-row" id="s-key"><span>✦ Gemini AI</span><span class="chev">${aiReady() ? `On · ${esc(S.aiModel)} ›` : 'Not connected ›'}</span></button>
      <button class="menu-row" id="s-places"><span>📍 Places at home</span><span class="chev">${S.places.length} place${S.places.length === 1 ? '' : 's'}${unplaced && items.length ? ` · ${unplaced} unfiled` : ''} ›</span></button>
      <button class="menu-row" id="s-export"><span>Back up closet</span><span class="chev">Export ›</span></button>
      <label class="menu-row" style="position:relative"><span>Restore from backup</span><span class="chev">Import ›</span><input type="file" accept="application/json,.json" id="s-import" style="position:absolute;inset:0;opacity:0"></label>
      <button class="menu-row" id="s-install"><span>Add Drape to Home Screen</span><span class="chev">How ›</span></button>
      <button class="menu-row" id="s-how"><span>How Drape works</span><span class="chev">›</span></button>
      ${S.items.some(i => i.sample) ? '<button class="menu-row" id="s-sample"><span>Remove sample wardrobe</span><span class="chev">›</span></button>' : ''}
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

    ${S.outfits.length ? `<h2>Saved outfits</h2><div id="saved">${S.outfits.map(o => {
      const pieces = o.pieces.map(byId).filter(Boolean);
      return `<div class="card pad" style="margin-bottom:10px"><div class="row between"><h3>${esc(o.name)}</h3><button class="btn sm ghost" data-del-outfit="${o.id}">Remove</button></div>
        <div class="row" style="gap:6px;margin-top:10px;overflow-x:auto">${pieces.map(p => `<button class="mini-ph" data-item="${p.id}">${phHTML(p)}</button>`).join('')}</div>
        <div class="row" style="margin-top:10px"><button class="btn sm secondary" data-wear-outfit="${o.id}">Wear today</button><button class="btn sm secondary" data-find-outfit="${o.id}">${PIN} Find</button></div></div>`;
    }).join('')}</div>` : ''}

    ${S.wears.length ? `<h2>History</h2><div class="card pad">${S.wears.slice(0, 14).map(wearRow).join('')}</div>` : ''}

    <h2>Profiles</h2>
    <p class="muted small" style="margin-top:-6px">Each profile is a completely separate closet and database on this device.</p>
    <div class="card">${db.listProfiles().map(p => `<button class="menu-row" data-prof="${p.id}"><span>${esc(p.name)}</span><span class="chev">${p.id === prof.id ? '✓ Active' : 'Switch ›'}</span></button>`).join('')}
      <button class="menu-row" id="p-add"><span>+ Add profile</span></button>
      <button class="menu-row" id="p-rename"><span>Rename “${esc(prof.name)}”</span></button>
      <button class="menu-row" id="s-wipe" style="color:#c0392b"><span>${db.listProfiles().length > 1 ? 'Delete this profile' : 'Erase all data'}</span></button></div>
    <p class="muted small" style="text-align:center;margin-top:24px">Your closet lives on this device. Photos and descriptions only leave it when Gemini is scanning or styling.</p>
  `;

  $$('[data-item]').forEach(b => (b.onclick = () => openItem(byId(b.dataset.item))));
  $$('[data-wear-item]').forEach(b => (b.onclick = () => openItem(byId(b.dataset.wearItem))));
  $$('[data-del-outfit]').forEach(b => (b.onclick = async () => { await db.del('outfits', b.dataset.delOutfit); S.outfits = S.outfits.filter(o => o.id !== b.dataset.delOutfit); renderMe(); }));
  $$('[data-wear-outfit]').forEach(b => (b.onclick = async () => {
    const o = S.outfits.find(x => x.id === b.dataset.wearOutfit);
    await wearPieces(o.pieces.map(byId).filter(Boolean)); toast('Logged'); renderMe();
  }));
  $$('[data-find-outfit]').forEach(b => (b.onclick = () => whereSheet(S.outfits.find(x => x.id === b.dataset.findOutfit).pieces.map(byId).filter(Boolean))));
  $$('[data-prof]').forEach(b => (b.onclick = async () => { if (b.dataset.prof === prof.id) return; db.setActiveProfile(b.dataset.prof); await switchProfile(); }));
  $('#p-add').onclick = async () => { const n = prompt('Name for the new profile'); if (n?.trim()) { const p = db.addProfile(n.trim()); db.setActiveProfile(p.id); await switchProfile(); toast(`Switched to ${p.name}`); } };
  $('#p-rename').onclick = () => { const n = prompt('Profile name', prof.name); if (n?.trim()) { db.renameProfile(prof.id, n.trim()); renderMe(); } };
  $('#s-key').onclick = geminiSheet;
  $('#s-places').onclick = placesSheet;
  $('#s-export').onclick = exportBackup;
  $('#s-import').onchange = importBackup;
  $('#s-install').onclick = installSheet;
  $('#s-how').onclick = howSheet;
  const sm = $('#s-sample'); if (sm) sm.onclick = async () => { for (const i of S.items.filter(x => x.sample)) await deleteItem(i.id); toast('Sample wardrobe removed'); renderMe(); };
  $('#s-wipe').onclick = async () => {
    const multi = db.listProfiles().length > 1;
    if (!confirm(multi ? `Delete profile “${prof.name}” and its whole closet? This can't be undone.` : "Erase your whole closet, history and settings? This can't be undone. Export a backup first if you might want it.")) return;
    await db.deleteProfile(prof.id);
    db.setActiveProfile(db.listProfiles()[0].id);
    await switchProfile(); toast(multi ? 'Profile deleted' : 'Erased');
  };
}

async function switchProfile() {
  urlCache.forEach(u => URL.revokeObjectURL(u)); urlCache.clear();
  S.matchAnchor = null; S.seed = 0;
  S.builder = { locked: [], need: [], brief: '', looks: null, busy: false, error: '' };
  S.shop = { status: 'idle' };
  await loadAll(); render();
}

function placesSheet() {
  const count = id => S.items.filter(i => i.placeId === id).length;
  const rows = [...S.places].sort((a, b) => placeLabel(a.id).localeCompare(placeLabel(b.id)));
  openSheet(`
    <div class="sheet-head"><h2>Places at home</h2><button class="btn sm ghost" data-close>Done</button></div>
    <p class="muted small" style="margin-top:0">A catalogue for your closet, organised as Room › Storage › Spot. Every outfit has a 📍 Find button that shows exactly where each piece is.</p>
    <div class="card">${rows.map(p => `<div class="menu-row"><span class="grow">${esc(placeLabel(p.id))} <span class="muted small">· ${count(p.id)}</span></span>
      <span class="row" style="gap:2px;flex:none"><button class="btn sm ghost" data-ren="${p.id}">Rename</button><button class="btn sm ghost" data-rm="${p.id}" style="color:#c0392b">Delete</button></span></div>`).join('') || '<div class="menu-row muted">No places yet.</div>'}</div>
    <h3 style="margin:18px 0 8px">Add a place</h3>
    <div class="place-grid">
      <input class="input" id="np-room" placeholder="Room (Bedroom)" list="np-dl-room">
      <input class="input" id="np-unit" placeholder="Storage (Wardrobe)" list="np-dl-unit">
      <input class="input" id="np-spot" placeholder="Spot (Shelf 2 / blue pouch)">
    </div>
    <datalist id="np-dl-room">${uniq(['Bedroom', 'Guest room', ...S.places.map(p => p.room)]).map(v => `<option value="${esc(v)}">`).join('')}</datalist>
    <datalist id="np-dl-unit">${uniq(['Wardrobe', 'Cupboard', 'Chest of drawers', 'Shoe rack', 'Under-bed box', ...S.places.map(p => p.unit)]).map(v => `<option value="${esc(v)}">`).join('')}</datalist>
    <button class="btn block" id="np-add" style="margin-top:10px">Add place</button>
  `, {
    onMount(sheet, close) {
      $('#np-add', sheet).onclick = () => {
        const id = findOrCreatePlace($('#np-room', sheet).value, $('#np-unit', sheet).value, $('#np-spot', sheet).value);
        if (!id) return toast('Type at least a room or storage');
        nextSheet(close, placesSheet);
      };
      $$('[data-ren]', sheet).forEach(b => (b.onclick = async () => {
        const p = placeById(b.dataset.ren);
        const v = prompt('Room › Storage › Spot', placeLabel(p.id));
        if (!v) return;
        const [room, unit = '', spot = ''] = v.split(/\s*[›>]\s*/);
        Object.assign(p, { room: room || 'Home', unit, spot }); await savePlaces();
        nextSheet(close, placesSheet);
      }));
      $$('[data-rm]', sheet).forEach(b => (b.onclick = async () => {
        const id = b.dataset.rm;
        if (count(id) && !confirm(`${count(id)} piece(s) are filed here. Delete the place anyway? The pieces stay in your closet.`)) return;
        S.places = S.places.filter(p => p.id !== id); await savePlaces();
        for (const i of S.items.filter(x => x.placeId === id)) { i.placeId = undefined; await saveItem(i); }
        nextSheet(close, placesSheet);
      }));
    },
    onClose: () => { if (S.tab === 'me') setTimeout(renderMe, 300); },
  });
}

// Validate a Gemini key by listing its models, then pick the newest stable Flash.
async function connectKey(key) {
  if (!/^AIza[\w-]{20,}$/.test(key)) throw new Error('That does not look like a Gemini API key (it starts with AIza)');
  const { listModels } = await ai();
  const { text, image } = await listModels(key);
  if (!text.length) throw new Error('This key has no Gemini models available');
  S.apiKey = key; S.aiModels = text; S.imageModels = image;
  if (!text.includes(S.aiModel)) S.aiModel = text[0];
  const studioOff = await db.getPref('studioOff', false);
  if (S.studioModel && !image.includes(S.studioModel)) S.studioModel = '';
  if (!S.studioModel && !studioOff) S.studioModel = image[0] || '';
  S.studioBlocked = false;
  await Promise.all([db.setPref('geminiKey', key), db.setPref('aiModels', text), db.setPref('imageModels', image), db.setPref('aiModel', S.aiModel), db.setPref('studioModel', S.studioModel)]);
}

function geminiSheet() {
  openSheet(`
    <div class="sheet-head"><h2>Gemini AI</h2><button class="btn sm ghost" data-close>Close</button></div>
    <p class="muted" style="margin-top:0">Gemini scans your photos, writes detailed descriptions, makes product photos and styles you. It uses <b>your own free key</b>, which is saved only on this phone and sent only to Google.</p>
    <ol class="small muted" style="padding-left:20px;margin:0 0 6px">
      <li>Open <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a> and sign in with Google.</li>
      <li>Tap <b>Create API key</b> and copy it.</li>
      <li>Paste it below.</li>
    </ol>
    <label class="field"><span>Gemini API key</span><input class="input" id="g-key" type="password" placeholder="AIza…" value="${esc(S.apiKey)}" autocomplete="off" autocapitalize="off" spellcheck="false"></label>
    ${S.aiModels.length ? `
      <label class="field"><span>Thinking model</span><select class="input" id="g-model">${S.aiModels.map(m => `<option ${m === S.aiModel ? 'selected' : ''}>${esc(m)}</option>`).join('')}</select></label>
      <label class="field"><span>Studio product photos</span><select class="input" id="g-studio"><option value="">Off · use clean cut-outs</option>${S.imageModels.map(m => `<option ${m === S.studioModel ? 'selected' : ''}>${esc(m)}</option>`).join('')}</select></label>
      <p class="small muted" style="margin:6px 0 0">${S.imageModels.length ? 'Studio photos redraw each piece like a shop listing. Some free keys have little or no image quota; when that happens Drape switches to clean cut-outs on its own.' : 'This key has no image model, so Drape makes clean cut-outs on your phone instead.'}</p>` : ''}
    <button class="btn block" id="g-save" style="margin-top:14px">${S.apiKey ? 'Save' : 'Connect'}</button>
    ${S.apiKey ? '<button class="btn block danger" id="g-del" style="margin-top:8px">Remove key</button>' : ''}
  `, {
    onMount(sheet, close) {
      $('#g-save', sheet).onclick = async e => {
        const label = e.target.textContent;
        e.target.innerHTML = '<span class="spinner"></span> Checking key…';
        try {
          const m = $('#g-model', sheet)?.value, st = $('#g-studio', sheet);
          if (m) S.aiModel = m;
          if (st) { S.studioModel = st.value; await db.setPref('studioOff', !st.value); }
          await connectKey($('#g-key', sheet).value.trim());
          close(); render(); toast(`Gemini connected · ${S.aiModel}`);
        } catch (err) { toast(err.message, 3500); e.target.textContent = label; }
      };
      const d = $('#g-del', sheet);
      if (d) d.onclick = async () => {
        Object.assign(S, { apiKey: '', aiModels: [], imageModels: [], studioModel: '' });
        await Promise.all([db.setPref('geminiKey', ''), db.setPref('aiModels', []), db.setPref('imageModels', []), db.setPref('studioModel', '')]);
        close(); render();
      };
    },
  });
}

function howSheet() {
  openSheet(`
    <div class="sheet-head"><h2>How Drape works</h2><button class="btn sm ghost" data-close>Close</button></div>
    <div class="stack how">
      <div><b>Your closet is a database on this phone.</b> Each piece is saved with its photos (original, clean cut-out, studio), type, colours, pattern, formality, warmth, brand, size, price, where it's kept, and Gemini's description. Each profile is a separate database. None of it is stored on a server.</div>
      <div><b>Scanning.</b> When you add a photo, Gemini finds every item in it. For each one it writes a name, category, colour, pattern, a shop-style description and a "tell-apart" fingerprint covering wash, fades, rips, logos and buttons. That's how two pairs of jeans stay distinct. It also outlines the item so Drape can cut it out on your phone, and it can redraw it as a studio product photo.</div>
      <div><b>Styling.</b> Two engines work together. The offline engine is instant: it scores every pair on colour harmony, formality, style, proven combinations, pattern clashes, weather, how recently you wore it, and your 👍/👎. The Gemini stylist reads the full descriptions and your brief ("rooftop dinner, relaxed") and builds outfits around the pieces you pick.</div>
      <div><b>Places.</b> You can file each piece under Room › Storage › Spot. Every outfit has a 📍 Find button that lists where to grab each piece.</div>
      <div><b>Shopping check.</b> Snap something in a store. Gemini scans it, then compares it with the photos and descriptions of your pieces in the same category.</div>
      <div class="muted small">Back up now and then from Me → Back up closet. It saves everything, photos included, to one file.</div>
    </div>
  `);
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
      <li>Open Drape from the new icon. It runs full-screen and works offline.</li>
    </ol>
    <p class="muted small">Your closet is stored inside the Home Screen app. Back up now and then from Me → Back up closet so you never lose it.</p>
  `);
}

function welcomeSheet() {
  openSheet(`
    <div class="welcome">
      <div class="art">✦</div>
      <h1 style="margin:8px 0 6px">Welcome to Drape</h1>
      <p class="muted" style="margin:0 0 18px">Your wardrobe, catalogued and styled.</p>
      <div class="stack how small">
        <div>📷 <b>Snap your clothes</b>, even a whole pile at once. Gemini detects, names, describes and cleans up each piece.</div>
        <div>✦ <b>Build fits.</b> Pick a shirt, some shoes or nothing at all, say where you're going, and get outfits.</div>
        <div>📍 <b>Find anything.</b> File pieces under Room › Cupboard › Shelf, and every outfit tells you where to grab them.</div>
        <div>🛍 <b>Shop smarter.</b> Snap an item in a store to see whether you already own something like it.</div>
      </div>
      <button class="btn block accent" id="w-gemini" style="margin-top:22px">Connect Gemini (free)</button>
      <button class="btn block ghost" data-close style="margin-top:6px">Skip for now</button>
    </div>
  `, {
    onMount(sheet, close) { $('#w-gemini', sheet).onclick = () => nextSheet(close, geminiSheet); },
    onClose: () => db.setPref('onboarded', true),
  });
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
  ['Navy blazer', 'outer', 'blazer', 'navy'], ['Black bomber', 'outer', 'bomber', 'black'], ['White crew socks', 'accessory', 'socks', 'white'],
  ['Black sunglasses', 'accessory', 'sunglasses', 'black'],
];
const SHAPES = {
  top: 'M30 22 L46 14 Q60 24 74 14 L90 22 L104 46 L88 54 L86 106 L34 106 L32 54 L16 46 Z',
  outer: 'M28 20 L48 12 L60 40 L72 12 L92 20 L106 50 L92 56 L92 108 L28 108 L28 56 L14 50 Z',
  bottom: 'M36 12 L84 12 L90 108 L66 108 L60 46 L54 108 L30 108 Z',
  shoes: 'M14 74 Q16 58 30 58 L50 60 Q62 70 82 72 Q104 74 106 88 L106 94 L14 94 Z',
  socks: 'M44 14 L66 14 L66 70 Q66 78 74 82 L92 90 Q100 96 94 104 L80 108 Q70 108 60 100 L48 92 Q44 88 44 80 Z',
  sunglasses: 'M10 52 L50 52 Q52 76 32 78 Q12 78 10 52 Z M70 52 L110 52 Q108 78 88 78 Q68 76 70 52 Z M50 54 L70 54 L70 58 L50 58 Z',
};
async function sampleThumb(cat, type, color) {
  const c = document.createElement('canvas'); c.width = 120; c.height = 160;
  const g = c.getContext('2d');
  g.fillStyle = '#ece7de'; g.fillRect(0, 0, 120, 160);
  g.translate(0, 20);
  const p = new Path2D(SHAPES[type] || SHAPES[cat] || SHAPES.top);
  g.fillStyle = colorById(color).hex; g.fill(p);
  g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 2; g.stroke(p);
  return new Promise(res => c.toBlob(res, 'image/jpeg', 0.85));
}
async function loadSample() {
  const now = Date.now();
  for (const [k, [name, category, type, color, pattern]] of SAMPLE.entries()) {
    const thumb = await sampleThumb(category, type, color);
    await saveItem({ id: db.uid(), name, category, type, color, pattern: pattern || 'solid', seasons: [], created: now - k, sample: true, thumb, photo: thumb, original: thumb, photoMode: 'original' });
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
  if (!(await db.getPref('onboarded', false))) setTimeout(welcomeSheet, 400);
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
})();
