import { z } from 'zod';
import { route, json, fail } from '@/lib/server/http';
import { planTrip } from '@/lib/ai/features';
import { withCredit } from '@/lib/server/credits';
import { activeWardrobe, profileText, wardrobeRows } from '@/lib/server/wardrobe';
import { forecast, geocode } from '@/lib/weather';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const maxDuration = 90;

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** A day-by-day outfit plan and packing list for a trip, from owned clothes only. */
export const POST = route(z.object({
  wardrobeId: z.uuid().optional(),
  destination: z.string().min(2).max(120),
  start: day, end: day,
  activities: z.string().max(400).default(''),
  preferences: z.string().max(400).default(''),
}), async ({ userId, body }) => {
  const dates: string[] = [];
  for (let d = new Date(body.start + 'T00:00:00Z'); d <= new Date(body.end + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 1)) dates.push(d.toISOString().slice(0, 10));
  if (!dates.length) return fail('The end date must be on or after the start date.');
  if (dates.length > 21) return fail('Trips can be up to 21 days.');

  const wid = await activeWardrobe(userId, body.wardrobeId);
  const items = await wardrobeRows(userId, wid);
  if (items.length < 3) return fail('Add at least a top, a bottom and shoes before planning a trip.', 400, 'too_few_items');

  const place = (await geocode(body.destination))[0];
  const days = place ? await forecast(place.lat, place.lon, body.start, body.end) : [];
  const forecastText = days.length
    ? days.map(d => `${d.date}: ${d.label}, ${Math.round(d.minC)}–${Math.round(d.maxC)}°C, rain ${d.rainChance}%`).join('; ')
    : 'No forecast available for these dates (too far ahead or unknown place) — plan for typical weather at this destination and time of year.';

  const plan = await withCredit(userId, 'trip', body.destination, async () => planTrip(userId, {
    items, destination: place?.name ?? body.destination, dates, activities: body.activities, preferences: body.preferences,
    forecast: forecastText, profile: await profileText(userId),
  }));

  const db = supabaseAdmin();
  const { data: trip, error } = await db.from('trip_plans').insert({
    user_id: userId, wardrobe_profile_id: wid, destination: place?.name ?? body.destination, lat: place?.lat, lon: place?.lon,
    start_date: body.start, end_date: body.end, activities: body.activities, preferences: body.preferences,
    forecast: days, plan,
  }).select('id').single();
  if (error || !trip) return fail('Could not save the trip.', 500);

  for (const d of plan.days) {
    for (const [slot, look] of [['day', d.day], ['evening', d.evening]] as const) {
      if (!look?.pieceIds.length) continue;
      const { data: o } = await db.from('outfit_combinations').insert({ user_id: userId, wardrobe_profile_id: wid, title: look.title, why: look.why, source: 'trip', occasion: slot }).select('id').single();
      if (!o) continue;
      await db.from('outfit_items').insert(look.pieceIds.map(item_id => ({ outfit_id: o.id, item_id, user_id: userId })));
      await db.from('trip_outfits').insert({ trip_id: trip.id, outfit_id: o.id, user_id: userId, day: d.date, slot });
    }
  }
  return json({ id: trip.id, plan, forecast: days, destination: place?.name ?? body.destination });
});
