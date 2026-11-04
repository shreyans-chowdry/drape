'use client';
import { Heart } from 'lucide-react';
import { useState } from 'react';
import type { Item } from '@/lib/model';
import { Empty, LinkButton, PageHeader, Segmented } from '@/components/ui';
import { ItemTile, type OutfitView } from '@/components/app/items';
import { LookList } from '@/components/app/looks';
import { useStore } from '@/components/app/store';

export default function FavouritesPage() {
  const { outfits, items, byId } = useStore();
  const [tab, setTab] = useState<'outfits' | 'pieces'>('outfits');
  const looks: OutfitView[] = outfits.filter(o => o.favourite).map(o => ({
    key: o.id, title: o.title ?? undefined, why: o.why ?? undefined, tip: o.tips ?? undefined, pieces: o.itemIds.map(byId).filter(Boolean) as Item[],
    badges: o.occasion ? [o.occasion] : undefined,
  })).filter(l => l.pieces.length);
  const pieces = items.filter(i => i.favourite);

  return (
    <>
      <PageHeader eyebrow="Favourites" title="Saved for later" actions={<Segmented label="Show" value={tab} onChange={setTab} options={[{ value: 'outfits', label: `Outfits (${looks.length})` }, { value: 'pieces', label: `Pieces (${pieces.length})` }]} />} />
      {tab === 'outfits' ? (
        looks.length ? <LookList looks={looks} source="favourite" comparable /> : (
          <Empty icon={<Heart className="size-6" />} title="No saved outfits yet" action={<LinkButton href="/app">See today’s outfits</LinkButton>}>Tap the heart on any outfit to keep it here.</Empty>
        )
      ) : pieces.length ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">{pieces.map(i => <ItemTile key={i.id} item={i} href={`/app/wardrobe/${i.id}`} />)}</div>
      ) : <Empty icon={<Heart className="size-6" />} title="No favourite pieces yet">Open a piece in your wardrobe and tap the heart.</Empty>}
    </>
  );
}
