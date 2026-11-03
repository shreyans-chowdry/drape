import 'server-only';
import { CATEGORIES, COLORS, forWeather, lookWeatherOk, OCCASIONS, PATTERNS, SEASONS, TYPES, type Category, type EngineItem } from '@/lib/engine';
import { AIError, generate, imageOf, imagePart, jsonOf, S, settings } from './gemini';
import { climateNote, completeLook, quickDay, type Climate, type TripDay, type TripLook } from '@/lib/trip';

// Every Gemini-powered feature. Each one is grounded in the owner's saved
// metadata (never the whole photo library), uses structured JSON output, and
// only ever refers to clothes by their ids, which are checked on the way out.

export type WardrobeRow = {
  id: string; name: string; category: string; subcategory: string; brand: string | null;
  color: string | null; color2: string | null; pattern: string; material: string | null;
  formality: number; warmth: number; seasons: string[]; occasions: string[];
  description: string | null; fingerprint: string | null; laundry: string;
  wear_count: number; last_worn_on: string | null; favourite: boolean; location?: string | null;
};

const ALL_TYPES = [...new Set(Object.values(TYPES).flatMap(t => Object.keys(t)))];
const sid = (id: string) => id.slice(0, 8);

const line = (i: WardrobeRow) => [
  `[${sid(i.id)}] ${i.name}`,
  `${i.category}/${TYPES[i.category as Category]?.[i.subcategory]?.label ?? i.subcategory}`,
  [i.color, i.color2].filter(Boolean).join(' + '),
  i.pattern !== 'solid' ? i.pattern : '',
  i.brand ? `brand ${i.brand}` : '',
  i.material ?? '',
  `formality ${i.formality}/5, warmth ${i.warmth}/5`,
  i.seasons.length ? `seasons ${i.seasons.join('/')}` : '',
  i.description ? `— ${i.description}` : '',
  i.fingerprint ? `(tell-apart: ${i.fingerprint})` : '',
  i.laundry !== 'clean' ? `[${i.laundry}]` : '',
  i.last_worn_on ? `last worn ${i.last_worn_on}` : 'never worn',
].filter(Boolean).join(' · ');

export const wardrobeText = (items: WardrobeRow[]) => items.map(line).join('\n');

export const engineOf = (i: WardrobeRow): EngineItem & WardrobeRow => ({ ...i, category: i.category as Category, type: i.subcategory });

/** Drop pieces that can't be worn in this weather before the model ever sees them. */
export function weatherPool(items: WardrobeRow[], c?: Climate) {
  return c?.tempC == null ? items : forWeather(items.map(engineOf), c.tempC, c.rain);
}

/** Remove pieces from a model-built look that break the weather rules (e.g. a sweatshirt under a jacket at 28°). */
export function fitLookToWeather(ids: string[], items: WardrobeRow[], c?: Climate, keep: string[] = []) {
  if (c?.tempC == null) return ids;
  const byId = new Map(items.map(i => [i.id, engineOf(i)]));
  let pieces = ids.map(id => byId.get(id)).filter((x): x is EngineItem & WardrobeRow => !!x);
  pieces = pieces.filter(p => keep.includes(p.id) || lookWeatherOk([p], c.tempC, c.rain));
  if (!lookWeatherOk(pieces, c.tempC, c.rain)) pieces = pieces.filter(p => p.category !== 'outer' || keep.includes(p.id));
  return pieces.map(p => p.id);
}

const WEATHER_RULE = (c?: Climate) => c?.tempC == null ? '' : `It is ${Math.round(c.tempC)}°C${c.rain ? ' with rain' : ''}. Dress for that: ${
  c.tempC >= 24 ? 'light breathable pieces only — no hoodies, sweatshirts, knits or jackets' :
  c.tempC >= 17 ? 'one light layer at most — never a warm top (hoodie/sweatshirt/knit) under a jacket' :
  c.tempC >= 10 ? 'a warm top or a light top with a jacket' : 'warm layers'}.`;

/** Map short ids back to real ones, dropping anything the model made up. */
function resolveIds(ids: string[], items: WardrobeRow[]) {
  const byShort = new Map(items.map(i => [sid(i.id), i.id]));
  return [...new Set(ids.map(x => byShort.get(String(x).replace(/[^\w-]/g, '').slice(0, 8))).filter((x): x is string => !!x))];
}

/**
 * Pick the pieces worth sending: available ones, ranked by overlap with the
 * request, but always keeping every category represented. Keeps prompts small.
 */
export function relevantItems(items: WardrobeRow[], query: string, limit = 70, keep: string[] = []) {
  const available = items.filter(i => i.laundry !== 'unavailable' && i.laundry !== 'in_laundry');
  if (available.length <= limit) return available;
  const words = query.toLowerCase().split(/\W+/).filter(w => w.length > 2);
  const score = (i: WardrobeRow) => {
    const hay = `${i.name} ${i.subcategory} ${i.color} ${i.brand} ${i.description} ${i.category}`.toLowerCase();
    return words.reduce((s, w) => s + (hay.includes(w) ? 2 : 0), 0) + (i.favourite ? 0.5 : 0) + (i.laundry === 'clean' ? 0.3 : 0);
  };
  const ranked = available.map(i => ({ i, s: score(i) + (keep.includes(i.id) ? 100 : 0) })).sort((a, b) => b.s - a.s);
  const out: WardrobeRow[] = [];
  const perCat: Record<string, number> = {};
  const cap = Math.ceil(limit / 4);
  for (const { i } of ranked) {
    if (out.length >= limit) break;
    if ((perCat[i.category] ?? 0) >= cap && !keep.includes(i.id)) continue;
    perCat[i.category] = (perCat[i.category] ?? 0) + 1;
    out.push(i);
  }
  return out;
}

// ───────────────────────────────────────────── scan
const GARMENT = S.obj({
  name: S.str('Short shop-style product name, e.g. "Dark indigo slim-taper jeans"'),
  category: S.str(undefined, CATEGORIES.map(c => c.id)),
  subcategory: S.str(undefined, ALL_TYPES),
  color: S.str(undefined, COLORS.map(c => c.id)),
  color2: S.str(undefined, ['none', ...COLORS.map(c => c.id)]),
  pattern: S.str(undefined, PATTERNS.map(p => p.id)),
  material: S.str('Fabric only if it is clearly identifiable from the photo, else empty'),
  brand: S.str('Brand only if a logo or label is clearly readable, else empty'),
  visibleText: S.str('Any printed text or logo copied exactly, else empty'),
  formality: S.int('1 = loungewear … 5 = black tie'),
  warmth: S.int('1 = very light / hot weather … 5 = heavy winter'),
  seasons: S.arr(S.str(undefined, SEASONS.map(s => s.id)), 'Every season it suits; several are normal'),
  occasions: S.arr(S.str(undefined, OCCASIONS.map(o => o.id))),
  styleTags: S.arr(S.str()),
  description: S.str('2–3 sentence product-page description of what is visible: silhouette, fabric look, colour/wash, construction details, and typical styling'),
  fingerprint: S.str('Comma-separated visual traits that tell this exact piece apart from similar ones (shade, wash, fades, logo, buttons, pockets, stitching, sole colour)'),
  keywords: S.arr(S.str(), 'Search keywords a person might type to find it'),
  box_2d: S.arr(S.int(), '[ymin, xmin, ymax, xmax], normalised 0–1000'),
}, ['name', 'category', 'subcategory', 'color', 'pattern', 'formality', 'warmth', 'seasons', 'occasions', 'description', 'fingerprint', 'keywords', 'box_2d']);

const SCAN_SCHEMA = S.obj({
  quality: S.obj({
    usable: S.bool('false if the photo is too blurry, dark, or cut off to catalogue reliably'),
    wholeItemVisible: S.bool(),
    blurry: S.bool(),
    poorLighting: S.bool(),
    advice: S.str('If not usable or not ideal: one short sentence telling the person how to retake it; else empty'),
  }),
  isProductPhoto: S.bool('true if it is already a clean product shot on a plain background'),
  garments: S.arr(GARMENT),
});

const SCAN_PROMPT = `You catalogue clothes for a personal wardrobe app.
First judge the photo: is it sharp, well lit, and is each item fully in frame?
Then list every separate wearable item (garments, shoes, socks, sunglasses, bags, watches, belts, caps, jewellery). Ignore bodies, hangers, furniture and background. One item → return one.
Rules: pick a subcategory that belongs to the chosen category; main colour = largest area; describe only what is visible; never invent a brand, fabric or text you cannot read — leave those fields empty instead; list every season the item suits.`;

export type Scanned = {
  quality: { usable: boolean; wholeItemVisible: boolean; blurry: boolean; poorLighting: boolean; advice: string };
  isProductPhoto: boolean;
  garments: {
    name: string; category: Category; subcategory: string; color: string; color2?: string; pattern: string;
    material?: string; brand?: string; visibleText?: string; formality: number; warmth: number;
    seasons: string[]; occasions: string[]; styleTags?: string[]; description: string; fingerprint: string;
    keywords: string[]; box_2d: number[];
  }[];
};

export async function scanGarments(userId: string, photo: Buffer, mime: string): Promise<Scanned> {
  const s = await settings();
  const { data } = await generate([s.models.text, s.models.reasoning], {
    contents: [{ role: 'user', parts: [imagePart(photo, mime), { text: SCAN_PROMPT }] }],
    generationConfig: { responseMimeType: 'application/json', responseSchema: SCAN_SCHEMA, maxOutputTokens: 6000, mediaResolution: 'MEDIA_RESOLUTION_MEDIUM' },
  }, { userId, feature: 'scan', operation: 'analyse_photo' });
  const out = jsonOf<Scanned>(data);
  out.garments = (out.garments ?? []).map(g => {
    const cat = (TYPES[g.category] ? g.category : 'top') as Category;
    return {
      ...g,
      category: cat,
      subcategory: TYPES[cat][g.subcategory] ? g.subcategory : Object.keys(TYPES[cat])[0],
      color2: g.color2 && g.color2 !== 'none' ? g.color2 : undefined,
      brand: g.brand?.trim() || undefined,
      material: g.material?.trim() || undefined,
      formality: Math.min(5, Math.max(1, Math.round(g.formality || 2))),
      warmth: Math.min(5, Math.max(1, Math.round(g.warmth || 2))),
      seasons: [...new Set((g.seasons ?? []).filter(x => SEASONS.some(s => s.id === x)))],
      box_2d: Array.isArray(g.box_2d) && g.box_2d.length === 4 ? g.box_2d : [0, 0, 1000, 1000],
    };
  });
  return out;
}

// ───────────────────────────────────────────── studio photo + verification
export function studioPrompt(g: { name: string; category: string; description?: string | null; visibleText?: string | null }) {
  const view = g.category === 'shoes' ? 'the pair of shoes at a clean three-quarter side angle, both shoes visible'
    : g.category === 'accessory' ? 'the item centred, front view, at a natural product angle'
      : g.category === 'bottom' ? 'laid flat, front view, legs straight'
        : 'on an invisible ghost mannequin, front view, symmetrical';
  return `Analyse the uploaded photograph and isolate ONLY this exact item: ${g.name}${g.description ? ` (${g.description})` : ''}.
Create a professional e-commerce product photograph with a pure white studio background.
Preserve the original item exactly. Do not change its colour, fabric texture, pattern, logo, stitching, sleeves, collar, shape, buttons, zippers or any design detail.${g.visibleText ? ` Its printed text reads "${g.visibleText}" — reproduce it letter for letter in the same place and size.` : ''}
Do not invent missing parts or redesign it. Remove the original background, people, hands, hangers, shadows, tags, stickers and unrelated objects.
Show ${view}, the complete item centred with even margins and natural, realistic lighting. It must look like a premium fashion e-commerce product image. No text or watermark.`;
}

const VERIFY_SCHEMA = S.obj({
  completeItem: S.bool('the whole item is present, nothing cut off by the frame'),
  partsIntact: S.bool('no sleeve, leg, strap, collar or edge is missing or deformed'),
  colourMatches: S.bool(),
  patternMatches: S.bool(),
  logosFaithful: S.bool('logos/printed text match the original and nothing was invented'),
  cleanBackground: S.bool(),
  clear: S.bool('sharp and well lit'),
  issues: S.arr(S.str(), 'short list of problems, empty if none'),
});
export type Verification = { completeItem: boolean; partsIntact: boolean; colourMatches: boolean; patternMatches: boolean; logosFaithful: boolean; cleanBackground: boolean; clear: boolean; issues: string[]; pass: boolean };

async function verifyStudio(userId: string, original: Buffer, oMime: string, studio: Buffer, sMime: string, name: string): Promise<Verification> {
  const s = await settings();
  const { data } = await generate([s.models.text, s.models.reasoning], {
    contents: [{ role: 'user', parts: [
      { text: `ORIGINAL photo of "${name}":` }, imagePart(original, oMime),
      { text: 'GENERATED studio product photo:' }, imagePart(studio, sMime),
      { text: 'You are a strict quality checker. Compare the generated product photo against the original item. Answer each check honestly; a check fails on any visible difference in the garment itself.' },
    ] }],
    generationConfig: { responseMimeType: 'application/json', responseSchema: VERIFY_SCHEMA, maxOutputTokens: 1000 },
  }, { userId, feature: 'studio', operation: 'verify' });
  const v = jsonOf<Omit<Verification, 'pass'>>(data);
  const pass = v.completeItem && v.partsIntact && v.colourMatches && v.patternMatches && v.logosFaithful && v.clear;
  return { ...v, issues: v.issues ?? [], pass };
}

/**
 * Generate a studio photo, verify it against the original, retry once on a
 * failed check. Returns null image when both attempts fail, so the caller keeps
 * the original rather than saving a damaged picture.
 */
export async function makeStudio(userId: string, original: Buffer, mime: string, garment: Parameters<typeof studioPrompt>[0]) {
  const s = await settings();
  const models = [s.models.image, s.models.image_fallback ?? ''];
  let lastCheck: Verification | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const extra = lastCheck?.issues.length ? `\nA previous attempt had these problems — fix them: ${lastCheck.issues.join('; ')}.` : '';
    const { data, model } = await generate(models, {
      contents: [{ role: 'user', parts: [imagePart(original, mime), { text: studioPrompt(garment) + extra }] }],
      generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '3:4', imageSize: '1K' } },
    }, { userId, feature: 'studio', operation: attempt ? 'generate_retry' : 'generate' });
    const img = imageOf(data);
    if (!img) { lastCheck = null; continue; }
    const check = await verifyStudio(userId, original, mime, img.bytes, img.mime, garment.name);
    if (check.pass) return { image: img, model, check, attempts: attempt + 1 };
    lastCheck = check;
  }
  return { image: null, model: null, check: lastCheck, attempts: 2 };
}

// ───────────────────────────────────────────── outfits
const LOOKS_SCHEMA = S.obj({
  looks: S.arr(S.obj({
    title: S.str('Short evocative name'),
    pieceIds: S.arr(S.str(), 'ids of the wardrobe pieces, including every locked piece, plus shoes and suitable accessories'),
    why: S.str('1–2 sentences: why it works (colour, proportion, formality, weather)'),
    occasionFit: S.str('One short phrase on how it suits the occasion'),
    weatherFit: S.str('One short phrase on how it suits the weather'),
    tip: S.str('One practical styling tip'),
  }, ['title', 'pieceIds', 'why', 'occasionFit', 'weatherFit'])),
  missing: S.str('If the wardrobe lacks something important for this brief, the single piece worth buying; else empty'),
});

export type AILook = { title: string; pieceIds: string[]; why: string; occasionFit: string; weatherFit: string; tip?: string };

const STYLE_RULES = `You are a sharp, practical personal stylist. You may ONLY use pieces from the wardrobe list, referenced by their [id].
Never invent or suggest clothes that are not on the list. Skip pieces marked [in_laundry] or [unavailable]; prefer pieces not worn recently.
Every look needs footwear if the wardrobe has any. Respect locked pieces: include them in every look. Make the looks clearly different from each other.`;

export async function styleLooks(userId: string, args: {
  items: WardrobeRow[]; locked: string[]; need: string[]; occasion: string; brief: string; weather: string; profile: string; count?: number;
  climate?: Climate; avoid?: string[];
}) {
  const s = await settings();
  const lockedRows = args.items.filter(i => args.locked.includes(i.id));
  const pool = relevantItems([...new Set([...weatherPool(args.items, args.climate), ...lockedRows])], `${args.brief} ${args.occasion}`, 80, args.locked);
  const avoid = pool.filter(i => args.avoid?.includes(i.id) && !args.locked.includes(i.id));
  const locked = pool.filter(i => args.locked.includes(i.id));
  const prompt = [
    `Occasion: ${args.occasion || 'any'}`, `Brief: ${args.brief || '(none)'}`, `Weather: ${args.weather || 'unknown'}`, WEATHER_RULE(args.climate),
    avoid.length ? `Already suggested recently — build around different tops and bottoms where possible: ${avoid.map(i => `[${sid(i.id)}]`).join(' ')}` : '',
    args.profile ? `About the person: ${args.profile}` : '',
    locked.length ? `LOCKED pieces: ${locked.map(i => `[${sid(i.id)}] ${i.name}`).join(', ')}` : '',
    args.need.length ? `Fill these slots: ${args.need.join(', ')}` : 'Build complete outfits.',
    `Give ${args.count ?? 3} looks. Each look must use a different top (or one-piece) and, where the wardrobe allows, a different bottom.`,
  ].filter(Boolean).join('\n');
  const { data } = await generate([s.models.text, s.models.reasoning], {
    systemInstruction: { parts: [{ text: STYLE_RULES }, { text: `Wardrobe:\n${wardrobeText(pool)}` }] },
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: 'application/json', responseSchema: LOOKS_SCHEMA, maxOutputTokens: 3000 },
  }, { userId, feature: 'styling', operation: 'outfits' });
  const out = jsonOf<{ looks: AILook[]; missing?: string }>(data);
  const looks = (out.looks ?? [])
    .map(l => ({ ...l, pieceIds: fitLookToWeather(resolveIds([...args.locked.map(sid), ...l.pieceIds], pool), pool, args.climate, args.locked) }))
    .filter(l => l.pieceIds.length >= 2);
  if (!looks.length) throw new AIError('The stylist could not build a look from this wardrobe. Add a few more pieces and try again.', 422, 'ai_no_looks');
  return { looks, missing: out.missing || '' };
}

// ───────────────────────────────────────────── Own It
const OWN_SCHEMA = S.obj({
  item: S.obj({ name: S.str(), category: S.str(undefined, CATEGORIES.map(c => c.id)), subcategory: S.str(), color: S.str(), pattern: S.str(), brand: S.str('only if readable, else empty') }, ['name', 'category', 'subcategory', 'color', 'pattern']),
  verdict: S.str('exact = the same product (same design, colour, logo/print and cut); similar = same role and look but differs; not_found = nothing comparable', ['exact', 'similar', 'not_found']),
  confidence: S.int('0–100 confidence in the verdict'),
  summary: S.str('One plain sentence for the shopper'),
  matches: S.arr(S.obj({
    id: S.str(), similarity: S.int('0–100'),
    reasons: S.arr(S.str(undefined, ['colour', 'category', 'pattern', 'style', 'visual', 'brand'])),
    difference: S.str('What is different, concretely'),
  }, ['id', 'similarity', 'reasons', 'difference'])),
  worksWith: S.arr(S.str(), 'ids of owned pieces it would pair well with'),
  advice: S.str('Buy or skip, one sentence, honest'),
});
export type OwnItResult = {
  item: { name: string; category: string; subcategory: string; color: string; pattern: string; brand?: string };
  verdict: 'exact' | 'similar' | 'not_found'; confidence: number; summary: string;
  matches: { id: string; similarity: number; reasons: string[]; difference: string }[];
  worksWith: string[]; advice: string;
};

export async function ownIt(userId: string, photo: Buffer, mime: string, items: WardrobeRow[], thumbs: { id: string; bytes: Buffer; mime: string }[]) {
  const s = await settings();
  const parts: Record<string, unknown>[] = [{ text: 'NEW ITEM the shopper is considering:' }, imagePart(photo, mime)];
  for (const t of thumbs) parts.push({ text: `Owned piece [${sid(t.id)}]:` }, imagePart(t.bytes, t.mime));
  parts.push({ text: 'Compare the new item with the wardrobe. Say "exact" only if it is genuinely the same product. Never claim an exact match for a merely similar piece. Use the owned pieces\' [id]s.' });
  const { data } = await generate([s.models.text, s.models.reasoning], {
    systemInstruction: { parts: [{ text: `Wardrobe:\n${wardrobeText(items)}` }] },
    contents: [{ role: 'user', parts }],
    generationConfig: { responseMimeType: 'application/json', responseSchema: OWN_SCHEMA, maxOutputTokens: 2000 },
  }, { userId, feature: 'ownit', operation: 'compare' });
  const out = jsonOf<OwnItResult>(data);
  const known = new Set(items.map(i => sid(i.id)));
  out.matches = (out.matches ?? []).filter(m => known.has(String(m.id).slice(0, 8)))
    .map(m => ({ ...m, id: resolveIds([m.id], items)[0], similarity: Math.max(0, Math.min(100, m.similarity)) }))
    .sort((a, b) => b.similarity - a.similarity);
  out.worksWith = resolveIds(out.worksWith ?? [], items);
  if (out.verdict === 'exact' && !(out.matches[0]?.similarity >= 90)) out.verdict = 'similar';
  if (out.verdict !== 'not_found' && !out.matches.length) out.verdict = 'not_found';
  out.confidence = Math.max(0, Math.min(100, out.confidence ?? 50));
  return out;
}

// ───────────────────────────────────────────── chat
const CHAT_SCHEMA = S.obj({
  reply: S.str('Your answer in plain, friendly prose. Refer to owned pieces as [id].'),
  looks: S.arr(S.obj({ title: S.str(), pieceIds: S.arr(S.str()), why: S.str() }), 'Outfits to show as cards, if the answer proposes any; else empty'),
  itemIds: S.arr(S.str(), 'Pieces to show as chips, e.g. when the person asks to find items; else empty'),
}, ['reply', 'looks', 'itemIds']);

export async function chatReply(userId: string, args: {
  items: WardrobeRow[]; history: { role: 'user' | 'assistant'; content: string }[]; context: string; profile: string; photo?: { bytes: Buffer; mime: string };
}) {
  const s = await settings();
  const lastUser = [...args.history].reverse().find(m => m.role === 'user')?.content ?? '';
  const pool = relevantItems(args.items, lastUser, 90);
  const contents = args.history.slice(-12).map((m, idx, arr) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [...(idx === arr.length - 1 && args.photo ? [imagePart(args.photo.bytes, args.photo.mime)] : []), { text: m.content }],
  }));
  const { data } = await generate([s.models.text, s.models.reasoning], {
    systemInstruction: { parts: [
      { text: `${STYLE_RULES}\nYou also answer wardrobe questions (finding pieces, where they are stored, what to pack, gaps to fill). Keep replies short and concrete. Shopping ideas must be clearly labelled as optional purchases.` },
      { text: `Today: ${args.context}\n${args.profile ? `About the person: ${args.profile}\n` : ''}Wardrobe (${pool.length} of ${args.items.length} pieces shown):\n${wardrobeText(pool)}` },
    ] },
    contents,
    generationConfig: { responseMimeType: 'application/json', responseSchema: CHAT_SCHEMA, maxOutputTokens: 2500 },
  }, { userId, feature: 'chat', operation: 'reply' });
  const out = jsonOf<{ reply: string; looks: { title: string; pieceIds: string[]; why: string }[]; itemIds: string[] }>(data);
  const byShort = new Map(pool.map(i => [sid(i.id), i.id]));
  return {
    reply: out.reply.replace(/\[([\w-]{6,12})\]/g, (m, x) => (byShort.has(String(x).slice(0, 8)) ? `[[${byShort.get(String(x).slice(0, 8))}]]` : '')),
    looks: (out.looks ?? []).map(l => ({ ...l, pieceIds: resolveIds(l.pieceIds, pool) })).filter(l => l.pieceIds.length >= 2),
    itemIds: resolveIds(out.itemIds ?? [], pool),
  };
}

// ───────────────────────────────────────────── trips
const LOOK = S.obj({ title: S.str('Short name for the look'), pieceIds: S.arr(S.str()), why: S.str('One sentence: why it suits that day and its weather') });
const TRIP_SCHEMA = S.obj({
  days: S.arr(S.obj({
    date: S.str('YYYY-MM-DD'),
    plan: S.str('What the day looks like in under 10 words; reuse the itinerary note if one is given'),
    day: LOOK,
    evening: S.obj({ title: S.str(), pieceIds: S.arr(S.str()), why: S.str() }, ['title', 'pieceIds', 'why']),
  }, ['date', 'plan', 'day'])),
  remember: S.arr(S.str(), 'Non-clothing things not to forget for these places and this weather'),
  laundry: S.str('Re-wear or laundry advice for this trip length'),
  optionalShopping: S.arr(S.str(), 'Only if a real gap exists for this weather: items worth buying, clearly optional'),
});

export type TripDayInput = { date: string; place: string; note: string; weather: string; climate: Climate; skipped?: boolean };

export async function planTrip(userId: string, args: { items: WardrobeRow[]; days: TripDayInput[]; mustPack: string[]; activities: string; preferences: string; profile: string }) {
  const s = await settings();
  const active = args.days.filter(d => !d.skipped);
  const pool = relevantItems(args.items, `${args.activities} ${args.preferences} ${active.map(d => d.note).join(' ')}`, 90, args.mustPack);
  const must = pool.filter(i => args.mustPack.includes(i.id));
  const { data } = await generate([s.models.text, s.models.reasoning], {
    systemInstruction: { parts: [{ text: STYLE_RULES + `
Plan a travel capsule. Each day has its own place and weather: dress for THAT day, not the trip average. A hot city day and a cold mountain day need different clothes.
Re-use bottoms, shoes and layers across days so the bag stays light, but give each day a different top while unworn tops remain. Add an evening look only when that day's plans call for one.` }, { text: `Wardrobe:\n${wardrobeText(pool)}` }] },
    contents: [{ role: 'user', parts: [{ text: [
      `Trip: ${[...new Set(active.map(d => d.place))].join(' → ')}, ${active.length} day(s).`,
      'Days (date · place · weather · plans · rule):',
      ...active.map(d => `${d.date} · ${d.place} · ${d.weather || 'weather unknown'} · ${d.note || 'free day'} · ${climateNote(d.climate) || 'dress for the season'}`),
      `Activities overall: ${args.activities || 'general sightseeing'}`,
      `Preferences: ${args.preferences || 'none'}`,
      must.length ? `MUST PACK (use each on at least one suitable day): ${must.map(i => `[${sid(i.id)}] ${i.name}`).join(', ')}` : '',
      args.profile ? `About the person: ${args.profile}` : '',
      'Give exactly one entry per listed date.',
    ].filter(Boolean).join('\n') }] }],
    generationConfig: { responseMimeType: 'application/json', responseSchema: TRIP_SCHEMA, maxOutputTokens: 6000 },
  }, { userId, feature: 'trip', operation: 'plan' });
  const out = jsonOf<{ days: { date: string; plan: string; day: TripLook; evening?: TripLook }[]; remember: string[]; laundry: string; optionalShopping: string[] }>(data);
  const engine = pool.map(engineOf);
  const used = new Set<string>();
  const days: TripDay[] = args.days.map(d => {
    const ai = (out.days ?? []).find(x => x.date === d.date);
    const base: TripDay = { date: d.date, place: d.place, plan: d.note || ai?.plan || '', skipped: d.skipped };
    if (d.skipped) return base;
    const fix = (l?: TripLook) => l && { ...l, pieceIds: completeLook(resolveIds(l.pieceIds ?? [], pool), engine, d.climate, args.mustPack, used) };
    const day = fix(ai?.day) ?? quickDay(engine, d.climate, new Map([...used].map(id => [id, 1])));
    day?.pieceIds.forEach(id => { if (/^(top|onepiece)$/.test(engineOf(pool.find(p => p.id === id)!).category)) used.add(id); });
    const evening = ai?.evening?.pieceIds?.length ? fix(ai.evening) : undefined;
    return { ...base, day, evening };
  });
  return { days, remember: out.remember ?? [], laundry: out.laundry ?? '', optionalShopping: out.optionalShopping ?? [] };
}

// ───────────────────────────────────────────── itinerary reading
const ITINERARY_SCHEMA = S.obj({
  title: S.str('Short trip name, e.g. "Japan: Osaka, Hakone, Tokyo"'),
  stops: S.arr(S.obj({
    place: S.str('City or area, specific enough to look up the weather, e.g. "Hakone, Japan"'),
    start: S.str('YYYY-MM-DD, first day there'),
    end: S.str('YYYY-MM-DD, last day there'),
    note: S.str('Main plans there in under 10 words'),
  }), 'In travel order'),
  days: S.arr(S.obj({ date: S.str('YYYY-MM-DD'), note: S.str('That day in under 12 words, e.g. "Ryokan, onsen, Lake Ashi cruise"') })),
  hadDates: S.bool('false if the itinerary gives no dates and you numbered the days from the start date'),
});

export type Itinerary = { title: string; stops: { place: string; start: string; end: string; note: string }[]; days: { date: string; note: string }[]; hadDates: boolean };

/** Turn a typed, pasted, photographed or PDF itinerary into stops and day notes. */
export async function readItinerary(userId: string, input: { text?: string; file?: { bytes: Buffer; mime: string }; startHint: string; today: string }): Promise<Itinerary> {
  const s = await settings();
  const parts: Record<string, unknown>[] = [];
  if (input.file) parts.push(imagePart(input.file.bytes, input.file.mime));
  if (input.text) parts.push({ text: `Itinerary:\n${input.text}` });
  parts.push({ text: `Today is ${input.today}. Read the itinerary and list where the traveller is on each date.
If dates lack a year, use the next occurrence after today. If there are no dates at all, start on ${input.startHint} and number the days in order.
Use only places and plans written in the itinerary; never invent stops.` });
  const { data } = await generate([s.models.text, s.models.reasoning], {
    contents: [{ role: 'user', parts }],
    generationConfig: { responseMimeType: 'application/json', responseSchema: ITINERARY_SCHEMA, maxOutputTokens: 3000 },
  }, { userId, feature: 'trip', operation: 'itinerary' });
  const out = jsonOf<Itinerary>(data);
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  const stops = (out.stops ?? []).filter(x => x.place?.trim() && iso.test(x.start) && iso.test(x.end)).map(x => (x.end < x.start ? { ...x, end: x.start } : x)).slice(0, 8);
  if (!stops.length) throw new AIError('Couldn’t find places and dates in that itinerary. Add them by hand below.', 422, 'ai_no_itinerary');
  return { title: out.title ?? '', stops, days: (out.days ?? []).filter(d => iso.test(d.date) && d.note?.trim()).slice(0, 31), hadDates: out.hadDates !== false };
}
