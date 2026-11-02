'use client';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { ApiError } from '@/lib/api-client';
import type { Weather } from '@/lib/weather';
import { currentSeason, type Ctx } from '@/lib/engine';
import { useStore, type Quotas } from './store';

type Kind = 'studio' | 'styling' | 'chat' | 'ownit' | 'trip';
const NOUN: Record<Kind, string> = { studio: 'studio photos', styling: 'stylist requests', chat: 'chat messages', ownit: 'Own It checks', trip: 'trip plans' };

/** "7 of 10 stylist requests left this month" with an upgrade link when low. */
export function QuotaNote({ kind }: { kind: Kind }) {
  const { quotas } = useStore();
  const q = quotas?.[kind as keyof Quotas] as Quotas['studio'] | undefined;
  if (!q) return null;
  const low = q.remaining <= Math.max(1, Math.round(q.limit * 0.2));
  return (
    <p className="inline-flex flex-wrap items-center gap-1.5 text-xs text-muted">
      <Sparkles className="size-3.5 text-accent" />
      <span><b className="text-ink">{q.remaining}</b> {NOUN[kind]} left{kind === 'studio' ? '' : ' this month'}</span>
      {low && <Link href="/app/profile/billing" className="text-accent underline-offset-2 hover:underline">Get more</Link>}
    </p>
  );
}

export function aiErrorText(e: unknown) {
  if (e instanceof ApiError) return e.message;
  return 'Something went wrong. No credit was used — please try again.';
}
export const isQuotaError = (e: unknown) => e instanceof ApiError && (e.code === 'quota_exceeded' || e.status === 402);

export function weatherCtx(weather: Weather | null, occasion?: string): Ctx {
  return { occasion, tempC: weather?.tempC ?? null, rain: weather?.rain, humidity: weather?.humidity, wind: weather?.windKph, season: currentSeason(new Date(), weather?.tempC, weather?.rain) };
}
export const weatherText = (w: Weather | null) => (w ? `${Math.round(w.tempC)}°C, feels ${Math.round(w.feelsC)}°C, ${w.label}, humidity ${w.humidity}%, wind ${Math.round(w.windKph)} km/h${w.place ? ` in ${w.place}` : ''}` : '');
