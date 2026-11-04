'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Camera, Check, ImagePlus, Loader2, Pause, Play, RotateCcw, Sparkles, X } from 'lucide-react';
import type { Scanned } from '@/lib/ai/features';
import { api, ApiError, dbErrorMessage } from '@/lib/api-client';
import { compress, cropThumb, looksLikeProductShot } from '@/lib/images';
import { Badge, Button, Card, cx, PageHeader, Progress, Sheet, useToast } from '@/components/ui';
import { ItemImage } from '@/components/app/items';
import { LocationSelect } from '@/components/app/locations';
import { useStore } from '@/components/app/store';

type JobState = 'preparing' | 'uploading' | 'queued' | 'analysing' | 'saving' | 'studio' | 'done' | 'retake' | 'failed';
type Job = {
  id: string; file?: File; preview: string; state: JobState; tempPath?: string; error?: string; advice?: string;
  itemIds: string[]; productShot?: boolean;
};
type StudioResult = { itemId: string; url?: string; ok: boolean; issues?: string[] };

export function AddFlow({ embedded }: { embedded?: boolean }) {
  const { sb, user, wardrobeId, quotas, reload, reloadQuotas, byId, patchItem } = useStore();
  const toast = useToast();
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [paused, setPaused] = useState(false);
  const [wantStudio, setWantStudio] = useState(false);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [studio, setStudio] = useState<StudioResult[]>([]);
  const [compare, setCompare] = useState<StudioResult | null>(null);
  const running = useRef(false);
  const pausedRef = useRef(false);
  pausedRef.current = paused;
  const batch = useRef(crypto.randomUUID());
  const camRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const update = useCallback((id: string, patch: Partial<Job>) => setJobs(list => list.map(j => (j.id === id ? { ...j, ...patch } : j))), []);

  // 1. prepare + upload every chosen photo (to the private temp folder)
  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const fresh: Job[] = [...files].slice(0, 40).map(f => ({ id: crypto.randomUUID(), file: f, preview: URL.createObjectURL(f), state: 'preparing', itemIds: [] }));
    setJobs(j => [...j, ...fresh]);
    for (const job of fresh) {
      try {
        const { blob, quality } = await compress(job.file!, 1600);
        const productShot = await looksLikeProductShot(blob);
        if (quality.blurry || quality.dark) {
          update(job.id, { advice: quality.blurry ? 'This photo looks blurry — hold steady or tap to focus.' : 'This photo is quite dark — try near a window or turn on a light.' });
        }
        update(job.id, { state: 'uploading', productShot });
        const tempPath = `${user.id}/${batch.current}/${job.id}.jpg`;
        const { error } = await sb.storage.from('temp').upload(tempPath, blob, { contentType: 'image/jpeg', upsert: true });
        if (error) throw new Error('upload');
        await sb.from('ai_jobs').insert({ id: job.id, user_id: user.id, wardrobe_profile_id: wardrobeId, batch_id: batch.current, temp_path: tempPath, want_studio: wantStudio });
        update(job.id, { state: 'queued', tempPath });
      } catch {
        update(job.id, { state: 'failed', error: 'Could not read or upload this photo.' });
      }
    }
  };

  // 2. analyse queued photos one at a time (pausable), save each detected piece
  const processOne = useCallback(async (job: Job) => {
    update(job.id, { state: 'analysing', error: undefined });
    await sb.from('ai_jobs').update({ status: 'processing', attempts: 1 }).eq('id', job.id);
    let scan: Scanned;
    try {
      scan = await api<Scanned>('/api/ai/scan', { path: job.tempPath });
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Analysis failed.';
      update(job.id, { state: 'failed', error: msg });
      await sb.from('ai_jobs').update({ status: 'failed', error: msg }).eq('id', job.id);
      return;
    }
    if (!scan.garments.length) {
      update(job.id, { state: 'retake', advice: scan.quality.advice || 'No clothing was found in this photo. Try again with the item filling most of the frame.' });
      await sb.from('ai_jobs').update({ status: 'failed', error: 'no garments', result: scan as never }).eq('id', job.id);
      return;
    }
    update(job.id, { state: 'saving', advice: !scan.quality.usable || !scan.quality.wholeItemVisible ? (scan.quality.advice || 'Part of the item may be cut off — a retake would give a better result.') : job.advice });
    const original = (await sb.storage.from('temp').download(job.tempPath!)).data;
    const ids: string[] = [];
    for (const g of scan.garments) {
      const id = crypto.randomUUID();
      const productShot = !!(scan.isProductPhoto || job.productShot) && scan.garments.length === 1;
      const { error } = await sb.from('clothing_items').insert({
        id, user_id: user.id, wardrobe_profile_id: wardrobeId, name: g.name.slice(0, 120), category: g.category, subcategory: g.subcategory,
        brand: g.brand ?? null, color: g.color, color2: g.color2 ?? null, pattern: g.pattern, material: g.material ?? null,
        style_tags: g.styleTags ?? [], seasons: g.seasons, occasions: g.occasions ?? [], formality: g.formality, warmth: g.warmth,
        description: g.description, fingerprint: g.fingerprint, keywords: g.keywords ?? [], location_id: locationId,
        needs_review: scan.garments.length > 1 || !scan.quality.usable,
        photo_mode: productShot ? 'original' : 'studio',
        ai_meta: { visibleText: g.visibleText ?? '', box_2d: g.box_2d, quality: scan.quality, scannedAt: new Date().toISOString() },
      });
      if (error) {
        update(job.id, { state: 'failed', error: dbErrorMessage(error.message) });
        if (error.message.includes('item_limit_reached')) setPaused(true);
        return;
      }
      const base = `${user.id}/${id}`;
      await sb.storage.from('temp').copy(job.tempPath!, `${base}/original.jpg`, { destinationBucket: 'originals' });
      const rows: { user_id: string; item_id: string; kind: 'original' | 'thumb'; bucket: string; path: string }[] = [{ user_id: user.id, item_id: id, kind: 'original', bucket: 'originals', path: `${base}/original.jpg` }];
      if (original) {
        const thumb = productShot ? original : await cropThumb(original, g.box_2d);
        const up = await sb.storage.from('originals').upload(`${base}/thumb.jpg`, thumb, { contentType: 'image/jpeg', upsert: true });
        if (!up.error) rows.push({ user_id: user.id, item_id: id, kind: 'thumb', bucket: 'originals', path: `${base}/thumb.jpg` });
      }
      const imgErr = (await sb.from('clothing_images').insert(rows)).error;
      if (imgErr) { update(job.id, { state: 'failed', error: 'The piece was saved but its photo could not be linked. Please retry.' }); return; }
      ids.push(id);
    }
    await sb.storage.from('temp').remove([job.tempPath!]);
    await sb.from('ai_jobs').update({ status: 'done', result: { itemIds: ids } }).eq('id', job.id);
    update(job.id, { state: 'done', itemIds: ids, productShot: !!scan.isProductPhoto || job.productShot });
    await reload();
    reloadQuotas();
  }, [sb, user.id, wardrobeId, locationId, update, reload, reloadQuotas]);

  useEffect(() => {
    if (running.current || paused) return;
    const next = jobs.find(j => j.state === 'queued');
    if (!next) return;
    running.current = true;
    processOne(next).finally(() => { running.current = false; setJobs(j => [...j]); });
  }, [jobs, paused, processOne]);

  // 3. optional studio photos, after analysis, with a credit estimate shown up front
  const pendingStudio = jobs.filter(j => j.state === 'done' && !j.productShot).flatMap(j => j.itemIds).filter(id => !studio.some(s => s.itemId === id));
  const runStudio = async () => {
    for (const itemId of pendingStudio) {
      if (pausedRef.current) break;
      setStudio(s => [...s, { itemId, ok: false }]);
      try {
        const r = await api<{ ok: boolean; url?: string; issues?: string[] }>('/api/ai/studio', { itemId });
        setStudio(s => s.map(x => (x.itemId === itemId ? { itemId, ...r } : x)));
      } catch (e) {
        setStudio(s => s.map(x => (x.itemId === itemId ? { itemId, ok: false, issues: [e instanceof ApiError ? e.message : 'Failed'] } : x)));
        if (e instanceof ApiError && (e.code === 'quota_exceeded' || e.code === 'ai_no_quota' || e.code === 'ai_unconfigured')) { toast(e.message, { tone: 'bad' }); break; }
      }
      reloadQuotas();
    }
    await reload();
  };

  const total = jobs.length, finished = jobs.filter(j => ['done', 'failed', 'retake'].includes(j.state)).length;
  const credits = quotas?.studio.remaining ?? 0;

  return (
    <>
      <PageHeader eyebrow="Wardrobe" title="Add clothes">
        Take a photo or choose several. Drape checks each photo, finds every piece in it, and fills in the details for you to confirm.
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <Card className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
            <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => { addFiles(e.target.files); e.target.value = ''; }} />
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic" multiple className="hidden" onChange={e => { addFiles(e.target.files); e.target.value = ''; }} />
            <button onClick={() => camRef.current?.click()} className="flex items-center gap-4 rounded-2xl bg-ink p-5 text-left text-paper transition hover:bg-ink/90">
              <Camera className="size-7 shrink-0" />
              <span><b className="block">Take a photo</b><span className="text-sm opacity-75">Use your camera</span></span>
            </button>
            <button onClick={() => fileRef.current?.click()} className="flex items-center gap-4 rounded-2xl border border-line p-5 text-left transition hover:border-line-strong">
              <ImagePlus className="size-7 shrink-0 text-accent" />
              <span><b className="block">Choose photos</b><span className="text-sm text-muted">Up to 40 at a time</span></span>
            </button>
          </Card>

          {total > 0 && (
            <Card className="p-4 sm:p-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="text-sm"><b>{finished}</b> of {total} photos processed</div>
                <Button size="sm" variant="secondary" onClick={() => setPaused(p => !p)}>{paused ? <><Play className="size-4" /> Resume</> : <><Pause className="size-4" /> Pause</>}</Button>
              </div>
              <Progress value={total ? (finished / total) * 100 : 0} className="mb-4" />
              <ul className="space-y-2">
                {jobs.map(j => <JobRow key={j.id} job={j} onRetry={() => update(j.id, { state: 'queued', error: undefined })} onRemove={() => setJobs(l => l.filter(x => x.id !== j.id))} />)}
              </ul>
            </Card>
          )}

          {pendingStudio.length > 0 && finished === total && (
            <Card className="flex flex-wrap items-center gap-4 p-4 sm:p-5">
              <Sparkles className="size-6 text-accent" />
              <div className="min-w-0 flex-1 text-sm">
                <b>Make studio photos?</b> {pendingStudio.length} piece{pendingStudio.length === 1 ? '' : 's'} → up to <b>{pendingStudio.length}</b> studio credit{pendingStudio.length === 1 ? '' : 's'}. You have <b>{credits}</b>. A credit is only used when a photo passes our quality check.
              </div>
              <Button onClick={runStudio} disabled={!credits}>{credits ? `Make ${Math.min(credits, pendingStudio.length)}` : 'No credits left'}</Button>
            </Card>
          )}

          {studio.length > 0 && (
            <Card className="p-4 sm:p-5">
              <h2 className="mb-3 font-serif text-xl">Studio photos</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {studio.map(s => {
                  const item = byId(s.itemId);
                  if (!item) return null;
                  return (
                    <button key={s.itemId} onClick={() => s.ok && setCompare(s)} className="overflow-hidden rounded-xl border border-line text-left" disabled={!s.ok}>
                      <ItemImage item={{ ...item, imageUrl: s.url ?? item.imageUrl }} ratio="aspect-square" />
                      <div className="p-2 text-xs">
                        {s.ok ? <Badge tone="good"><Check className="size-3" /> Ready — review</Badge> : s.issues ? <span className="text-danger">Kept original: {s.issues[0]}</span> : <span className="inline-flex items-center gap-1 text-muted"><Loader2 className="size-3 animate-spin" /> Creating…</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </Card>
          )}
        </div>

        <aside className="space-y-4">
          <Card className="p-4 sm:p-5">
            <h2 className="mb-3 font-medium">Where will these be kept?</h2>
            <LocationSelect value={locationId} onChange={setLocationId} />
            <p className="mt-2 text-xs text-muted">Optional — you can set it per item later.</p>
          </Card>
          <Card className="p-4 text-sm sm:p-5">
            <h2 className="mb-2 font-medium">For the best results</h2>
            <ul className="list-disc space-y-1.5 pl-4 text-ink-2">
              <li>Lay the piece flat or hang it, in good light.</li>
              <li>Keep the whole item in the frame.</li>
              <li>Several items in one photo is fine — they’re detected separately.</li>
              <li>Already have a clean product photo? Upload it — it’s kept exactly as it is.</li>
            </ul>
          </Card>
          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-line bg-card p-4 text-sm">
            <input type="checkbox" className="mt-0.5 size-4 accent-[var(--accent)]" checked={wantStudio} onChange={e => setWantStudio(e.target.checked)} />
            <span><b>Offer studio photos after scanning</b><span className="block text-muted">You’ll see how many credits it needs before anything is generated. {credits} left.</span></span>
          </label>
          {!embedded && finished > 0 && finished === total && <Button block variant="secondary" onClick={() => router.push('/app/wardrobe')}>Done — view wardrobe</Button>}
        </aside>
      </div>

      <Sheet open={!!compare} onClose={() => setCompare(null)} title="Original or studio?" wide
        footer={compare && (
          <div className="flex gap-2">
            <Button variant="secondary" block onClick={async () => {
              const item = byId(compare.itemId);
              if (item) {
                const { data: img } = await sb.from('clothing_images').select('path').eq('item_id', item.id).eq('kind', 'studio').maybeSingle();
                if (img) { await sb.storage.from('studio').remove([img.path]); await sb.from('clothing_images').delete().eq('item_id', item.id).eq('kind', 'studio'); }
                await patchItem(item.id, { photo_mode: 'original', studioUrl: null });
              }
              setStudio(s => s.map(x => (x.itemId === compare.itemId ? { ...x, ok: false, issues: ['You kept the original'] } : x)));
              setCompare(null);
            }}>Keep original</Button>
            <Button block onClick={async () => { await patchItem(compare.itemId, { photo_mode: 'studio', studioUrl: compare.url ?? null }); toast('Studio photo saved', { tone: 'good' }); setCompare(null); }}>Use studio photo</Button>
          </div>
        )}>
        {compare && (() => {
          const item = byId(compare.itemId);
          return item ? (
            <div className="grid grid-cols-2 gap-3">
              <figure><div className="overflow-hidden rounded-xl border border-line"><ItemImage item={{ ...item, imageUrl: item.originalUrl }} /></div><figcaption className="mt-1.5 text-center text-sm text-muted">Original</figcaption></figure>
              <figure><div className="overflow-hidden rounded-xl border border-line"><ItemImage item={{ ...item, imageUrl: compare.url ?? null }} /></div><figcaption className="mt-1.5 text-center text-sm text-muted">Studio</figcaption></figure>
            </div>
          ) : null;
        })()}
      </Sheet>
    </>
  );
}

function JobRow({ job, onRetry, onRemove }: { job: Job; onRetry: () => void; onRemove: () => void }) {
  const label: Record<JobState, string> = { preparing: 'Preparing…', uploading: 'Uploading…', queued: 'Waiting', analysing: 'Analysing…', saving: 'Saving…', studio: 'Studio photo…', done: '', retake: 'Retake suggested', failed: 'Failed' };
  return (
    <li className="flex items-center gap-3 rounded-xl border border-line p-2">
      {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
      <img src={job.preview} alt="" className="size-14 shrink-0 rounded-lg bg-studio object-cover" />
      <div className="min-w-0 flex-1 text-sm">
        {job.state === 'done' ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <Check className="size-4 text-sage" /> Found {job.itemIds.length} piece{job.itemIds.length === 1 ? '' : 's'}
            {job.itemIds.map(id => <Link key={id} href={`/app/wardrobe/${id}`} className="text-accent underline-offset-2 hover:underline">review</Link>)}
          </div>
        ) : (
          <div className={cx('flex items-center gap-1.5', job.state === 'failed' && 'text-danger')}>
            {['preparing', 'uploading', 'analysing', 'saving', 'studio'].includes(job.state) && <Loader2 className="size-4 animate-spin" />}
            {(job.state === 'retake' || job.state === 'failed') && <AlertTriangle className="size-4" />}
            {label[job.state]}
          </div>
        )}
        {(job.error || job.advice) && <p className="mt-0.5 text-xs text-muted">{job.error ?? job.advice}</p>}
      </div>
      {(job.state === 'failed' || job.state === 'retake') && job.tempPath && <Button size="sm" variant="ghost" onClick={onRetry}><RotateCcw className="size-4" /> Retry</Button>}
      {['failed', 'retake', 'done'].includes(job.state) && <button aria-label="Remove from list" onClick={onRemove} className="p-1 text-muted"><X className="size-4" /></button>}
    </li>
  );
}
