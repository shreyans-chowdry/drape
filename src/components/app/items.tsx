'use client';
import Link from 'next/link';
import { useMemo, useState, type ReactNode } from 'react';
import { CalendarPlus, Check, Heart, MapPin, Repeat2, Search, Shirt } from 'lucide-react';
import { CATEGORIES, colorById, pairScore, TYPES, type Category } from '@/lib/engine';
import { isAvailable, toEngine, type Item } from '@/lib/model';
import { Badge, Button, Card, Chip, cx, IconButton, Input, Sheet } from '@/components/ui';
import { Garment, garmentKind } from '@/components/garments';

export const typeLabel = (i: Pick<Item, 'category' | 'subcategory'>) => TYPES[i.category as Category]?.[i.subcategory]?.label ?? i.subcategory;
const ORDER: string[] = ['outer', 'top', 'onepiece', 'bottom', 'shoes', 'accessory'];
export const byOutfitOrder = <T extends Pick<Item, 'category'>>(list: T[]) => [...list].sort((a, b) => ORDER.indexOf(a.category) - ORDER.indexOf(b.category));

/**
 * The one way an item photo is drawn: fixed aspect box, whole garment visible
 * (object-contain) on the studio backdrop, so no photo is ever stretched or cropped.
 */
export function ItemImage({ item, className, ratio = 'aspect-[4/5]', sizes }: { item: Pick<Item, 'imageUrl' | 'name' | 'category' | 'subcategory' | 'color'>; className?: string; ratio?: string; sizes?: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={cx('relative w-full overflow-hidden bg-studio', ratio, className)}>
      {item.imageUrl && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element -- signed private URLs, already sized
        <img src={item.imageUrl} alt={item.name} loading="lazy" decoding="async" sizes={sizes} onError={() => setFailed(true)}
          className="absolute inset-0 size-full object-contain p-[6%] mix-blend-multiply" />
      ) : (
        <Garment kind={garmentKind(item.category, item.subcategory)} color={item.color ?? undefined} title={item.name} className="absolute inset-0 m-auto h-3/4 w-3/4 opacity-90" />
      )}
    </div>
  );
}

export function ItemTile({ item, href, selected, onSelect, children }: { item: Item; href?: string; selected?: boolean; onSelect?: () => void; children?: ReactNode }) {
  const body = (
    <>
      <div className="relative">
        <ItemImage item={item} sizes="(min-width:1024px) 20vw, 45vw" />
        <div className="absolute left-2 top-2 flex gap-1">
          {item.needs_review && <Badge tone="accent">Review</Badge>}
          {!isAvailable(item) && <Badge tone="warn">{item.laundry === 'in_laundry' ? 'Laundry' : 'Away'}</Badge>}
        </div>
        {item.favourite && <Heart className="absolute right-2.5 top-2.5 size-4 fill-accent text-accent" />}
        {selected != null && (
          <span className={cx('absolute bottom-2 right-2 flex size-6 items-center justify-center rounded-full border-2', selected ? 'border-ink bg-ink text-paper' : 'border-white/90 bg-white/60')}>
            {selected && <Check className="size-3.5" />}
          </span>
        )}
      </div>
      <div className="px-3 pb-3 pt-2.5">
        <div className="truncate text-sm font-medium">{item.name}</div>
        <div className="truncate text-xs text-muted">{[item.brand, typeLabel(item)].filter(Boolean).join(' · ')}</div>
        {children}
      </div>
    </>
  );
  const cls = cx('group block overflow-hidden rounded-2xl border bg-card text-left transition hover:shadow-soft', selected ? 'border-ink' : 'border-line');
  if (onSelect) return <button type="button" onClick={onSelect} className={cls} aria-pressed={selected}>{body}</button>;
  return <Link href={href ?? `/app/wardrobe/${item.id}`} className={cls}>{body}</Link>;
}

export type OutfitView = { key: string; pieces: Item[]; title?: string; why?: string; tip?: string; reasons?: { t: string; good: boolean }[]; score?: number; badges?: string[] };

/**
 * The outfit card used everywhere (Today, Stylist, Match, Chat, Trips, Favourites).
 * One fixed 2×2 tile grid of equal squares + text, as a full-height flex column,
 * so cards in a row always line up and photos never stretch.
 */
export function OutfitCard({ look, onWear, onSave, saved, onSwap, onPlan, onWhere, footer, compact }: {
  look: OutfitView; onWear?: () => void; onSave?: () => void; saved?: boolean; onSwap?: (piece: Item) => void; onPlan?: () => void; onWhere?: () => void; footer?: ReactNode; compact?: boolean;
}) {
  const pieces = byOutfitOrder(look.pieces);
  const shown = pieces.slice(0, 4);
  const extra = pieces.length - shown.length;
  return (
    <Card className="flex h-full flex-col overflow-hidden">
      {/* Always a square: 1 piece fills it, 2 split it, 3 = one tall + two stacked, 4 = 2×2. */}
      <div className={cx('grid aspect-square gap-px bg-line', shown.length === 1 ? 'grid-cols-1' : 'grid-cols-2', shown.length >= 3 && 'grid-rows-2')}>
        {shown.map((p, idx) => (
          <div key={p.id} className={cx('relative min-h-0 bg-studio', shown.length === 3 && idx === 0 && 'row-span-2')}>
            <ItemImage item={p} ratio="h-full" sizes="(min-width:1024px) 15vw, 45vw" />
            {onSwap && (
              <button onClick={() => onSwap(p)} aria-label={`Swap ${p.name}`} className="absolute right-1.5 top-1.5 flex size-8 items-center justify-center rounded-full bg-card/90 text-ink-2 shadow-soft transition hover:text-ink">
                <Repeat2 className="size-4" />
              </button>
            )}
            {idx === shown.length - 1 && extra > 0 && <span className="absolute bottom-1.5 right-1.5 rounded-full bg-ink/80 px-2 py-0.5 text-xs text-paper">+{extra}</span>}
          </div>
        ))}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-serif text-lg leading-snug">{look.title ?? pieces.slice(0, 2).map(p => p.name).join(' + ')}</h3>
          {look.score != null && <Badge tone={look.score >= 70 ? 'good' : look.score >= 50 ? 'neutral' : 'warn'}>{look.score}%</Badge>}
        </div>
        <ul className="mt-2 space-y-0.5 text-[13px] text-ink-2">
          {pieces.map(p => (
            <li key={p.id} className="flex items-center gap-2">
              <span className="size-2.5 shrink-0 rounded-full border border-line" style={{ background: colorById(p.color).hex.startsWith('#') ? colorById(p.color).hex : undefined }} />
              <span className="truncate">{p.name}</span>
            </li>
          ))}
        </ul>
        {!compact && (look.why || look.reasons?.length) && (
          <div className="mt-3 border-t border-line pt-3 text-[13px] leading-relaxed text-muted">
            {look.why ?? look.reasons!.filter(r => r.good).slice(0, 2).map(r => r.t).join('. ')}
            {look.tip && <p className="mt-1.5 text-ink-2">Tip: {look.tip}</p>}
          </div>
        )}
        {look.badges?.length ? <div className="mt-2 flex flex-wrap gap-1">{look.badges.map(b => <Badge key={b}>{b}</Badge>)}</div> : null}
        <div className="mt-auto flex items-center gap-1 pt-4">
          {onWear && <Button size="sm" onClick={onWear}><Shirt className="size-4" /> Wear today</Button>}
          <div className="ml-auto flex">
            {onWhere && <IconButton label="Where is everything?" onClick={onWhere}><MapPin className="size-[18px]" /></IconButton>}
            {onPlan && <IconButton label="Plan for a day" onClick={onPlan}><CalendarPlus className="size-[18px]" /></IconButton>}
            {onSave && <IconButton label={saved ? 'Saved to favourites' : 'Save to favourites'} onClick={onSave}><Heart className={cx('size-[18px]', saved && 'fill-accent text-accent')} /></IconButton>}
          </div>
        </div>
        {footer}
      </div>
    </Card>
  );
}

/** Grid that keeps outfit cards aligned: 1 column on phones, 2 on tablets, 3 on desktops. */
export function OutfitGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">{children}</div>;
}

export function ItemPicker({ open, onClose, items, title = 'Choose a piece', selected = [], onPick, multi, filter }: {
  open: boolean; onClose: () => void; items: Item[]; title?: string; selected?: string[]; onPick: (ids: string[]) => void; multi?: boolean; filter?: (i: Item) => boolean;
}) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<string>('all');
  const [sel, setSel] = useState<string[]>(selected);
  const list = useMemo(() => items.filter(i => (filter ? filter(i) : true) && (cat === 'all' || i.category === cat) && (!q || `${i.name} ${i.brand} ${i.color} ${i.subcategory}`.toLowerCase().includes(q.toLowerCase()))), [items, filter, cat, q]);
  return (
    <Sheet open={open} onClose={onClose} title={title} wide footer={multi ? <Button block onClick={() => { onPick(sel); onClose(); }}>Use {sel.length} piece{sel.length === 1 ? '' : 's'}</Button> : undefined}>
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <Input aria-label="Search your wardrobe" placeholder="Search your wardrobe" value={q} onChange={e => setQ(e.target.value)} className="pl-9" />
      </div>
      <div className="no-scrollbar -mx-5 mb-4 flex gap-2 overflow-x-auto px-5">
        <Chip active={cat === 'all'} onClick={() => setCat('all')}>All</Chip>
        {CATEGORIES.map(c => <Chip key={c.id} active={cat === c.id} onClick={() => setCat(c.id)}>{c.label}</Chip>)}
      </div>
      {list.length ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {list.map(i => (
            <ItemTile key={i.id} item={i} selected={multi ? sel.includes(i.id) : undefined}
              onSelect={() => (multi ? setSel(s => (s.includes(i.id) ? s.filter(x => x !== i.id) : [...s, i.id])) : (onPick([i.id]), onClose()))} />
          ))}
        </div>
      ) : <p className="py-10 text-center text-sm text-muted">Nothing matches.</p>}
    </Sheet>
  );
}

/** Replace one piece of an outfit with the best-scoring alternatives of the same category. */
export function SwapSheet({ piece, look, items, onClose, onSwap }: { piece: Item | null; look: Item[]; items: Item[]; onClose: () => void; onSwap: (next: Item) => void }) {
  const options = useMemo(() => {
    if (!piece) return [];
    const rest = look.filter(p => p.id !== piece.id).map(toEngine);
    return items.filter(i => i.category === piece.category && i.id !== piece.id && isAvailable(i))
      .map(i => ({ i, s: rest.reduce((sum, r) => sum + pairScore(toEngine(i), r).s, 0) / Math.max(1, rest.length) }))
      .sort((a, b) => b.s - a.s).slice(0, 12);
  }, [piece, look, items]);
  return (
    <Sheet open={!!piece} onClose={onClose} title={piece ? `Swap ${piece.name}` : ''} wide>
      {options.length ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {options.map(({ i, s }) => (
            <ItemTile key={i.id} item={i} onSelect={() => { onSwap(i); onClose(); }}>
              <div className="mt-1 text-xs text-muted">{Math.round(s * 100)}% match with the rest</div>
            </ItemTile>
          ))}
        </div>
      ) : <p className="py-10 text-center text-sm text-muted">No other available pieces in this category.</p>}
    </Sheet>
  );
}

/** Where to find each piece of an outfit, grouped by storage place. */
export function WhereSheet({ pieces, onClose }: { pieces: Item[] | null; onClose: () => void }) {
  const groups = useMemo(() => {
    const g = new Map<string, Item[]>();
    (pieces ?? []).forEach(p => { const k = p.locationPath ?? 'No place set'; g.set(k, [...(g.get(k) ?? []), p]); });
    return [...g.entries()];
  }, [pieces]);
  return (
    <Sheet open={!!pieces} onClose={onClose} title="Where everything is">
      <div className="space-y-4">
        {groups.map(([place, list]) => (
          <div key={place}>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium"><MapPin className="size-4 text-accent" /> {place}</div>
            <div className="space-y-2">
              {list.map(p => (
                <div key={p.id} className="flex items-center gap-3 rounded-xl border border-line p-2">
                  <div className="w-12 shrink-0 overflow-hidden rounded-lg"><ItemImage item={p} ratio="aspect-square" /></div>
                  <div className="min-w-0 text-sm"><div className="truncate font-medium">{p.name}</div><div className="text-xs text-muted">{p.laundry === 'clean' ? 'Clean' : p.laundry.replace('_', ' ')}</div></div>
                </div>
              ))}
            </div>
          </div>
        ))}
        {groups.some(([k]) => k === 'No place set') && <p className="text-xs text-muted">Set where things are kept from each item’s page or in Closet Finder.</p>}
      </div>
    </Sheet>
  );
}
