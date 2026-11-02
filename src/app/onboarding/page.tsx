'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Check, LocateFixed, Sparkles } from 'lucide-react';
import { BRAND } from '@/lib/brand';
import { COLORS } from '@/lib/engine';
import { STYLE_OPTIONS, type Preferences } from '@/lib/style-options';
import { Button, Chip, Input, Progress, useToast } from '@/components/ui';
import { useStore } from '@/components/app/store';
import { AddFlow } from '@/components/app/add-flow';

const STEPS = ['Welcome', 'Your style', 'Weather', 'First pieces', 'Tour'];
type Place = { name: string; lat: number; lon: number };

export default function Onboarding() {
  const { profile, updateProfile, items } = useStore();
  const toast = useToast();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [prefs, setPrefs] = useState<Preferences>({});
  const [city, setCity] = useState('');
  const [places, setPlaces] = useState<Place[]>([]);

  // Resume where the person left off.
  useEffect(() => {
    if (!profile) return;
    const ob = profile.onboarding as { step?: number; done?: boolean };
    if (ob?.done) { router.replace('/app'); return; }
    setStep(Math.min(ob?.step ?? 0, STEPS.length - 1));
    setPrefs((profile.preferences ?? {}) as Preferences);
    setCity(profile.city ?? '');
  }, [profile, router]);

  const go = async (to: number, patch: Record<string, unknown> = {}) => {
    setStep(to);
    await updateProfile({ ...patch, onboarding: { step: to, done: false } });
    window.scrollTo({ top: 0 });
  };
  const finish = async (tour: boolean) => {
    await updateProfile({ onboarding: { step: STEPS.length, done: true }, tour_done: !tour });
    router.replace('/app');
    router.refresh();
  };
  const toggle = (k: 'styles' | 'occasions' | 'colours', v: string) => setPrefs(p => ({ ...p, [k]: (p[k] ?? []).includes(v) ? p[k]!.filter(x => x !== v) : [...(p[k] ?? []), v] }));
  const search = async () => { const r = await fetch(`/api/geocode?q=${encodeURIComponent(city.trim())}`); setPlaces(r.ok ? await r.json() : []); };

  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col px-4 py-6 sm:px-6">
      <header className="mb-8 flex items-center gap-4">
        <span className="font-serif text-2xl">{BRAND.name}</span>
        <div className="flex-1"><Progress value={((step + 1) / STEPS.length) * 100} /></div>
        <span className="text-sm text-muted">{step + 1} / {STEPS.length}</span>
      </header>

      <main className="flex-1 animate-rise" key={step}>
        {step === 0 && (
          <div className="py-10 text-center">
            <Sparkles className="mx-auto size-10 text-accent" />
            <h1 className="mt-6 font-serif text-4xl sm:text-5xl">Hi {profile?.display_name?.split(' ')[0] ?? 'there'}, welcome to {BRAND.name}</h1>
            <p className="mx-auto mt-4 max-w-md text-lg text-ink-2">In two minutes you’ll have a wardrobe that knows what you own, and outfits picked for today’s weather.</p>
            <ul className="mx-auto mt-8 max-w-sm space-y-2 text-left">{BRAND.promises.map(p => <li key={p} className="flex gap-2"><Check className="mt-0.5 size-5 text-sage" />{p}</li>)}</ul>
          </div>
        )}
        {step === 1 && (
          <div className="space-y-7">
            <div><h1 className="font-serif text-3xl">Tell us your style</h1><p className="mt-1 text-muted">It shapes every suggestion. Change it any time in Profile.</p></div>
            <Q label="I mostly wear">{STYLE_OPTIONS.clothing.map(o => <Chip key={o.id} active={prefs.clothing === o.id} onClick={() => setPrefs(p => ({ ...p, clothing: o.id }))}>{o.label}</Chip>)}</Q>
            <Q label="My style (pick any)">{STYLE_OPTIONS.styles.map(o => <Chip key={o.id} active={!!prefs.styles?.includes(o.id)} onClick={() => toggle('styles', o.id)}>{o.label}</Chip>)}</Q>
            <Q label="I usually dress for">{STYLE_OPTIONS.occasions.map(o => <Chip key={o.id} active={!!prefs.occasions?.includes(o.id)} onClick={() => toggle('occasions', o.id)}>{o.label}</Chip>)}</Q>
            <Q label="Colours I love">{COLORS.filter(c => c.hex.startsWith('#')).map(c => (
              <button key={c.id} onClick={() => toggle('colours', c.id)} aria-pressed={!!prefs.colours?.includes(c.id)} aria-label={c.label} title={c.label}
                className={`size-9 rounded-full border-2 transition ${prefs.colours?.includes(c.id) ? 'scale-110 border-ink' : 'border-line'}`} style={{ background: c.hex }} />
            ))}</Q>
          </div>
        )}
        {step === 2 && (
          <div className="space-y-5">
            <div><h1 className="font-serif text-3xl">Where are you?</h1><p className="mt-1 text-muted">So outfits suit the weather. We only use it to fetch the forecast.</p></div>
            <Button variant="secondary" onClick={() => navigator.geolocation.getCurrentPosition(
              async pos => { await updateProfile({ lat: pos.coords.latitude, lon: pos.coords.longitude, city: 'Current location', use_device_location: true }); setCity('Current location'); toast('Got your location', { tone: 'good' }); },
              () => toast('Permission declined — type your city instead.', { tone: 'bad' }), { timeout: 10000 })}>
              <LocateFixed className="size-4" /> Use my location
            </Button>
            <div className="flex gap-2"><Input aria-label="City" value={city} onChange={e => setCity(e.target.value)} onKeyDown={e => e.key === 'Enter' && search()} placeholder="Or type a city, e.g. Pune" /><Button variant="secondary" onClick={search}>Search</Button></div>
            {places.length > 0 && <ul className="divide-y divide-line rounded-xl border border-line bg-card">{places.map(p => (
              <li key={`${p.lat},${p.lon}`}><button className="w-full px-4 py-3 text-left text-sm hover:bg-sunk" onClick={async () => { await updateProfile({ city: p.name, lat: p.lat, lon: p.lon, use_device_location: false }); setCity(p.name); setPlaces([]); toast(`Set to ${p.name}`, { tone: 'good' }); }}>{p.name}</button></li>
            ))}</ul>}
            {profile?.lat != null && <p className="flex items-center gap-2 text-sm text-sage"><Check className="size-4" /> Weather location: {profile.city}</p>}
          </div>
        )}
        {step === 3 && (
          <div>
            <AddFlow embedded />
            {items.length > 0 && <p className="mt-4 flex items-center gap-2 text-sm text-sage"><Check className="size-4" /> {items.length} piece{items.length === 1 ? '' : 's'} in your wardrobe</p>}
          </div>
        )}
        {step === 4 && (
          <div className="py-10 text-center">
            <h1 className="font-serif text-4xl">You’re all set</h1>
            <p className="mx-auto mt-3 max-w-md text-ink-2">Want a one-minute tour of where everything is? You can replay it from Help any time.</p>
            <div className="mt-8 flex flex-col items-center gap-3">
              <Button size="lg" onClick={() => finish(true)}>Show me around</Button>
              <Button variant="ghost" onClick={() => finish(false)}>Skip the tour</Button>
            </div>
          </div>
        )}
      </main>

      {step < 4 && (
        <footer className="sticky bottom-0 -mx-4 mt-8 flex items-center gap-3 border-t border-line bg-paper/95 px-4 py-4 backdrop-blur pb-safe sm:mx-0 sm:px-0">
          {step > 0 && <Button variant="ghost" onClick={() => go(step - 1)}><ArrowLeft className="size-4" /> Back</Button>}
          <span className="flex-1" />
          {(step === 2 || step === 3) && <Button variant="ghost" onClick={() => go(step + 1)}>Skip for now</Button>}
          <Button onClick={() => go(step + 1, step === 1 ? { preferences: prefs } : {})}>{step === 0 ? 'Get started' : 'Continue'} <ArrowRight className="size-4" /></Button>
        </footer>
      )}
    </div>
  );
}

function Q({ label, children }: { label: string; children: React.ReactNode }) {
  return <fieldset><legend className="mb-3 font-medium">{label}</legend><div className="flex flex-wrap gap-2">{children}</div></fieldset>;
}
