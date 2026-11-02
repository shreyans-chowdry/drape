import { z } from 'zod';
import { route, fail } from '@/lib/server/http';
import { collect, toCsv, zipOf } from '@/lib/server/backup';

export const maxDuration = 120;

/** Download everything as JSON, a CSV of items, or a ZIP with photos. */
export const GET = route(z.object({ format: z.enum(['json', 'csv', 'zip']).default('json') }), async ({ userId, body }) => {
  const backup = await collect(userId);
  const stamp = new Date().toISOString().slice(0, 10);
  if (body.format === 'csv') {
    return new Response(toCsv(backup.tables.clothing_items ?? []), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="drape-items-${stamp}.csv"` } });
  }
  if (body.format === 'zip') {
    const zip = await zipOf(userId, backup);
    if (zip.byteLength > 250 * 1024 * 1024) return fail('Your wardrobe is too large for one ZIP; export JSON instead.', 413);
    return new Response(Buffer.from(zip), { headers: { 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="drape-backup-${stamp}.zip"` } });
  }
  return new Response(JSON.stringify(backup, null, 2), { headers: { 'Content-Type': 'application/json', 'Content-Disposition': `attachment; filename="drape-backup-${stamp}.json"` } });
});
