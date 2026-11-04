'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ChevronRight, CreditCard, Database, LocateFixed, LogOut, Pencil, Plus, Shield, Trash2 } from 'lucide-react';
import { COLORS } from '@/lib/engine';
import { dbErrorMessage } from '@/lib/api-client';
import { STYLE_OPTIONS, type Preferences } from '@/lib/style-options';
import { Badge, Button, Card, Chip, Field, Input, PageHeader, Textarea, useToast } from '@/components/ui';
import { useStore } from '@/components/app/store';

type Place = { name: string; admin?: string; country?: string; lat: number; lon: number };

export default function ProfilePage() {
  const { profile, updateProfile, quotas, plans, wardrobes, wardrobeId, setWardrobe, sb, user, reload, refreshWeather } = useStore();
  const toast = useToast();
  const [name, setName] = useState('');
  const [prefs, setPrefs] = useState<Preferences>({});
  const [city, setCity] = useState('');
  const [places, setPlaces] = useState<Place[]>([]);
  const [newWardrobe, setNewWardrobe] = useState('');
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    if (!profile) return;
    setName(profile.display_name ?? ''); setPrefs((profile.preferences ?? {}) as Preferences); setCity(profile.city ?? '');
  }, [profile]);
  useEffect(() => { if (location.hash === '#location') document.getElementById('location')?.scrollIntoView({ block: 'center' }); }, []);

  const plan = plans.find(p => p.id === quotas?.plan);
  const notify = (profile?.notify ?? {}) as { product?: boolean; usage?: boolean };
  const toggle = (k: 'styles' | 'occasions' | 'colours', v: string) => setPrefs(p => ({ ...p, [k]: (p[k] ?? []).includes(v) ? p[k]!.filter(x => x !== v) : [...(p[k] ?? []), v] }));

  const saveAbout = async () => { await updateProfile({ display_name: name.trim().slice(0, 60) || null, preferences: prefs }); toast('Saved', { tone: 'good' }); };
  const search = async () => {
    if (city.trim().length < 2) return;
    const r = await fetch(`/api/geocode?q=${encodeURIComponent(city.trim())}`);
    setPlaces(r.ok ? await r.json() : []);
  };
  const setPlace = async (p: Place) => { await updateProfile({ city: p.name, lat: p.lat, lon: p.lon, use_device_location: false }); setPlaces([]); setCity(p.name); toast(`Weather set to ${p.name}`, { tone: 'good' }); refreshWeather(); };
  const useDevice = () => navigator.geolocation.getCurrentPosition(
    async pos => { await updateProfile({ lat: pos.coords.latitude, lon: pos.coords.longitude, city: 'Current location', use_device_location: true }); setCity('Current location'); toast('Using your location', { tone: 'good' }); },
    () => toast('Location permission was declined. Type your city instead.', { tone: 'bad' }), { timeout: 10000 });

  const addWardrobe = async () => {
    if (!newWardrobe.trim()) return;
    const { error } = await sb.from('wardrobe_profiles').insert({ user_id: user.id, name: newWardrobe.trim().slice(0, 40) });
    if (error) toast(dbErrorMessage(error.message), { tone: 'bad' }); else { setNewWardrobe(''); await reload(); toast('Wardrobe profile added', { tone: 'good' }); }
  };
  const removeWardrobe = async (id: string, n: string) => {
    if (wardrobes.length < 2) return;
    if (!confirm(`Delete “${n}” and every piece, outfit and trip in it? This can’t be undone.`)) return;
    const { data: imgs } = await sb.from('clothing_images').select('bucket, path, clothing_items!inner(wardrobe_profile_id)').eq('clothing_items.wardrobe_profile_id', id);
    await sb.from('wardrobe_profiles').delete().eq('id', id);
    const byB: Record<string, string[]> = {};
    (imgs ?? []).forEach(i => (byB[i.bucket] ??= []).push(i.path));
    for (const [b, paths] of Object.entries(byB)) await sb.storage.from(b).remove(paths);
    if (id === wardrobeId) await setWardrobe(wardrobes.find(w => w.id !== id)!.id); else await reload();
  };

  return (
    <>
      <PageHeader eyebrow="Profile" title={profile?.display_name || 'Your profile'}>{user.email}</PageHeader>
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Card className="space-y-5 p-4 sm:p-6">
            <h2 className="font-serif text-xl">About you</h2>
            <Field label="Name">{id => <Input id={id} value={name} maxLength={60} onChange={e => setName(e.target.value)} />}</Field>
            <Group label="I mostly wear">{STYLE_OPTIONS.clothing.map(o => <Chip key={o.id} active={prefs.clothing === o.id} onClick={() => setPrefs(p => ({ ...p, clothing: o.id }))}>{o.label}</Chip>)}</Group>
            <Group label="My style">{STYLE_OPTIONS.styles.map(o => <Chip key={o.id} active={!!prefs.styles?.includes(o.id)} onClick={() => toggle('styles', o.id)}>{o.label}</Chip>)}</Group>
            <Group label="I dress for">{STYLE_OPTIONS.occasions.map(o => <Chip key={o.id} active={!!prefs.occasions?.includes(o.id)} onClick={() => toggle('occasions', o.id)}>{o.label}</Chip>)}</Group>
            <Group label="Colours I love">
              {COLORS.filter(c => c.hex.startsWith('#')).map(c => (
                <button key={c.id} onClick={() => toggle('colours', c.id)} aria-pressed={!!prefs.colours?.includes(c.id)} title={c.label} aria-label={c.label}
                  className={`size-8 rounded-full border-2 transition ${prefs.colours?.includes(c.id) ? 'border-ink scale-110' : 'border-line'}`} style={{ background: c.hex }} />
              ))}
            </Group>
            <Field label="Anything to avoid?" hint="e.g. no skinny fits, nothing sleeveless">{id => <Textarea id={id} maxLength={300} value={prefs.avoid ?? ''} onChange={e => setPrefs(p => ({ ...p, avoid: e.target.value }))} className="min-h-16" />}</Field>
            <Button onClick={saveAbout}>Save</Button>
          </Card>

          <Card id="location" className="space-y-3 scroll-mt-24 p-4 sm:p-6">
            <h2 className="font-serif text-xl">Weather location</h2>
            <p className="text-sm text-muted">Used only to fetch the forecast for outfit suggestions. {profile?.city ? <>Currently: <b className="text-ink">{profile.city}</b></> : 'Not set yet.'}</p>
            <div className="flex gap-2">
              <Input aria-label="City" value={city} onChange={e => setCity(e.target.value)} onKeyDown={e => e.key === 'Enter' && search()} placeholder="Search a city" />
              <Button variant="secondary" onClick={search}>Search</Button>
            </div>
            {places.length > 0 && <ul className="divide-y divide-line rounded-xl border border-line">{places.map(p => <li key={`${p.lat},${p.lon}`}><button className="w-full px-3 py-2 text-left text-sm hover:bg-sunk" onClick={() => setPlace(p)}>{p.name}<span className="text-muted">{[p.admin, p.country].filter(Boolean).map(x => `, ${x}`).join('')}</span></button></li>)}</ul>}
            <Button variant="ghost" size="sm" onClick={useDevice}><LocateFixed className="size-4" /> Use my current location</Button>
          </Card>

          <Card className="space-y-3 p-4 sm:p-6">
            <div className="flex items-center justify-between"><h2 className="font-serif text-xl">Wardrobe profiles</h2><span className="text-sm text-muted">{wardrobes.length} of {quotas?.profiles ?? 1}</span></div>
            <p className="text-sm text-muted">Separate wardrobes — for example yours and a partner’s, or home and a hostel.</p>
            <ul className="divide-y divide-line rounded-xl border border-line">
              {wardrobes.map(w => (
                <li key={w.id} className="flex items-center gap-2 px-3 py-2">
                  {renaming?.id === w.id ? (
                    <>
                      <Input aria-label="Wardrobe name" autoFocus value={renaming.name} maxLength={40} onChange={e => setRenaming({ ...renaming, name: e.target.value })} />
                      <Button size="sm" onClick={async () => { await sb.from('wardrobe_profiles').update({ name: renaming.name.trim() || w.name }).eq('id', w.id); setRenaming(null); reload(); }}>Save</Button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 truncate text-sm">{w.name}</span>
                      {w.id === wardrobeId ? <Badge tone="good">Active</Badge> : <Button size="sm" variant="ghost" onClick={() => setWardrobe(w.id)}>Switch</Button>}
                      <button aria-label={`Rename ${w.name}`} onClick={() => setRenaming({ id: w.id, name: w.name })} className="p-1.5 text-muted"><Pencil className="size-4" /></button>
                      {wardrobes.length > 1 && <button aria-label={`Delete ${w.name}`} onClick={() => removeWardrobe(w.id, w.name)} className="p-1.5 text-muted hover:text-danger"><Trash2 className="size-4" /></button>}
                    </>
                  )}
                </li>
              ))}
            </ul>
            {wardrobes.length < (quotas?.profiles ?? 1) ? (
              <div className="flex gap-2"><Input aria-label="New wardrobe name" value={newWardrobe} maxLength={40} onChange={e => setNewWardrobe(e.target.value)} placeholder="e.g. Aditi’s wardrobe" /><Button variant="secondary" onClick={addWardrobe}><Plus className="size-4" /> Add</Button></div>
            ) : <p className="text-sm text-muted">Need more? <Link href="/app/profile/billing" className="text-accent">Pro allows up to 3.</Link></p>}
          </Card>

          <Card className="space-y-3 p-4 sm:p-6">
            <h2 className="font-serif text-xl">Emails</h2>
            {([['usage', 'When I’m close to a plan limit'], ['product', 'Occasional product updates']] as const).map(([k, label]) => (
              <label key={k} className="flex items-center justify-between gap-3 text-sm">{label}
                <input type="checkbox" className="size-5 accent-[var(--accent)]" checked={notify[k] !== false} onChange={e => updateProfile({ notify: { ...notify, [k]: e.target.checked } })} />
              </label>
            ))}
            <p className="text-xs text-muted">Account and payment emails (receipts, password resets) are always sent.</p>
          </Card>
        </div>

        <aside className="space-y-3">
          <Card className="p-4 sm:p-5">
            <div className="flex items-center justify-between"><span className="text-sm text-muted">Plan</span><Badge tone="accent">{plan?.name ?? 'Free'}</Badge></div>
            {quotas && (
              <dl className="mt-3 space-y-1.5 text-sm">
                <Row k="Wardrobe items" v={`limit ${quotas.items}`} />
                <Row k="Studio photos left" v={quotas.studio.remaining} />
                <Row k="Stylist requests left" v={quotas.styling.remaining} />
                <Row k="Chat messages left" v={quotas.chat.remaining} />
              </dl>
            )}
          </Card>
          <NavRow href="/app/profile/billing" icon={<CreditCard className="size-5" />} label="Plan & billing" />
          <NavRow href="/app/profile/data" icon={<Database className="size-5" />} label="Your data: export, import, delete" />
          <NavRow href="/privacy" icon={<Shield className="size-5" />} label="Privacy policy" />
          <form action="/auth/signout" method="post"><Button type="submit" variant="ghost" block><LogOut className="size-4" /> Sign out</Button></form>
        </aside>
      </div>
    </>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return <fieldset><legend className="mb-2 text-sm font-medium">{label}</legend><div className="flex flex-wrap gap-2">{children}</div></fieldset>;
}
function Row({ k, v }: { k: string; v: string | number }) { return <div className="flex justify-between"><dt className="text-muted">{k}</dt><dd>{v}</dd></div>; }
function NavRow({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return <Link href={href} className="flex items-center gap-3 rounded-2xl border border-line bg-card p-4 text-sm transition hover:border-line-strong">{icon}<span className="flex-1">{label}</span><ChevronRight className="size-4 text-muted" /></Link>;
}
