// Trip plans: the shape stored in trip_plans.plan, plus the on-device planner
// used when the AI is unavailable and for every edit on the trip page (swap,
// rebuild a day, leave something at home). Runs in the browser and on the server.
import { buildAround, CATEGORIES, forWeather, generateLooks, itemW, lookWeatherOk, pairScore, typeInfo, weatherOk, type Category, type EngineItem, type Reason } from './engine';
import type { DayForecast } from './weather';

export type TripLook = { title: string; pieceIds: string[]; why: string };
export type TripStop = { place: string; start: string; end: string; note?: string; lat?: number; lon?: number };
export type TripDay = {
  date: string;
  /** Where the person is that day. */
  place?: string;
  /** One line from the itinerary: what the day looks like. */
  plan: string;
  weather?: DayForecast | null;
  day?: TripLook;
  evening?: TripLook;
  /** A travel or rest day the person doesn't need an outfit for. */
  skipped?: boolean;
};
export type TripPlan = {
  stops?: TripStop[];
  days: TripDay[];
  /** Ids of every owned piece to pack. */
  packing: string[];
  /** Pieces the person asked to bring even if no day uses them. */
  extras?: string[];
  remember: string[];
  laundry: string;
  optionalShopping: string[];
  /** 'quick' = planned on-device because the AI was unavailable. */
  source?: 'ai' | 'quick';
  /** Clothing types the person said they want to pack; empty = anything. */
  types?: string[];
  /** Pieces the person chose to leave at home after planning. */
  excluded?: string[];
};

export type Climate = { tempC: number | null; rain: boolean };

/** Daytime feel of a day: closer to the high than the low, since that's when you're out. */
export function dayClimate(w?: Pick<DayForecast, 'maxC' | 'minC' | 'rainChance'> | null): Climate {
  if (!w) return { tempC: null, rain: false };
  return { tempC: Math.round((w.maxC * 0.65 + w.minC * 0.35) * 10) / 10, rain: w.rainChance >= 50 };
}

export function climateNote(c: Climate) {
  if (c.tempC == null) return '';
  if (c.tempC >= 24) return 'Hot: light, breathable pieces only. No hoodies, sweatshirts, knits or jackets.';
  if (c.tempC >= 17) return 'Mild: one light layer at most. Never a warm top under a jacket.';
  if (c.tempC >= 10) return 'Cool: a warm top, or a light top with a jacket.';
  return 'Cold: warm layers.';
}

const isCore = (cat: string) => cat === 'top' || cat === 'bottom' || cat === 'onepiece' || cat === 'shoes';

/** Categories a look still needs to be complete. */
export function missingSlots(pieces: Pick<EngineItem, 'category'>[], hasShoes: boolean): Category[] {
  const has = (c: string) => pieces.some(p => p.category === c);
  const need: Category[] = [];
  if (!has('onepiece')) {
    if (!has('top')) need.push('top');
    if (!has('bottom')) need.push('bottom');
  }
  if (hasShoes && !has('shoes')) need.push('shoes');
  return need;
}

/**
 * Make a look wearable for the day: drop pieces that break the weather rules
 * (unless the person insisted on them) and fill any missing slot from the pool.
 */
export function completeLook<T extends EngineItem>(ids: string[], pool: T[], c: Climate, keep: string[] = [], avoid = new Set<string>()): string[] {
  const byId = new Map(pool.map(i => [i.id, i]));
  let pieces = ids.map(id => byId.get(id)).filter((x): x is T => !!x);
  pieces = pieces.filter(p => keep.includes(p.id) || lookWeatherOk([p], c.tempC, c.rain));
  if (!lookWeatherOk(pieces, c.tempC, c.rain)) pieces = pieces.filter(p => p.category !== 'outer' || keep.includes(p.id));
  const need = missingSlots(pieces, pool.some(i => i.category === 'shoes'));
  const ctx = { tempC: c.tempC, rain: c.rain };
  if (need.length) {
    const candidates = forWeather(pool, c.tempC, c.rain).filter(i => !avoid.has(i.id) || !isCore(i.category));
    pieces = (buildAround(pieces, need, candidates.length ? candidates : pool, ctx, {}, { count: 1 })[0]?.pieces ?? pieces) as T[];
  }
  return addLayerIfCold(pieces, pool, c).map(p => p.id);
}

/** On a cold day a light top on its own isn't enough: add the best-matching layer the person owns. */
export function addLayerIfCold<T extends EngineItem>(pieces: T[], pool: T[], c: Climate): T[] {
  if (c.tempC == null || c.tempC >= 15 || pieces.some(p => p.category === 'outer')) return pieces;
  const top = pieces.find(p => p.category === 'top' || p.category === 'onepiece');
  if (!top || (itemW(top) >= 3 && c.tempC >= 10)) return pieces;
  const layer = pool.filter(i => i.category === 'outer' && weatherOk(i, c.tempC, c.rain))
    .map(i => ({ i, s: pieces.reduce((sum, p) => sum + pairScore(i, p).s, 0) }))
    .sort((a, b) => b.s - a.s)[0]?.i;
  return layer ? [layer, ...pieces] : pieces;
}

function lookTitle(pieces: EngineItem[], c: Climate) {
  const top = pieces.find(p => p.category === 'top' || p.category === 'onepiece');
  const bottom = pieces.find(p => p.category === 'bottom');
  const label = [top, bottom].filter(Boolean).map(p => typeInfo(p!).label.toLowerCase()).join(' and ');
  const mood = c.tempC == null ? '' : c.tempC >= 24 ? 'Cool and light: ' : c.tempC >= 17 ? 'Easy layers: ' : c.tempC >= 10 ? 'Warm enough: ' : 'Bundled up: ';
  const text = `${mood}${label}`.trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}
const whyOf = (reasons: Reason[]) => reasons.filter(r => r.good).slice(0, 2).map(r => r.t).join('. ');

/**
 * One day's look from the engine, steering away from tops already used on the
 * trip so the days don't repeat.
 */
export function quickDay<T extends EngineItem>(pool: T[], c: Climate, used: Map<string, number>, seed = 1, keep: T[] = []): TripLook | undefined {
  const ctx = { tempC: c.tempC, rain: c.rain };
  const avoid = new Set([...used.entries()].filter(([, n]) => n > 0).map(([id]) => id));
  const looks = keep.length
    ? buildAround(keep, missingSlots(keep, pool.some(i => i.category === 'shoes')), pool, ctx, {}, { count: 3 })
    : generateLooks(pool, ctx, {}, { count: 3, seed, avoid });
  const best = looks.sort((a, b) => scoreWithUse(b.pieces, used) + b.s - (scoreWithUse(a.pieces, used) + a.s))[0];
  if (!best) return undefined;
  const pieces = addLayerIfCold(best.pieces, pool, c);
  return { title: lookTitle(pieces, c), pieceIds: pieces.map(p => p.id), why: whyOf(best.reasons) || climateNote(c) };
}
// Repeating trousers and shoes keeps the bag light; repeating tops is what feels samey.
const scoreWithUse = (pieces: EngineItem[], used: Map<string, number>) =>
  -pieces.reduce((s, p) => s + (used.get(p.id) ?? 0) * (p.category === 'top' || p.category === 'onepiece' ? 0.25 : 0.04), 0);

export function countUse(days: TripDay[], skipDate?: string) {
  const used = new Map<string, number>();
  for (const d of days) {
    if (d.skipped || d.date === skipDate) continue;
    for (const id of [...(d.day?.pieceIds ?? []), ...(d.evening?.pieceIds ?? [])]) used.set(id, (used.get(id) ?? 0) + 1);
  }
  return used;
}

/** Whole trip planned on-device. */
export function quickPlan<T extends EngineItem>(days: TripDay[], pool: T[], mustPack: string[] = []): TripDay[] {
  const out: TripDay[] = [];
  const used = new Map<string, number>();
  const unplaced = new Set(mustPack);
  days.forEach((d, i) => {
    if (d.skipped) { out.push(d); return; }
    const c = dayClimate(d.weather);
    // work each must-pack piece into the first day whose weather suits it
    const keep = pool.filter(p => unplaced.has(p.id) && lookWeatherOk([p], c.tempC, c.rain)).slice(0, 1);
    const look = quickDay(pool, c, used, i + 1, keep);
    keep.forEach(k => unplaced.delete(k.id));
    look?.pieceIds.forEach(id => used.set(id, (used.get(id) ?? 0) + 1));
    out.push({ ...d, day: look });
  });
  return out;
}

export function packingOf(plan: Pick<TripPlan, 'days' | 'extras'>) {
  return [...new Set([...plan.days.filter(d => !d.skipped).flatMap(d => [...(d.day?.pieceIds ?? []), ...(d.evening?.pieceIds ?? [])]), ...(plan.extras ?? [])])];
}

/** "Casual shirt" → "casual shirts"; words that are already plural ("jeans", "sneakers") stay as they are. */
export const plural = (label: string, n: number): string => {
  const l = label.toLowerCase();
  if (n === 1 || /s$/.test(l)) return l;
  if (/ \/ /.test(l)) return l.split(' / ').map(x => plural(x, n)).join(' / ');
  return /(sh|ch|x)$/.test(l) ? `${l}es` : `${l}s`;
};

/** "4 tops (2 casual shirts, 1 graphic tee) · 1 layer · 2 pairs of shoes", grouped for the packing summary. */
export function fitSummary(pieces: Pick<EngineItem, 'category' | 'type'>[]) {
  return CATEGORIES.map(c => {
    const inCat = pieces.filter(p => p.category === c.id);
    const types = new Map<string, number>();
    for (const p of inCat) { const l = typeInfo(p).label; types.set(l, (types.get(l) ?? 0) + 1); }
    const n = inCat.length;
    const label = c.id === 'shoes' ? (n === 1 ? 'pair of shoes' : 'pairs of shoes') : c.id === 'onepiece' ? (n === 1 ? 'one-piece' : 'one-pieces') : plural(c.one, n);
    return { category: c.id, label, count: n, types: [...types.entries()].map(([t, k]) => ({ label: plural(t, k), n: k })) };
  }).filter(g => g.count > 0);
}

/** Which stop each date belongs to; on a day that ends one stop and starts the next, the next one wins. */
export function placeFor(date: string, stops: TripStop[]) {
  const here = stops.filter(s => s.start <= date && date <= s.end);
  if (here.length) return here[here.length - 1];
  return [...stops].reverse().find(s => s.end < date) ?? stops[0];
}

export const datesBetween = (start: string, end: string) => {
  const out: string[] = [];
  for (let d = new Date(start + 'T00:00:00Z'); d <= new Date(end + 'T00:00:00Z') && out.length < 60; d.setUTCDate(d.getUTCDate() + 1)) out.push(d.toISOString().slice(0, 10));
  return out;
};
