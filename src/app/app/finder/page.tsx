'use client';
import { useMemo, useState } from 'react';
import { MapPin, Search } from 'lucide-react';
import { Button, Card, Empty, Input, PageHeader, Select, useToast } from '@/components/ui';
import { ItemTile } from '@/components/app/items';
import { LocationTree, useLocationTree } from '@/components/app/locations';
import { useStore } from '@/components/app/store';

export default function FinderPage() {
  const { items, patchItem } = useStore();
  const { flat, kids } = useLocationTree();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [place, setPlace] = useState<string | null>(null);
  const [assign, setAssign] = useState<string[]>([]);
  const [target, setTarget] = useState('');

  const within = useMemo(() => {
    if (!place) return new Set<string>();
    const out = new Set([place]);
    const walk = (id: string) => (kids.get(id) ?? []).forEach(k => { out.add(k.id); walk(k.id); });
    walk(place);
    return out;
  }, [place, kids]);

  const found = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(w => w.length > 1 && !['where', 'is', 'my', 'the', 'are'].includes(w));
    if (!words.length) return [];
    return items.filter(i => { const hay = `${i.name} ${i.brand ?? ''} ${i.color ?? ''} ${i.subcategory} ${i.description ?? ''} ${i.fingerprint ?? ''}`.toLowerCase(); return words.every(w => hay.includes(w)); }).slice(0, 24);
  }, [q, items]);

  const here = place ? items.filter(i => i.location_id && within.has(i.location_id)) : [];
  const unplaced = items.filter(i => !i.location_id);
  const placeName = flat.find(f => f.loc.id === place)?.path;

  const moveSelected = async () => {
    if (!target || !assign.length) return;
    for (const id of assign) await patchItem(id, { location_id: target });
    toast(`Moved ${assign.length} piece${assign.length === 1 ? '' : 's'}`, { tone: 'good' });
    setAssign([]);
  };

  return (
    <>
      <PageHeader eyebrow="Closet Finder" title="Where did I put it?">Map your storage — rooms, wardrobes, shelves, drawers, boxes — and find any piece in seconds.</PageHeader>

      <div className="relative mb-6">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted" />
        <Input aria-label="Find a piece" value={q} onChange={e => setQ(e.target.value)} placeholder="Where is my navy blazer?" className="h-14 rounded-2xl pl-12 text-base" />
      </div>
      {q && (
        <section className="mb-8">
          {found.length ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              {found.map(i => (
                <ItemTile key={i.id} item={i} href={`/app/wardrobe/${i.id}`}>
                  <div className="mt-1 flex items-start gap-1 text-xs text-muted"><MapPin className="mt-0.5 size-3 shrink-0 text-accent" />{i.locationPath ?? 'No place set'}</div>
                </ItemTile>
              ))}
            </div>
          ) : <p className="text-sm text-muted">No piece matches “{q}”.</p>}
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <Card className="p-3 sm:p-4">
          <h2 className="mb-2 px-1 font-medium">Your places</h2>
          {flat.length === 0 && <p className="mb-2 px-1 text-sm text-muted">Start with a room, then add wardrobes, shelves and boxes inside it.</p>}
          <LocationTree onPick={setPlace} selected={place} />
        </Card>
        <div>
          {place ? (
            <>
              <h2 className="mb-3 font-serif text-xl">{placeName} <span className="text-base text-muted">· {here.length}</span></h2>
              {here.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{here.map(i => <ItemTile key={i.id} item={i} href={`/app/wardrobe/${i.id}`} />)}</div> : <p className="text-sm text-muted">Nothing stored here yet.</p>}
            </>
          ) : unplaced.length ? (
            <>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <h2 className="mr-auto font-serif text-xl">Not placed yet <span className="text-base text-muted">· {unplaced.length}</span></h2>
                {assign.length > 0 && flat.length > 0 && (
                  <>
                    <Select aria-label="Move to" className="w-56" value={target} onChange={e => setTarget(e.target.value)}>
                      <option value="">Move {assign.length} to…</option>
                      {flat.map(f => <option key={f.loc.id} value={f.loc.id}>{f.path}</option>)}
                    </Select>
                    <Button size="sm" onClick={moveSelected} disabled={!target}>Move</Button>
                  </>
                )}
              </div>
              <p className="mb-3 text-sm text-muted">Tap pieces to select them, then choose where they live.</p>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 xl:grid-cols-6">
                {unplaced.map(i => <ItemTile key={i.id} item={i} selected={assign.includes(i.id)} onSelect={() => setAssign(a => (a.includes(i.id) ? a.filter(x => x !== i.id) : [...a, i.id]))} />)}
              </div>
            </>
          ) : <Empty icon={<MapPin className="size-6" />} title="Everything has a place">Choose a place on the left to see what’s in it.</Empty>}
        </div>
      </div>
    </>
  );
}
