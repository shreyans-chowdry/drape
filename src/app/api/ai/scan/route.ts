import { z } from 'zod';
import { route, json, fail } from '@/lib/server/http';
import { scanGarments } from '@/lib/ai/features';
import { readOwnFile } from '@/lib/server/wardrobe';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const maxDuration = 60;
const DAILY_SCANS = 150;

/** Analyse an uploaded photo (temp bucket): quality check + every garment's metadata. Free, but capped per day. */
export const POST = route(z.object({ path: z.string().min(10).max(300) }), async ({ userId, body }) => {
  const since = new Date(Date.now() - 864e5).toISOString();
  const { count } = await supabaseAdmin().from('user_ai_usage').select('id', { count: 'exact', head: true })
    .eq('user_id', userId).eq('feature', 'scan').gte('created_at', since);
  if ((count ?? 0) >= DAILY_SCANS) return fail(`You've scanned ${DAILY_SCANS} photos in the last 24 hours. Take a break and continue tomorrow.`, 429, 'scan_cap');
  const { bytes, mime } = await readOwnFile(userId, 'temp', body.path).catch((e: { status?: number }) => { throw Object.assign(new Error('file'), { status: e.status }); });
  return json(await scanGarments(userId, bytes, mime));
});
