'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Scroll motion for the marketing pages, in the style of Apple's product pages,
 * without a library. Mounted once; it drives plain data attributes so the
 * sections themselves stay server-rendered:
 *
 *  [data-reveal]     fades/rises in once it scrolls into view (`--d` = delay)
 *  [data-scene]      gets live CSS variables every frame it's on screen:
 *                    --enter 0→1 as it travels from the bottom of the viewport to the top
 *                    --exit  0→1 as it scrolls off the top
 *                    --pin   0→1 across a tall section whose child is position: sticky
 *                    data-step="n" when it has data-steps="N" (which panel to show)
 *  [data-spotlight]  a soft light that follows the cursor (--mx, --my)
 *
 * Without JavaScript, or with reduced motion, everything is simply visible.
 */
export function Motion() {
  const path = usePathname();

  useEffect(() => {
    const root = document.documentElement;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!still) root.classList.add('motion');

    // Reveal once, staggered by --d.
    const reveals = [...document.querySelectorAll<HTMLElement>('[data-reveal]')];
    const io = new IntersectionObserver(entries => {
      for (const e of entries) if (e.isIntersecting) { e.target.setAttribute('data-shown', ''); io.unobserve(e.target); }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    reveals.forEach(el => (still ? el.setAttribute('data-shown', '') : io.observe(el)));

    // Scroll-linked scenes: only the ones on screen are updated.
    const scenes = [...document.querySelectorAll<HTMLElement>('[data-scene]')];
    const live = new Set<HTMLElement>();
    const sio = new IntersectionObserver(entries => {
      for (const e of entries) (e.isIntersecting ? live.add(e.target as HTMLElement) : live.delete(e.target as HTMLElement));
      schedule();
    }, { rootMargin: '20% 0px 20% 0px' });
    scenes.forEach(el => sio.observe(el));
    const clamp = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);
    let raf = 0;
    const update = () => {
      raf = 0;
      const vh = window.innerHeight;
      for (const el of live) {
        const r = el.getBoundingClientRect();
        const enter = clamp((vh - r.top) / (vh + Math.min(r.height, vh)));
        const exit = clamp(-r.top / Math.max(1, r.height));
        const pin = clamp(-r.top / Math.max(1, r.height - vh));
        el.style.setProperty('--enter', enter.toFixed(4));
        el.style.setProperty('--exit', exit.toFixed(4));
        el.style.setProperty('--pin', pin.toFixed(4));
        const steps = Number(el.dataset.steps);
        if (steps) {
          const step = String(Math.min(steps - 1, Math.floor(pin * steps)));
          if (el.dataset.step !== step) el.dataset.step = step;
        }
      }
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(update); };
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    update();

    // Cursor spotlight on cards (fine pointers only).
    const fine = window.matchMedia('(pointer: fine)').matches;
    const onMove = (e: PointerEvent) => {
      const card = (e.target as HTMLElement).closest<HTMLElement>('[data-spotlight]');
      if (!card) return;
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${e.clientX - r.left}px`);
      card.style.setProperty('--my', `${e.clientY - r.top}px`);
    };
    if (fine && !still) document.addEventListener('pointermove', onMove, { passive: true });

    return () => {
      io.disconnect(); sio.disconnect();
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      document.removeEventListener('pointermove', onMove);
    };
  }, [path]);

  return null;
}
