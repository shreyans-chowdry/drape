'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Plane, Trash2 } from 'lucide-react';
import { api } from '@/lib/api-client';
import { fmtRange } from '@/lib/model';
import { Button, Card, Empty, Field, Input, PageHeader, Textarea, useToast } from '@/components/ui';
import { aiErrorText, QuotaNote } from '@/components/app/ai';
import { useStore } from '@/components/app/store';

type TripRow = { id: string; destination: string; start_date: string; end_date: string; created_at: string };
const iso = (d: Date) => d.toLocaleDateString('en-CA');

export default function TripsPage() {
  const { sb, wardrobeId, items, reloadQuotas, reload } = useStore();
  const router = useRouter();
  const toast = useToast();
  const [trips, setTrips] = useState<TripRow[] | null>(null);
  const [f, setF] = useState({ destination: '', start: iso(new Date(Date.now() + 7 * 864e5)), end: iso(new Date(Date.now() + 10 * 864e5)), activities: '', preferences: '' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!wardrobeId) return;
    sb.from('trip_plans').select('id, destination, start_date, end_date, created_at').eq('wardrobe_profile_id', wardrobeId).order('start_date', { ascending: false }).then(({ data }) => setTrips(data ?? []));
  }, [sb, wardrobeId]);

  const days = Math.round((new Date(f.end).getTime() - new Date(f.start).getTime()) / 864e5) + 1;
  const valid = f.destination.trim().length >= 2 && days >= 1 && days <= 21;

  const plan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setBusy(true);
    try {
      const r = await api<{ id: string }>('/api/ai/trip', { ...f, wardrobeId });
      await reload();
      router.push(`/app/trips/${r.id}`);
    } catch (err) { toast(aiErrorText(err), { tone: 'bad' }); setBusy(false); }
    finally { reloadQuotas(); }
  };
  const remove = async (id: string) => {
    if (!confirm('Delete this trip and its planned outfits?')) return;
    const { data: links } = await sb.from('trip_outfits').select('outfit_id').eq('trip_id', id);
    await sb.from('trip_plans').delete().eq('id', id);
    if (links?.length) await sb.from('outfit_combinations').delete().in('id', links.map(l => l.outfit_id)).eq('favourite', false);
    setTrips(t => t?.filter(x => x.id !== id) ?? null);
  };

  return (
    <>
      <PageHeader eyebrow="Trip Planner" title="Pack once, dress well every day">Outfits for each day and evening from what you own, matched to the forecast, plus a packing list.</PageHeader>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card className="p-4 sm:p-6">
          <form onSubmit={plan} className="grid gap-4 sm:grid-cols-2">
            <Field label="Where to?" className="sm:col-span-2">{id => <Input id={id} required value={f.destination} maxLength={120} onChange={e => setF({ ...f, destination: e.target.value })} placeholder="e.g. Goa, or Manali" />}</Field>
            <Field label="From">{id => <Input id={id} type="date" required value={f.start} onChange={e => setF({ ...f, start: e.target.value, end: e.target.value > f.end ? e.target.value : f.end })} />}</Field>
            <Field label="To" error={days > 21 ? 'Up to 21 days per trip' : null}>{id => <Input id={id} type="date" required min={f.start} value={f.end} onChange={e => setF({ ...f, end: e.target.value })} />}</Field>
            <Field label="What will you be doing?" className="sm:col-span-2">{id => <Textarea id={id} maxLength={400} value={f.activities} onChange={e => setF({ ...f, activities: e.target.value })} placeholder="Beach days, one wedding, a nice dinner, lots of walking" className="min-h-20" />}</Field>
            <Field label="Preferences" hint="Optional — e.g. carry-on only, minimal ironing" className="sm:col-span-2">{id => <Input id={id} maxLength={400} value={f.preferences} onChange={e => setF({ ...f, preferences: e.target.value })} />}</Field>
            <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
              <Button type="submit" loading={busy} disabled={!valid || items.length < 3}><Plane className="size-4" /> Plan {days > 0 && days <= 21 ? `${days} day${days === 1 ? '' : 's'}` : 'trip'}</Button>
              <QuotaNote kind="trip" />
              {busy && <span className="text-sm text-muted">Checking the forecast and building outfits — about 20 seconds.</span>}
            </div>
            {items.length < 3 && <p className="text-sm text-warn sm:col-span-2">Add at least a top, a bottom and shoes first.</p>}
          </form>
        </Card>
        <div>
          <h2 className="mb-3 font-serif text-xl">Your trips</h2>
          {trips === null ? <div className="skeleton h-24 rounded-2xl" /> : trips.length ? (
            <ul className="space-y-2">
              {trips.map(t => (
                <li key={t.id}><Card className="flex items-center gap-3 p-3">
                  <Link href={`/app/trips/${t.id}`} className="min-w-0 flex-1"><div className="truncate font-medium">{t.destination}</div><div className="text-sm text-muted">{fmtRange(t.start_date, t.end_date)}</div></Link>
                  <button aria-label={`Delete trip to ${t.destination}`} onClick={() => remove(t.id)} className="p-2 text-muted hover:text-danger"><Trash2 className="size-4" /></button>
                </Card></li>
              ))}
            </ul>
          ) : <Empty title="No trips yet">Plan one and it’ll be saved here.</Empty>}
        </div>
      </div>
    </>
  );
}
