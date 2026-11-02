import type { Database } from '@/lib/database.types';
import type { Category, EngineItem } from '@/lib/engine';

export type Tables = Database['public']['Tables'];
export type ItemRow = Tables['clothing_items']['Row'];
export type LocationRow = Tables['clothing_locations']['Row'];
export type OutfitRow = Tables['outfit_combinations']['Row'];
export type ProfileRow = Tables['profiles']['Row'];
export type WardrobeProfile = Tables['wardrobe_profiles']['Row'];

/** An item as the UI uses it: the row plus signed photo URLs and its storage path. */
export type Item = ItemRow & {
  thumbUrl: string | null;
  originalUrl: string | null;
  studioUrl: string | null;
  /** What to show: the approved studio photo if chosen, else the cropped thumb/original. */
  imageUrl: string | null;
  locationPath: string | null;
};

export type Outfit = OutfitRow & { itemIds: string[] };

export const LAUNDRY = [
  { id: 'clean', label: 'Clean' }, { id: 'worn', label: 'Worn' },
  { id: 'in_laundry', label: 'In laundry' }, { id: 'unavailable', label: 'Unavailable' },
] as const;

export const isAvailable = (i: Pick<ItemRow, 'laundry'>) => i.laundry === 'clean' || i.laundry === 'worn';

export function toEngine(i: Item): EngineItem & Item {
  return {
    ...i,
    category: i.category as Category,
    type: i.subcategory,
    lastWorn: i.last_worn_on ? new Date(i.last_worn_on + 'T12:00:00').getTime() : null,
    wearCount: i.wear_count,
    fav: i.favourite,
    unavailable: !isAvailable(i),
  } as EngineItem & Item;
}

export function locationPath(id: string | null, byId: Map<string, LocationRow>) {
  const parts: string[] = [];
  for (let cur = id ? byId.get(id) : undefined, n = 0; cur && n < 8; cur = cur.parent_id ? byId.get(cur.parent_id) : undefined, n++) parts.unshift(cur.name);
  return parts.length ? parts.join(' › ') : null;
}

export const costPerWear = (i: Pick<ItemRow, 'purchase_price' | 'wear_count'>) =>
  i.purchase_price != null ? Number(i.purchase_price) / Math.max(1, i.wear_count) : null;

export const inr = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: n < 100 ? 2 : 0 }).format(n);

export const fmtRange = (a: string, b: string) => {
  const o: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  return a === b ? new Date(a).toLocaleDateString('en-IN', o) : `${new Date(a).toLocaleDateString('en-IN', o)} – ${new Date(b).toLocaleDateString('en-IN', o)}`;
};
