'use client';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Shirt } from 'lucide-react';
import { buildAround, CATEGORIES, OCCASIONS, pctScore, suggestFor, type Category } from '@/lib/engine';
import { isAvailable, toEngine, type Item } from '@/lib/model';
import { Button, Card, Chip, Empty, LinkButton, PageHeader } from '@/components/ui';
import { ItemImage, ItemPicker, ItemTile } from '@/components/app/items';
import { LookList } from '@/components/app/looks';
import { weatherCtx } from '@/components/app/ai';
import { useStore } from '@/components/app/store';

export default function MatchPage() {
  return <Suspense><Match /></Suspense>;
}

function Match() {
  const params = useSearchParams();
  const { items, weather, loading } = useStore();
  const [anchor, setAnchor] = useState<string[]>([]);
  const [occasion, setOccasion] = useState('casual');
  const [picking, setPicking] = useState(false);

  useEffect(() => { const id = params.get('item'); if (id) setAnchor([id]); }, [params]);

  const pool = useMemo(() => items.filter(isAvailable).map(toEngine), [items]);
  const anchors = useMemo(() => anchor.map(id => items.find(i => i.id === id)).filter(Boolean) as Item[], [anchor, items]);
  const ctx = useMemo(() => weatherCtx(weather, occasion), [weather, occasion]);

  const groups = useMemo(() => {
    if (anchors.length !== 1) return null;
    return suggestFor(toEngine(anchors[0]), pool, ctx).groups;
  }, [anchors, pool, ctx]);

  const looks = useMemo(() => {
    if (!anchors.length) return [];
    const have = new Set(anchors.map(a => a.category));
    const need = (['top', 'bottom', 'shoes', 'outer'] as Category[]).filter(c => !have.has(c) && !(have.has('onepiece') && (c === 'top' || c === 'bottom')));
    return buildAround(anchors.map(toEngine), need.slice(0, 3), pool, ctx, {}, { count: 3 })
      .map((l, i) => ({ key: `m${i}-${anchor.join()}`, pieces: l.pieces as unknown as Item[], reasons: l.reasons, score: pctScore(l.s) }));
  }, [anchors, anchor, pool, ctx]);

  if (!loading && items.length < 2) return (
    <>
      <PageHeader eyebrow="Match" title="What goes with this?" />
      <Empty icon={<Shirt className="size-6" />} title="Add a few pieces first" action={<LinkButton href="/app/add">Add clothes</LinkButton>}>Matching needs at least two pieces to compare.</Empty>
    </>
  );

  return (
    <>
      <PageHeader eyebrow="Match" title="What goes with this?">Pick one piece (or a few) and see what pairs best, scored on colour, formality and the weather. Free and instant.</PageHeader>

      <Card className="mb-6 flex flex-wrap items-center gap-4 p-4 sm:p-5">
        <div className="flex flex-wrap gap-3">
          {anchors.map(a => <div key={a.id} className="w-20"><ItemImage item={a} ratio="aspect-square" className="rounded-xl" /><div className="mt-1 truncate text-xs">{a.name}</div></div>)}
        </div>
        <Button variant={anchors.length ? 'secondary' : 'primary'} onClick={() => setPicking(true)}>{anchors.length ? 'Change' : 'Choose a piece'}</Button>
        <div className="flex w-full flex-wrap gap-2 border-t border-line pt-4">{OCCASIONS.map(o => <Chip key={o.id} active={occasion === o.id} onClick={() => setOccasion(o.id)}>{o.label}</Chip>)}</div>
      </Card>

      {looks.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 font-serif text-2xl">Complete outfits</h2>
          <LookList looks={looks} occasion={occasion} source="match" />
        </section>
      )}

      {groups && (
        <section className="space-y-6">
          {CATEGORIES.filter(c => groups[c.id]?.length).map(c => (
            <div key={c.id}>
              <h2 className="mb-3 font-serif text-xl">{c.label} that work</h2>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                {groups[c.id]!.slice(0, 6).map(r => (
                  <ItemTile key={r.item.id} item={r.item as unknown as Item} href={`/app/wardrobe/${r.item.id}`}>
                    <div className="mt-1 text-xs text-muted">{pctScore(r.s)}% · {r.reasons.find(x => x.good)?.t ?? ''}</div>
                  </ItemTile>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      <ItemPicker open={picking} onClose={() => setPicking(false)} items={items.filter(isAvailable)} multi selected={anchor} title="Build around" onPick={setAnchor} />
    </>
  );
}
