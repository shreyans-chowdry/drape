'use client';
import { use, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Ban, Check, MapPin, Pencil, Plus, RefreshCw, Repeat2, Undo2, X } from 'lucide-react';
import { typeInfo, weatherOk } from '@/lib/engine';
import { isAvailable, toEngine, fmtRange, type Item } from '@/lib/model';
import { climateNote, completeLook, countUse, dayClimate, fitSummary, packingOf, plural, quickDay, type TripDay, type TripLook, type TripPlan } from '@/lib/trip';
import type { DayForecast } from '@/lib/weather';
import { Badge, Button, Card, cx, Empty, IconButton, Input, PageHeader, useToast } from '@/components/ui';
import { ItemImage, ItemPicker, SwapSheet } from '@/components/app/items';
import { useStore } from '@/components/app/store';

type Trip = { id: string; destination: string; start_date: string; end_date: string; plan: TripPlan | null; forecast: DayForecast[] | null; wardrobe_profile_id: string };
type Slot = 'day' | 'evening';
const dayLabel = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' });

export default function TripPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { sb, items, byId, user } = useStore();
  const toast = useToast();
  const [trip, setTrip] = useState<Trip | null | undefined>(undefined);
  const [packed, setPacked] = useState<string[]>([]);
  const [swap, setSwap] = useState<{ date: string; slot: Slot; piece: Item } | null>(null);
  const [adding, setAdding] = useState<{ date: string; slot: Slot } | 'extra' | null>(null);

  useEffect(() => {
    sb.from('trip_plans').select('id, destination, start_date, end_date, plan, forecast, wardrobe_profile_id').eq('id', id).maybeSingle().then(({ data }) => {
      const t = data as Trip | null;
      // Plans made before per-day weather was stored: attach it from the trip's forecast.
      if (t?.plan) t.plan = { ...t.plan, days: t.plan.days.map(d => ({ ...d, place: d.place ?? t.destination.split(',')[0], weather: d.weather ?? t.forecast?.find(f => f.date === d.date) ?? null })) };
      setTrip(t);
    });
    try { setPacked(JSON.parse(localStorage.getItem(`drape.packed.${id}`) ?? '[]')); } catch { /* storage unavailable */ }
  }, [sb, id]);

  const plan = trip?.plan ?? null;
  const excluded = useMemo(() => new Set(plan?.excluded ?? []), [plan]);
  // Pieces the planner may use: available, of the chosen kinds, not left at home.
  const pool = useMemo(() => items.filter(i => isAvailable(i) && !excluded.has(i.id) && (!plan?.types?.length || plan.types.includes(i.subcategory) || plan.extras?.includes(i.id))).map(toEngine), [items, excluded, plan]);
  const packing = useMemo(() => (plan ? packingOf(plan).map(byId).filter(Boolean) as Item[] : []), [plan, byId]);

  if (trip === undefined) return <div className="skeleton h-96 rounded-2xl" />;
  if (!trip || !plan) return <Empty title="Trip not found" action={<Link href="/app/trips" className="text-accent">Back to trips</Link>}>It may have been deleted.</Empty>;

  /** Save a new plan; `changed` lists the day looks whose linked outfits need updating. */
  const save = async (next: TripPlan, changed: { date: string; slot: Slot }[] = []) => {
    next = { ...next, packing: packingOf(next) };
    setTrip(t => (t ? { ...t, plan: next } : t));
    const { error } = await sb.from('trip_plans').update({ plan: next }).eq('id', trip.id);
    if (error) { toast('Couldn’t save that change. Try again.', { tone: 'bad' }); return; }
    for (const c of changed) {
      const d = next.days.find(x => x.date === c.date);
      await syncLook(c.date, c.slot, d && !d.skipped ? d[c.slot] : undefined);
    }
  };
  const syncLook = async (date: string, slot: Slot, look?: TripLook) => {
    if (!user) return;
    const { data: link } = await sb.from('trip_outfits').select('outfit_id').eq('trip_id', trip.id).eq('day', date).eq('slot', slot).maybeSingle();
    if (link && !look?.pieceIds.length) { await sb.from('outfit_combinations').delete().eq('id', link.outfit_id).eq('favourite', false); return; }
    if (!look?.pieceIds.length) return;
    let outfitId = link?.outfit_id;
    if (outfitId) {
      await sb.from('outfit_combinations').update({ title: look.title, why: look.why }).eq('id', outfitId);
      await sb.from('outfit_items').delete().eq('outfit_id', outfitId);
    } else {
      const { data: o } = await sb.from('outfit_combinations').insert({ user_id: user.id, wardrobe_profile_id: trip.wardrobe_profile_id, title: look.title, why: look.why, source: 'trip', occasion: slot }).select('id').single();
      if (!o) return;
      outfitId = o.id;
      await sb.from('trip_outfits').insert({ trip_id: trip.id, outfit_id: o.id, user_id: user.id, day: date, slot });
    }
    await sb.from('outfit_items').insert(look.pieceIds.map(item_id => ({ outfit_id: outfitId!, item_id, user_id: user.id })));
  };

  const setDay = (date: string, patch: Partial<TripDay>, changed: Slot[] = []) =>
    save({ ...plan, days: plan.days.map(d => (d.date === date ? { ...d, ...patch } : d)) }, changed.map(slot => ({ date, slot })));
  const setPieces = (date: string, slot: Slot, ids: string[]) => {
    const d = plan.days.find(x => x.date === date)!;
    const look = d[slot] ?? { title: 'Your pick', why: '' };
    setDay(date, { [slot]: ids.length ? { ...look, pieceIds: ids } : undefined }, [slot]);
  };
  const rebuild = (d: TripDay) => {
    const c = dayClimate(d.weather);
    const look = quickDay(pool, c, countUse(plan.days, d.date), Date.now() % 997);
    if (!look) { toast('Not enough pieces that suit this weather.', { tone: 'bad' }); return; }
    setDay(d.date, { day: look, skipped: false }, ['day']);
  };
  /** Take pieces off the whole trip and fill each gap with the best alternative for that day. */
  const leaveAtHome = (ids: string[], what: string) => {
    const out = new Set([...(plan.excluded ?? []), ...ids]);
    const nextPool = pool.filter(p => !out.has(p.id));
    const changed: { date: string; slot: Slot }[] = [];
    const days = plan.days.map(d => {
      let next = d;
      for (const slot of ['day', 'evening'] as Slot[]) {
        const look = d[slot];
        if (!look?.pieceIds.some(x => out.has(x))) continue;
        const kept = look.pieceIds.filter(x => !out.has(x));
        const ids2 = completeLook(kept, nextPool, dayClimate(d.weather), [], new Set(countUse(plan.days, d.date).keys()));
        next = { ...next, [slot]: ids2.length ? { ...look, pieceIds: ids2 } : undefined };
        changed.push({ date: d.date, slot });
      }
      return next;
    });
    save({ ...plan, days, excluded: [...out], extras: (plan.extras ?? []).filter(x => !out.has(x)) }, changed);
    toast(`${what} left at home. ${changed.length ? `${changed.length} look${changed.length === 1 ? '' : 's'} updated.` : ''}`);
  };
  const togglePacked = (k: string) => setPacked(p => {
    const next = p.includes(k) ? p.filter(x => x !== k) : [...p, k];
    try { localStorage.setItem(`drape.packed.${id}`, JSON.stringify(next)); } catch { /* storage unavailable */ }
    return next;
  });

  const active = plan.days.filter(d => !d.skipped);
  const summary = fitSummary(packing.map(toEngine));
  const swapDay = swap ? plan.days.find(d => d.date === swap.date) : undefined;
  const swapClimate = dayClimate(swapDay?.weather);
  const slotTarget = adding && adding !== 'extra' ? adding : null;
  const targetIds = slotTarget ? plan.days.find(d => d.date === slotTarget.date)?.[slotTarget.slot]?.pieceIds ?? [] : [];

  return (
    <>
      <Link href="/app/trips" className="mb-3 inline-flex items-center gap-1 text-sm text-muted"><ArrowLeft className="size-4" /> All trips</Link>
      <PageHeader eyebrow={fmtRange(trip.start_date, trip.end_date)} title={trip.destination}>
        {plan.stops && plan.stops.length > 0 && (
          <span className="flex flex-wrap gap-x-3 gap-y-1">
            {plan.stops.map((s, i) => <span key={i} className="inline-flex items-center gap-1"><MapPin className="size-3.5 text-accent" />{s.place.split(',')[0]} <span className="text-muted">{fmtRange(s.start, s.end)}</span></span>)}
          </span>
        )}
      </PageHeader>
      {plan.source === 'quick' && <p className="mb-6 rounded-xl bg-warn-soft px-4 py-3 text-sm text-warn">Planned with quick ideas (on-device) because the AI planner wasn’t available. You can still swap and rebuild anything.</p>}

      <div className="grid gap-8 xl:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          {plan.days.map((d, n) => (
            <DayCard key={d.date} day={d} n={n + 1} byId={byId}
              onNote={note => setDay(d.date, { plan: note })}
              onSkip={() => setDay(d.date, { skipped: !d.skipped }, ['day', 'evening'])}
              onRebuild={() => rebuild(d)}
              onSwap={(slot, piece) => setSwap({ date: d.date, slot, piece })}
              onRemove={(slot, pid) => setPieces(d.date, slot, (d[slot]?.pieceIds ?? []).filter(x => x !== pid))}
              onAdd={slot => setAdding({ date: d.date, slot })} />
          ))}
        </div>

        <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
          <Card className="p-4">
            <h2 className="font-serif text-xl">Your fit for this trip</h2>
            <p className="mb-3 text-sm text-muted">{packing.length} piece{packing.length === 1 ? '' : 's'} for {active.length} day{active.length === 1 ? '' : 's'}</p>
            <ul className="mb-4 space-y-1.5 text-sm">
              {summary.map(g => (
                <li key={g.category}><b className="font-medium">{g.count} {g.label}</b> <span className="text-muted">({g.types.map(t => `${t.n} ${t.label}`).join(', ')})</span></li>
              ))}
            </ul>
            <ul className="space-y-1">
              {packing.map(p => (
                <li key={p.id} className="group flex items-center gap-2 rounded-lg px-1 py-1 hover:bg-sunk">
                  <button onClick={() => togglePacked(p.id)} aria-pressed={packed.includes(p.id)} aria-label={`Packed ${p.name}`}
                    className={cx('flex size-5 shrink-0 items-center justify-center rounded-md border', packed.includes(p.id) ? 'border-sage bg-sage text-paper' : 'border-line-strong')}>{packed.includes(p.id) && <Check className="size-3.5" />}</button>
                  <span className="size-8 shrink-0 overflow-hidden rounded-md"><ItemImage item={p} ratio="aspect-square" /></span>
                  <span className={cx('min-w-0 flex-1 truncate text-sm', packed.includes(p.id) && 'text-muted line-through')}>{p.name}</span>
                  <button onClick={() => leaveAtHome([p.id], p.name)} className="rounded p-1 text-muted opacity-70 hover:text-danger group-hover:opacity-100" aria-label={`Leave ${p.name} at home`} title="Leave at home"><Ban className="size-3.5" /></button>
                </li>
              ))}
            </ul>
            <Button variant="secondary" size="sm" className="mt-3" onClick={() => setAdding('extra')}><Plus className="size-4" /> Add a piece I want to take</Button>
          </Card>

          {summary.some(g => g.types.length) && (
            <Card className="p-4 text-sm">
              <h2 className="mb-2 font-medium">Leave a whole type at home</h2>
              <div className="flex flex-wrap gap-2">
                {[...new Set(packing.map(p => p.subcategory))].map(t => {
                  const ofType = packing.filter(p => p.subcategory === t);
                  const label = typeInfo(toEngine(ofType[0])).label;
                  return <button key={t} onClick={() => leaveAtHome(ofType.map(p => p.id), plural(label, 2).replace(/^./, c => c.toUpperCase()))} className="inline-flex items-center gap-1 rounded-full border border-line px-3 py-1 hover:border-danger hover:text-danger"><X className="size-3" /> {label}</button>;
                })}
              </div>
              {(plan.excluded?.length ?? 0) > 0 && (
                <button onClick={() => save({ ...plan, excluded: [] })} className="mt-3 inline-flex items-center gap-1 text-muted hover:text-ink"><Undo2 className="size-3.5" /> Allow the {plan.excluded!.length} left-at-home piece{plan.excluded!.length === 1 ? '' : 's'} again</button>
              )}
            </Card>
          )}
          {plan.remember.length > 0 && <Card className="p-4 text-sm"><h2 className="mb-2 font-medium">Don’t forget</h2><ul className="list-disc space-y-1 pl-4 text-ink-2">{plan.remember.map(r => <li key={r}>{r}</li>)}</ul></Card>}
          {plan.laundry && <Card className="p-4 text-sm"><h2 className="mb-1 font-medium">Laundry</h2><p className="text-ink-2">{plan.laundry}</p></Card>}
          {plan.optionalShopping.length > 0 && <Card className="p-4 text-sm"><h2 className="mb-1 font-medium">Worth buying (optional)</h2><ul className="list-disc space-y-1 pl-4 text-ink-2">{plan.optionalShopping.map(r => <li key={r}>{r}</li>)}</ul></Card>}
        </aside>
      </div>

      <SwapSheet piece={swap?.piece ?? null} look={swap && swapDay ? (swapDay[swap.slot]?.pieceIds ?? []).map(byId).filter(Boolean) as Item[] : []}
        items={pool.filter(i => weatherOk(i, swapClimate.tempC, swapClimate.rain))} onClose={() => setSwap(null)}
        onSwap={next => swap && swapDay && setPieces(swap.date, swap.slot, (swapDay[swap.slot]?.pieceIds ?? []).map(x => (x === swap.piece.id ? next.id : x)))} />
      <ItemPicker open={adding !== null} onClose={() => setAdding(null)} key={adding === null ? 'closed' : adding === 'extra' ? 'extra' : `${adding.date}-${adding.slot}`}
        title={adding === 'extra' ? 'Add a piece to take' : 'Add to this look'}
        items={items.filter(i => !excluded.has(i.id))}
        filter={adding === 'extra' ? i => !packing.some(p => p.id === i.id) : i => !targetIds.includes(i.id)}
        onPick={([pid]) => {
          if (!pid || !adding) return;
          if (adding === 'extra') { save({ ...plan, extras: [...new Set([...(plan.extras ?? []), pid])] }); return; }
          const d = plan.days.find(x => x.date === adding.date)!;
          const added = byId(pid);
          // One piece per slot: a new top replaces the old top, and so on (accessories stack).
          const ids = (d[adding.slot]?.pieceIds ?? []).filter(x => added?.category === 'accessory' || byId(x)?.category !== added?.category);
          setPieces(adding.date, adding.slot, [...ids, pid]);
        }} />
    </>
  );
}

function DayCard({ day: d, n, byId, onNote, onSkip, onRebuild, onSwap, onRemove, onAdd }: {
  day: TripDay; n: number; byId: (id: string) => Item | undefined;
  onNote: (note: string) => void; onSkip: () => void; onRebuild: () => void;
  onSwap: (slot: Slot, piece: Item) => void; onRemove: (slot: Slot, id: string) => void; onAdd: (slot: Slot) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(d.plan);
  const w = d.weather;
  const tip = climateNote(dayClimate(w));
  return (
    <section className={cx('rounded-2xl border border-line bg-card p-4 sm:p-5', d.skipped && 'opacity-60')}>
      <header className="mb-2 flex flex-wrap items-start gap-x-3 gap-y-1">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium uppercase tracking-wide text-accent">Day {n}{d.place ? ` · ${d.place}` : ''}</div>
          <h2 className="font-serif text-xl">{dayLabel(d.date)}</h2>
        </div>
        <div className="flex items-center gap-1">
          {!d.skipped && <IconButton label="Rebuild this day" onClick={onRebuild}><RefreshCw className="size-4" /></IconButton>}
          <Button variant="ghost" size="sm" onClick={onSkip}>{d.skipped ? 'Plan this day' : 'No outfit'}</Button>
        </div>
      </header>
      {w && <p className="mb-2 text-sm text-ink-2">{w.icon} {w.label}, {Math.round(w.minC)}–{Math.round(w.maxC)}°C · rain {w.rainChance}%{w.typical && <span className="text-muted"> · typical for these dates</span>}</p>}

      {editing ? (
        <form className="mb-3 flex gap-2" onSubmit={e => { e.preventDefault(); onNote(note.trim()); setEditing(false); }}>
          <Input aria-label="What this day looks like" autoFocus maxLength={200} value={note} onChange={e => setNote(e.target.value)} className="h-9 text-sm" />
          <Button size="sm" type="submit">Save</Button>
        </form>
      ) : (
        <button onClick={() => setEditing(true)} className="group mb-3 flex items-center gap-1.5 text-left text-sm text-ink-2 hover:text-ink">
          <span className={cx(!d.plan && 'text-muted')}>{d.plan || 'Add a line about this day'}</span>
          <Pencil className="size-3 opacity-50 group-hover:opacity-100" />
        </button>
      )}

      {!d.skipped && (
        <div className="space-y-4">
          {(['day', 'evening'] as Slot[]).map(slot => {
            const look = d[slot];
            if (slot === 'evening' && !look) return null;
            const pieces = (look?.pieceIds ?? []).map(byId).filter(Boolean) as Item[];
            return (
              <div key={slot}>
                {(slot === 'evening' || d.evening) && <Badge>{slot === 'day' ? 'Day' : 'Evening'}</Badge>}
                {look?.title && <div className="mt-1 font-medium">{look.title}</div>}
                {look?.why && <p className="mb-2 text-sm text-muted">{look.why}</p>}
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
                  {pieces.map(p => (
                    <div key={p.id} className="group relative">
                      <ItemImage item={p} ratio="aspect-square" className="rounded-xl" />
                      <div className="mt-1 truncate text-xs">{p.name}</div>
                      <div className="absolute right-1 top-1 flex gap-1">
                        <button onClick={() => onSwap(slot, p)} aria-label={`Swap ${p.name}`} title="Swap" className="rounded-full bg-card/90 p-1.5 shadow-soft hover:text-accent"><Repeat2 className="size-3.5" /></button>
                        <button onClick={() => onRemove(slot, p.id)} aria-label={`Remove ${p.name} from this day`} title="Remove" className="rounded-full bg-card/90 p-1.5 shadow-soft hover:text-danger"><X className="size-3.5" /></button>
                      </div>
                    </div>
                  ))}
                  <button onClick={() => onAdd(slot)} className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-line-strong text-xs text-muted hover:border-accent hover:text-accent">
                    <Plus className="size-4" /> Add
                  </button>
                </div>
              </div>
            );
          })}
          {!d.day && <p className="text-sm text-muted">No outfit yet. Use rebuild or add pieces.</p>}
          {tip && <p className="text-xs text-muted">{tip}</p>}
        </div>
      )}
    </section>
  );
}
