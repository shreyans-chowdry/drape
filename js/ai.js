// Optional AI stylist powered by Google Gemini. Uses the person's own API key,
// stored only on their device, and calls the API straight from the browser.

import { TYPES, COLORS, PATTERNS, SEASONS, typeInfo, colorById, itemF, itemW } from './engine.js';

const API = 'https://generativelanguage.googleapis.com/v1beta';
export const DEFAULT_MODEL = 'gemini-flash-latest';

async function call(apiKey, path, body) {
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
    if (res.status === 400 && /API key/i.test(msg)) throw new Error('That API key was rejected. Check it in Me → AI stylist.');
    if (res.status === 403) throw new Error('This API key is not allowed to use Gemini. Check it in Google AI Studio.');
    if (res.status === 404) throw new Error('That Gemini model is not available. Pick another in Me → AI stylist.');
    if (res.status === 429) throw new Error('Gemini rate limit or free quota reached — try again in a minute.');
    throw new Error(`Gemini error (${res.status}): ${msg}`);
  }
  return data;
}

/** Models this key can use for text generation, best Flash first. */
export async function listModels(apiKey) {
  const out = [];
  let pageToken = '';
  do {
    const d = await call(apiKey, `models?pageSize=200${pageToken ? `&pageToken=${pageToken}` : ''}`);
    out.push(...(d.models || []));
    pageToken = d.nextPageToken || '';
  } while (pageToken);
  const usable = out
    .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
    .map(m => m.name.replace(/^models\//, ''))
    .filter(id => id.startsWith('gemini') && !/(image|tts|audio|live|embedding|vision|robotics|computer|thinking-exp)/.test(id));
  const version = id => parseFloat((id.match(/gemini-(\d+(?:\.\d+)?)/) || [])[1] || 0);
  const rank = id => (id.includes('preview') || id.includes('exp') ? 0 : 2) + (id.includes('flash') && !id.includes('lite') ? 1 : 0);
  return usable.sort((a, b) => rank(b) - rank(a) || version(b) - version(a) || a.length - b.length);
}

function textOf(data) {
  if (data.promptFeedback?.blockReason) throw new Error("Gemini declined that request — try rephrasing it.");
  const cand = data.candidates?.[0];
  if (!cand) throw new Error('Gemini returned no answer.');
  if (cand.finishReason === 'SAFETY' || cand.finishReason === 'PROHIBITED_CONTENT') throw new Error("Gemini declined that request — try rephrasing it.");
  return (cand.content?.parts || []).filter(p => p.text && !p.thought).map(p => p.text).join('').trim();
}

function summarizeWardrobe(items) {
  return items.filter(i => !i.archived).map(i => {
    const bits = [
      `id=${i.id.slice(0, 8)}`,
      i.name,
      `${colorById(i.color).label}${i.color2 ? '/' + colorById(i.color2).label : ''}`,
      typeInfo(i).label,
      `pattern=${i.pattern || 'solid'}`,
      `formality=${itemF(i)}/5`,
      `warmth=${itemW(i)}/5`,
      i.laundry ? 'IN LAUNDRY' : '',
      i.wearCount ? `worn ${i.wearCount}x` : 'never worn',
      i.notes ? `notes: ${i.notes}` : '',
    ].filter(Boolean);
    return `- [${i.category}] ${bits.join(' · ')}`;
  }).join('\n');
}

const STYLIST_SYSTEM = `You are a warm, sharp personal stylist inside a wardrobe app. You only suggest pieces the user actually owns unless they explicitly ask what to buy.

When you reference a garment from the wardrobe, write its id in double square brackets, e.g. [[a1b2c3d4]], so the app can show its photo. Keep answers short and practical: lead with the outfit, then one or two lines on why it works (colour, proportion, formality). Use plain text — no markdown, no asterisks, no headings. Skip items marked IN LAUNDRY. If the wardrobe is missing something essential for the request, say what one piece would fix it.`;

/** Chat with the stylist. history: [{role: 'user'|'assistant', content}] plain text turns. */
export async function askStylist({ apiKey, model, history, items, context }) {
  const wardrobe = `Today: ${context}\n\nMy wardrobe (${items.length} items):\n${summarizeWardrobe(items)}`;
  const data = await call(apiKey, `models/${model || DEFAULT_MODEL}:generateContent`, {
    systemInstruction: { parts: [{ text: STYLIST_SYSTEM }, { text: wardrobe }] },
    contents: history.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
    generationConfig: { maxOutputTokens: 4000 },
  });
  return { text: textOf(data).replace(/\*\*(.+?)\*\*/g, '$1') || '(no answer)' };
}

const S = (type, extra = {}) => ({ type, ...extra });
const TAG_SCHEMA = S('OBJECT', {
  required: ['name', 'category', 'type', 'color', 'pattern', 'formality', 'warmth', 'seasons'],
  properties: {
    name: S('STRING', { description: 'Short descriptive name, e.g. "Navy zip hoodie"' }),
    category: S('STRING', { enum: Object.keys(TYPES) }),
    type: S('STRING', { enum: [...new Set(Object.values(TYPES).flatMap(t => Object.keys(t)))] }),
    color: S('STRING', { enum: COLORS.map(c => c.id) }),
    color2: S('STRING', { enum: ['none', ...COLORS.map(c => c.id)] }),
    pattern: S('STRING', { enum: PATTERNS.map(p => p.id) }),
    formality: S('INTEGER', { description: '1 = loungewear … 5 = black tie' }),
    warmth: S('INTEGER', { description: '1 = very light/hot weather … 5 = heavy winter' }),
    seasons: S('ARRAY', { items: S('STRING', { enum: SEASONS }) }),
  },
});

/** Auto-fill an item from its photo. */
export async function tagPhoto({ apiKey, model, blob }) {
  const data64 = await new Promise(res => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.readAsDataURL(blob); });
  const data = await call(apiKey, `models/${model || DEFAULT_MODEL}:generateContent`, {
    contents: [{
      role: 'user',
      parts: [
        { inlineData: { mimeType: blob.type || 'image/jpeg', data: data64 } },
        { text: 'Catalogue the main garment in this photo for my wardrobe app. The type must belong to the chosen category.' },
      ],
    }],
    generationConfig: { responseMimeType: 'application/json', responseSchema: TAG_SCHEMA, maxOutputTokens: 2000 },
  });
  let out;
  try { out = JSON.parse(textOf(data)); } catch (e) { throw e.message?.startsWith('Gemini') ? e : new Error('Could not read the tags Gemini returned.'); }
  if (out.color2 === 'none') delete out.color2;
  if (!TYPES[out.category]?.[out.type]) delete out.type;
  return out;
}
