'use client';
import { useState } from 'react';
import { Columns2 } from 'lucide-react';
import type { Item } from '@/lib/model';
import { Button, cx, Sheet, useToast } from '@/components/ui';
import { OutfitCard, OutfitGrid, SwapSheet, WhereSheet, type OutfitView } from './items';
import { PlanSheet } from './plan';
import { useStore } from './store';

/**
 * A grid of outfit cards with every action wired up: swap a piece, find it,
 * plan it, save it, wear it, and optionally compare two side by side.
 */
export function LookList({ looks, occasion, source, comparable }: { looks: OutfitView[]; occasion?: string; source: string; comparable?: boolean }) {
  const { items, outfits, saveOutfit, setOutfitFav, logWear } = useStore();
  const toast = useToast();
  const [overrides, setOverrides] = useState<Record<string, Item[]>>({});
  const [swap, setSwap] = useState<{ key: string; piece: Item } | null>(null);
  const [where, setWhere] = useState<Item[] | null>(null);
  const [plan, setPlan] = useState<string[] | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [comparing, setComparing] = useState(false);

  const piecesOf = (l: OutfitView) => overrides[l.key] ?? l.pieces;
  const savedOf = (ids: string[]) => outfits.find(o => o.favourite && o.itemIds.length === ids.length && o.itemIds.every(id => ids.includes(id)));
  const current = swap ? looks.find(l => l.key === swap.key) : null;

  return (
    <>
      {comparable && looks.length > 1 && (
        <div className="mb-3 flex items-center justify-end gap-2 text-sm text-muted">
          {picked.length ? `${picked.length} of 2 chosen to compare` : 'Tick two looks to compare them'}
          <Button size="sm" variant="secondary" disabled={picked.length !== 2} onClick={() => setComparing(true)}><Columns2 className="size-4" /> Compare</Button>
        </div>
      )}
      <OutfitGrid>
        {looks.map(l => {
          const pieces = piecesOf(l), ids = pieces.map(p => p.id), saved = savedOf(ids);
          return (
            <OutfitCard key={l.key} look={{ ...l, pieces }}
              onSwap={p => setSwap({ key: l.key, piece: p })}
              onWhere={() => setWhere(pieces)}
              onPlan={() => setPlan(ids)}
              saved={!!saved}
              onSave={async () => {
                if (saved) { await setOutfitFav(saved.id, false); toast('Removed from favourites'); return; }
                await saveOutfit(ids, { favourite: true, occasion, source, title: l.title, why: l.why, tips: l.tip });
                toast('Saved to favourites', { tone: 'good' });
              }}
              onWear={async () => { await logWear(ids, saved?.id); toast('Logged as worn today', { tone: 'good' }); }}
              footer={comparable && looks.length > 1 ? (
                <label className="mt-3 flex cursor-pointer items-center gap-2 border-t border-line pt-3 text-sm text-muted">
                  <input type="checkbox" className="size-4 accent-[var(--accent)]" checked={picked.includes(l.key)} disabled={!picked.includes(l.key) && picked.length >= 2}
                    onChange={() => setPicked(p => (p.includes(l.key) ? p.filter(x => x !== l.key) : [...p, l.key]))} /> Compare
                </label>
              ) : undefined}
            />
          );
        })}
      </OutfitGrid>

      <SwapSheet piece={swap?.piece ?? null} look={current ? piecesOf(current) : []} items={items} onClose={() => setSwap(null)}
        onSwap={next => swap && current && setOverrides(o => ({ ...o, [swap.key]: piecesOf(current).map(p => (p.id === swap.piece.id ? next : p)) }))} />
      <WhereSheet pieces={where} onClose={() => setWhere(null)} />
      <PlanSheet pieceIds={plan} onClose={() => setPlan(null)} />
      <Sheet open={comparing} onClose={() => setComparing(false)} title="Side by side" wide>
        <div className="grid grid-cols-2 gap-3">
          {picked.map(k => looks.find(l => l.key === k)).filter(Boolean).map(l => (
            <div key={l!.key} className={cx('min-w-0')}><OutfitCard look={{ ...l!, pieces: piecesOf(l!) }} compact={false} /></div>
          ))}
        </div>
      </Sheet>
    </>
  );
}
