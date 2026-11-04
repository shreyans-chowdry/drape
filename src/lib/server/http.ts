import 'server-only';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { AIError } from '@/lib/ai/gemini';
import { currentUser } from '@/lib/supabase/server';

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status });
export const fail = (message: string, status = 400, code = 'bad_request') => json({ error: message, code }, status);

/** Wrap a route: verified user, validated body, consistent errors, no stack traces to the client. */
export function route<S extends z.ZodType>(schema: S, handler: (args: { userId: string; email: string | null; body: z.infer<S>; req: Request }) => Promise<Response>) {
  return async (req: Request) => {
    const user = await currentUser();
    if (!user) return fail('Please sign in again.', 401, 'unauthenticated');
    if (!(await rateLimit(user.id))) return fail('Too many requests — slow down a little.', 429, 'rate_limited');
    let raw: unknown = {};
    if (req.method !== 'GET') {
      try { raw = await req.json(); } catch { return fail('Invalid request.'); }
    } else {
      raw = Object.fromEntries(new URL(req.url).searchParams);
    }
    const parsed = schema.safeParse(raw);
    if (!parsed.success) return fail('Invalid request: ' + parsed.error.issues.map(i => `${i.path.join('.')} ${i.message}`).join('; '));
    try {
      return await handler({ userId: user.id, email: user.email ?? null, body: parsed.data, req });
    } catch (err) {
      if (err instanceof AIError) return fail(err.message, err.status >= 400 && err.status < 600 ? err.status : 500, err.code);
      console.error('[route]', err instanceof Error ? err.message : err);
      return fail('Something went wrong. Please try again.', 500, 'server_error');
    }
  };
}

// Per-user sliding window (per server instance). Credit holds in the database are
// the real spending guard; this just stops floods.
const hits = new Map<string, number[]>();
async function rateLimit(userId: string, max = 30, windowMs = 60_000) {
  const now = Date.now();
  const list = (hits.get(userId) ?? []).filter(t => now - t < windowMs);
  list.push(now);
  hits.set(userId, list);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some(t => now - t < windowMs)) hits.delete(k);
  return list.length <= max;
}
