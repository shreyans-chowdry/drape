'use client';
import Link from 'next/link';
import { PlayCircle } from 'lucide-react';
import { BRAND } from '@/lib/brand';
import { Button, Card, PageHeader } from '@/components/ui';
import { startTour } from '@/components/app/tour';
import { FAQ } from '@/lib/faq';

export default function HelpPage() {
  return (
    <>
      <PageHeader eyebrow="Help" title="How can we help?" />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-2">
          {FAQ.map(f => (
            <details key={f.q} className="group rounded-2xl border border-line bg-card p-4 open:shadow-soft">
              <summary className="cursor-pointer list-none font-medium marker:hidden">{f.q}</summary>
              <p className="mt-2 text-sm leading-relaxed text-ink-2">{f.a}</p>
            </details>
          ))}
        </div>
        <aside className="space-y-3">
          <Card className="p-5">
            <h2 className="font-medium">Take the tour again</h2>
            <p className="mt-1 text-sm text-muted">A one-minute walk through every part of the app.</p>
            <Button className="mt-3" onClick={startTour}><PlayCircle className="size-4" /> Replay tour</Button>
          </Card>
          <Card className="p-5 text-sm">
            <h2 className="font-medium">Still stuck?</h2>
            <p className="mt-1 text-muted">{BRAND.supportEmail ? <>Write to <a className="text-accent" href={`mailto:${BRAND.supportEmail}`}>{BRAND.supportEmail}</a>, or use the </> : 'Use the '}<Link className="text-accent" href="/contact">contact form</Link>. We read every message.</p>
            <p className="mt-3 flex flex-wrap gap-x-3 gap-y-1"><Link className="text-accent" href="/privacy">Privacy</Link><Link className="text-accent" href="/terms">Terms</Link><Link className="text-accent" href="/refunds">Refunds</Link></p>
          </Card>
        </aside>
      </div>
    </>
  );
}
