import { z } from 'zod';
import { route, json, fail } from '@/lib/server/http';
import { makeStudio } from '@/lib/ai/features';
import { withCredit } from '@/lib/server/credits';
import { readOwnFile } from '@/lib/server/wardrobe';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const maxDuration = 120;

/**
 * Make a verified studio photo for one item. A credit is charged only when a
 * photo passes verification; otherwise it's refunded and the original stays.
 */
export const POST = route(z.object({ itemId: z.uuid() }), async ({ userId, body }) => {
  const db = supabaseAdmin();
  const { data: item } = await db.from('clothing_items').select('id, name, category, description, ai_meta').eq('id', body.itemId).eq('user_id', userId).single();
  if (!item) return fail('Item not found.', 404, 'not_found');
  const { data: orig } = await db.from('clothing_images').select('bucket, path').eq('item_id', item.id).eq('user_id', userId).eq('kind', 'original').single();
  if (!orig) return fail('This item has no original photo.', 400, 'no_photo');
  const { bytes, mime } = await readOwnFile(userId, orig.bucket, orig.path);
  const visibleText = (item.ai_meta as { visibleText?: string } | null)?.visibleText ?? null;

  const result = await withCredit(userId, 'studio', item.id, () => makeStudio(userId, bytes, mime, { name: item.name, category: item.category, description: item.description, visibleText }), r => !!r.image);
  if (!result.image) {
    return json({ ok: false, issues: result.check?.issues ?? ['The generated photo did not match your item closely enough.'] });
  }
  const ext = result.image.mime.includes('png') ? 'png' : result.image.mime.includes('webp') ? 'webp' : 'jpg';
  const path = `${userId}/${item.id}/studio-${Date.now()}.${ext}`;
  const up = await db.storage.from('studio').upload(path, result.image.bytes, { contentType: result.image.mime, upsert: false });
  if (up.error) return fail('Could not save the studio photo.', 500, 'storage');
  const { data: prev } = await db.from('clothing_images').select('path').eq('item_id', item.id).eq('kind', 'studio').maybeSingle();
  await db.from('clothing_images').upsert({ user_id: userId, item_id: item.id, kind: 'studio', bucket: 'studio', path, model: result.model, checks: result.check }, { onConflict: 'item_id,kind' });
  if (prev?.path) await db.storage.from('studio').remove([prev.path]);
  const { data: signed } = await db.storage.from('studio').createSignedUrl(path, 3600);
  return json({ ok: true, url: signed?.signedUrl, check: result.check, attempts: result.attempts });
});
