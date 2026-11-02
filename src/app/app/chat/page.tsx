'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ImagePlus, MessageCircle, Plus, Send, Trash2, X } from 'lucide-react';
import { api } from '@/lib/api-client';
import { compress } from '@/lib/images';
import type { Item } from '@/lib/model';
import { Button, Card, cx, IconButton, Spinner, Textarea, useToast } from '@/components/ui';
import { ItemTile, type OutfitView } from '@/components/app/items';
import { LookList } from '@/components/app/looks';
import { aiErrorText, QuotaNote, weatherText } from '@/components/app/ai';
import { useStore } from '@/components/app/store';

type Conv = { id: string; title: string; updated_at: string };
type ChatLook = { title: string; pieceIds: string[]; why: string };
type Msg = { id: string; role: 'user' | 'assistant'; content: string; looks?: { looks: ChatLook[]; itemIds: string[] } | null; photo?: string };

const STARTERS = ['What should I wear to a wedding this weekend?', 'Which of my shirts go with my navy chinos?', 'What am I missing for winter?', 'Plan a smart-casual week for office'];

export default function ChatPage() {
  const { sb, user, wardrobeId, byId, weather, reloadQuotas } = useStore();
  const toast = useToast();
  const [convs, setConvs] = useState<Conv[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [photo, setPhoto] = useState<{ url: string; blob: Blob } | null>(null);
  const [busy, setBusy] = useState(false);
  const [showList, setShowList] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadConvs = useCallback(async () => {
    const { data } = await sb.from('chat_conversations').select('id, title, updated_at').eq('wardrobe_profile_id', wardrobeId).order('updated_at', { ascending: false }).limit(50);
    setConvs(data ?? []);
  }, [sb, wardrobeId]);
  useEffect(() => { if (wardrobeId) loadConvs(); }, [wardrobeId, loadConvs]);

  const open = async (id: string | null) => {
    setActive(id); setShowList(false);
    if (!id) { setMsgs([]); return; }
    const { data } = await sb.from('chat_messages').select('id, role, content, looks').eq('conversation_id', id).order('created_at');
    setMsgs((data ?? []) as Msg[]);
  };
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [msgs, busy]);

  const send = async (message = text) => {
    if (!message.trim() || busy) return;
    setBusy(true); setText('');
    const local: Msg = { id: crypto.randomUUID(), role: 'user', content: message.trim(), photo: photo?.url };
    setMsgs(m => [...m, local]);
    try {
      let imagePath: string | undefined;
      if (photo) {
        imagePath = `${user.id}/chat/${crypto.randomUUID()}.jpg`;
        const up = await sb.storage.from('temp').upload(imagePath, photo.blob, { contentType: 'image/jpeg' });
        if (up.error) imagePath = undefined;
      }
      setPhoto(null);
      const r = await api<{ conversationId: string; reply: string; looks: ChatLook[]; itemIds: string[] }>('/api/ai/chat', {
        conversationId: active ?? undefined, wardrobeId, message: message.trim(), imagePath, context: weatherText(weather) ? `Weather now: ${weatherText(weather)}` : '',
      });
      setMsgs(m => [...m, { id: crypto.randomUUID(), role: 'assistant', content: r.reply, looks: { looks: r.looks, itemIds: r.itemIds } }]);
      if (!active) { setActive(r.conversationId); loadConvs(); }
    } catch (e) {
      toast(aiErrorText(e), { tone: 'bad' });
      setMsgs(m => m.filter(x => x.id !== local.id));
      setText(message);
    } finally { setBusy(false); reloadQuotas(); }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this conversation?')) return;
    await sb.from('chat_conversations').delete().eq('id', id);
    if (active === id) open(null);
    loadConvs();
  };

  const list = (
    <div className="space-y-1">
      <Button block variant="secondary" size="sm" onClick={() => open(null)}><Plus className="size-4" /> New chat</Button>
      {convs.map(c => (
        <div key={c.id} className={cx('group flex items-center rounded-xl', active === c.id && 'bg-sunk')}>
          <button onClick={() => open(c.id)} className="min-w-0 flex-1 truncate px-3 py-2 text-left text-sm">{c.title}</button>
          <button aria-label={`Delete “${c.title}”`} onClick={() => remove(c.id)} className="p-2 text-muted opacity-60 hover:text-danger group-hover:opacity-100"><Trash2 className="size-4" /></button>
        </div>
      ))}
    </div>
  );

  return (
    <div className="grid h-[calc(100dvh-10rem)] gap-4 lg:h-[calc(100dvh-4rem)] lg:grid-cols-[240px_1fr]">
      <aside className="hidden overflow-y-auto lg:block">{list}</aside>
      <Card className="flex min-h-0 flex-col">
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <button className="text-sm text-accent lg:hidden" onClick={() => setShowList(s => !s)}>{showList ? 'Close' : 'Chats'}</button>
          <h1 className="flex-1 truncate font-serif text-lg">{convs.find(c => c.id === active)?.title ?? 'Ask your stylist'}</h1>
          <QuotaNote kind="chat" />
        </div>
        {showList ? <div className="flex-1 overflow-y-auto p-3 lg:hidden">{list}</div> : (
          <div className="flex-1 space-y-4 overflow-y-auto p-4" aria-live="polite">
            {!msgs.length && (
              <div className="mx-auto max-w-md py-8 text-center">
                <MessageCircle className="mx-auto size-8 text-accent" />
                <p className="mt-3 text-ink-2">Ask anything about your wardrobe. Answers use only the clothes you own.</p>
                <div className="mt-5 grid gap-2">{STARTERS.map(s => <button key={s} onClick={() => send(s)} className="rounded-xl border border-line px-4 py-2.5 text-left text-sm hover:border-line-strong">{s}</button>)}</div>
              </div>
            )}
            {msgs.map(m => <Bubble key={m.id} m={m} byId={byId} />)}
            {busy && <div className="flex items-center gap-2 text-sm text-muted"><Spinner /> Thinking…</div>}
            <div ref={end} />
          </div>
        )}
        <form onSubmit={e => { e.preventDefault(); send(); }} className="border-t border-line p-3">
          {photo && (
            <div className="relative mb-2 inline-block">
              {/* eslint-disable-next-line @next/next/no-img-element -- local preview */}
              <img src={photo.url} alt="Attached" className="h-16 rounded-lg" />
              <button type="button" aria-label="Remove photo" onClick={() => setPhoto(null)} className="absolute -right-2 -top-2 rounded-full bg-ink p-0.5 text-paper"><X className="size-3" /></button>
            </div>
          )}
          <div className="flex items-end gap-2">
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={async e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) { const { blob } = await compress(f, 1200); setPhoto({ url: URL.createObjectURL(blob), blob }); } }} />
            <IconButton type="button" label="Attach a photo" onClick={() => fileRef.current?.click()}><ImagePlus className="size-5" /></IconButton>
            <Textarea aria-label="Message" rows={1} maxLength={2000} value={text} onChange={e => setText(e.target.value)} placeholder="Message your stylist…" className="max-h-40 min-h-11 flex-1 resize-none"
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />
            <Button type="submit" aria-label="Send" disabled={!text.trim() || busy}><Send className="size-4" /></Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

function Bubble({ m, byId }: { m: Msg; byId: (id: string) => Item | undefined }) {
  const looks: OutfitView[] = (m.looks?.looks ?? []).map((l, i) => ({ key: `${m.id}-${i}`, title: l.title, why: l.why, pieces: l.pieceIds.map(byId).filter(Boolean) as Item[] })).filter(l => l.pieces.length >= 2);
  const mentioned = (m.looks?.itemIds ?? []).map(byId).filter(Boolean) as Item[];
  return (
    <div className={cx('flex flex-col', m.role === 'user' ? 'items-end' : 'items-start')}>
      {/* eslint-disable-next-line @next/next/no-img-element -- local preview */}
      {m.photo && <img src={m.photo} alt="" className="mb-1 h-24 rounded-xl" />}
      <div className={cx('max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed', m.role === 'user' ? 'bg-ink text-paper' : 'bg-sunk text-ink')}>{m.content}</div>
      {looks.length > 0 && <div className="mt-3 w-full"><LookList looks={looks} source="chat" /></div>}
      {!looks.length && mentioned.length > 0 && <div className="mt-2 grid w-full max-w-lg grid-cols-4 gap-2">{mentioned.slice(0, 8).map(i => <ItemTile key={i.id} item={i} href={`/app/wardrobe/${i.id}`} />)}</div>}
    </div>
  );
}
