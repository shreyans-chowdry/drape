import { z } from 'zod';
import { route, json } from '@/lib/server/http';
import { ownIt, scanGarments } from '@/lib/ai/features';
import { withCredit } from '@/lib/server/credits';
import { activeWardrobe, readOwnFile, wardrobeRows } from '@/lib/server/wardrobe';
import { similarOwned, type Category } from '@/lib/engine';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const maxDuration = 90;

/**
 * "Do I already own this?" — classify the shop photo, shortlist look-alikes from
 * the same category with the engine, then let Gemini compare the photos.
 */
export const POST = route(z.object({ path: z.string().min(10).max(300), wardrobeId: z.uuid().optional() }), async ({ userId, body }) => {
  const wid = await activeWardrobe(userId, body.wardrobeId);
  const items = await wardrobeRows(userId, wid);
  const { bytes, mime } = await readOwnFile(userId, 'temp', body.path);

  const result = await withCredit(userId, 'ownit', body.path, async () => {
    const scan = await scanGarments(userId, bytes, mime);
    const probe = scan.garments[0];
    const sameCat = probe ? items.filter(i => i.category === probe.category) : items;
    const shortlist = probe
      ? similarOwned({ category: probe.category as Category, type: probe.subcategory, color: probe.color, pattern: probe.pattern },
          sameCat.map(i => ({ ...i, category: i.category as Category, type: i.subcategory })))
          .map(r => r.item.id)
      : [];
    const pick = [...new Set([...shortlist, ...sameCat.map(i => i.id)])].slice(0, 8);
    const db = supabaseAdmin();
    const { data: imgs } = await db.from('clothing_images').select('item_id, bucket, path, kind').eq('user_id', userId).in('item_id', pick).in('kind', ['thumb', 'original']);
    const thumbs: { id: string; bytes: Buffer; mime: string }[] = [];
    for (const id of pick) {
      const im = imgs?.find(x => x.item_id === id && x.kind === 'thumb') ?? imgs?.find(x => x.item_id === id);
      if (!im) continue;
      try { const f = await readOwnFile(userId, im.bucket, im.path); thumbs.push({ id, ...f }); } catch { /* skip missing */ }
    }
    return ownIt(userId, bytes, mime, sameCat.length ? sameCat : items, thumbs);
  }).finally(() => supabaseAdmin().storage.from('temp').remove([body.path]));
  return json(result);
});
