import { z } from 'zod';
import type { NextRequest } from 'next/server';
import { json, fail } from '@/lib/server/http';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { currentUser } from '@/lib/supabase/server';

const Body = z.object({ email: z.email().max(200), topic: z.enum(['question', 'billing', 'data', 'bug', 'feedback']), message: z.string().trim().min(5).max(4000), website: z.string().max(0).optional() });
const recent = new Map<string, number[]>();

/** Public contact form. Stored in the feedback table for the admin dashboard. */
export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const now = Date.now(), list = (recent.get(ip) ?? []).filter(t => now - t < 3600_000);
  if (list.length >= 5) return fail('Too many messages from this connection. Please try again later.', 429, 'rate_limited');
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail('Please enter a valid email and a message.', 400, 'invalid');
  if (parsed.data.website) return json({ ok: true }); // bot
  recent.set(ip, [...list, now]);
  const user = await currentUser();
  const { error } = await supabaseAdmin().from('feedback').insert({ user_id: user?.id ?? null, message: parsed.data.message, context: { email: parsed.data.email, topic: parsed.data.topic, source: 'contact' } });
  if (error) return fail('Could not send. Please try again.', 500);
  return json({ ok: true });
}
