'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabaseBrowser } from '@/lib/supabase/client';
import { locationPath, type Item, type LocationRow, type Outfit, type ProfileRow, type WardrobeProfile } from '@/lib/model';
import type { Weather } from '@/lib/weather';

export type Quotas = {
  plan: string; items: number; profiles: number;
  studio: Q; styling: Q; chat: Q; ownit: Q; trip: Q;
};
type Q = { limit: number; used: number; bonus: number; remaining: number };
export type Plan = { id: string; name: string; limits: Record<string, number | string> };

type Store = {
  sb: ReturnType<typeof supabaseBrowser>;
  user: User;
  profile: ProfileRow | null;
  wardrobes: WardrobeProfile[];
  wardrobeId: string;
  items: Item[];
  locations: LocationRow[];
  outfits: Outfit[];
  quotas: Quotas | null;
  plans: Plan[];
  weather: Weather | null;
  loading: boolean;
  byId: (id: string) => Item | undefined;
  reload: () => Promise<void>;
  reloadQuotas: () => Promise<void>;
  setWardrobe: (id: string) => Promise<void>;
  updateProfile: (patch: Partial<ProfileRow>) => Promise<void>;
  patchItem: (id: string, patch: Partial<Item>) => Promise<string | null>;
  deleteItems: (ids: string[]) => Promise<void>;
  saveOutfit: (itemIds: string[], meta?: { title?: string; why?: string; tips?: string; occasion?: string; source?: string; favourite?: boolean }) => Promise<string | null>;
  setOutfitFav: (id: string, fav: boolean) => Promise<void>;
  deleteOutfit: (id: string) => Promise<void>;
  logWear: (itemIds: string[], outfitId?: string | null, date?: string) => Promise<void>;
  refreshWeather: () => Promise<void>;
};

const Ctx = createContext<Store | null>(null);
export const useStore = () => {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore outside StoreProvider');
  return s;
};

async function signAll(sb: ReturnType<typeof supabaseBrowser>, bucket: string, paths: string[]) {
  const out = new Map<string, string>();
  for (let i = 0; i < paths.length; i += 100) {
    const { data } = await sb.storage.from(bucket).createSignedUrls(paths.slice(i, i + 100), 3600);
    data?.forEach(d => { if (d.signedUrl && d.path) out.set(d.path, d.signedUrl); });
  }
  return out;
}

export function StoreProvider({ user, children }: { user: User; children: ReactNode }) {
  const sb = useMemo(() => supabaseBrowser(), []);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [wardrobes, setWardrobes] = useState<WardrobeProfile[]>([]);
  const [wardrobeId, setWardrobeId] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [quotas, setQuotas] = useState<Quotas | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [loading, setLoading] = useState(true);
  const wid = useRef('');

  const reloadQuotas = useCallback(async () => {
    const { data } = await sb.rpc('my_quotas');
    if (data) setQuotas(data as unknown as Quotas);
  }, [sb]);

  const load = useCallback(async (forWardrobe?: string) => {
    const [{ data: prof }, { data: ws }, { data: pl }] = await Promise.all([
      sb.from('profiles').select('*').eq('id', user.id).single(),
      sb.from('wardrobe_profiles').select('*').order('created_at'),
      sb.from('plans').select('id, name, limits').order('sort'),
    ]);
    setProfile(prof);
    setWardrobes(ws ?? []);
    setPlans((pl ?? []) as Plan[]);
    const active = forWardrobe ?? prof?.active_wardrobe_id ?? ws?.find(w => w.is_default)?.id ?? ws?.[0]?.id ?? '';
    wid.current = active;
    setWardrobeId(active);
    if (!active) { setLoading(false); return; }

    const [{ data: rows }, { data: locs }, { data: outs }, { data: imgs }] = await Promise.all([
      sb.from('clothing_items').select('*').eq('wardrobe_profile_id', active).order('created_at', { ascending: false }),
      sb.from('clothing_locations').select('*').eq('wardrobe_profile_id', active).order('sort'),
      sb.from('outfit_combinations').select('*, outfit_items(item_id)').eq('wardrobe_profile_id', active).order('created_at', { ascending: false }).limit(300),
      sb.from('clothing_images').select('item_id, kind, bucket, path'),
    ]);
    const byBucket: Record<string, string[]> = {};
    (imgs ?? []).forEach(i => (byBucket[i.bucket] ??= []).push(i.path));
    const signed = new Map<string, string>();
    for (const [b, paths] of Object.entries(byBucket)) (await signAll(sb, b, paths)).forEach((v, k) => signed.set(k, v));
    const imgOf = (id: string, kind: string) => { const im = imgs?.find(x => x.item_id === id && x.kind === kind); return im ? signed.get(im.path) ?? null : null; };
    const locMap = new Map((locs ?? []).map(l => [l.id, l]));
    setItems((rows ?? []).map(r => {
      const thumbUrl = imgOf(r.id, 'thumb'), originalUrl = imgOf(r.id, 'original'), studioUrl = imgOf(r.id, 'studio');
      return { ...r, thumbUrl, originalUrl, studioUrl, imageUrl: (r.photo_mode === 'studio' && studioUrl) || thumbUrl || originalUrl, locationPath: locationPath(r.location_id, locMap) };
    }));
    setLocations(locs ?? []);
    setOutfits((outs ?? []).map(({ outfit_items, ...o }) => ({ ...o, itemIds: (outfit_items as { item_id: string }[]).map(x => x.item_id) })));
    setLoading(false);
  }, [sb, user.id]);

  const refreshWeather = useCallback(async () => {
    const p = profile;
    if (!p?.lat || !p?.lon) { setWeather(null); return; }
    const key = `drape.weather.${p.lat.toFixed(2)},${p.lon.toFixed(2)}`;
    try {
      const c = JSON.parse(localStorage.getItem(key) ?? 'null');
      if (c && Date.now() - c.at < 30 * 60_000) { setWeather({ ...c.w, place: p.city ?? undefined }); return; }
    } catch { /* storage unavailable */ }
    const res = await fetch(`/api/weather?lat=${p.lat}&lon=${p.lon}`);
    if (!res.ok) return;
    const w = (await res.json()) as Weather;
    setWeather({ ...w, place: p.city ?? undefined });
    try { localStorage.setItem(key, JSON.stringify({ at: Date.now(), w })); } catch { /* ignore */ }
  }, [profile]);

  useEffect(() => { load(); reloadQuotas(); }, [load, reloadQuotas]);
  useEffect(() => { refreshWeather(); }, [refreshWeather]);
  // Signed photo URLs last an hour; refresh quietly before they expire.
  useEffect(() => { const t = setInterval(() => load(wid.current), 50 * 60_000); return () => clearInterval(t); }, [load]);

  const store: Store = {
    sb, user, profile, wardrobes, wardrobeId, items, locations, outfits, quotas, plans, weather, loading,
    byId: id => items.find(i => i.id === id),
    reload: () => load(wid.current),
    reloadQuotas,
    refreshWeather,
    setWardrobe: async id => {
      setLoading(true);
      await sb.from('profiles').update({ active_wardrobe_id: id }).eq('id', user.id);
      await load(id);
    },
    updateProfile: async patch => {
      const { data } = await sb.from('profiles').update(patch).eq('id', user.id).select('*').single();
      if (data) setProfile(data);
    },
    patchItem: async (id, patch) => {
      const { thumbUrl: _a, originalUrl: _b, studioUrl: _c, imageUrl: _d, locationPath: _e, ...row } = patch as Item;
      void _a; void _b; void _c; void _d; void _e;
      const { error } = await sb.from('clothing_items').update(row).eq('id', id);
      if (error) return error.message;
      setItems(list => list.map(i => {
        if (i.id !== id) return i;
        const next = { ...i, ...patch };
        next.imageUrl = (next.photo_mode === 'studio' && next.studioUrl) || next.thumbUrl || next.originalUrl;
        if ('location_id' in patch) next.locationPath = locationPath(next.location_id, new Map(locations.map(l => [l.id, l])));
        return next;
      }));
      return null;
    },
    deleteItems: async ids => {
      const { data: imgs } = await sb.from('clothing_images').select('bucket, path').in('item_id', ids);
      await sb.from('clothing_items').delete().in('id', ids);
      const byB: Record<string, string[]> = {};
      (imgs ?? []).forEach(i => (byB[i.bucket] ??= []).push(i.path));
      for (const [b, paths] of Object.entries(byB)) await sb.storage.from(b).remove(paths);
      setItems(list => list.filter(i => !ids.includes(i.id)));
      reloadQuotas();
    },
    saveOutfit: async (itemIds, meta = {}) => {
      const { data, error } = await sb.from('outfit_combinations').insert({ user_id: user.id, wardrobe_profile_id: wid.current, source: meta.source ?? 'engine', title: meta.title, why: meta.why, tips: meta.tips, occasion: meta.occasion, favourite: meta.favourite ?? false }).select('*').single();
      if (error || !data) return null;
      await sb.from('outfit_items').insert(itemIds.map(item_id => ({ outfit_id: data.id, item_id, user_id: user.id })));
      setOutfits(o => [{ ...data, itemIds }, ...o]);
      return data.id;
    },
    setOutfitFav: async (id, fav) => {
      await sb.from('outfit_combinations').update({ favourite: fav }).eq('id', id);
      setOutfits(o => o.map(x => (x.id === id ? { ...x, favourite: fav } : x)));
    },
    deleteOutfit: async id => {
      await sb.from('outfit_combinations').delete().eq('id', id);
      setOutfits(o => o.filter(x => x.id !== id));
    },
    logWear: async (itemIds, outfitId, date) => {
      const worn_on = date ?? new Date().toLocaleDateString('en-CA');
      await sb.from('wear_history').insert({ user_id: user.id, wardrobe_profile_id: wid.current, item_ids: itemIds, outfit_id: outfitId ?? null, worn_on });
      setItems(list => list.map(i => (itemIds.includes(i.id) ? { ...i, wear_count: i.wear_count + 1, last_worn_on: worn_on, laundry: i.laundry === 'clean' ? 'worn' : i.laundry } : i)));
    },
  };
  return <Ctx value={store}>{children}</Ctx>;
}
