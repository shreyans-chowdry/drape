// The AI layer, powered by Google Gemini with the person's own API key.
// The key is entered in the app, stored only on the device, and sent only to Google.
//
// What Gemini does here:
//  - scanPhoto:   detect every garment in a photo, catalogue it, and describe it precisely
//  - studioPhoto: redraw a garment as a clean, shop-style product photo
//  - styleFit:    build outfits around chosen pieces for a mood or place
//  - shopCheck:   "do I already own something like this?"
//  - askStylist:  free-form chat about the wardrobe

import { TYPES, COLORS, PATTERNS, SEASONS, CATEGORIES, typeInfo, colorById, itemF, itemW } from './engine.js';

const API = 'https://generativelanguage.googleapis.com/v1beta';
export const DEFAULT_MODEL = 'gemini-flash-latest';

// When a model is overloaded (503) or hiccups (500), wait briefly, then fall back
// to steadier Flash models so a busy moment never breaks a scan or a fit.
let FALLBACKS = ['gemini-flash-latest'];
export const setFallbacks = models => { FALLBACKS = models.slice(0, 4); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function call(apiKey, path, body) {
  const m = path.match(/^models\/([^:]+):generateContent$/);
  const tries = [path];
  if (m && body && !body.generationConfig?.responseModalities) {
    tries.push(path, ...FALLBACKS.filter(f => f !== m[1]).map(f => `models/${f}:generateContent`));
  } else tries.push(path);
  let last;
  for (let i = 0; i < tries.length; i++) {
    try { return await once(apiKey, tries[i], body); } catch (err) {
      last = err;
      const busy = [500, 503].includes(err.status);
      // retired model or its free quota used up: another model has its own quota, so move on
      const gone = m && [404, 429].includes(err.status);
      if (!busy && !gone) throw err;
      if (busy) await sleep(800 * (i + 1));
      else while (tries[i + 1] === tries[i]) i++;
    }
  }
  if (last.status !== 429) last.message = 'Gemini is very busy right now — try again in a minute.';
  throw last;
}

/**
 * Some models are overloaded, retired or out of free quota at any moment.
 * Ping the best candidates at once with a tiny prompt and return the ones that
 * answer quickly, best model first; the rest keep their original order after.
 */
export async function rankModels(apiKey, models, { limitMs = 12000 } = {}) {
  const candidates = models.slice(0, 8);
  const ok = await Promise.all(candidates.map(id => Promise.race([
    once(apiKey, `models/${id}:generateContent`, { contents: [{ role: 'user', parts: [{ text: 'Reply with OK.' }] }] }).then(() => true, () => false),
    sleep(limitMs).then(() => false),
  ])));
  const healthy = candidates.filter((_, i) => ok[i]);
  // a lite model is a fallback, not a first choice, when a full Flash is healthy
  healthy.sort((a, b) => /lite/.test(a) - /lite/.test(b));
  return [...healthy, ...models.filter(id => !healthy.includes(id))].map(id => ({ id, healthy: healthy.includes(id) }));
}

async function once(apiKey, path, body) {
  let res;
  try {
    res = await fetch(`${API}/${path}`, {
      method: body ? 'POST' : 'GET',
      headers: { 'x-goog-api-key': apiKey, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('Could not reach Gemini. Are you online?');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data.error?.message || res.statusText;
    const err = new Error(
      res.status === 400 && /API key/i.test(msg) ? 'That API key was rejected. Check it in Me → Gemini.'
        : res.status === 403 ? 'This API key is not allowed to use that Gemini model.'
          : res.status === 404 ? 'That Gemini model is not available. Pick another in Me → Gemini.'
            : res.status === 429 ? 'Gemini rate limit or free quota reached — try again in a minute.'
              : `Gemini error (${res.status}): ${msg}`);
    err.status = res.status;
    err.billing = res.status === 429 && /limit: 0\b/.test(msg); // free tier has no quota for this model at all
    throw err;
  }
  return data;
}

/** Models this key can use: text models (best Flash first) and image models. */
export async function listModels(apiKey) {
  const all = [];
  let pageToken = '';
  do {
    const d = await call(apiKey, `models?pageSize=200${pageToken ? `&pageToken=${pageToken}` : ''}`);
    all.push(...(d.models || []));
    pageToken = d.nextPageToken || '';
  } while (pageToken);
  const ids = all
    .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
    .map(m => m.name.replace(/^models\//, ''));
  const version = id => parseFloat((id.match(/(\d+(?:\.\d+)?)/) || [])[1] || 0);
  const stable = id => (/(preview|exp)/.test(id) ? 0 : 1);

  const text = ids
    .filter(id => id.startsWith('gemini') && !/(image|banana|tts|audio|live|embedding|vision|robotics|computer|thinking-exp|transcribe|omni|customtools)/.test(id))
    .sort((a, b) => {
      const r = id => stable(id) * 2 + (id.includes('flash') && !id.includes('lite') ? 1 : 0);
      return r(b) - r(a) || version(b) - version(a) || a.length - b.length;
    });
  const image = ids
    .filter(id => /(image|banana)/.test(id) && !/(imagen|tts|lite)/.test(id))
    .sort((a, b) => {
      const r = id => stable(id) * 2 + (id.includes('banana') ? 1 : 0);
      return r(b) - r(a) || version(b) - version(a);
    });
  return { text, image };
}

function textOf(data) {
  if (data.promptFeedback?.blockReason) throw new Error('Gemini declined that request — try rephrasing it.');
  const cand = data.candidates?.[0];
  if (!cand) throw new Error('Gemini returned no answer.');
  if (cand.finishReason === 'SAFETY' || cand.finishReason === 'PROHIBITED_CONTENT') throw new Error('Gemini declined that request — try rephrasing it.');
  return (cand.content?.parts || []).filter(p => p.text && !p.thought).map(p => p.text).join('').trim();
}
function jsonOf(data, what) {
  try { return JSON.parse(textOf(data)); }
  catch (e) { throw e.message?.startsWith('Gemini') ? e : new Error(`Could not read the ${what} Gemini returned.`); }
}

export const blobToB64 = blob => new Promise(res => {
  const r = new FileReader();
  r.onload = () => res(String(r.result).split(',')[1]);
  r.readAsDataURL(blob);
});
const imagePart = async blob => ({ inlineData: { mimeType: blob.type || 'image/jpeg', data: await blobToB64(blob) } });

// ---------- wardrobe as text: what the AI "knows" about each piece ----------
export const shortId = id => id.slice(0, 8);

export function describeItem(i, placeLabel) {
  const bits = [
    `id=${shortId(i.id)}`,
    `"${i.name}"`,
    typeInfo(i).label,
    `${colorById(i.color).label}${i.color2 ? '/' + colorById(i.color2).label : ''}`,
    `pattern=${i.pattern || 'solid'}`,
    `formality=${itemF(i)}/5`,
    `warmth=${itemW(i)}/5`,
    i.brand ? `brand=${i.brand}` : '',
    i.size ? `size=${i.size}` : '',
    i.ai?.description ? `looks like: ${i.ai.description}` : '',
    i.ai?.fingerprint ? `tell-apart: ${i.ai.fingerprint}` : '',
    i.notes ? `owner notes: ${i.notes}` : '',
    placeLabel ? `kept in: ${placeLabel}` : '',
    i.laundry ? 'IN LAUNDRY (unavailable)' : '',
    i.wearCount ? `worn ${i.wearCount}x` : 'never worn',
  ].filter(Boolean);
  return `- [${i.category}] ${bits.join(' · ')}`;
}
const wardrobeText = (items, placeLabel) => items.filter(i => !i.archived).map(i => describeItem(i, placeLabel(i))).join('\n');

// ---------- schemas ----------
const T = (type, extra = {}) => ({ type, ...extra });
const ALL_TYPES = [...new Set(Object.values(TYPES).flatMap(t => Object.keys(t)))];

const GARMENT = T('OBJECT', {
  required: ['name', 'category', 'type', 'color', 'pattern', 'formality', 'warmth', 'seasons', 'description', 'fingerprint', 'box_2d'],
  properties: {
    name: T('STRING', { description: 'Short shop-style product name, e.g. "Dark indigo slim-taper jeans"' }),
    category: T('STRING', { enum: CATEGORIES.map(c => c.id) }),
    type: T('STRING', { enum: ALL_TYPES }),
    color: T('STRING', { enum: COLORS.map(c => c.id) }),
    color2: T('STRING', { enum: ['none', ...COLORS.map(c => c.id)] }),
    pattern: T('STRING', { enum: PATTERNS.map(p => p.id) }),
    formality: T('INTEGER', { description: '1 = loungewear … 5 = black tie' }),
    warmth: T('INTEGER', { description: '1 = very light / hot weather … 5 = heavy winter' }),
    seasons: T('ARRAY', { items: T('STRING', { enum: SEASONS }) }),
    material: T('STRING', { description: 'Best guess at fabric, e.g. "heavyweight cotton fleece", "rigid denim"' }),
    brandGuess: T('STRING', { description: 'Brand only if a logo or label is clearly visible, else empty' }),
    description: T('STRING', { description: '2–3 sentence product-page description: fit/silhouette, fabric, colour/wash, construction details, and how it is typically styled' }),
    fingerprint: T('STRING', { description: 'Comma-separated visual traits that tell this exact piece apart from similar ones the owner may have (shade, wash, fades, rips, logo, buttons, pockets, stitching, hem, sole colour)' }),
    styleTags: T('ARRAY', { items: T('STRING') }),
    box_2d: T('ARRAY', { items: T('INTEGER'), description: '[ymin, xmin, ymax, xmax] of the garment, normalised 0–1000' }),
    outline: T('ARRAY', { items: T('INTEGER'), description: 'Tight outline polygon of the garment as a flat list x1,y1,x2,y2,… normalised 0–1000, 16–60 points, clockwise' }),
  },
});
const SCAN_SCHEMA = T('OBJECT', { required: ['garments'], properties: { garments: T('ARRAY', { items: GARMENT }) } });

const SCAN_PROMPT = `You are cataloguing clothes for a personal wardrobe app.
Find every separate wearable item in this photo (garments, shoes, socks, sunglasses, bags, jewellery, belts, watches, caps). Ignore people's bodies, hangers, furniture and background. If the photo shows one item, return one.
For each item:
- choose the category and a type that belongs to that category;
- pick the closest colour from the list (main colour = largest area);
- write the description like a good e-commerce product page;
- the fingerprint must make this exact piece distinguishable from other pieces of the same type and colour;
- box_2d and outline must hug the item tightly.
Be precise and factual; do not invent logos or text you cannot see.`;

/** Detect and describe every item in a photo. */
export async function scanPhoto({ apiKey, model, blob }) {
  const data = await call(apiKey, `models/${model || DEFAULT_MODEL}:generateContent`, {
    contents: [{ role: 'user', parts: [await imagePart(blob), { text: SCAN_PROMPT }] }],
    generationConfig: { responseMimeType: 'application/json', responseSchema: SCAN_SCHEMA, maxOutputTokens: 8000 },
  });
  const out = jsonOf(data, 'scan');
  return (out.garments || []).map(g => {
    if (g.color2 === 'none') delete g.color2;
    if (!TYPES[g.category]?.[g.type]) g.type = Object.keys(TYPES[g.category] || TYPES.top)[0];
    if (!Array.isArray(g.box_2d) || g.box_2d.length !== 4) g.box_2d = [0, 0, 1000, 1000];
    g.formality = Math.min(5, Math.max(1, g.formality || 2));
    g.warmth = Math.min(5, Math.max(1, g.warmth || 3));
    return g;
  });
}

// ---------- studio product photo ----------
function findImage(obj) {
  if (!obj || typeof obj !== 'object') return null;
  const mime = obj.mimeType || obj.mime_type;
  if (typeof obj.data === 'string' && typeof mime === 'string' && mime.startsWith('image/')) return { mime, data: obj.data };
  for (const v of Object.values(obj)) { const f = findImage(v); if (f) return f; }
  return null;
}
const b64ToBlob = (b64, mime) => {
  const bin = atob(b64); const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
};

function studioPrompt(g) {
  const pose = g.category === 'shoes' ? 'a pair of shoes at a three-quarter side angle'
    : g.category === 'accessory' ? 'the item centred, front view'
      : g.category === 'bottom' ? 'laid flat, front view, legs straight'
        : 'on an invisible ghost mannequin, front view';
  return `Create a professional e-commerce product photo, like an official brand website listing, of ONLY the ${g.name}${g.description ? ` (${g.description})` : ''} in this photo.
The photo may show it worn by a person, crumpled, at an angle or partly hidden: remove the person entirely, straighten it to a flat, symmetrical front view, smooth out wrinkles as if freshly pressed, and rebuild any hidden parts (sleeves, collar, hem) consistently with what is visible.
Keep its identity exact: the same colour and shade, wash, pattern, fabric texture, and every logo and printed word copied letter for letter in the same position and size. Do not redesign, recolour or add details.
Remove price stickers, tags, lint and stains. Show it as ${pose}, centred with even margins, on a seamless warm light-grey studio background (#F1EEE8) with soft, even lighting and a subtle shadow.
No people, skin, hands, hangers, props, text or watermarks. Portrait 3:4.`;
}

/** Redraw a garment as a shop-style product photo. Returns a Blob. */
export async function studioPhoto({ apiKey, model, blob, garment }) {
  if (!model) throw new Error('No Gemini image model is available for this key.');
  const parts = [await imagePart(blob), { text: studioPrompt(garment) }];
  let data;
  try {
    data = await call(apiKey, `models/${model}:generateContent`, {
      contents: [{ role: 'user', parts }],
      generationConfig: { responseModalities: ['TEXT', 'IMAGE'], imageConfig: { aspectRatio: '3:4' } },
    });
  } catch (e) {
    if (e.status !== 400 && e.status !== 404) throw e;
    // Newer image models may only be served through the Interactions endpoint.
    data = await call(apiKey, 'interactions', {
      model,
      input: [
        { type: 'text', text: studioPrompt(garment) },
        { type: 'image', mime_type: parts[0].inlineData.mimeType, data: parts[0].inlineData.data },
      ],
    });
  }
  const img = findImage(data);
  if (!img) throw new Error('Gemini did not return a product photo.');
  return b64ToBlob(img.data, img.mime);
}

// ---------- fit builder ----------
const FIT_SCHEMA = T('OBJECT', {
  required: ['looks'],
  properties: {
    looks: T('ARRAY', {
      items: T('OBJECT', {
        required: ['title', 'pieceIds', 'why'],
        properties: {
          title: T('STRING', { description: 'Short evocative name for the look' }),
          pieceIds: T('ARRAY', { items: T('STRING'), description: 'ids of the wardrobe pieces in this look, including every locked piece' }),
          why: T('STRING', { description: '1–2 sentences: why it works for the brief (colour, proportion, formality, weather)' }),
          tips: T('STRING', { description: 'One practical styling tip, e.g. how to tuck, roll, or which socks' }),
        },
      }),
    }),
    missing: T('STRING', { description: 'If the wardrobe lacks something important for this brief, the single piece worth buying; else empty' }),
  },
});

const STYLIST_RULES = `You are an expert personal stylist with a sharp eye for colour, proportion, fabric and occasion. You only use pieces the owner actually has (listed below with ids). Never use pieces marked IN LAUNDRY. Respect the weather. Each piece's "looks like" and "tell-apart" text describes the exact garment — use it to choose between similar items (e.g. two pairs of jeans).`;

export async function styleFit({ apiKey, model, locked, need, brief, items, context, placeLabel }) {
  const lockedImgs = [];
  for (const p of locked.slice(0, 4)) {
    const b = p.thumb || p.photo;
    if (b instanceof Blob) lockedImgs.push({ text: `Photo of locked piece ${shortId(p.id)}:` }, await imagePart(b));
  }
  const ask = [
    `Context: ${context}`,
    `Brief from the owner: ${brief || '(none — pick something that suits the context)'}`,
    locked.length ? `Must include these pieces: ${locked.map(p => `${shortId(p.id)} (${p.name})`).join(', ')}` : 'No pieces chosen yet — build complete outfits.',
    `Fill these slots: ${need.join(', ')}.`,
    'Give 3 distinct looks, best first. Use ids exactly as listed.',
  ].join('\n');
  const data = await call(apiKey, `models/${model || DEFAULT_MODEL}:generateContent`, {
    systemInstruction: { parts: [{ text: STYLIST_RULES }, { text: `Wardrobe:\n${wardrobeText(items, placeLabel)}` }] },
    contents: [{ role: 'user', parts: [...lockedImgs, { text: ask }] }],
    generationConfig: { responseMimeType: 'application/json', responseSchema: FIT_SCHEMA, maxOutputTokens: 6000 },
  });
  return jsonOf(data, 'outfits');
}

// ---------- shopping check ----------
const SHOP_SCHEMA = T('OBJECT', {
  required: ['verdict', 'summary', 'matches', 'worksWith'],
  properties: {
    verdict: T('STRING', { enum: ['identical', 'very_similar', 'similar', 'new'] }),
    summary: T('STRING', { description: 'One or two plain sentences answering "do I already own this?"' }),
    matches: T('ARRAY', {
      items: T('OBJECT', {
        required: ['id', 'similarity', 'difference'],
        properties: {
          id: T('STRING'),
          similarity: T('INTEGER', { description: '0–100' }),
          difference: T('STRING', { description: 'What is different, or "practically the same"' }),
        },
      }),
    }),
    worksWith: T('ARRAY', { items: T('STRING'), description: 'ids of owned pieces it would pair well with (up to 6)' }),
    advice: T('STRING', { description: 'Buy / skip advice in one sentence, honest about overlap' }),
  },
});

export async function shopCheck({ apiKey, model, blob, probe, candidates, items, placeLabel }) {
  const parts = [{ text: 'NEW ITEM the owner is considering buying:' }, await imagePart(blob),
    { text: `Scanned as: ${probe.name} — ${probe.description} (tell-apart: ${probe.fingerprint})` }];
  for (const c of candidates.slice(0, 16)) {
    const b = c.thumb || c.photo;
    parts.push({ text: `Owned piece ${shortId(c.id)}: ${c.name}${c.ai?.fingerprint ? ` (${c.ai.fingerprint})` : ''}` });
    if (b instanceof Blob) parts.push(await imagePart(b));
  }
  parts.push({ text: 'Compare the NEW ITEM against the owned pieces. Similarity 100 = same item, 80+ = would serve the same role in an outfit. Only list matches ≥ 50. Then list owned pieces from the wardrobe that it would pair well with.' });
  const data = await call(apiKey, `models/${model || DEFAULT_MODEL}:generateContent`, {
    systemInstruction: { parts: [{ text: 'You help someone avoid buying duplicates. Be honest and specific.' }, { text: `Full wardrobe:\n${wardrobeText(items, placeLabel)}` }] },
    contents: [{ role: 'user', parts }],
    generationConfig: { responseMimeType: 'application/json', responseSchema: SHOP_SCHEMA, maxOutputTokens: 4000 },
  });
  return jsonOf(data, 'comparison');
}

// ---------- chat ----------
const CHAT_RULES = `${STYLIST_RULES}

When you reference a garment, write its id in double square brackets, e.g. [[a1b2c3d4]], so the app can show its photo and where it is kept. Keep answers short and practical: lead with the outfit, then one or two lines on why it works. Plain text only — no markdown, asterisks or headings. If something essential is missing, name the one piece that would fix it.`;

export async function askStylist({ apiKey, model, history, items, context, placeLabel }) {
  const data = await call(apiKey, `models/${model || DEFAULT_MODEL}:generateContent`, {
    systemInstruction: { parts: [{ text: CHAT_RULES }, { text: `Today: ${context}\n\nWardrobe (${items.length} pieces):\n${wardrobeText(items, placeLabel)}` }] },
    contents: history.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
    generationConfig: { maxOutputTokens: 4000 },
  });
  return { text: textOf(data).replace(/\*\*(.+?)\*\*/g, '$1') || '(no answer)' };
}
