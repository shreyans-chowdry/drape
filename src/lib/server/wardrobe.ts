import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import type { WardrobeRow } from '@/lib/ai/features';

// Server-side reads always filter by the verified user id, even with the service role.

export async function activeWardrobe(userId: string, requested?: string | null) {
  const db = supabaseAdmin();
  const { data: list } = await db.from('wardrobe_profiles').select('id, name, is_default').eq('user_id', userId);
  if (!list?.length) throw new Error('no wardrobe');
  if (requested && list.some(w => w.id === requested)) return requested;
  const { data: p } = await db.from('profiles').select('active_wardrobe_id').eq('id', userId).single();
  return list.find(w => w.id === p?.active_wardrobe_id)?.id ?? list.find(w => w.is_default)?.id ?? list[0].id;
}

export async function wardrobeRows(userId: string, wardrobeId: string): Promise<WardrobeRow[]> {
  const db = supabaseAdmin();
  const [{ data: items }, { data: locs }] = await Promise.all([
    db.from('clothing_items').select('id, name, category, subcategory, brand, color, color2, pattern, material, formality, warmth, seasons, occasions, description, fingerprint, laundry, wear_count, last_worn_on, favourite, location_id')
      .eq('user_id', userId).eq('wardrobe_profile_id', wardrobeId).limit(1500),
    db.from('clothing_locations').select('id, name, parent_id').eq('user_id', userId).eq('wardrobe_profile_id', wardrobeId),
  ]);
  const byId = new Map((locs ?? []).map(l => [l.id, l]));
  const path = (id: string | null) => {
    const parts: string[] = [];
    for (let cur = id ? byId.get(id) : undefined, guard = 0; cur && guard < 8; cur = cur.parent_id ? byId.get(cur.parent_id) : undefined, guard++) parts.unshift(cur.name);
    return parts.join(' › ') || null;
  };
  return (items ?? []).map(({ location_id, ...i }) => ({ ...i, location: path(location_id) }));
}

export async function profileText(userId: string) {
  const { data } = await supabaseAdmin().from('profiles').select('preferences').eq('id', userId).single();
  const p = (data?.preferences ?? {}) as Record<string, string[] | string>;
  return Object.entries(p).filter(([, v]) => (Array.isArray(v) ? v.length : v)).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join('; ');
}

/** Download a file the user owns from a private bucket. The path must start with their id. */
export async function readOwnFile(userId: string, bucket: string, path: string) {
  if (!path.startsWith(`${userId}/`) || path.includes('..')) throw Object.assign(new Error('forbidden'), { status: 403 });
  const { data, error } = await supabaseAdmin().storage.from(bucket).download(path);
  if (error || !data) throw Object.assign(new Error('not found'), { status: 404 });
  const bytes = Buffer.from(await data.arrayBuffer());
  if (bytes.length > 12 * 1024 * 1024) throw Object.assign(new Error('too large'), { status: 413 });
  const mime = data.type || 'image/jpeg';
  if (!/^image\/(jpeg|png|webp)$/.test(mime)) throw Object.assign(new Error('bad type'), { status: 415 });
  return { bytes, mime };
}
