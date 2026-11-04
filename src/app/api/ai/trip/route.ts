import { z } from 'zod';
import { route, json, fail } from '@/lib/server/http';
import { engineOf, planTrip, weatherPool, type TripDayInput } from '@/lib/ai/features';
import { AIError } from '@/lib/ai/gemini';
import { withCredit } from '@/lib/server/credits';
import { activeWardrobe, profileText, wardrobeRows } from '@/lib/server/wardrobe';
import { geocode, tripWeather, type DayForecast } from '@/lib/weather';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { datesBetween, dayClimate, packingOf, placeFor, quickPlan, type TripDay, type TripPlan, type TripStop } from '@/lib/trip';

export const maxDuration = 90;

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/**
 * A day-by-day outfit plan and packing list for a trip with one or more stops,
 * each dressed for its own weather, from owned clothes only. If the AI is
 * unavailable the on-device planner builds it instead and no credit is used.
 */
export const POST = route(z.object({
  wardrobeId: z.uuid().optional(),
  title: z.string().max(120).default(''),
  stops: z.array(z.object({ place: z.string().trim().min(2).max(120), start: day, end: day, note: z.string().max(200).default('') })).min(1).max(8),
  dayNotes: z.record(day, z.string().max(200)).default({}),
  skipDays: z.array(day).max(21).default([]),
  types: z.array(z.string().max(30)).max(80).default([]),
  mustPack: z.array(z.uuid()).max(30).default([]),
  leaveHome: z.array(z.uuid()).max(200).default([]),
  activities: z.string().max(400).default(''),
  preferences: z.string().max(400).default(''),
}), async ({ userId, body }) => {
  const stops = [...body.stops].sort((a, b) => a.start.localeCompare(b.start));
  if (stops.some(s => s.end < s.start)) return fail('Each stop needs its last day on or after its first day.');
  const start = stops[0].start, end = stops.reduce((m, s) => (s.end > m ? s.end : m), stops[0].end);
  const dates = datesBetween(start, end);
  if (dates.length > 21) return fail('Trips can be up to 21 days.');

  const wid = await activeWardrobe(userId, body.wardrobeId);
  const rows = (await wardrobeRows(userId, wid)).filter(i => !body.leaveHome.includes(i.id));
  const items = rows.filter(i => body.mustPack.includes(i.id) || !body.types.length || body.types.includes(i.subcategory));
  const has = (cats: string[]) => items.some(i => cats.includes(i.category));
  if (!has(['top', 'onepiece'])) {
    return fail(body.types.length ? 'Pick at least one kind of top to pack.' : 'Add a few tops (and ideally bottoms and shoes) before planning a trip.', 400, 'too_few_items');
  }
  const noBottoms = !has(['bottom', 'onepiece']);

  // Look up each stop and its weather in parallel.
  const located: TripStop[] = await Promise.all(stops.map(async s => {
    const g = (await geocode(s.place).catch(() => []))[0];
    return { ...s, place: g?.name ?? s.place, lat: g?.lat, lon: g?.lon };
  }));
  const weather: DayForecast[][] = await Promise.all(located.map(s => (s.lat != null && s.lon != null ? tripWeather(s.lat, s.lon, s.start, s.end) : Promise.resolve([]))));

  const inputs: (TripDayInput & { forecast: DayForecast | null })[] = dates.map(date => {
    const stop = placeFor(date, located);
    const idx = located.indexOf(stop);
    const fc = weather[idx]?.find(w => w.date === date) ?? null;
    const climate = dayClimate(fc);
    const wText = fc ? `${fc.label}, ${Math.round(fc.minC)}–${Math.round(fc.maxC)}°C, rain ${fc.rainChance}%${fc.typical ? ' (typical for the season)' : ''}` : '';
    return { date, place: stop.place.split(',')[0], note: body.dayNotes[date] ?? '', weather: wText, climate, forecast: fc, skipped: body.skipDays.includes(date) };
  });

  const base: TripDay[] = inputs.map(d => ({ date: d.date, place: d.place, plan: d.note, weather: d.forecast, skipped: d.skipped }));
  let days: TripDay[];
  let extra: Pick<TripPlan, 'remember' | 'laundry' | 'optionalShopping'> = { remember: [], laundry: '', optionalShopping: [] };
  let source: TripPlan['source'] = 'ai';
  let notice = '';
  try {
    const ai = await withCredit(userId, 'trip', located.map(s => s.place).join(' → ').slice(0, 200), async () => planTrip(userId, {
      items, days: inputs, mustPack: body.mustPack, activities: body.activities, preferences: body.preferences, profile: await profileText(userId),
    }));
    days = ai.days.map((d, i) => ({ ...d, weather: base[i].weather }));
    extra = { remember: ai.remember, laundry: ai.laundry, optionalShopping: ai.optionalShopping };
  } catch (err) {
    // Never leave the person with nothing: plan on-device instead (free).
    if (!(err instanceof AIError)) console.error('[trip]', err instanceof Error ? err.message : err);
    const pool = weatherPool(items).map(engineOf).filter(i => i.laundry !== 'in_laundry' && i.laundry !== 'unavailable');
    days = quickPlan(base, pool, body.mustPack);
    source = 'quick';
    notice = err instanceof AIError && err.code === 'quota_exceeded'
      ? 'You’ve used this month’s AI trip plans, so this one was planned with quick ideas instead. No credit was used.'
      : 'The AI planner didn’t respond, so this trip was planned with quick ideas instead. No credit was used.';
  }

  const plan: TripPlan = {
    stops: located, days, packing: [], extras: body.mustPack.filter(id => items.some(i => i.id === id)),
    ...extra, source, types: body.types,
  };
  plan.packing = packingOf(plan);

  const destination = body.title.trim() || [...new Set(located.map(s => s.place.split(',')[0]))].join(' · ');
  const db = supabaseAdmin();
  const { data: trip, error } = await db.from('trip_plans').insert({
    user_id: userId, wardrobe_profile_id: wid, destination: destination.slice(0, 120), lat: located[0].lat, lon: located[0].lon,
    start_date: start, end_date: end, activities: body.activities, preferences: body.preferences,
    forecast: inputs.map(d => d.forecast).filter(Boolean), plan,
  }).select('id').single();
  if (error || !trip) return fail('Could not save the trip.', 500);

  // Link each look as a saved outfit so it shows up in the calendar and favourites.
  const looks = days.flatMap(d => (d.skipped ? [] : ([['day', d.day], ['evening', d.evening]] as const).filter(([, l]) => l?.pieceIds.length).map(([slot, l]) => ({ date: d.date, slot, look: l! }))));
  if (looks.length) {
    const { data: outfits } = await db.from('outfit_combinations')
      .insert(looks.map(l => ({ user_id: userId, wardrobe_profile_id: wid, title: l.look.title, why: l.look.why, source: 'trip', occasion: l.slot })))
      .select('id');
    if (outfits?.length === looks.length) {
      await db.from('outfit_items').insert(looks.flatMap((l, i) => l.look.pieceIds.map(item_id => ({ outfit_id: outfits[i].id, item_id, user_id: userId }))));
      await db.from('trip_outfits').insert(looks.map((l, i) => ({ trip_id: trip.id, outfit_id: outfits[i].id, user_id: userId, day: l.date, slot: l.slot })));
    }
  }
  if (noBottoms) notice = [notice, 'No trousers, jeans or shorts are in this plan because none are in your wardrobe (or the kinds you picked). Add them and rebuild any day.'].filter(Boolean).join(' ');
  return json({ id: trip.id, source, notice });
});
