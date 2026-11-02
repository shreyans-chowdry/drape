'use client';
import { useMemo, useState } from 'react';
import { CheckSquare, Heart, LayoutGrid, Plus, Search, SlidersHorizontal, Trash2 } from 'lucide-react';
import { CATEGORIES, colorById, COLORS, OCCASIONS, SEASONS } from '@/lib/engine';
import { costPerWear, LAUNDRY } from '@/lib/model';
import { Button, Chip, cx, Empty, Input, LinkButton, PageHeader, Select, Sheet, useToast } from '@/components/ui';
import { ItemTile } from '@/components/app/items';
import { useStore } from '@/components/app/store';

const SORTS = {
  recent: { label: 'Recently added', fn: (a: { created_at: string }, b: { created_at: string }) => b.created_at.localeCompare(a.created_at) },
  name: { label: 'Name', fn: (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name) },
  most: { label: 'Most worn', fn: (a: { wear_count: number }, b: { wear_count: number }) => b.wear_count - a.wear_count },
  least: { label: 'Least worn', fn: (a: { wear_count: number }, b: { wear_count: number }) => a.wear_count - b.wear_count },
  cpw: { label: 'Cost per wear', fn: (a: Parameters<typeof costPerWear>[0], b: Parameters<typeof costPerWear>[0]) => (costPerWear(b) ?? -1) - (costPerWear(a) ?? -1) },
} as const;

export default function WardrobePage() {
  const { items, loading, deleteItems, patchItem, quotas } = useStore();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const [fav, setFav] = useState(false);
  const [sort, setSort] = useState<keyof typeof SORTS>('recent');
  const [filters, setFilters] = useState({ brand: '', color: '', season: '', occasion: '', laundry: '' });
  const [showFilters, setShowFilters] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [confirm, setConfirm] = useState(false);

  const brands = useMemo(() => [...new Set(items.map(i => i.brand).filter(Boolean) as string[])].sort(), [items]);
  const list = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return items.filter(i =>
      (cat === 'all' || i.category === cat) && (!fav || i.favourite) &&
      (!filters.brand || i.brand === filters.brand) && (!filters.color || i.color === filters.color || i.color2 === filters.color) &&
      (!filters.season || i.seasons.includes(filters.season) || i.seasons.includes('all')) && (!filters.occasion || i.occasions.includes(filters.occasion)) &&
      (!filters.laundry || i.laundry === filters.laundry) &&
      words.every(w => `${i.name} ${i.brand ?? ''} ${i.color ?? ''} ${i.subcategory} ${i.description ?? ''} ${i.fingerprint ?? ''} ${i.keywords.join(' ')} ${i.locationPath ?? ''}`.toLowerCase().includes(w)),
    ).sort(SORTS[sort].fn as (a: typeof items[0], b: typeof items[0]) => number);
  }, [items, q, cat, fav, filters, sort]);
  const activeFilters = Object.values(filters).filter(Boolean).length;
  const limit = quotas ? (quotas.plan === 'free' ? 30 : quotas.plan === 'plus' ? 300 : 1000) : null;

  return (
    <>
      <PageHeader eyebrow={`${items.length} piece${items.length === 1 ? '' : 's'}${limit ? ` · ${limit} on your plan` : ''}`} title="Wardrobe"
        actions={<>
          <Button variant="secondary" onClick={() => { setSelecting(s => !s); setSelected([]); }}><CheckSquare className="size-4" /> {selecting ? 'Done' : 'Select'}</Button>
          <LinkButton href="/app/add"><Plus className="size-4" /> Add</LinkButton>
        </>} />

      <div className="mb-4 flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <Input aria-label="Search" placeholder="Search name, brand, colour, place…" value={q} onChange={e => setQ(e.target.value)} className="pl-9" />
        </div>
        <Button variant="secondary" onClick={() => setShowFilters(true)} aria-label="Filters and sorting">
          <SlidersHorizontal className="size-4" /><span className="hidden sm:inline">Filter</span>{activeFilters ? ` · ${activeFilters}` : ''}
        </Button>
      </div>
      <div className="no-scrollbar -mx-4 mb-5 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
        <Chip active={cat === 'all'} onClick={() => setCat('all')}>All</Chip>
        {CATEGORIES.map(c => <Chip key={c.id} active={cat === c.id} onClick={() => setCat(c.id)}>{c.label} <span className="text-xs opacity-60">{items.filter(i => i.category === c.id).length}</span></Chip>)}
        <Chip active={fav} onClick={() => setFav(f => !f)}><Heart className="size-3.5" /> Favourites</Chip>
      </div>

      {selecting && (
        <div className="sticky top-16 z-20 mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-card p-2 pl-4 shadow-soft lg:top-4">
          <span className="text-sm">{selected.length} selected</span>
          <button className="text-sm text-accent underline-offset-2 hover:underline" onClick={() => setSelected(selected.length === list.length ? [] : list.map(i => i.id))}>{selected.length === list.length ? 'Clear' : 'Select all'}</button>
          <div className="ml-auto flex gap-2">
            <Select aria-label="Set laundry status" className="h-9 w-auto text-sm" value="" disabled={!selected.length}
              onChange={async e => { const v = e.target.value as typeof LAUNDRY[number]['id']; for (const id of selected) await patchItem(id, { laundry: v }); toast(`Marked ${selected.length} as ${LAUNDRY.find(l => l.id === v)?.label.toLowerCase()}`); }}>
              <option value="" disabled>Laundry…</option>
              {LAUNDRY.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
            </Select>
            <Button size="sm" variant="danger" disabled={!selected.length} onClick={() => setConfirm(true)}><Trash2 className="size-4" /> Delete</Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">{Array.from({ length: 10 }, (_, i) => <div key={i} className="skeleton aspect-[4/6] rounded-2xl" />)}</div>
      ) : !items.length ? (
        <Empty icon={<LayoutGrid className="size-6" />} title="Your wardrobe is empty" action={<LinkButton href="/app/add">Add your first pieces</LinkButton>}>
          Photograph clothes one at a time or lay several out together — Drape detects each piece.
        </Empty>
      ) : !list.length ? (
        <p className="py-16 text-center text-muted">Nothing matches those filters.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {list.map(i => (
            <ItemTile key={i.id} item={i} selected={selecting ? selected.includes(i.id) : undefined}
              onSelect={selecting ? () => setSelected(s => (s.includes(i.id) ? s.filter(x => x !== i.id) : [...s, i.id])) : undefined}>
              {sort === 'cpw' && costPerWear(i) != null && <div className="mt-1 text-xs text-muted">₹{Math.round(costPerWear(i)!)} per wear</div>}
            </ItemTile>
          ))}
        </div>
      )}

      <Sheet open={showFilters} onClose={() => setShowFilters(false)} title="Filter and sort"
        footer={<div className="flex gap-2"><Button variant="secondary" onClick={() => setFilters({ brand: '', color: '', season: '', occasion: '', laundry: '' })}>Clear</Button><Button block onClick={() => setShowFilters(false)}>Show {list.length}</Button></div>}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Labeled label="Sort by"><Select value={sort} onChange={e => setSort(e.target.value as keyof typeof SORTS)}>{Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</Select></Labeled>
          <Labeled label="Brand"><Select value={filters.brand} onChange={e => setFilters(f => ({ ...f, brand: e.target.value }))}><option value="">Any</option>{brands.map(b => <option key={b}>{b}</option>)}</Select></Labeled>
          <Labeled label="Season"><Select value={filters.season} onChange={e => setFilters(f => ({ ...f, season: e.target.value }))}><option value="">Any</option>{SEASONS.filter(s => s.id !== 'all').map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</Select></Labeled>
          <Labeled label="Occasion"><Select value={filters.occasion} onChange={e => setFilters(f => ({ ...f, occasion: e.target.value }))}><option value="">Any</option>{OCCASIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}</Select></Labeled>
          <Labeled label="Laundry"><Select value={filters.laundry} onChange={e => setFilters(f => ({ ...f, laundry: e.target.value }))}><option value="">Any</option>{LAUNDRY.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}</Select></Labeled>
        </div>
        <div className="mt-5">
          <div className="mb-2 text-sm font-medium text-ink-2">Colour</div>
          <div className="flex flex-wrap gap-2">
            {COLORS.filter(c => items.some(i => i.color === c.id || i.color2 === c.id)).map(c => (
              <button key={c.id} onClick={() => setFilters(f => ({ ...f, color: f.color === c.id ? '' : c.id }))} aria-pressed={filters.color === c.id}
                className={cx('flex h-9 items-center gap-2 rounded-full border px-3 text-sm', filters.color === c.id ? 'border-ink' : 'border-line')}>
                <span className="size-4 rounded-full border border-line" style={{ background: colorById(c.id).hex }} />{c.label}
              </button>
            ))}
          </div>
        </div>
      </Sheet>

      <Sheet open={confirm} onClose={() => setConfirm(false)} title={`Delete ${selected.length} piece${selected.length === 1 ? '' : 's'}?`}
        footer={<div className="flex gap-2"><Button variant="secondary" block onClick={() => setConfirm(false)}>Cancel</Button><Button variant="danger" block onClick={async () => { await deleteItems(selected); toast(`Deleted ${selected.length}`); setSelected([]); setConfirm(false); setSelecting(false); }}>Delete permanently</Button></div>}>
        <p className="text-sm text-ink-2">Their photos are deleted too, and they’re removed from saved outfits. This can’t be undone — export a backup first if you might want them back.</p>
      </Sheet>
    </>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="flex flex-col gap-1.5 text-sm font-medium text-ink-2">{label}{children}</label>;
}
