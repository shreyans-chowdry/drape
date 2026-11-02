import { z } from 'zod';
import { route, json } from '@/lib/server/http';
import { geocode } from '@/lib/weather';

export const GET = route(z.object({ q: z.string().min(2).max(80) }), async ({ body }) => json(await geocode(body.q)));
