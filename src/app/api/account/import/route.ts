import JSZip from 'jszip';
import { z } from 'zod';
import { route, json, fail } from '@/lib/server/http';
import { restore, type Backup } from '@/lib/server/backup';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const maxDuration = 120;

/** Restore a backup the user uploaded to their private "backups" folder. */
export const POST = route(z.object({ path: z.string().min(10).max(300) }), async ({ userId, body }) => {
  if (!body.path.startsWith(`${userId}/`) || body.path.includes('..')) return fail('Not your file.', 403);
  const db = supabaseAdmin();
  const { data, error } = await db.storage.from('backups').download(body.path);
  if (error || !data) return fail('Backup not found.', 404);
  const bytes = Buffer.from(await data.arrayBuffer());
  try {
    let backup: Backup, zip: JSZip | undefined;
    if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
      zip = await JSZip.loadAsync(bytes);
      const f = zip.file('wardrobe.json');
      if (!f) return fail('That ZIP has no wardrobe.json.');
      backup = JSON.parse(await f.async('string'));
    } else backup = JSON.parse(bytes.toString('utf8'));
    const report = await restore(userId, backup, zip);
    return json({ ok: true, report });
  } catch (e) {
    return fail(e instanceof Error && e.message.includes('Drape') ? e.message : 'That file could not be read as a Drape backup.');
  } finally {
    await db.storage.from('backups').remove([body.path]);
  }
});
