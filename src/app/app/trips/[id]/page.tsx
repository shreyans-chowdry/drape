'use client';
import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check } from 'lucide-react';
import type { TripPlan } from '@/lib/ai/features';
import type { DayForecast } from '@/lib/weather';
import { fmtRange, type Item } from '@/lib/model';
import { Card, cx, Empty, PageHeader } from '@/components/ui';
import type { OutfitView } from '@/components/app/items';
import { LookList } from '@/components/app/looks';
import { useStore } from '@/components/app/store';

type Trip = { id: string; destination: string; start_date: string; end_date: string; plan: TripPlan | null; forecast: DayForecast[] | null };

export default function TripPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { sb, byId } = useStore();
  const [trip, setTrip] = useState<Trip | null | undefined>(undefined);
  const [packed, setPacked] = useState<string[]>([]);

  useEffect(() => {
    sb.from('trip_plans').select('id, destination, start_date, end_date, plan, forecast').eq('id', id).maybeSingle().then(({ data }) => setTrip(data as Trip | null));
    try { setPacked(JSON.parse(localStorage.getItem(`drape.packed.${id}`) ?? '[]')); } catch { /* storage unavailable */ }
  }, [sb, id]);
  const togglePacked = (k: string) => setPacked(p => {
    const next = p.includes(k) ? p.filter(x => x !== k) : [...p, k];
    try { localStorage.setItem(`drape.packed.${id}`, JSON.stringify(next)); } catch { /* ignore */ }
    return next;
  });

  if (trip === undefined) return <div className="skeleton h-96 rounded-2xl" />;
  if (!trip?.plan) return <Empty title="Trip not found" action={<Link href="/app/trips" className="text-accent">Back to trips</Link>}>It may have been deleted.</Empty>;
  const plan = trip.plan;
  const toLook = (key: string, l?: { title: string; pieceIds: string[]; why: string }): OutfitView | null => {
    const pieces = (l?.pieceIds ?? []).map(byId).filter(Boolean) as Item[];
    return l && pieces.length ? { key, title: l.title, why: l.why, pieces } : null;
  };
  const allPieces = [...new Set(plan.days.flatMap(d => [...d.day.pieceIds, ...(d.evening?.pieceIds ?? [])]))].map(byId).filter(Boolean) as Item[];

  return (
    <>
      <Link href="/app/trips" className="mb-3 inline-flex items-center gap-1 text-sm text-muted"><ArrowLeft className="size-4" /> All trips</Link>
      <PageHeader eyebrow={fmtRange(trip.start_date, trip.end_date)} title={trip.destination} />

      <div className="grid gap-8 xl:grid-cols-[1fr_320px]">
        <div className="space-y-8">
          {plan.days.map(d => {
            const fc = trip.forecast?.find(f => f.date === d.date);
            const looks = [toLook(`${d.date}-day`, d.day), toLook(`${d.date}-eve`, d.evening)].filter(Boolean) as OutfitView[];
            return (
              <section key={d.date}>
                <div className="mb-3 flex flex-wrap items-baseline gap-x-3">
                  <h2 className="font-serif text-xl">{new Date(d.date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}</h2>
                  {fc && <span className="text-sm text-muted">{fc.icon} {fc.label}, {Math.round(fc.minC)}–{Math.round(fc.maxC)}° · rain {fc.rainChance}%</span>}
                </div>
                {d.plan && <p className="mb-3 text-sm text-ink-2">{d.plan}</p>}
                {looks.length ? <LookList looks={looks.map((l, i) => ({ ...l, badges: [i === 0 ? 'Day' : 'Evening'] }))} source="trip" /> : <p className="text-sm text-muted">No outfit planned.</p>}
              </section>
            );
          })}
        </div>

        <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
          <Card className="p-4">
            <h2 className="mb-2 font-medium">Pack these ({allPieces.length})</h2>
            <ul className="space-y-1">
              {allPieces.map(p => <PackRow key={p.id} label={p.name} done={packed.includes(p.id)} onToggle={() => togglePacked(p.id)} />)}
              {plan.packing.map(x => <PackRow key={x} label={x} done={packed.includes(x)} onToggle={() => togglePacked(x)} />)}
            </ul>
          </Card>
          {plan.remember.length > 0 && <Card className="p-4 text-sm"><h2 className="mb-2 font-medium">Don’t forget</h2><ul className="list-disc space-y-1 pl-4 text-ink-2">{plan.remember.map(r => <li key={r}>{r}</li>)}</ul></Card>}
          {plan.laundry && <Card className="p-4 text-sm"><h2 className="mb-1 font-medium">Laundry</h2><p className="text-ink-2">{plan.laundry}</p></Card>}
          {plan.optionalShopping.length > 0 && <Card className="p-4 text-sm"><h2 className="mb-1 font-medium">Worth buying (optional)</h2><ul className="list-disc space-y-1 pl-4 text-ink-2">{plan.optionalShopping.map(r => <li key={r}>{r}</li>)}</ul></Card>}
        </aside>
      </div>
    </>
  );
}

function PackRow({ label, done, onToggle }: { label: string; done: boolean; onToggle: () => void }) {
  return (
    <li>
      <button onClick={onToggle} className="flex w-full items-center gap-2 rounded-lg px-1 py-1 text-left text-sm hover:bg-sunk" aria-pressed={done}>
        <span className={cx('flex size-5 shrink-0 items-center justify-center rounded-md border', done ? 'border-sage bg-sage text-paper' : 'border-line-strong')}>{done && <Check className="size-3.5" />}</span>
        <span className={cx(done && 'text-muted line-through')}>{label}</span>
      </button>
    </li>
  );
}
