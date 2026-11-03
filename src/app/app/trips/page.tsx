'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FileText, MapPin, Plane, Plus, ScanText, Trash2, X } from 'lucide-react';
import type { Itinerary } from '@/lib/ai/features';
import { api, ApiError } from '@/lib/api-client';
import { CATEGORIES, TYPES, type Category } from '@/lib/engine';
import { compress } from '@/lib/images';
import { fmtRange } from '@/lib/model';
import { datesBetween } from '@/lib/trip';
import { Button, Card, Chip, cx, Empty, Field, Input, PageHeader, Textarea, useToast } from '@/components/ui';
import { aiErrorText, QuotaNote } from '@/components/app/ai';
import { ItemImage, ItemPicker } from '@/components/app/items';
import { useStore } from '@/components/app/store';

type TripRow = { id: string; destination: string; start_date: string; end_date: string; created_at: string };
type Stop = { place: string; start: string; end: string; note: string };
const iso = (d: Date) => d.toLocaleDateString('en-CA');
const addDays = (s: string, n: number) => { const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n); return iso(d); };
const short = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

export default function TripsPage() {
  const { sb, wardrobeId, items, byId, reloadQuotas, reload } = useStore();
  const router = useRouter();
  const toast = useToast();
  const [trips, setTrips] = useState<TripRow[] | null>(null);
  const first = iso(new Date(Date.now() + 7 * 864e5));
  const [title, setTitle] = useState('');
  const [stops, setStops] = useState<Stop[]>([{ place: '', start: first, end: addDays(first, 3), note: '' }]);
  const [dayNotes, setDayNotes] = useState<Record<string, string>>({});
  const [skip, setSkip] = useState<string[]>([]);
  const [activities, setActivities] = useState('');
  const [preferences, setPreferences] = useState('');
  const [types, setTypes] = useState<string[] | null>(null); // null = everything
  const [mustPack, setMustPack] = useState<string[]>([]);
  const [leaveHome, setLeaveHome] = useState<string[]>([]);
  const [picker, setPicker] = useState<'must' | 'leave' | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!wardrobeId) return;
    sb.from('trip_plans').select('id, destination, start_date, end_date, created_at').eq('wardrobe_profile_id', wardrobeId).order('start_date', { ascending: false }).then(({ data }) => setTrips(data ?? []));
  }, [sb, wardrobeId]);

  const sorted = [...stops].sort((a, b) => a.start.localeCompare(b.start));
  const start = sorted[0]?.start ?? first;
  const end = sorted.reduce((m, s) => (s.end > m ? s.end : m), start);
  const dates = start <= end ? datesBetween(start, end) : [];
  const badStop = stops.some(s => s.end < s.start);
  const valid = stops.every(s => s.place.trim().length >= 2) && !badStop && dates.length >= 1 && dates.length <= 21;

  // Clothing kinds this wardrobe actually has, grouped by category.
  const kinds = useMemo(() => {
    const present = new Map<string, number>();
    for (const i of items) present.set(`${i.category}/${i.subcategory}`, (present.get(`${i.category}/${i.subcategory}`) ?? 0) + 1);
    return CATEGORIES.map(c => ({
      ...c,
      types: Object.entries(TYPES[c.id]).filter(([t]) => present.has(`${c.id}/${t}`)).map(([t, info]) => ({ id: t, label: info.label, n: present.get(`${c.id}/${t}`)! })),
    })).filter(c => c.types.length);
  }, [items]);
  const allKinds = kinds.flatMap(c => c.types.map(t => t.id));
  const chosen = types ?? allKinds;
  const toggleKind = (t: string) => setTypes(chosen.includes(t) ? chosen.filter(x => x !== t) : [...chosen, t]);
  const toggleCategory = (cat: Category) => {
    const ids = kinds.find(k => k.id === cat)?.types.map(t => t.id) ?? [];
    const allOn = ids.every(id => chosen.includes(id));
    setTypes(allOn ? chosen.filter(x => !ids.includes(x)) : [...new Set([...chosen, ...ids])]);
  };

  const updateStop = (i: number, patch: Partial<Stop>) => setStops(s => s.map((x, j) => {
    if (j !== i) return x;
    const next = { ...x, ...patch };
    if (patch.start && next.end < patch.start) next.end = patch.start;
    return next;
  }));
  const addStop = () => setStops(s => { const last = [...s].sort((a, b) => a.start.localeCompare(b.start)).at(-1)!; return [...s, { place: '', start: last.end, end: addDays(last.end, 2), note: '' }]; });

  const applyItinerary = (it: Itinerary) => {
    setStops(it.stops.map(s => ({ place: s.place, start: s.start, end: s.end, note: s.note ?? '' })));
    setDayNotes(Object.fromEntries(it.days.map(d => [d.date, d.note])));
    if (it.title && !title) setTitle(it.title);
    setSkip([]);
  };

  const plan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setBusy(true);
    const startedAt = new Date(Date.now() - 5000).toISOString();
    try {
      const r = await api<{ id: string; notice: string }>('/api/ai/trip', {
        wardrobeId, title, stops: sorted, dayNotes: Object.fromEntries(Object.entries(dayNotes).filter(([d, n]) => dates.includes(d) && n.trim())),
        skipDays: skip.filter(d => dates.includes(d)), types: types && types.length < allKinds.length ? types : [],
        mustPack, leaveHome, activities, preferences,
      });
      if (r.notice) toast(r.notice);
      await reload();
      router.push(`/app/trips/${r.id}`);
    } catch (err) {
      // A long request can lose its connection after the trip was saved: look for it before reporting a failure.
      if (!(err instanceof ApiError)) {
        const { data } = await sb.from('trip_plans').select('id').gte('created_at', startedAt).order('created_at', { ascending: false }).limit(1);
        if (data?.[0]) { router.push(`/app/trips/${data[0].id}`); return; }
        toast('The connection dropped before the plan came back. Check your connection and try again.', { tone: 'bad' });
      } else toast(aiErrorText(err), { tone: 'bad' });
      setBusy(false);
    } finally { reloadQuotas(); }
  };
  const remove = async (id: string) => {
    if (!confirm('Delete this trip and its planned outfits?')) return;
    const { data: links } = await sb.from('trip_outfits').select('outfit_id').eq('trip_id', id);
    await sb.from('trip_plans').delete().eq('id', id);
    if (links?.length) await sb.from('outfit_combinations').delete().in('id', links.map(l => l.outfit_id)).eq('favourite', false);
    setTrips(t => t?.filter(x => x.id !== id) ?? null);
  };

  const enough = items.some(i => i.category === 'top' || i.category === 'onepiece');

  return (
    <>
      <PageHeader eyebrow="Trip Planner" title="Pack once, dress well every day">Add where you’re going (or drop in your itinerary). Every day gets an outfit for that place’s weather, from clothes you own.</PageHeader>
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <form onSubmit={plan} className="space-y-6">
          <ItineraryReader startHint={start} onRead={applyItinerary} />

          <Card className="p-4 sm:p-6">
            <h2 className="mb-1 font-serif text-xl">Where and when</h2>
            <p className="mb-4 text-sm text-muted">One row per place. Weather is checked for each place on its own dates.</p>
            <Field label="Trip name" hint="Optional" className="mb-4">{id => <Input id={id} maxLength={120} value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Japan in November" />}</Field>
            <ol className="space-y-3">
              {stops.map((s, i) => (
                <li key={i} className="rounded-xl border border-line p-3">
                  <div className="grid gap-3 sm:grid-cols-[1fr_150px_150px_auto] sm:items-end">
                    <Field label={stops.length > 1 ? `Stop ${i + 1}` : 'Destination'}>{id => <Input id={id} required value={s.place} maxLength={120} onChange={e => updateStop(i, { place: e.target.value })} placeholder="City or area, e.g. Hakone" />}</Field>
                    <Field label="From">{id => <Input id={id} type="date" required value={s.start} onChange={e => updateStop(i, { start: e.target.value })} />}</Field>
                    <Field label="To" error={s.end < s.start ? 'Before the start' : null}>{id => <Input id={id} type="date" required min={s.start} value={s.end} onChange={e => updateStop(i, { end: e.target.value })} />}</Field>
                    {stops.length > 1 && <button type="button" onClick={() => setStops(x => x.filter((_, j) => j !== i))} className="mb-1 self-end rounded-lg p-2 text-muted hover:bg-sunk hover:text-danger" aria-label={`Remove stop ${i + 1}`}><X className="size-4" /></button>}
                  </div>
                  <Input aria-label={`Plans in stop ${i + 1}`} className="mt-3" maxLength={200} value={s.note} onChange={e => updateStop(i, { note: e.target.value })} placeholder="Plans there (optional), e.g. temples, street food, onsen" />
                </li>
              ))}
            </ol>
            <Button type="button" variant="secondary" size="sm" className="mt-3" onClick={addStop} disabled={stops.length >= 8}><Plus className="size-4" /> Add a stop</Button>

            {dates.length > 0 && dates.length <= 21 && (
              <details className="mt-5 rounded-xl bg-sunk/60 p-3" open={Object.keys(dayNotes).length > 0}>
                <summary className="cursor-pointer text-sm font-medium">Day-by-day plans ({dates.length} day{dates.length === 1 ? '' : 's'})</summary>
                <p className="mt-1 text-xs text-muted">A short line per day helps match outfits to what you’re doing. Turn off days you don’t need an outfit for, such as a long flight.</p>
                <ul className="mt-3 space-y-2">
                  {dates.map(d => {
                    const off = skip.includes(d);
                    return (
                      <li key={d} className="grid grid-cols-[92px_1fr_auto] items-center gap-2">
                        <span className={cx('text-sm', off && 'text-muted line-through')}>{short(d)}</span>
                        <Input aria-label={`Plan for ${short(d)}`} disabled={off} value={dayNotes[d] ?? ''} maxLength={200} onChange={e => setDayNotes(n => ({ ...n, [d]: e.target.value }))} placeholder="e.g. Universal Studios" className="h-9 text-sm" />
                        <button type="button" onClick={() => setSkip(x => (off ? x.filter(y => y !== d) : [...x, d]))} className="rounded-lg px-2 py-1 text-xs text-muted hover:bg-card" aria-pressed={!off}>{off ? 'Add back' : 'No outfit'}</button>
                      </li>
                    );
                  })}
                </ul>
              </details>
            )}
          </Card>

          <Card className="p-4 sm:p-6">
            <h2 className="mb-1 font-serif text-xl">What to pack</h2>
            <p className="mb-4 text-sm text-muted">Choose the kinds of clothes you want on this trip. Only these will be planned.</p>
            {kinds.length ? (
              <div className="space-y-3">
                {kinds.map(c => (
                  <div key={c.id}>
                    <button type="button" onClick={() => toggleCategory(c.id)} className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted hover:text-ink">{c.label}</button>
                    <div className="flex flex-wrap gap-2">
                      {c.types.map(t => <Chip key={t.id} type="button" active={chosen.includes(t.id)} onClick={() => toggleKind(t.id)}>{t.label} <span className="text-muted">{t.n}</span></Chip>)}
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-muted">Your wardrobe is empty.</p>}

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <PiecePick label="Must take" hint="Pieces you definitely want to bring" ids={mustPack} byId={byId} onAdd={() => setPicker('must')} onRemove={id => setMustPack(x => x.filter(y => y !== id))} />
              <PiecePick label="Leave at home" hint="Pieces the plan should never use" ids={leaveHome} byId={byId} onAdd={() => setPicker('leave')} onRemove={id => setLeaveHome(x => x.filter(y => y !== id))} />
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field label="What will you be doing?" className="sm:col-span-2">{id => <Textarea id={id} maxLength={400} value={activities} onChange={e => setActivities(e.target.value)} placeholder="Lots of walking, one nice dinner, a hike" className="min-h-20" />}</Field>
              <Field label="Preferences" hint="Optional, e.g. carry-on only, minimal ironing" className="sm:col-span-2">{id => <Input id={id} maxLength={400} value={preferences} onChange={e => setPreferences(e.target.value)} />}</Field>
            </div>
          </Card>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" loading={busy} disabled={!valid || !enough}><Plane className="size-4" /> Plan {dates.length > 0 && dates.length <= 21 ? `${dates.length} day${dates.length === 1 ? '' : 's'}` : 'trip'}</Button>
            <QuotaNote kind="trip" />
            {dates.length > 21 && <span className="text-sm text-danger">Trips can be up to 21 days.</span>}
            {busy && <span className="text-sm text-muted">Checking the weather for each place and building outfits. This can take up to a minute.</span>}
          </div>
          {!enough && <p className="text-sm text-warn">Add a few tops first (bottoms and shoes help too).</p>}
        </form>

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

      <ItemPicker open={picker !== null} onClose={() => setPicker(null)} multi title={picker === 'must' ? 'Pieces to bring' : 'Pieces to leave at home'}
        items={items} selected={picker === 'must' ? mustPack : leaveHome} key={picker ?? 'none'}
        filter={i => (picker === 'must' ? !leaveHome.includes(i.id) : !mustPack.includes(i.id))}
        onPick={ids => (picker === 'must' ? setMustPack(ids) : setLeaveHome(ids))} />
    </>
  );
}

function PiecePick({ label, hint, ids, byId, onAdd, onRemove }: { label: string; hint: string; ids: string[]; byId: ReturnType<typeof useStore>['byId']; onAdd: () => void; onRemove: (id: string) => void }) {
  return (
    <div>
      <div className="mb-1 text-sm font-medium">{label}</div>
      <p className="mb-2 text-xs text-muted">{hint}</p>
      <div className="flex flex-wrap gap-2">
        {ids.map(id => byId(id)).filter(Boolean).map(p => (
          <span key={p!.id} className="flex items-center gap-1.5 rounded-full border border-line bg-card py-1 pl-1 pr-2 text-sm">
            <span className="size-6 overflow-hidden rounded-full"><ItemImage item={p!} ratio="aspect-square" /></span>
            <span className="max-w-32 truncate">{p!.name}</span>
            <button type="button" onClick={() => onRemove(p!.id)} aria-label={`Remove ${p!.name}`} className="text-muted hover:text-danger"><X className="size-3.5" /></button>
          </span>
        ))}
        <Button type="button" variant="secondary" size="sm" onClick={onAdd}><Plus className="size-4" /> Choose</Button>
      </div>
    </div>
  );
}

/** Paste, type, photograph or upload an itinerary; the places and dates fill the form for review. */
function ItineraryReader({ startHint, onRead }: { startHint: string; onRead: (it: Itinerary) => void }) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [read, setRead] = useState<Itinerary | null>(null);

  const go = async () => {
    setBusy(true);
    try {
      let payload: { mime: string; data: string } | undefined;
      if (file) {
        const blob = file.type.startsWith('image/') ? (await compress(file, 2000)).blob : file;
        const mime = file.type.startsWith('image/') ? 'image/jpeg' : file.type || 'application/pdf';
        if (blob.size > 4 * 1024 * 1024) throw new ApiError('That file is over 4 MB. Try a screenshot of the itinerary instead.', 'too_big', 400);
        payload = { mime, data: await toBase64(blob) };
      }
      const it = await api<Itinerary>('/api/ai/itinerary', { text, file: payload, startHint });
      onRead(it); setRead(it);
      toast(`Found ${it.stops.length} stop${it.stops.length === 1 ? '' : 's'}. Check the dates below.`);
    } catch (e) { toast(aiErrorText(e), { tone: 'bad' }); }
    finally { setBusy(false); }
  };

  return (
    <Card className="p-4 sm:p-6">
      <div className="mb-1 flex items-center gap-2"><ScanText className="size-5 text-accent" /><h2 className="font-serif text-xl">Have an itinerary?</h2></div>
      <p className="mb-4 text-sm text-muted">Paste it, or add a screenshot, photo or PDF. We’ll pull out each place and date so you can check them.</p>
      <Textarea aria-label="Itinerary text" maxLength={8000} value={text} onChange={e => setText(e.target.value)} className="min-h-24" placeholder={'7–9 Nov: Osaka (Dotonbori, Osaka Castle)\n10–11 Nov: Hakone, ryokan and onsen\n12–15 Nov: Tokyo'} />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input ref={fileRef} type="file" accept="image/*,application/pdf,text/plain" className="sr-only" onChange={e => setFile(e.target.files?.[0] ?? null)} />
        <Button type="button" variant="secondary" size="sm" onClick={() => fileRef.current?.click()}><FileText className="size-4" /> {file ? 'Change file' : 'Add a file'}</Button>
        {file && <span className="flex items-center gap-1 text-sm text-ink-2"><span className="max-w-48 truncate">{file.name}</span><button type="button" aria-label="Remove file" onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ''; }} className="text-muted hover:text-danger"><X className="size-3.5" /></button></span>}
        <Button type="button" size="sm" loading={busy} disabled={!text.trim() && !file} onClick={go}><ScanText className="size-4" /> Read itinerary</Button>
      </div>
      {read && (
        <ul className="mt-4 space-y-1 text-sm">
          {read.stops.map((s, i) => <li key={i} className="flex items-center gap-2 text-ink-2"><MapPin className="size-3.5 text-accent" /> <b className="font-medium text-ink">{s.place}</b> {fmtRange(s.start, s.end)}{s.note && <span className="text-muted">· {s.note}</span>}</li>)}
          {!read.hadDates && <li className="text-warn">Your itinerary had no dates, so days were counted from {short(startHint)}. Change the dates below if needed.</li>}
        </ul>
      )}
    </Card>
  );
}

function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}
