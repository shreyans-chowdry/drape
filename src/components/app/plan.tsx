'use client';
import { useState } from 'react';
import { Button, Field, Input, Sheet, useToast } from '@/components/ui';
import { useStore } from './store';

/** Put an outfit on the calendar (saving it first if needed). */
export function PlanSheet({ pieceIds, meta, onClose }: { pieceIds: string[] | null; meta?: { title?: string; why?: string }; onClose: () => void }) {
  const { sb, user, wardrobeId, saveOutfit } = useStore();
  const toast = useToast();
  const tomorrow = new Date(Date.now() + 864e5).toLocaleDateString('en-CA');
  const [date, setDate] = useState(tomorrow);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!pieceIds) return;
    setBusy(true);
    const outfitId = await saveOutfit(pieceIds, { ...meta, source: 'manual' });
    if (outfitId) {
      const { error } = await sb.from('outfit_calendar').upsert({ user_id: user.id, wardrobe_profile_id: wardrobeId, date, outfit_id: outfitId }, { onConflict: 'wardrobe_profile_id,date' });
      toast(error ? 'Could not plan that day.' : `Planned for ${new Date(date + 'T12:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}`, { tone: error ? 'bad' : 'good' });
    }
    setBusy(false);
    onClose();
  };
  return (
    <Sheet open={!!pieceIds} onClose={onClose} title="Plan this outfit" footer={<Button block loading={busy} onClick={save}>Add to calendar</Button>}>
      <Field label="Day">{id => <Input id={id} type="date" min={new Date().toLocaleDateString('en-CA')} value={date} onChange={e => setDate(e.target.value)} />}</Field>
      <p className="mt-3 text-sm text-muted">Planning a day that already has an outfit replaces it.</p>
    </Sheet>
  );
}
