'use client';
import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

/** Registers the service worker (offline shell + cached photos). */
export function RegisterSW() {
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') navigator.serviceWorker.register('/sw.js').catch(() => {});
  }, []);
  return <InstallPrompt />;
}

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/** Android/desktop Chrome install button, and Add-to-Home-Screen instructions on iPhone. */
export function InstallPrompt() {
  const [evt, setEvt] = useState<BIPEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    let dismissed = false;
    try { dismissed = !!localStorage.getItem('drape.installDismissed'); } catch { /* ignore */ }
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone;
    if (dismissed || standalone) return;
    const on = (e: Event) => { e.preventDefault(); setEvt(e as BIPEvent); setHidden(false); };
    window.addEventListener('beforeinstallprompt', on);
    if (/iphone|ipad|ipod/i.test(navigator.userAgent)) { setIos(true); const t = setTimeout(() => setHidden(false), 20000); return () => { clearTimeout(t); window.removeEventListener('beforeinstallprompt', on); }; }
    return () => window.removeEventListener('beforeinstallprompt', on);
  }, []);
  if (hidden || (!evt && !ios)) return null;
  const close = () => { setHidden(true); try { localStorage.setItem('drape.installDismissed', '1'); } catch { /* ignore */ } };
  return (
    <div className="fixed inset-x-3 bottom-24 z-50 mx-auto flex max-w-md animate-rise items-center gap-3 rounded-2xl border border-line bg-card p-3 shadow-lift lg:bottom-6">
      <Download className="size-5 shrink-0 text-accent" />
      <p className="flex-1 text-sm">{ios ? <>Install Drape: tap <b>Share</b> then <b>Add to Home Screen</b>.</> : 'Install Drape on this device for one-tap access.'}</p>
      {evt && <button className="rounded-full bg-ink px-3 py-1.5 text-sm text-paper" onClick={async () => { await evt.prompt(); close(); }}>Install</button>}
      <button aria-label="Dismiss" onClick={close} className="p-1 text-muted"><X className="size-4" /></button>
    </div>
  );
}
