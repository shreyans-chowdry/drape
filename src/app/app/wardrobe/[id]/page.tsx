'use client';
import Link from 'next/link';
import { use, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Heart, Loader2, Shirt, Sparkles, Trash2 } from 'lucide-react';
import { CATEGORIES, COLORS, OCCASIONS, PATTERNS, SEASONS, suggestFor, TYPES, type Category } from '@/lib/engine';
import { costPerWear, inr, isAvailable, LAUNDRY, toEngine, type Item } from '@/lib/model';
import { api, ApiError } from '@/lib/api-client';
import { Badge, Button, Card, Chip, cx, Empty, Field, IconButton, Input, Segmented, Select, Sheet, Textarea, useToast } from '@/components/ui';
import { ItemImage, ItemTile, typeLabel } from '@/components/app/items';
import { LocationSelect } from '@/components/app/locations';
import { useStore } from '@/components/app/store';

type Draft = Pick<Item, 'name' | 'category' | 'subcategory' | 'brand' | 'color' | 'color2' | 'pattern' | 'material' | 'seasons' | 'occasions' | 'formality' | 'warmth' | 'description' | 'fingerprint' | 'purchase_price' | 'purchase_date' | 'location_id' | 'laundry'>;

export default function ItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { byId, items, loading, patchItem, deleteItems, logWear, quotas, reloadQuotas, reload } = useStore();
  const item = byId(id);
  const router = useRouter();
  const toast = useToast();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [studioBusy, setStudioBusy] = useState(false);
  const [preview, setPreview] = useState<{ url: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (item && !draft) setDraft({
      name: item.name, category: item.category, subcategory: item.subcategory, brand: item.brand, color: item.color, color2: item.color2,
      pattern: item.pattern, material: item.material, seasons: item.seasons, occasions: item.occasions, formality: item.formality, warmth: item.warmth,
      description: item.description, fingerprint: item.fingerprint, purchase_price: item.purchase_price, purchase_date: item.purchase_date,
      location_id: item.location_id, laundry: item.laundry,
    });
  }, [item, draft]);

  const pairs = useMemo(() => {
    if (!item) return [];
    const pool = items.filter(isAvailable).map(toEngine);
    const { groups } = suggestFor(toEngine(item), pool);
    return Object.values(groups).flatMap(g => (g ?? []).slice(0, 2)).sort((a, b) => b.s - a.s).slice(0, 6).map(r => r.item as unknown as Item);
  }, [item, items]);

  if (loading) return <div className="skeleton h-96 rounded-2xl" />;
  if (!item || !draft) return <Empty title="This piece isn’t in your wardrobe" action={<Button onClick={() => router.push('/app/wardrobe')}>Back to wardrobe</Button>}>It may have been deleted, or it belongs to another wardrobe profile.</Empty>;

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft(d => (d ? { ...d, [k]: v } : d));
  const toggle = (k: 'seasons' | 'occasions', v: string) => set(k, draft[k].includes(v) ? draft[k].filter(x => x !== v) : [...draft[k], v]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(Object.fromEntries(Object.keys(draft).map(k => [k, item[k as keyof Draft]])));

  const save = async () => {
    if (!draft.name.trim()) { toast('Give it a name first.', { tone: 'bad' }); return; }
    setSaving(true);
    const err = await patchItem(item.id, { ...draft, name: draft.name.trim(), needs_review: false });
    setSaving(false);
    toast(err ? 'Could not save your changes.' : 'Saved', { tone: err ? 'bad' : 'good' });
  };

  const makeStudio = async () => {
    setStudioBusy(true);
    try {
      const r = await api<{ ok: boolean; url?: string; issues?: string[] }>('/api/ai/studio', { itemId: item.id });
      if (r.ok && r.url) setPreview({ url: r.url });
      else toast(`We kept your original photo: ${r.issues?.[0] ?? 'the result didn’t match closely enough'}. No credit was used.`, { tone: 'bad' });
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Studio photo failed. No credit was used.', { tone: 'bad' });
    } finally { setStudioBusy(false); reloadQuotas(); }
  };

  const cpw = costPerWear(item);
  return (
    <>
      <div className="mb-4 flex items-center gap-2">
        <IconButton label="Back" onClick={() => router.back()}><ArrowLeft className="size-5" /></IconButton>
        <h1 className="min-w-0 flex-1 truncate font-serif text-2xl sm:text-3xl">{item.name}</h1>
        <IconButton label={item.favourite ? 'Remove from favourites' : 'Add to favourites'} onClick={() => patchItem(item.id, { favourite: !item.favourite })}>
          <Heart className={cx('size-5', item.favourite && 'fill-accent text-accent')} />
        </IconButton>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
        <div className="space-y-4">
          <Card className="overflow-hidden"><ItemImage item={item} sizes="(min-width:1024px) 420px, 100vw" /></Card>
          {(item.studioUrl || item.originalUrl) && (
            <Segmented label="Photo shown" value={item.photo_mode as 'studio' | 'original'} onChange={v => patchItem(item.id, { photo_mode: v })}
              options={[{ value: 'original', label: 'Original' }, ...(item.studioUrl ? [{ value: 'studio' as const, label: 'Studio' }] : [])]} />
          )}
          <Card className="p-4 text-sm">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 size-5 shrink-0 text-accent" />
              <div className="flex-1">
                <b>{item.studioUrl ? 'Remake the studio photo' : 'Make a studio photo'}</b>
                <p className="mt-0.5 text-muted">A clean, consistent product shot of this exact piece. 1 credit, only charged if it passes our match check. {quotas ? `${quotas.studio.remaining} left.` : ''}</p>
                <Button size="sm" className="mt-3" onClick={makeStudio} disabled={studioBusy || !item.originalUrl || (quotas?.studio.remaining ?? 0) < 1}>
                  {studioBusy ? <><Loader2 className="size-4 animate-spin" /> Creating… (up to a minute)</> : 'Create studio photo'}
                </Button>
              </div>
            </div>
          </Card>
          <Card className="grid grid-cols-3 divide-x divide-line text-center">
            <Stat label="Worn" value={`${item.wear_count}×`} />
            <Stat label="Last worn" value={item.last_worn_on ? new Date(item.last_worn_on).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'} />
            <Stat label="Cost / wear" value={cpw != null ? inr(cpw) : '—'} />
          </Card>
          <Button variant="secondary" block onClick={async () => { await logWear([item.id]); toast('Logged as worn today', { tone: 'good' }); }}><Shirt className="size-4" /> I wore this today</Button>
        </div>

        <div className="space-y-4">
          {item.needs_review && <div className="rounded-2xl bg-warn-soft p-4 text-sm text-warn">Please check these details — they were read from a photo with several pieces or a less clear shot.</div>}
          <Card className="grid gap-4 p-4 sm:grid-cols-2 sm:p-6">
            <Field label="Name" className="sm:col-span-2">{id => <Input id={id} value={draft.name} maxLength={120} onChange={e => set('name', e.target.value)} />}</Field>
            <Field label="Category">{id => (
              <Select id={id} value={draft.category} onChange={e => { const c = e.target.value as Category; setDraft(d => d && { ...d, category: c, subcategory: Object.keys(TYPES[c])[0] }); }}>
                {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.one}</option>)}
              </Select>
            )}</Field>
            <Field label="Type">{id => (
              <Select id={id} value={draft.subcategory} onChange={e => set('subcategory', e.target.value)}>
                {Object.entries(TYPES[draft.category as Category] ?? {}).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}
              </Select>
            )}</Field>
            <Field label="Main colour">{id => <ColorSelect id={id} value={draft.color} onChange={v => set('color', v)} />}</Field>
            <Field label="Second colour">{id => <ColorSelect id={id} value={draft.color2} onChange={v => set('color2', v)} allowNone />}</Field>
            <Field label="Pattern">{id => (
              <Select id={id} value={draft.pattern} onChange={e => set('pattern', e.target.value)}>{PATTERNS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}</Select>
            )}</Field>
            <Field label="Material" hint="Only if you know it">{id => <Input id={id} value={draft.material ?? ''} onChange={e => set('material', e.target.value || null)} placeholder="e.g. Cotton" />}</Field>
            <Field label="Brand">{id => <Input id={id} value={draft.brand ?? ''} onChange={e => set('brand', e.target.value || null)} />}</Field>
            <Field label="Laundry">{id => (
              <Select id={id} value={draft.laundry} onChange={e => set('laundry', e.target.value as Draft['laundry'])}>{LAUNDRY.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}</Select>
            )}</Field>
            <Field label="Purchase price (₹)">{id => <Input id={id} type="number" min={0} inputMode="decimal" value={draft.purchase_price ?? ''} onChange={e => set('purchase_price', e.target.value === '' ? null : Math.max(0, Number(e.target.value)))} />}</Field>
            <Field label="Purchase date">{id => <Input id={id} type="date" max={new Date().toLocaleDateString('en-CA')} value={draft.purchase_date ?? ''} onChange={e => set('purchase_date', e.target.value || null)} />}</Field>
            <Field label={`Formality: ${['', 'Lounge', 'Casual', 'Smart casual', 'Smart', 'Formal'][draft.formality]}`}>{id => <input id={id} type="range" min={1} max={5} value={draft.formality} onChange={e => set('formality', Number(e.target.value))} className="w-full accent-[var(--accent)]" />}</Field>
            <Field label={`Warmth: ${['', 'Very light', 'Light', 'Medium', 'Warm', 'Very warm'][draft.warmth]}`}>{id => <input id={id} type="range" min={1} max={5} value={draft.warmth} onChange={e => set('warmth', Number(e.target.value))} className="w-full accent-[var(--accent)]" />}</Field>
            <fieldset className="sm:col-span-2"><legend className="mb-2 text-sm font-medium">Seasons</legend>
              <div className="flex flex-wrap gap-2">{SEASONS.map(s => <Chip key={s.id} active={draft.seasons.includes(s.id)} onClick={() => toggle('seasons', s.id)} aria-pressed={draft.seasons.includes(s.id)}>{s.label}</Chip>)}</div>
            </fieldset>
            <fieldset className="sm:col-span-2"><legend className="mb-2 text-sm font-medium">Occasions</legend>
              <div className="flex flex-wrap gap-2">{OCCASIONS.map(o => <Chip key={o.id} active={draft.occasions.includes(o.id)} onClick={() => toggle('occasions', o.id)} aria-pressed={draft.occasions.includes(o.id)}>{o.label}</Chip>)}</div>
            </fieldset>
            <Field label="Where it’s kept" className="sm:col-span-2">{id => <LocationSelect id={id} value={draft.location_id} onChange={v => set('location_id', v)} />}</Field>
            <Field label="Description" className="sm:col-span-2">{id => <Textarea id={id} maxLength={600} value={draft.description ?? ''} onChange={e => set('description', e.target.value || null)} />}</Field>
            <Field label="How to tell it apart" hint="Helps find it in your closet and match it in shops" className="sm:col-span-2">{id => <Input id={id} maxLength={200} value={draft.fingerprint ?? ''} onChange={e => set('fingerprint', e.target.value || null)} />}</Field>
          </Card>
          <div className="sticky bottom-20 z-10 flex gap-2 lg:bottom-4">
            <Button className="flex-1 shadow-lift" onClick={save} loading={saving} disabled={!dirty && !item.needs_review}>{item.needs_review && !dirty ? 'Looks right' : 'Save changes'}</Button>
            <Button variant="ghost" className="bg-card shadow-soft" onClick={() => setConfirmDelete(true)}><Trash2 className="size-4" /> Delete</Button>
          </div>

          {pairs.length > 0 && (
            <section>
              <h2 className="mb-3 font-serif text-xl">Goes well with</h2>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-6 lg:grid-cols-3 xl:grid-cols-6">{pairs.map(p => <ItemTile key={p.id} item={p} href={`/app/wardrobe/${p.id}`} />)}</div>
              <Link href={`/app/match?item=${item.id}`} className="mt-3 inline-block text-sm text-accent">Build full outfits around it →</Link>
            </section>
          )}
        </div>
      </div>

      <Sheet open={!!preview} onClose={() => setPreview(null)} title="Original or studio?" wide footer={
        <div className="flex gap-2">
          <Button variant="secondary" block onClick={async () => { await patchItem(item.id, { photo_mode: 'original' }); await reload(); setPreview(null); }}>Keep original</Button>
          <Button block onClick={async () => { await patchItem(item.id, { photo_mode: 'studio', studioUrl: preview!.url }); setPreview(null); toast('Studio photo in use', { tone: 'good' }); }}>Use studio photo</Button>
        </div>
      }>
        <div className="grid grid-cols-2 gap-3">
          <figure><div className="overflow-hidden rounded-xl border border-line"><ItemImage item={{ ...item, imageUrl: item.originalUrl }} /></div><figcaption className="mt-1.5 text-center text-sm text-muted">Original</figcaption></figure>
          <figure><div className="overflow-hidden rounded-xl border border-line"><ItemImage item={{ ...item, imageUrl: preview?.url ?? null }} /></div><figcaption className="mt-1.5 text-center text-sm text-muted">Studio</figcaption></figure>
        </div>
        <p className="mt-3 text-sm text-muted">You can switch between them any time.</p>
      </Sheet>

      <Sheet open={confirmDelete} onClose={() => setConfirmDelete(false)} title={`Delete ${item.name}?`} footer={
        <div className="flex gap-2">
          <Button variant="secondary" block onClick={() => setConfirmDelete(false)}>Cancel</Button>
          <Button variant="danger" block onClick={async () => { await deleteItems([item.id]); router.replace('/app/wardrobe'); toast('Deleted'); }}>Delete</Button>
        </div>
      }>
        <p className="text-sm text-ink-2">The piece, its photos and its wear history are removed. Saved outfits that used it lose this piece. This can’t be undone.</p>
        <p className="mt-2 text-sm"><Badge>{typeLabel(item)}</Badge></p>
      </Sheet>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="p-3"><div className="font-serif text-lg">{value}</div><div className="text-xs text-muted">{label}</div></div>;
}

function ColorSelect({ id, value, onChange, allowNone }: { id: string; value: string | null; onChange: (v: string | null) => void; allowNone?: boolean }) {
  return (
    <Select id={id} value={value ?? ''} onChange={e => onChange(e.target.value || null)}>
      {allowNone && <option value="">None</option>}
      {COLORS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
    </Select>
  );
}
