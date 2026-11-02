import 'server-only';
import JSZip from 'jszip';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase/admin';

// What a backup holds: every row the user owns (not billing or AI-usage logs),
// plus the photos when exported as ZIP.
export const BACKUP_TABLES = [
  'wardrobe_profiles', 'clothing_locations', 'clothing_items', 'clothing_images', 'outfit_combinations', 'outfit_items',
  'outfit_calendar', 'wear_history', 'shopping_wishlist', 'trip_plans', 'trip_outfits', 'chat_conversations', 'chat_messages',
] as const;
type Table = (typeof BACKUP_TABLES)[number];
export type Backup = { app: 'drape'; version: 2; exportedAt: string; profile: Record<string, unknown> | null; tables: Partial<Record<Table, Record<string, unknown>[]>> };

export async function collect(userId: string): Promise<Backup> {
  const db = supabaseAdmin();
  const tables: Backup['tables'] = {};
  for (const t of BACKUP_TABLES) {
    const { data } = await db.from(t).select('*').eq('user_id', userId).limit(20000);
    tables[t] = (data ?? []).map(r => { const { search: _search, ...rest } = r as Record<string, unknown>; void _search; return rest; });
  }
  const { data: profile } = await db.from('profiles').select('display_name, preferences, city, units, notify').eq('id', userId).single();
  return { app: 'drape', version: 2, exportedAt: new Date().toISOString(), profile, tables };
}

export async function zipOf(userId: string, backup: Backup) {
  const zip = new JSZip();
  zip.file('wardrobe.json', JSON.stringify(backup, null, 2));
  zip.file('items.csv', toCsv(backup.tables.clothing_items ?? []));
  const db = supabaseAdmin();
  for (const img of (backup.tables.clothing_images ?? []) as { bucket: string; path: string }[]) {
    const { data } = await db.storage.from(img.bucket).download(img.path);
    if (data) zip.file(`images/${img.bucket}/${img.path.slice(userId.length + 1)}`, Buffer.from(await data.arrayBuffer()));
  }
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}

const CSV_COLS = ['name', 'category', 'subcategory', 'brand', 'color', 'color2', 'pattern', 'material', 'seasons', 'occasions', 'description', 'purchase_price', 'purchase_date', 'laundry', 'wear_count', 'last_worn_on', 'favourite', 'created_at'];
export function toCsv(rows: Record<string, unknown>[]) {
  const cell = (v: unknown) => {
    const s = Array.isArray(v) ? v.join('; ') : v == null ? '' : String(v);
    const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s; // no spreadsheet formula injection
    return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  return [CSV_COLS.join(','), ...rows.map(r => CSV_COLS.map(c => cell(r[c])).join(','))].join('\n');
}

/**
 * Restore rows into the same account. Existing rows (same id) are kept as they
 * are; rows are always re-owned by the restoring user, so a backup can't write
 * into someone else's account.
 */
export async function restore(userId: string, backup: Backup, zip?: JSZip) {
  if (backup?.app !== 'drape' || !backup.tables) throw new Error('That file is not a Drape backup.');
  // Table names are dynamic here, so use the untyped client; every row is re-owned below.
  const db = supabaseAdmin() as unknown as SupabaseClient;
  const report: Record<string, number> = {};
  const { data: own } = await db.from('wardrobe_profiles').select('id').eq('user_id', userId);
  const wardrobeIds = new Set((own ?? []).map(w => w.id));
  const fallbackWardrobe = (own ?? [])[0]?.id;
  for (const t of BACKUP_TABLES) {
    let rows: Record<string, unknown>[] = (backup.tables[t] ?? []).map(r => ({ ...r, user_id: userId }));
    if (t === 'wardrobe_profiles') {
      rows = rows.filter(r => !wardrobeIds.has(String(r.id))).map(r => ({ ...r, is_default: false }));
      for (const r of rows) {
        const { error } = await db.from(t).insert(r);
        if (!error) wardrobeIds.add(String(r.id));
      }
      report[t] = rows.length;
      continue;
    }
    if ('wardrobe_profile_id' in (rows[0] ?? {})) rows = rows.map(r => ({ ...r, wardrobe_profile_id: wardrobeIds.has(String(r.wardrobe_profile_id)) ? r.wardrobe_profile_id : fallbackWardrobe }));
    if (t === 'clothing_images') {
      rows = rows.map(r => ({ ...r, path: `${userId}/${String(r.path).split('/').slice(1).join('/')}` }));
      if (zip) for (const r of rows as unknown as { bucket: string; path: string }[]) {
        const f = zip.file(`images/${r.bucket}/${r.path.slice(userId.length + 1)}`);
        if (f) await db.storage.from(r.bucket).upload(r.path, Buffer.from(await f.async('uint8array')), { upsert: true, contentType: r.path.endsWith('.png') ? 'image/png' : 'image/jpeg' });
      }
    }
    let ok = 0;
    for (let i = 0; i < rows.length; i += 200) {
      const { data, error } = await db.from(t).upsert(rows.slice(i, i + 200), { onConflict: t === 'outfit_items' ? 'outfit_id,item_id' : t === 'trip_outfits' ? 'trip_id,outfit_id' : t === 'clothing_images' ? 'item_id,kind' : 'id', ignoreDuplicates: true }).select('user_id');
      if (error) { report[`${t}_error`] = 1; console.error('[restore]', t, error.message); break; }
      ok += data?.length ?? 0;
    }
    report[t] = ok;
  }
  return report;
}
