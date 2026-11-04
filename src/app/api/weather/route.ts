import { z } from 'zod';
import { route, json, fail } from '@/lib/server/http';
import { currentWeather } from '@/lib/weather';

export const GET = route(z.object({ lat: z.coerce.number().min(-90).max(90), lon: z.coerce.number().min(-180).max(180) }), async ({ body }) => {
  try { return json(await currentWeather(body.lat, body.lon)); } catch { return fail('Weather is unavailable right now.', 503, 'weather'); }
});
