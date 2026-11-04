import type { NextRequest } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { json, fail } from '@/lib/server/http';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const maxDuration = 300;

/**
 * Daily housekeeping (Vercel Cron sends `Authorization: Bearer $CRON_SECRET`):
 * deletes temporary uploads older than a day and expires abandoned scan jobs.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET ?? '';
  const got = request.headers.get('authorization') ?? '';
  const want = `Bearer ${secret}`;
  if (!secret || got.length !== want.length || !timingSafeEqual(Buffer.from(got), Buffer.from(want))) return fail('Unauthorized', 401);

  const db = supabaseAdmin();
  const cutoff = new Date(Date.now() - 24 * 3600_000).toISOString();
  // temp/<user>/<batch or feature>/<file>: walk at most three levels deep.
  const names: string[] = [];
  const walk = async (prefix: string, depth: number) => {
    if (depth > 3 || names.length >= 5000) return;
    const { data } = await db.storage.from('temp').list(prefix, { limit: 1000 });
    for (const f of data ?? []) {
      const path = prefix ? `${prefix}/${f.name}` : f.name;
      if (!f.id) await walk(path, depth + 1);
      else if (f.created_at && f.created_at < cutoff) names.push(path);
    }
  };
  await walk('', 0);
  let removed = 0;
  for (let i = 0; i < names.length; i += 500) {
    const { data } = await db.storage.from('temp').remove(names.slice(i, i + 500));
    removed += data?.length ?? 0;
  }
  const { count } = await db.from('ai_jobs').update({ status: 'failed', error: 'expired' }, { count: 'exact' }).in('status', ['queued', 'processing']).lt('created_at', cutoff);
  return json({ ok: true, tempFilesRemoved: removed, jobsExpired: count ?? 0 });
}
