import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';

// The one place that talks to Google Gemini. The key lives only in the server
// environment (GEMINI_API_KEY). Every call is metered into user_ai_usage with
// token counts and an estimated cost from the editable pricing table.

const API = 'https://generativelanguage.googleapis.com/v1beta';

export class AIError extends Error {
  constructor(message: string, public status = 500, public code = 'ai_error') { super(message); }
}

export type Settings = {
  pricing: Record<string, { input: number; output: number; image: number }>;
  usdInr: number;
  models: { text: string; reasoning: string; image: string; image_fallback?: string };
};

const DEFAULT_SETTINGS: Settings = {
  pricing: {},
  usdInr: 94.6,
  models: { text: 'gemini-3.1-flash-lite', reasoning: 'gemini-3.6-flash', image: 'gemini-3.1-flash-lite-image', image_fallback: 'gemini-nano-banana-2.1' },
};

let cached: { at: number; value: Settings } | null = null;

/** Model choice, prices and exchange rate, editable in Admin → Settings (cached for a minute). */
export async function settings(): Promise<Settings> {
  if (cached && Date.now() - cached.at < 60_000) return cached.value;
  const { data } = await supabaseAdmin().from('admin_settings').select('key, value').in('key', ['model_pricing', 'fx', 'models']);
  const get = (k: string) => data?.find(r => r.key === k)?.value as Record<string, unknown> | undefined;
  const value: Settings = {
    pricing: (get('model_pricing') as Settings['pricing']) ?? DEFAULT_SETTINGS.pricing,
    usdInr: Number(get('fx')?.usd_inr ?? DEFAULT_SETTINGS.usdInr),
    models: { ...DEFAULT_SETTINGS.models, ...(get('models') as Partial<Settings['models']>) },
  };
  cached = { at: Date.now(), value };
  return value;
}
export const clearSettingsCache = () => { cached = null; };

export function estimateCost(s: Settings, model: string, inTok: number, outTok: number, images: number) {
  const p = s.pricing[model] ?? { input: 0, output: 0, image: 0 };
  const usd = (inTok * p.input + outTok * p.output) / 1e6 + images * p.image;
  return { usd, inr: usd * s.usdInr };
}

type Meta = { userId: string | null; feature: string; operation: string };
type GenResult = { data: GeminiResponse; model: string };
export type GeminiResponse = {
  candidates?: { content?: { parts?: { text?: string; thought?: boolean; inlineData?: { mimeType: string; data: string } }[] }; finishReason?: string }[];
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number };
  promptFeedback?: { blockReason?: string };
};

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function once(model: string, body: unknown): Promise<GeminiResponse> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new AIError('AI is not configured on this server yet.', 503, 'ai_unconfigured');
  let res: Response;
  try {
    res = await fetch(`${API}/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120_000),
    });
  } catch {
    throw new AIError('Could not reach the AI service.', 503, 'ai_unreachable');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg: string = data?.error?.message ?? res.statusText;
    // Never surface Google's raw message (it can include project details) to users.
    const code = res.status === 429 ? (/limit: 0\b/.test(msg) ? 'ai_no_quota' : 'ai_rate_limited') : res.status === 404 ? 'ai_model_missing' : 'ai_upstream';
    const err = new AIError(code === 'ai_rate_limited' ? 'The AI is busy. Try again in a minute.' : code === 'ai_no_quota' ? 'This AI feature isn’t available right now. No credit was used.' : 'The AI request failed. No credit was used.', res.status === 429 && code === 'ai_no_quota' ? 503 : res.status, code);
    console.error(`[gemini] ${model} ${res.status} ${msg.slice(0, 200)}`);
    throw err;
  }
  return data as GeminiResponse;
}

/**
 * generateContent with retries on overload and fallback models, metered per attempt.
 * `models` is the preference order; the first that answers wins.
 */
export async function generate(models: string[], body: Record<string, unknown>, meta: Meta): Promise<GenResult> {
  const s = await settings();
  let last: unknown;
  const list = [...new Set(models.filter(Boolean))];
  for (const [i, model] of list.entries()) {
    // An overloaded model is better skipped than retried while another one can answer.
    const tries = i === list.length - 1 ? 2 : 1;
    for (let attempt = 0; attempt < tries; attempt++) {
      const t0 = Date.now();
      try {
        const data = await once(model, body);
        await meter(s, model, data, meta, 'ok', Date.now() - t0);
        return { data, model };
      } catch (err) {
        last = err;
        await meter(s, model, null, meta, 'error', Date.now() - t0, err instanceof AIError ? err.code : 'unknown');
        const status = err instanceof AIError ? err.status : 500;
        if (status === 500 || status === 503) { await sleep(700 * (attempt + 1)); continue; }
        break; // 404 / 429 / 400: try the next model
      }
    }
  }
  throw last instanceof AIError ? last : new AIError('The AI request failed.');
}

async function meter(s: Settings, model: string, data: GeminiResponse | null, meta: Meta, status: string, latency: number, error?: string) {
  const u = data?.usageMetadata ?? {};
  const inTok = u.promptTokenCount ?? 0;
  const outTok = (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0);
  const images = data ? countImages(data) : 0;
  const cost = estimateCost(s, model, inTok, images ? 0 : outTok, images);
  const { error: dbErr } = await supabaseAdmin().from('user_ai_usage').insert({
    user_id: meta.userId, model, feature: meta.feature, operation: meta.operation,
    input_tokens: inTok, output_tokens: outTok, images,
    cost_usd: Number(cost.usd.toFixed(6)), cost_inr: Number(cost.inr.toFixed(4)),
    status, error: error ?? null, latency_ms: latency,
  });
  if (dbErr) console.error('[meter]', dbErr.message);
}

const countImages = (d: GeminiResponse) =>
  (d.candidates ?? []).flatMap(c => c.content?.parts ?? []).filter(p => p.inlineData?.mimeType?.startsWith('image/')).length;

/** The JSON object a structured-output call returned. */
export function jsonOf<T>(d: GeminiResponse): T {
  if (d.promptFeedback?.blockReason) throw new AIError('That photo or request was blocked by the AI safety filter.', 422, 'ai_blocked');
  const text = (d.candidates?.[0]?.content?.parts ?? []).filter(p => !p.thought).map(p => p.text ?? '').join('');
  try { return JSON.parse(text) as T; } catch { throw new AIError('The AI returned an unreadable answer. Try again.', 502, 'ai_bad_json'); }
}

export function imageOf(d: GeminiResponse): { mime: string; bytes: Buffer } | null {
  const p = (d.candidates ?? []).flatMap(c => c.content?.parts ?? []).find(x => x.inlineData?.mimeType?.startsWith('image/'));
  return p?.inlineData ? { mime: p.inlineData.mimeType, bytes: Buffer.from(p.inlineData.data, 'base64') } : null;
}

export const imagePart = (bytes: Buffer | Uint8Array, mime: string) => ({ inlineData: { mimeType: mime, data: Buffer.from(bytes).toString('base64') } });

// Gemini's structured-output schema helpers (OpenAPI subset, upper-case types).
type SchemaNode = Record<string, unknown>;
export const S = {
  obj: (properties: Record<string, SchemaNode>, required: string[] = Object.keys(properties)): SchemaNode => ({ type: 'OBJECT', properties, required }),
  arr: (items: SchemaNode, description?: string): SchemaNode => ({ type: 'ARRAY', items, ...(description ? { description } : {}) }),
  str: (description?: string, enumValues?: string[]): SchemaNode => ({ type: 'STRING', ...(description ? { description } : {}), ...(enumValues ? { enum: enumValues } : {}) }),
  int: (description?: string): SchemaNode => ({ type: 'INTEGER', ...(description ? { description } : {}) }),
  bool: (description?: string): SchemaNode => ({ type: 'BOOLEAN', ...(description ? { description } : {}) }),
};
