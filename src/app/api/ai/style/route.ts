import { z } from 'zod';
import { route, json } from '@/lib/server/http';
import { styleLooks } from '@/lib/ai/features';
import { withCredit } from '@/lib/server/credits';
import { activeWardrobe, profileText, wardrobeRows } from '@/lib/server/wardrobe';

export const maxDuration = 60;

/** Three outfits from the person's own wardrobe. One request = one styling credit. */
export const POST = route(z.object({
  wardrobeId: z.uuid().optional(),
  occasion: z.string().max(40).default('casual'),
  lockedIds: z.array(z.uuid()).max(6).default([]),
  need: z.array(z.string().max(20)).max(6).default([]),
  brief: z.string().max(400).default(''),
  weather: z.string().max(200).default(''),
  tempC: z.number().min(-60).max(60).nullable().default(null),
  rain: z.boolean().default(false),
  avoidIds: z.array(z.uuid()).max(30).default([]),
}), async ({ userId, body }) => {
  const wid = await activeWardrobe(userId, body.wardrobeId);
  const items = await wardrobeRows(userId, wid);
  const result = await withCredit(userId, 'styling', wid, async () => styleLooks(userId, {
    items, locked: body.lockedIds.filter(id => items.some(i => i.id === id)), need: body.need,
    occasion: body.occasion, brief: body.brief, weather: body.weather, profile: await profileText(userId),
    climate: { tempC: body.tempC, rain: body.rain }, avoid: body.avoidIds,
  }));
  return json(result);
});
