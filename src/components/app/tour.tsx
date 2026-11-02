'use client';
import { useEffect, useLayoutEffect, useState } from 'react';
import { Button } from '@/components/ui';
import { NAV } from './nav';
import { useStore } from './store';

// Guided walkthrough. Highlights each section in the nav where it is visible
// (sidebar on desktop, tab bar on phones) and explains it; skippable, replayable from Help.
const STEPS = [
  { target: 'add', title: 'Add clothes', body: 'Photograph a piece — or several at once. Drape detects each item, names it, describes it and can make a clean studio photo.' },
  ...NAV.filter(n => n.href !== '/app/help').map(n => ({ target: n.href, title: n.label, body: n.tour })),
  { target: '/app/help', title: 'You can replay this', body: 'This tour lives in Help whenever you need it.' },
];

export const startTour = () => window.dispatchEvent(new Event('drape:tour'));

export function Tour() {
  const { profile, updateProfile } = useStore();
  const [step, setStep] = useState(-1);
  const [box, setBox] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (profile && !profile.tour_done && (profile.onboarding as { done?: boolean })?.done) setStep(0);
    const on = () => setStep(0);
    window.addEventListener('drape:tour', on);
    return () => window.removeEventListener('drape:tour', on);
  }, [profile]);

  useLayoutEffect(() => {
    if (step < 0) return;
    const els = [...document.querySelectorAll<HTMLElement>(`[data-tour="${STEPS[step].target}"]`)].filter(e => e.offsetParent !== null);
    const el = els[0];
    if (el) { el.scrollIntoView({ block: 'nearest' }); setBox(el.getBoundingClientRect()); } else setBox(null);
  }, [step]);

  if (step < 0) return null;
  const s = STEPS[step];
  const finish = () => { setStep(-1); if (!profile?.tour_done) updateProfile({ tour_done: true }); };
  const below = box ? box.top < window.innerHeight / 2 : false;
  const style: React.CSSProperties = box
    ? { left: Math.min(Math.max(12, box.left), window.innerWidth - 332), ...(below ? { top: box.bottom + 12 } : { bottom: window.innerHeight - box.top + 12 }) }
    : { left: '50%', top: '50%', transform: 'translate(-50%,-50%)' };

  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label="Product tour">
      <div className="absolute inset-0 bg-black/45" onClick={finish} />
      {box && <div className="pointer-events-none absolute rounded-xl ring-4 ring-accent transition-all duration-300" style={{ left: box.left - 4, top: box.top - 4, width: box.width + 8, height: box.height + 8, boxShadow: '0 0 0 9999px rgba(0,0,0,.25)' }} />}
      <div className="absolute w-[320px] animate-rise rounded-2xl bg-card p-5 shadow-lift" style={style}>
        <div className="mb-1 text-xs text-muted">{step + 1} of {STEPS.length}</div>
        <h3 className="font-serif text-xl">{s.title}</h3>
        <p className="mt-1.5 text-sm text-ink-2">{s.body}</p>
        <div className="mt-4 flex items-center justify-between">
          <button className="text-sm text-muted underline-offset-2 hover:underline" onClick={finish}>Skip tour</button>
          <div className="flex gap-2">
            {step > 0 && <Button size="sm" variant="secondary" onClick={() => setStep(step - 1)}>Back</Button>}
            <Button size="sm" onClick={() => (step === STEPS.length - 1 ? finish() : setStep(step + 1))}>{step === STEPS.length - 1 ? 'Done' : 'Next'}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
