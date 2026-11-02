'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import type { Item } from '@/lib/model';
import { Button, Card, cx, IconButton, PageHeader, Sheet, useToast } from '@/components/ui';
import { ItemImage, OutfitCard, byOutfitOrder } from '@/components/app/items';
import { useStore } from '@/components/app/store';

type Planned = { id: string; date: string; outfit_id: string };
type Worn = { id: string; worn_on: string; item_ids: string[] };
const ymd = (d: Date) => d.toLocaleDateString('en-CA');

export default function CalendarPage() {
  const { sb, wardrobeId, outfits, byId, items, logWear, user } = useStore();
  const toast = useToast();
  const [month, setMonth] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [planned, setPlanned] = useState<Planned[]>([]);
  const [worn, setWorn] = useState<Worn[]>([]);
  const [day, setDay] = useState<string | null>(null);
  const [choosing, setChoosing] = useState(false);

  const range = useMemo(() => {
    const start = new Date(month); start.setDate(1 - ((start.getDay() + 6) % 7));
    return Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  }, [month]);

  const load = useCallback(async () => {
    if (!wardrobeId) return;
    const from = ymd(range[0]), to = ymd(range[41]);
    const [p, w] = await Promise.all([
      sb.from('outfit_calendar').select('id, date, outfit_id').eq('wardrobe_profile_id', wardrobeId).gte('date', from).lte('date', to),
      sb.from('wear_history').select('id, worn_on, item_ids').eq('wardrobe_profile_id', wardrobeId).gte('worn_on', from).lte('worn_on', to),
    ]);
    setPlanned(p.data ?? []); setWorn(w.data ?? []);
  }, [sb, wardrobeId, range]);
  useEffect(() => { load(); }, [load]);

  const piecesOf = (ids: string[]) => byOutfitOrder(ids.map(byId).filter(Boolean) as Item[]);
  const today = ymd(new Date());
  const plannedOn = (d: string) => planned.find(p => p.date === d);
  const wornOn = (d: string) => worn.filter(w => w.worn_on === d);
  const sel = day ? { plan: plannedOn(day), worn: wornOn(day) } : null;
  const selOutfit = sel?.plan ? outfits.find(o => o.id === sel.plan!.outfit_id) : null;

  const planOutfit = async (outfitId: string) => {
    if (!day) return;
    const { error } = await sb.from('outfit_calendar').upsert({ user_id: user.id, wardrobe_profile_id: wardrobeId, date: day, outfit_id: outfitId }, { onConflict: 'wardrobe_profile_id,date' });
    if (error) toast('Could not plan that day.', { tone: 'bad' });
    setChoosing(false); load();
  };

  return (
    <>
      <PageHeader eyebrow="Calendar" title="Plan ahead, look back" />
      <Card className="p-3 sm:p-5">
        <div className="mb-3 flex items-center gap-2">
          <IconButton label="Previous month" onClick={() => setMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}><ChevronLeft className="size-5" /></IconButton>
          <h2 className="flex-1 text-center font-serif text-xl">{month.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</h2>
          <IconButton label="Next month" onClick={() => setMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}><ChevronRight className="size-5" /></IconButton>
        </div>
        <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-line bg-line text-sm" role="grid">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => <div key={d} className="bg-sunk py-1.5 text-center text-xs text-muted" role="columnheader">{d}</div>)}
          {range.map(d => {
            const k = ymd(d), p = plannedOn(k), w = wornOn(k);
            const o = p ? outfits.find(x => x.id === p.outfit_id) : null;
            const first = o ? piecesOf(o.itemIds)[0] : w[0] ? piecesOf(w[0].item_ids)[0] : null;
            return (
              <button key={k} role="gridcell" onClick={() => setDay(k)} aria-label={`${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })}${p ? ', outfit planned' : ''}${w.length ? ', worn' : ''}`}
                className={cx('relative flex min-h-16 flex-col items-start bg-card p-1 text-left transition hover:bg-sunk sm:min-h-24 sm:p-1.5', d.getMonth() !== month.getMonth() && 'opacity-45')}>
                <span className={cx('flex size-6 items-center justify-center rounded-full text-xs', k === today && 'bg-ink text-paper')}>{d.getDate()}</span>
                {first && <span className="mt-auto block w-full overflow-hidden rounded-md sm:w-3/4"><ItemImage item={first} ratio="aspect-square" /></span>}
                <span className="absolute right-1 top-1.5 flex gap-0.5">{p && <span className="size-1.5 rounded-full bg-accent" />}{w.length > 0 && <span className="size-1.5 rounded-full bg-sage" />}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex gap-4 text-xs text-muted"><span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-accent" /> Planned</span><span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-sage" /> Worn</span></div>
      </Card>

      <Sheet open={!!day} onClose={() => { setDay(null); setChoosing(false); }} title={day ? new Date(day + 'T12:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }) : ''} wide>
        {sel && (choosing ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {outfits.filter(o => o.favourite).map(o => (
              <button key={o.id} onClick={() => planOutfit(o.id)} className="text-left"><OutfitCard look={{ key: o.id, title: o.title ?? undefined, pieces: piecesOf(o.itemIds) }} compact /></button>
            ))}
            {!outfits.some(o => o.favourite) && <p className="col-span-full text-sm text-muted">Save outfits to favourites first, or plan one from Today or the Stylist.</p>}
          </div>
        ) : (
          <div className="space-y-5">
            <section>
              <h3 className="mb-2 font-medium">Planned</h3>
              {selOutfit ? (
                <div className="max-w-xs">
                  <OutfitCard look={{ key: selOutfit.id, title: selOutfit.title ?? undefined, why: selOutfit.why ?? undefined, pieces: piecesOf(selOutfit.itemIds) }}
                    onWear={day === today ? async () => { await logWear(selOutfit.itemIds, selOutfit.id); toast('Logged as worn', { tone: 'good' }); load(); } : undefined}
                    footer={<Button size="sm" variant="ghost" className="mt-2" onClick={async () => { await sb.from('outfit_calendar').delete().eq('id', sel.plan!.id); load(); }}><Trash2 className="size-4" /> Remove from this day</Button>} />
                </div>
              ) : <p className="text-sm text-muted">Nothing planned.</p>}
              <Button size="sm" variant="secondary" className="mt-3" onClick={() => setChoosing(true)}>{selOutfit ? 'Change outfit' : 'Plan an outfit'}</Button>
            </section>
            {sel.worn.length > 0 && (
              <section>
                <h3 className="mb-2 font-medium">Worn</h3>
                {sel.worn.map(w => (
                  <div key={w.id} className="mb-2 flex flex-wrap items-center gap-2">
                    {piecesOf(w.item_ids).map(p => <div key={p.id} className="w-16"><ItemImage item={p} ratio="aspect-square" className="rounded-lg" /></div>)}
                    <button className="ml-auto text-sm text-muted hover:text-danger" onClick={async () => { await sb.from('wear_history').delete().eq('id', w.id); load(); }}>Remove</button>
                  </div>
                ))}
              </section>
            )}
            {day! <= today && !sel.worn.length && items.length > 0 && selOutfit && (
              <Button size="sm" variant="ghost" onClick={async () => { await logWear(selOutfit.itemIds, selOutfit.id, day!); load(); }}>I wore the planned outfit</Button>
            )}
          </div>
        ))}
      </Sheet>
    </>
  );
}
