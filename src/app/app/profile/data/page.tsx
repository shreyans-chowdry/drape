'use client';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Download, Trash2, Upload } from 'lucide-react';
import { api, ApiError } from '@/lib/api-client';
import { Button, Card, Field, Input, PageHeader, useToast } from '@/components/ui';
import { useStore } from '@/components/app/store';

export default function DataPage() {
  const { sb, user, reload } = useStore();
  const toast = useToast();
  const router = useRouter();
  const [importing, setImporting] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  const restore = async (f?: File) => {
    if (!f) return;
    if (f.size > 200 * 1024 * 1024) { toast('Backups can be up to 200 MB.', { tone: 'bad' }); return; }
    setImporting(true);
    try {
      const path = `${user.id}/import-${Date.now()}.${f.name.endsWith('.zip') ? 'zip' : 'json'}`;
      const up = await sb.storage.from('backups').upload(path, f, { contentType: f.name.endsWith('.zip') ? 'application/zip' : 'application/json' });
      if (up.error) throw new Error('upload');
      const r = await api<{ report: Record<string, number> }>('/api/account/import', { path });
      toast(`Restored ${r.report.clothing_items ?? 0} pieces and ${r.report.outfit_combinations ?? 0} outfits`, { tone: 'good' });
      await reload();
    } catch (e) { toast(e instanceof ApiError ? e.message : 'Could not restore that backup.', { tone: 'bad' }); }
    finally { setImporting(false); }
  };

  const del = async () => {
    setDeleting(true);
    try {
      await api('/api/account/delete', { confirm: 'DELETE' });
      await sb.auth.signOut();
      router.replace('/'); router.refresh();
    } catch (e) { toast(e instanceof ApiError ? e.message : 'Could not delete your account. Please contact us.', { tone: 'bad' }); setDeleting(false); }
  };

  return (
    <>
      <Link href="/app/profile" className="mb-3 inline-flex items-center gap-1 text-sm text-muted"><ArrowLeft className="size-4" /> Profile</Link>
      <PageHeader eyebrow="Your data" title="Export, restore or delete">Your wardrobe belongs to you. Take a copy any time.</PageHeader>
      <div className="max-w-2xl space-y-4">
        <Card className="p-4 sm:p-6">
          <h2 className="font-serif text-xl">Export</h2>
          <p className="mt-1 text-sm text-muted">Download everything in the active wardrobe profile.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a href="/api/account/export?format=zip" download><Button tabIndex={-1}><Download className="size-4" /> Full backup (ZIP with photos)</Button></a>
            <a href="/api/account/export?format=json" download><Button tabIndex={-1} variant="secondary">JSON</Button></a>
            <a href="/api/account/export?format=csv" download><Button tabIndex={-1} variant="secondary">Spreadsheet (CSV)</Button></a>
          </div>
        </Card>
        <Card className="p-4 sm:p-6">
          <h2 className="font-serif text-xl">Restore</h2>
          <p className="mt-1 text-sm text-muted">Upload a Drape ZIP or JSON backup. Missing pieces, outfits and photos are added back; anything already in your account is skipped, so nothing is overwritten. Plan limits still apply.</p>
          <input ref={file} type="file" accept=".zip,.json,application/zip,application/json" className="hidden" onChange={e => { restore(e.target.files?.[0]); e.target.value = ''; }} />
          <Button variant="secondary" className="mt-4" loading={importing} onClick={() => file.current?.click()}><Upload className="size-4" /> Choose backup file</Button>
        </Card>
        <Card className="border-danger/40 p-4 sm:p-6">
          <h2 className="font-serif text-xl text-danger">Delete account</h2>
          <p className="mt-1 text-sm text-ink-2">Permanently deletes your account, every wardrobe profile, all photos, outfits, chats and trips, and cancels any subscription. Payment records required by law are kept without your photos or wardrobe. This can’t be undone — export first if you want a copy.</p>
          <Field label="Type DELETE to confirm" className="mt-4">{id => <Input id={id} value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="off" />}</Field>
          <Button variant="danger" className="mt-3" disabled={confirm !== 'DELETE'} loading={deleting} onClick={del}><Trash2 className="size-4" /> Delete my account</Button>
        </Card>
      </div>
    </>
  );
}
