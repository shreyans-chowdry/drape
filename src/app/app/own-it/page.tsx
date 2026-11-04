'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Bookmark, Camera, CheckCircle2, CircleDashed, CircleHelp, ImagePlus, Trash2 } from 'lucide-react';
import type { OwnItResult } from '@/lib/ai/features';
import { api } from '@/lib/api-client';
import { compress } from '@/lib/images';
import { inr, type Item } from '@/lib/model';
import { Badge, Button, Card, cx, Empty, Input, PageHeader, Spinner, useToast } from '@/components/ui';
import { ItemImage, ItemTile } from '@/components/app/items';
import { aiErrorText, QuotaNote } from '@/components/app/ai';
import { useStore } from '@/components/app/store';

type Wish = { id: string; name: string; image_path: string | null; verdict: string | null; price: number | null; note: string | null; url?: string | null; created_at: string; signed?: string | null };

const VERDICT = {
  exact: { icon: CheckCircle2, title: 'You already own this', tone: 'text-sage', body: 'It looks like the same piece is in your wardrobe.' },
  similar: { icon: CircleDashed, title: 'You own something similar', tone: 'text-warn', body: 'Not the same, but close — check the differences before you buy.' },
  not_found: { icon: CircleHelp, title: 'Nothing like it in your wardrobe', tone: 'text-accent', body: 'This would be a new addition.' },
} as const;

export default function OwnItPage() {
  const { sb, user, wardrobeId, byId, reloadQuotas } = useStore();
  const toast = useToast();
  const [photo, setPhoto] = useState<{ url: string; blob: Blob; path: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<OwnItResult | null>(null);
  const [price, setPrice] = useState('');
  const [wishes, setWishes] = useState<Wish[]>([]);
  const cam = useRef<HTMLInputElement>(null), pick = useRef<HTMLInputElement>(null);

  const loadWishes = useCallback(async () => {
    const { data } = await sb.from('shopping_wishlist').select('*').eq('wardrobe_profile_id', wardrobeId).order('created_at', { ascending: false });
    const rows = (data ?? []) as Wish[];
    const paths = rows.map(r => r.image_path).filter(Boolean) as string[];
    const { data: signed } = paths.length ? await sb.storage.from('originals').createSignedUrls(paths, 3600) : { data: [] };
    setWishes(rows.map(r => ({ ...r, signed: signed?.find(s => s.path === r.image_path)?.signedUrl })));
  }, [sb, wardrobeId]);
  useEffect(() => { if (wardrobeId) loadWishes(); }, [wardrobeId, loadWishes]);

  const check = async (file?: File) => {
    if (!file) return;
    setBusy(true); setResult(null);
    try {
      const { blob } = await compress(file, 1400);
      const path = `${user.id}/ownit/${crypto.randomUUID()}.jpg`;
      const { error } = await sb.storage.from('temp').upload(path, blob, { contentType: 'image/jpeg' });
      if (error) throw new Error('upload');
      setPhoto({ url: URL.createObjectURL(blob), blob, path });
      setResult(await api<OwnItResult>('/api/ai/ownit', { path, wardrobeId }));
    } catch (e) {
      toast(aiErrorText(e), { tone: 'bad' });
    } finally { setBusy(false); reloadQuotas(); }
  };

  const saveWish = async () => {
    if (!result || !photo) return;
    const id = crypto.randomUUID(), image_path = `${user.id}/wishlist/${id}.jpg`;
    await sb.storage.from('originals').upload(image_path, photo.blob, { contentType: 'image/jpeg' });
    const { error } = await sb.from('shopping_wishlist').insert({ id, user_id: user.id, wardrobe_profile_id: wardrobeId, name: result.item.name, image_path, verdict: result.verdict, result: result as never, price: price ? Number(price) : null });
    toast(error ? 'Could not save to your wishlist.' : 'Saved to your wishlist', { tone: error ? 'bad' : 'good' });
    loadWishes();
  };
  const removeWish = async (w: Wish) => {
    await sb.from('shopping_wishlist').delete().eq('id', w.id);
    if (w.image_path) await sb.storage.from('originals').remove([w.image_path]);
    setWishes(l => l.filter(x => x.id !== w.id));
  };

  const v = result ? VERDICT[result.verdict] : null;
  return (
    <>
      <PageHeader eyebrow="Own It" title="Do I already own this?">In a shop or browsing online? Take a photo or a screenshot. Drape compares it with your wardrobe before you spend.</PageHeader>

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <div className="space-y-3">
          <input ref={cam} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => { check(e.target.files?.[0]); e.target.value = ''; }} />
          <input ref={pick} type="file" accept="image/*" className="hidden" onChange={e => { check(e.target.files?.[0]); e.target.value = ''; }} />
          <Card className="overflow-hidden">
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element -- local preview
              <img src={photo.url} alt="The item you’re checking" className="aspect-[4/5] w-full bg-studio object-contain" />
            ) : (
              <div className="flex aspect-[4/5] flex-col items-center justify-center gap-3 bg-sunk p-6 text-center text-sm text-muted">
                <Camera className="size-8" /> A clear photo of the item, or a product screenshot
              </div>
            )}
          </Card>
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => cam.current?.click()} disabled={busy}><Camera className="size-4" /> Photo</Button>
            <Button variant="secondary" onClick={() => pick.current?.click()} disabled={busy}><ImagePlus className="size-4" /> Upload</Button>
          </div>
          <QuotaNote kind="ownit" />
        </div>

        <div>
          {busy && <Card className="flex items-center gap-3 p-6 text-sm"><Spinner /> Comparing with your wardrobe…</Card>}
          {result && v && (
            <div className="space-y-4">
              <Card className="p-5 sm:p-6">
                <div className={cx('flex items-center gap-2 font-serif text-2xl', v.tone)}><v.icon className="size-6" /> {v.title}</div>
                <p className="mt-1 text-sm text-muted">{v.body} Confidence {result.confidence}%.</p>
                <p className="mt-3 text-ink-2">{result.summary}</p>
                <p className="mt-2 text-sm text-muted">Detected: {result.item.name}{result.item.brand ? ` · ${result.item.brand}` : ''}</p>
              </Card>

              {result.matches.length > 0 && (
                <section>
                  <h2 className="mb-3 font-serif text-xl">In your wardrobe</h2>
                  <div className="space-y-3">
                    {result.matches.slice(0, 4).map(m => { const it = byId(m.id); return it ? (
                      <Card key={m.id} className="flex gap-4 p-3">
                        <div className="w-24 shrink-0 overflow-hidden rounded-xl"><ItemImage item={it} ratio="aspect-square" /></div>
                        <div className="min-w-0 flex-1 text-sm">
                          <div className="flex items-center gap-2"><b className="truncate">{it.name}</b><Badge tone={m.similarity >= 90 ? 'good' : 'neutral'}>{m.similarity}% alike</Badge></div>
                          {m.reasons.length > 0 && <p className="mt-1 text-ink-2">{m.reasons.join(' · ')}</p>}
                          {m.difference && <p className="mt-1 text-muted">Different: {m.difference}</p>}
                          {it.locationPath && <p className="mt-1 text-xs text-muted">Kept in {it.locationPath}</p>}
                        </div>
                      </Card>
                    ) : null; })}
                  </div>
                </section>
              )}

              {result.worksWith.length > 0 && (
                <section>
                  <h2 className="mb-3 font-serif text-xl">If you buy it, it goes with</h2>
                  <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">{result.worksWith.map(byId).filter(Boolean).slice(0, 5).map(it => <ItemTile key={it!.id} item={it as Item} href={`/app/wardrobe/${it!.id}`} />)}</div>
                </section>
              )}
              {result.advice && <Card className="p-4 text-sm"><b>Our take:</b> {result.advice}</Card>}

              <Card className="flex flex-wrap items-end gap-3 p-4">
                <label className="min-w-32 flex-1 text-sm">Price (optional)<Input type="number" min={0} inputMode="decimal" value={price} onChange={e => setPrice(e.target.value)} placeholder="₹" className="mt-1" /></label>
                <Button variant="secondary" onClick={saveWish}><Bookmark className="size-4" /> Save to wishlist</Button>
              </Card>
            </div>
          )}
          {!busy && !result && <Empty title="Results appear here">You’ll see whether it’s an exact match, something similar, or new to your wardrobe — and what it would go with.</Empty>}
        </div>
      </div>

      <section className="mt-10">
        <h2 className="mb-3 font-serif text-2xl">Wishlist</h2>
        {wishes.length ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {wishes.map(w => (
              <Card key={w.id} className="overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element -- signed private URL */}
                {w.signed ? <img src={w.signed} alt={w.name} className="aspect-square w-full bg-studio object-contain" /> : <div className="aspect-square bg-sunk" />}
                <div className="flex items-start gap-2 p-3 text-sm">
                  <div className="min-w-0 flex-1"><div className="truncate font-medium">{w.name}</div><div className="text-xs text-muted">{w.verdict ? VERDICT[w.verdict as keyof typeof VERDICT]?.title : ''}{w.price ? ` · ${inr(Number(w.price))}` : ''}</div></div>
                  <button aria-label={`Remove ${w.name}`} onClick={() => removeWish(w)} className="text-muted hover:text-danger"><Trash2 className="size-4" /></button>
                </div>
              </Card>
            ))}
          </div>
        ) : <p className="text-sm text-muted">Items you save after a check appear here.</p>}
      </section>
    </>
  );
}
