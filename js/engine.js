// The styling engine: works fully offline, no AI key needed.
// Scores pairs of garments on colour harmony, formality, vibe, pattern,
// weather, rotation and what you've liked or disliked before.

export const CATEGORIES = [
  { id: 'top', label: 'Tops', one: 'Top' },
  { id: 'bottom', label: 'Bottoms', one: 'Bottom' },
  { id: 'outer', label: 'Layers', one: 'Layer' },
  { id: 'shoes', label: 'Shoes', one: 'Shoes' },
  { id: 'onepiece', label: 'One-piece', one: 'One-piece' },
  { id: 'accessory', label: 'Extras', one: 'Extra' },
];

// f = default formality (1 lounge … 5 black tie), w = warmth (1 hot-weather … 5 winter)
export const TYPES = {
  top: {
    tshirt: { label: 'T-shirt', f: 1, w: 1, v: ['casual', 'street', 'sporty'] },
    graphic: { label: 'Graphic tee', f: 1, w: 1, v: ['street', 'casual'] },
    tank: { label: 'Tank / vest', f: 1, w: 1, v: ['sporty', 'casual'] },
    polo: { label: 'Polo', f: 2, w: 1, v: ['casual', 'smart'] },
    longsleeve: { label: 'Long-sleeve tee', f: 1, w: 2, v: ['casual', 'street'] },
    shirt: { label: 'Casual shirt', f: 2, w: 2, v: ['casual', 'smart'] },
    dressshirt: { label: 'Formal shirt', f: 4, w: 2, v: ['smart', 'formal'] },
    linen: { label: 'Linen shirt', f: 2, w: 1, v: ['casual', 'smart'] },
    hoodie: { label: 'Hoodie', f: 1, w: 3, v: ['street', 'casual', 'sporty'] },
    sweatshirt: { label: 'Sweatshirt', f: 1, w: 3, v: ['casual', 'street', 'sporty'] },
    sweater: { label: 'Sweater / knit', f: 3, w: 4, v: ['smart', 'casual'] },
    kurta: { label: 'Kurta', f: 3, w: 2, v: ['ethnic', 'smart'] },
    blouse: { label: 'Blouse', f: 3, w: 2, v: ['smart', 'casual'] },
    croptop: { label: 'Crop top', f: 1, w: 1, v: ['street', 'casual'] },
    jersey: { label: 'Sports jersey', f: 1, w: 1, v: ['sporty', 'street'] },
  },
  bottom: {
    jeans: { label: 'Jeans', f: 2, w: 3, v: ['casual', 'street', 'smart'] },
    chinos: { label: 'Chinos', f: 3, w: 3, v: ['smart', 'casual'] },
    trousers: { label: 'Tailored trousers', f: 4, w: 3, v: ['smart', 'formal'] },
    cargo: { label: 'Cargo pants', f: 1, w: 3, v: ['street', 'casual'] },
    joggers: { label: 'Joggers', f: 1, w: 3, v: ['sporty', 'street', 'casual'] },
    trackpants: { label: 'Track pants', f: 1, w: 3, v: ['sporty'] },
    shorts: { label: 'Shorts', f: 1, w: 1, v: ['casual', 'sporty', 'street'] },
    skirt: { label: 'Skirt', f: 3, w: 2, v: ['smart', 'casual'] },
    leggings: { label: 'Leggings', f: 1, w: 2, v: ['sporty', 'casual'] },
    pyjama: { label: 'Pyjama / churidar', f: 3, w: 2, v: ['ethnic'] },
  },
  outer: {
    denimjacket: { label: 'Denim jacket', f: 2, w: 3, v: ['casual', 'street'] },
    bomber: { label: 'Bomber', f: 2, w: 3, v: ['street', 'casual'] },
    leather: { label: 'Leather jacket', f: 3, w: 3, v: ['street', 'smart'] },
    overshirt: { label: 'Overshirt / shacket', f: 2, w: 3, v: ['casual', 'smart', 'street'] },
    blazer: { label: 'Blazer', f: 4, w: 3, v: ['smart', 'formal'] },
    nehru: { label: 'Nehru jacket', f: 4, w: 2, v: ['ethnic', 'smart', 'formal'] },
    cardigan: { label: 'Cardigan', f: 3, w: 3, v: ['smart', 'casual'] },
    coat: { label: 'Coat', f: 4, w: 5, v: ['smart', 'formal'] },
    puffer: { label: 'Puffer', f: 1, w: 5, v: ['street', 'casual', 'sporty'] },
    windbreaker: { label: 'Windbreaker', f: 1, w: 2, v: ['sporty', 'street'] },
  },
  shoes: {
    sneakers: { label: 'Sneakers', f: 2, w: 3, v: ['casual', 'street', 'smart'] },
    runners: { label: 'Running shoes', f: 1, w: 3, v: ['sporty'] },
    loafers: { label: 'Loafers', f: 4, w: 3, v: ['smart', 'formal'] },
    boots: { label: 'Boots', f: 3, w: 4, v: ['street', 'smart', 'casual'] },
    dress: { label: 'Formal shoes', f: 5, w: 3, v: ['formal', 'smart'] },
    sandals: { label: 'Sandals', f: 1, w: 1, v: ['casual'] },
    slides: { label: 'Slides / flip-flops', f: 1, w: 1, v: ['casual', 'sporty'] },
    juttis: { label: 'Juttis / mojaris', f: 3, w: 2, v: ['ethnic'] },
    heels: { label: 'Heels', f: 4, w: 2, v: ['smart', 'formal'] },
    flats: { label: 'Flats', f: 3, w: 2, v: ['smart', 'casual'] },
  },
  onepiece: {
    dress: { label: 'Dress', f: 3, w: 2, v: ['smart', 'casual'] },
    jumpsuit: { label: 'Jumpsuit', f: 3, w: 2, v: ['smart', 'casual', 'street'] },
    saree: { label: 'Saree', f: 4, w: 2, v: ['ethnic', 'formal'] },
    suit: { label: 'Suit (2-piece)', f: 5, w: 3, v: ['formal'] },
  },
  accessory: {
    watch: { label: 'Watch', f: 3, w: 3, v: ['smart', 'casual', 'formal'] },
    belt: { label: 'Belt', f: 3, w: 3, v: ['smart', 'casual', 'formal'] },
    cap: { label: 'Cap / hat', f: 1, w: 3, v: ['street', 'sporty', 'casual'] },
    bag: { label: 'Bag', f: 3, w: 3, v: ['casual', 'smart'] },
    sunglasses: { label: 'Sunglasses', f: 2, w: 3, v: ['casual', 'street', 'smart'] },
    jewelry: { label: 'Jewellery', f: 3, w: 3, v: ['smart', 'formal', 'ethnic'] },
    scarf: { label: 'Scarf', f: 3, w: 4, v: ['smart', 'casual'] },
  },
};

// n = neutral, L = lightness 0..1, h = hue degrees for colours
export const COLORS = [
  { id: 'black', label: 'Black', hex: '#141414', n: true, L: 0.05 },
  { id: 'charcoal', label: 'Charcoal', hex: '#3a3d42', n: true, L: 0.22 },
  { id: 'grey', label: 'Grey', hex: '#9a9ca0', n: true, L: 0.6 },
  { id: 'white', label: 'White', hex: '#f7f6f2', n: true, L: 0.98 },
  { id: 'cream', label: 'Cream', hex: '#efe6d2', n: true, L: 0.9 },
  { id: 'beige', label: 'Beige', hex: '#d8c3a0', n: true, L: 0.78 },
  { id: 'khaki', label: 'Khaki', hex: '#b5a27a', n: true, L: 0.64 },
  { id: 'brown', label: 'Brown', hex: '#6b4a32', n: true, L: 0.3 },
  { id: 'navy', label: 'Navy', hex: '#1f2a44', n: true, L: 0.15 },
  { id: 'denim', label: 'Denim blue', hex: '#4a6a93', n: true, L: 0.42 },
  { id: 'olive', label: 'Olive', hex: '#5f6b3a', n: true, L: 0.38 },
  { id: 'lightblue', label: 'Light blue', hex: '#a9c7e8', h: 210, L: 0.8 },
  { id: 'blue', label: 'Blue', hex: '#2f63c8', h: 220, L: 0.45 },
  { id: 'teal', label: 'Teal', hex: '#1f7a7a', h: 180, L: 0.4 },
  { id: 'green', label: 'Green', hex: '#3e9a5a', h: 140, L: 0.5 },
  { id: 'forest', label: 'Forest', hex: '#2b4a33', h: 135, L: 0.25 },
  { id: 'sage', label: 'Sage', hex: '#a7b79a', h: 100, L: 0.7 },
  { id: 'yellow', label: 'Yellow', hex: '#f0cc3c', h: 50, L: 0.8 },
  { id: 'mustard', label: 'Mustard', hex: '#c99a2e', h: 42, L: 0.58 },
  { id: 'orange', label: 'Orange', hex: '#e2742d', h: 25, L: 0.58 },
  { id: 'rust', label: 'Rust', hex: '#a24a26', h: 18, L: 0.38 },
  { id: 'red', label: 'Red', hex: '#c4302b', h: 3, L: 0.45 },
  { id: 'burgundy', label: 'Burgundy', hex: '#6d1f2c', h: 350, L: 0.25 },
  { id: 'pink', label: 'Pink', hex: '#eaa6b8', h: 345, L: 0.78 },
  { id: 'purple', label: 'Purple', hex: '#6a3e9c', h: 275, L: 0.38 },
  { id: 'lavender', label: 'Lavender', hex: '#c5b6e6', h: 260, L: 0.8 },
  { id: 'multi', label: 'Multicolour', hex: 'conic-gradient(#c4302b,#f0cc3c,#3e9a5a,#2f63c8,#6a3e9c,#c4302b)', multi: true, L: 0.5 },
];
export const colorById = id => COLORS.find(c => c.id === id) || COLORS[2];

export const PATTERNS = [
  { id: 'solid', label: 'Solid' }, { id: 'stripes', label: 'Stripes' }, { id: 'check', label: 'Checks / plaid' },
  { id: 'print', label: 'Print / floral' }, { id: 'graphic', label: 'Graphic / logo' }, { id: 'texture', label: 'Texture' },
];

export const OCCASIONS = [
  { id: 'casual', label: 'Casual', f: 2, v: ['casual', 'street'] },
  { id: 'work', label: 'Work', f: 3.5, v: ['smart'] },
  { id: 'date', label: 'Date', f: 3, v: ['smart', 'casual'] },
  { id: 'party', label: 'Night out', f: 3, v: ['street', 'smart'] },
  { id: 'gym', label: 'Gym', f: 1, v: ['sporty'] },
  { id: 'formal', label: 'Formal', f: 4.5, v: ['formal', 'smart'] },
  { id: 'festive', label: 'Festive', f: 3.5, v: ['ethnic', 'smart'] },
  { id: 'lounge', label: 'Lounge', f: 1, v: ['casual', 'sporty'] },
];

export const SEASONS = ['spring', 'summer', 'monsoon', 'autumn', 'winter'];

export function typeInfo(item) {
  return (TYPES[item.category] || {})[item.type] || { label: item.type || 'Item', f: 2, w: 3, v: ['casual'] };
}
export const itemF = i => i.formality ?? typeInfo(i).f;
export const itemW = i => i.warmth ?? typeInfo(i).w;
export const vibes = i => typeInfo(i).v;

// ---------- colour ----------
function hueDiff(a, b) { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; }

export function colorScore(ca, cb) {
  let a = colorById(ca), b = colorById(cb);
  const contrast = Math.abs(a.L - b.L);
  if (a.multi || b.multi) {
    if (a.multi && b.multi) return { s: 0.15, why: 'Two multicolour pieces compete' };
    const other = a.multi ? b : a;
    return other.n ? { s: 0.88, why: `${other.label} grounds the multicolour piece` } : { s: 0.35, why: 'Multicolour needs a neutral partner' };
  }
  if (a.n && b.n) {
    if (a.L < b.L) [a, b] = [b, a]; // stable wording: lighter first
    if (a.id === b.id && a.id !== 'denim') return { s: 0.55 + contrast * 0.2, why: `Tonal ${a.label.toLowerCase()} — add texture to keep it interesting` };
    if (contrast < 0.12) return { s: 0.6, why: `${a.label} and ${b.label.toLowerCase()} are close in depth — fine, but low contrast` };
    return { s: 0.78 + contrast * 0.2, why: `${a.label} + ${b.label.toLowerCase()}: a reliable neutral pairing` };
  }
  if (a.n || b.n) {
    const n = a.n ? a : b, c = a.n ? b : a;
    return { s: 0.82 + contrast * 0.15, why: `${n.label} lets the ${c.label.toLowerCase()} stand out` };
  }
  const d = hueDiff(a.h, b.h);
  if (d < 18) return { s: 0.5 + contrast * 0.3, why: `Monochrome ${a.label.toLowerCase()} — works best with different shades` };
  if (d <= 50) return { s: 0.72, why: `${a.label} and ${b.label.toLowerCase()} sit side by side on the colour wheel` };
  if (d >= 150) return { s: 0.62 + contrast * 0.15, why: `${a.label} / ${b.label.toLowerCase()} are complementary — bold but balanced` };
  return { s: 0.38, why: `${a.label} and ${b.label.toLowerCase()} can clash — keep everything else neutral` };
}

// ---------- garment compatibility ----------
const BAD = [
  ['hoodie', 'trousers'], ['sweatshirt', 'trousers'], ['dressshirt', 'joggers'], ['dressshirt', 'trackpants'],
  ['dressshirt', 'shorts'], ['dressshirt', 'cargo'], ['blazer', 'trackpants'], ['blazer', 'joggers'],
  ['shorts', 'boots'], ['shorts', 'dress'], ['shorts', 'loafers'], ['trousers', 'slides'], ['trousers', 'runners'],
  ['trousers', 'sandals'], ['chinos', 'slides'], ['jeans', 'slides'], ['kurta', 'joggers'], ['kurta', 'trackpants'],
  ['kurta', 'runners'], ['coat', 'shorts'], ['puffer', 'trousers'], ['tank', 'trousers'], ['tank', 'blazer'],
  ['graphic', 'trousers'], ['jersey', 'trousers'], ['hoodie', 'blazer'], ['sweatshirt', 'blazer'], ['hoodie', 'coat'], ['suit', 'sneakers'], ['saree', 'sneakers'], ['nehru', 'tshirt'],
];
const GREAT = [
  ['hoodie', 'jeans'], ['hoodie', 'joggers'], ['hoodie', 'cargo'], ['hoodie', 'sneakers'], ['shirt', 'chinos'],
  ['shirt', 'jeans'], ['oxford', 'chinos'], ['dressshirt', 'trousers'], ['dressshirt', 'loafers'], ['dressshirt', 'dress'],
  ['polo', 'chinos'], ['polo', 'shorts'], ['tshirt', 'jeans'], ['tshirt', 'shorts'], ['graphic', 'cargo'],
  ['kurta', 'jeans'], ['kurta', 'pyjama'], ['kurta', 'juttis'], ['kurta', 'nehru'], ['sweater', 'chinos'],
  ['sweater', 'trousers'], ['linen', 'chinos'], ['linen', 'shorts'], ['blazer', 'jeans'], ['blazer', 'chinos'],
  ['blazer', 'trousers'], ['denimjacket', 'chinos'], ['leather', 'jeans'], ['bomber', 'cargo'], ['chinos', 'loafers'],
  ['jeans', 'sneakers'], ['jeans', 'boots'], ['shorts', 'sneakers'], ['shorts', 'sandals'], ['joggers', 'sneakers'],
  ['trousers', 'loafers'], ['trousers', 'dress'], ['trackpants', 'runners'], ['overshirt', 'tshirt'], ['cardigan', 'shirt'],
];
const pairKey = (a, b) => [a, b].sort().join('|');
const BAD_SET = new Set(BAD.map(([a, b]) => pairKey(a, b)));
const GREAT_SET = new Set(GREAT.map(([a, b]) => pairKey(a, b)));

function overlap(a, b) {
  const s = new Set(a);
  const n = b.filter(x => s.has(x)).length;
  return n / Math.min(a.length, b.length);
}

/** Score two garments 0..1 with human-readable reasons. */
export function pairScore(a, b, prefs = {}) {
  const reasons = [];
  const c = colorScore(a.color, b.color);
  let s = c.s * 0.42;
  reasons.push({ t: c.why, good: c.s >= 0.6, color: true });

  const fd = Math.abs(itemF(a) - itemF(b));
  s += (1 - fd / 4) * 0.22;
  if (fd >= 2.5) reasons.push({ t: `Formality gap: ${typeInfo(a).label.toLowerCase()} is much ${itemF(a) > itemF(b) ? 'dressier' : 'more casual'}`, good: false });

  const vo = overlap(vibes(a), vibes(b));
  s += vo * 0.2;

  const k = pairKey(a.type, b.type);
  if (GREAT_SET.has(k)) { s += 0.12; reasons.push({ t: `${typeInfo(a).label} + ${typeInfo(b).label.toLowerCase()} is a proven combo`, good: true }); }
  if (BAD_SET.has(k)) { s -= 0.25; reasons.push({ t: `${typeInfo(a).label} with ${typeInfo(b).label.toLowerCase()} usually looks off`, good: false }); }

  const pa = a.pattern || 'solid', pb = b.pattern || 'solid';
  if (pa !== 'solid' && pb !== 'solid' && pa !== 'texture' && pb !== 'texture') {
    s -= 0.14; reasons.push({ t: 'Two busy patterns — let one piece be plain', good: false });
  }

  const fb = prefs[pairKey(a.id, b.id)] || 0;
  if (fb) { s += Math.max(-0.3, Math.min(0.3, fb * 0.12)); reasons.push({ t: fb > 0 ? 'You liked this pairing before' : 'You passed on this pairing before', good: fb > 0 }); }

  return { s: Math.max(0, Math.min(1, s + 0.04)), reasons };
}

// ---------- context: weather, occasion, rotation ----------
export function targetWarmth(tempC) {
  if (tempC == null) return null;
  if (tempC >= 29) return 1;
  if (tempC >= 23) return 2;
  if (tempC >= 16) return 3;
  if (tempC >= 9) return 4;
  return 5;
}
export function currentSeason(date = new Date(), tempC) {
  const m = date.getMonth();
  if (tempC != null && tempC <= 12) return 'winter';
  if (m === 11 || m <= 1) return 'winter';
  if (m <= 3) return 'spring';
  if (m <= 5) return 'summer';
  if (m <= 8) return 'monsoon';
  return 'autumn';
}

function contextScore(item, ctx) {
  let s = 0;
  const why = [];
  const occ = OCCASIONS.find(o => o.id === ctx.occasion);
  if (occ && item.category !== 'accessory') {
    const fd = Math.abs(itemF(item) - occ.f);
    s += 0.3 - fd * 0.16;
    s += overlap(vibes(item), occ.v) * 0.15;
    if (occ.id === 'gym' && !vibes(item).includes('sporty')) s -= 0.2;
    if (occ.id === 'festive' && vibes(item).includes('ethnic')) { s += 0.1; why.push('Festive-ready'); }
  }
  const tw = targetWarmth(ctx.tempC);
  if (tw != null && (item.category === 'top' || item.category === 'bottom' || item.category === 'onepiece')) {
    const d = Math.abs(itemW(item) - (item.category === 'bottom' ? Math.min(tw, 3) : tw));
    s -= d * 0.06;
    if (item.type === 'shorts' && ctx.tempC >= 26) { s += 0.08; why.push(`${Math.round(ctx.tempC)}° — shorts weather`); }
    if (item.type === 'shorts' && ctx.tempC < 16) s -= 0.2;
  }
  if (ctx.rain && ['sandals', 'slides', 'loafers', 'juttis'].includes(item.type) && item.category === 'shoes') s -= 0.08;
  if (item.seasons && item.seasons.length && ctx.season && !item.seasons.includes(ctx.season)) s -= 0.08;

  if (item.lastWorn) {
    const days = (Date.now() - item.lastWorn) / 864e5;
    if (days < 2) { s -= 0.18; why.push('Worn very recently'); }
    else if (days < 5) s -= 0.07;
    else if (days > 30) { s += 0.05; why.push(`Not worn in ${Math.floor(days)} days`); }
  } else if (!item.wearCount) { s += 0.04; }
  if (item.fav) s += 0.03;
  return { s, why: why.filter(Boolean) };
}

// ---------- suggestions ----------
const COMPLEMENT = {
  top: ['bottom', 'shoes', 'outer'],
  bottom: ['top', 'shoes', 'outer'],
  outer: ['top', 'bottom', 'shoes'],
  shoes: ['bottom', 'top', 'outer'],
  onepiece: ['shoes', 'outer', 'accessory'],
  accessory: ['top', 'bottom'],
};

function pieceTotal(pieces, ctx, prefs) {
  let pairSum = 0, n = 0;
  const reasons = [];
  for (let i = 0; i < pieces.length; i++) {
    for (let j = i + 1; j < pieces.length; j++) {
      const p = pairScore(pieces[i], pieces[j], prefs);
      // the top/bottom relationship matters most
      const w = (pieces[i].category === 'top' && pieces[j].category === 'bottom') || (pieces[i].category === 'bottom' && pieces[j].category === 'top') ? 2 : 1;
      pairSum += p.s * w; n += w;
      const minor = ['shoes', 'accessory'].includes(pieces[i].category) || ['shoes', 'accessory'].includes(pieces[j].category);
      reasons.push(...(minor ? p.reasons.filter(r => !r.color || !r.good) .filter(r => !(r.color && /^Tonal|close in depth/.test(r.t))) : p.reasons));
    }
  }
  let c = 0;
  for (const p of pieces) { const cs = contextScore(p, ctx); c += cs.s; reasons.push(...cs.why.map(t => ({ t, good: true }))); }
  return { s: (n ? pairSum / n : 0.5) + c / pieces.length, reasons };
}

function needsLayer(ctx) { return ctx.tempC != null && ctx.tempC < 18; }

/** For "I'm wearing X — what goes with it?" */
export function suggestFor(anchor, items, ctx = {}, prefs = {}) {
  const pool = items.filter(i => i.id !== anchor.id && !i.archived && !i.laundry);
  const groups = {};
  for (const cat of COMPLEMENT[anchor.category] || []) {
    groups[cat] = pool
      .filter(i => i.category === cat)
      .map(i => {
        const p = pairScore(anchor, i, prefs);
        const c = contextScore(i, ctx);
        return { item: i, s: p.s + c.s * 0.6, reasons: [...p.reasons, ...c.why.map(t => ({ t, good: true }))] };
      })
      .sort((a, b) => b.s - a.s);
  }
  // full looks built around the anchor
  const looks = [];
  const primary = anchor.category === 'top' ? 'bottom' : anchor.category === 'bottom' ? 'top' : anchor.category === 'onepiece' ? 'shoes' : 'top';
  const firsts = (groups[primary] || pool.filter(i => i.category === primary).map(item => ({ item }))).slice(0, 4);
  for (const f of firsts) {
    const pieces = [anchor, f.item];
    for (const cat of ['bottom', 'top', 'shoes', 'outer']) {
      if (pieces.some(p => p.category === cat)) continue;
      if (anchor.category === 'onepiece' && (cat === 'top' || cat === 'bottom')) continue;
      if (cat === 'outer' && !needsLayer(ctx) && anchor.category !== 'outer') continue;
      const best = pool.filter(i => i.category === cat).map(i => ({ i, s: pieceTotal([...pieces, i], ctx, prefs).s })).sort((a, b) => b.s - a.s)[0];
      if (!best) continue;
      if (cat === 'outer' && ctx.tempC >= 10 && best.s < pieceTotal(pieces, ctx, prefs).s - 0.08) continue;
      pieces.push(best.i);
    }
    looks.push({ pieces: order(pieces), ...pieceTotal(pieces, ctx, prefs) });
  }
  looks.sort((a, b) => b.s - a.s);
  return { groups, looks };
}

const ORDER = ['outer', 'top', 'onepiece', 'bottom', 'shoes', 'accessory'];
export const order = pieces => [...pieces].sort((a, b) => ORDER.indexOf(a.category) - ORDER.indexOf(b.category));

/** Whole-outfit generator for "what should I wear today?" */
export function generateLooks(items, ctx = {}, prefs = {}, { count = 3, seed = 0 } = {}) {
  const pool = items.filter(i => !i.archived && !i.laundry);
  const by = cat => pool.filter(i => i.category === cat);
  const tops = by('top'), bottoms = by('bottom'), shoes = by('shoes'), outers = by('outer'), ones = by('onepiece');
  const rand = mulberry(seed);
  const jitter = () => (seed ? (rand() - 0.5) * 0.18 : 0);

  const candidates = [];
  for (const t of tops) for (const b of bottoms) {
    const p = pairScore(t, b, prefs).s * 2 + contextScore(t, ctx).s + contextScore(b, ctx).s;
    candidates.push({ base: [t, b], s: p + jitter() });
  }
  for (const o of ones) candidates.push({ base: [o], s: 0.75 * 2 + contextScore(o, ctx).s * 2 + jitter() });
  candidates.sort((a, b) => b.s - a.s);

  const looks = [];
  const usedTop = new Set(), usedBottom = new Set();
  for (const c of candidates) {
    if (looks.length >= count) break;
    const [a, b] = c.base;
    if (usedTop.has(a.id) || (b && usedBottom.has(b.id) && looks.length < count - 1)) continue;
    const pieces = [...c.base];
    const bestOf = list => list.map(i => ({ i, s: pieceTotal([...pieces, i], ctx, prefs).s + jitter() })).sort((x, y) => y.s - x.s)[0];
    const sh = bestOf(shoes); if (sh) pieces.push(sh.i);
    if (needsLayer(ctx) || ctx.occasion === 'formal' || ctx.occasion === 'work') {
      const ou = bestOf(outers);
      const now = pieceTotal(pieces, ctx, prefs).s;
      if (ou && (ou.s > now || (needsLayer(ctx) && (ctx.tempC < 10 || ou.s > now - 0.08)))) pieces.push(ou.i);
    }
    usedTop.add(a.id); if (b) usedBottom.add(b.id);
    looks.push({ pieces: order(pieces), ...pieceTotal(pieces, ctx, prefs) });
  }
  return looks;
}

export function scoreLabel(s) {
  if (s >= 1.0) return 'Excellent';
  if (s >= 0.85) return 'Great';
  if (s >= 0.7) return 'Good';
  if (s >= 0.55) return 'Okay';
  return 'Risky';
}
export const pctScore = s => Math.round(Math.max(0, Math.min(1, (s - 0.25) / 1.05)) * 100);

function mulberry(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export { pairKey };

// ---------- photo colour detection ----------
function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
const PALETTE_RGB = COLORS.filter(c => !c.multi).map(c => ({ id: c.id, rgb: hexToRgb(c.hex) }));

/** Guess the garment's main colour from the centre of the photo. */
export function detectColor(canvas) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const w = canvas.width, h = canvas.height;
  const x0 = Math.floor(w * 0.3), y0 = Math.floor(h * 0.3), cw = Math.floor(w * 0.4), ch = Math.floor(h * 0.4);
  const data = ctx.getImageData(x0, y0, cw, ch).data;
  const counts = {};
  for (let i = 0; i < data.length; i += 16) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    let best = null, bd = Infinity;
    for (const p of PALETTE_RGB) {
      const dr = r - p.rgb[0], dg = g - p.rgb[1], db = b - p.rgb[2];
      const d = 2 * dr * dr + 4 * dg * dg + 3 * db * db;
      if (d < bd) { bd = d; best = p.id; }
    }
    counts[best] = (counts[best] || 0) + 1;
  }
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return sorted.length ? sorted[0][0] : 'grey';
}
