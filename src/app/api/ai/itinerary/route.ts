import { z } from 'zod';
import { route, json, fail } from '@/lib/server/http';
import { readItinerary } from '@/lib/ai/features';

export const maxDuration = 60;

const MIMES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'text/plain'] as const;

/**
 * Read an itinerary (typed, pasted, a photo/screenshot or a PDF) into stops and
 * day notes for the trip form. The file is read in memory and never stored.
 * Metered like any AI call, but it doesn't use a trip credit: planning does.
 */
export const POST = route(z.object({
  text: z.string().max(8000).default(''),
  file: z.object({ mime: z.enum(MIMES), data: z.string().max(5_600_000) }).optional(),
  startHint: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
}), async ({ userId, body }) => {
  if (!body.text.trim() && !body.file) return fail('Paste your itinerary or choose a file.');
  let file: { bytes: Buffer; mime: string } | undefined;
  let text = body.text;
  if (body.file) {
    const bytes = Buffer.from(body.file.data, 'base64');
    if (bytes.length > 4 * 1024 * 1024) return fail('That file is over 4 MB. Try a screenshot of the itinerary instead.');
    if (body.file.mime === 'text/plain') text = `${bytes.toString('utf8').slice(0, 8000)}\n${text}`;
    else file = { bytes, mime: body.file.mime };
  }
  const today = new Date().toISOString().slice(0, 10);
  return json(await readItinerary(userId, { text: text.trim() || undefined, file, startHint: body.startHint, today }));
});
