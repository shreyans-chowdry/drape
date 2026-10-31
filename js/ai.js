// Optional AI stylist powered by Claude. Uses the person's own API key,
// stored only on their device, and calls the API straight from the browser.

import { TYPES, COLORS, PATTERNS, SEASONS, typeInfo, colorById, itemF, itemW } from './engine.js';

const SDK_URL = 'https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@0.135.0/+esm';
const MODEL = 'claude-opus-5-5';
let _sdk = null;

async function client(apiKey) {
  if (!_sdk) _sdk = await import(SDK_URL);
  const Anthropic = _sdk.default;
  return { Anthropic, c: new Anthropic({ apiKey, dangerouslyAllowBrowser: true }) };
}

function friendlyError(Anthropic, e) {
  if (e instanceof Anthropic.AuthenticationError) return 'That API key was rejected. Check it in Me → AI stylist.';
  if (e instanceof Anthropic.PermissionDeniedError) return 'This API key does not have access to that model.';
  if (e instanceof Anthropic.RateLimitError) return 'Rate limited — wait a moment and try again.';
  if (e instanceof Anthropic.APIConnectionError) return 'Could not reach Claude. Are you online?';
  if (e instanceof Anthropic.APIError) return `Claude returned an error (${e.status}): ${e.message}`;
  return e.message || String(e);
}

const COMMON = {
  model: MODEL,
  betas: ['server-side-fallback-2026-07-01'],
  fallbacks: 'default',
};

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

When you reference a garment from the wardrobe, write its id in double square brackets, e.g. [[a1b2c3d4]], so the app can show its photo. Keep answers short and practical: lead with the outfit, then one or two lines on why it works (colour, proportion, formality). Use plain language; no markdown headings. Skip items marked IN LAUNDRY. If the wardrobe is missing something essential for the request, say what one piece would fix it.`;

/** Chat with the stylist. history: [{role, content}] of plain text turns. */
export async function askStylist({ apiKey, history, items, context }) {
  const { Anthropic, c } = await client(apiKey);
  const wardrobe = `Today: ${context}\n\nMy wardrobe (${items.length} items):\n${summarizeWardrobe(items)}`;
  try {
    const res = await c.beta.messages.create({
      ...COMMON,
      max_tokens: 4000,
      output_config: { effort: 'low' },
      system: [
        { type: 'text', text: STYLIST_SYSTEM },
        { type: 'text', text: wardrobe, cache_control: { type: 'ephemeral' } },
      ],
      messages: history,
    });
    if (res.stop_reason === 'refusal') return { text: "I can't help with that one — try asking about an outfit." };
    const text = res.content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
    return { text: text || '(no answer)' };
  } catch (e) {
    throw new Error(friendlyError(Anthropic, e));
  }
}

const TAG_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'category', 'type', 'color', 'pattern', 'formality', 'warmth', 'seasons'],
  properties: {
    name: { type: 'string', description: 'Short descriptive name, e.g. "Navy zip hoodie"' },
    category: { type: 'string', enum: Object.keys(TYPES) },
    type: { type: 'string', enum: [...new Set(Object.values(TYPES).flatMap(t => Object.keys(t)))] },
    color: { type: 'string', enum: COLORS.map(c => c.id) },
    color2: { type: 'string', enum: ['none', ...COLORS.map(c => c.id)] },
    pattern: { type: 'string', enum: PATTERNS.map(p => p.id) },
    formality: { type: 'integer', description: '1 = loungewear … 5 = black tie' },
    warmth: { type: 'integer', description: '1 = very light/hot weather … 5 = heavy winter' },
    seasons: { type: 'array', items: { type: 'string', enum: SEASONS } },
  },
};

/** Auto-fill an item from its photo. */
export async function tagPhoto({ apiKey, blob }) {
  const { Anthropic, c } = await client(apiKey);
  const data = await new Promise(res => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.readAsDataURL(blob); });
  try {
    const res = await c.beta.messages.create({
      ...COMMON,
      max_tokens: 2000,
      output_config: { effort: 'low', format: { type: 'json_schema', schema: TAG_SCHEMA } },
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: blob.type || 'image/jpeg', data } },
          { type: 'text', text: 'Catalogue the main garment in this photo for my wardrobe app. The type must belong to the chosen category.' },
        ],
      }],
    });
    if (res.stop_reason === 'refusal') throw new Error('Claude declined to tag this photo.');
    const text = res.content.find(b => b.type === 'text')?.text || '{}';
    const out = JSON.parse(text);
    if (out.color2 === 'none') delete out.color2;
    if (!TYPES[out.category]?.[out.type]) delete out.type;
    return out;
  } catch (e) {
    if (e instanceof SyntaxError) throw new Error('Could not read the tags Claude returned.');
    throw new Error(friendlyError(Anthropic, e));
  }
}
