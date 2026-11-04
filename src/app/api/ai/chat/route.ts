import { z } from 'zod';
import { route, json, fail } from '@/lib/server/http';
import { chatReply } from '@/lib/ai/features';
import { withCredit } from '@/lib/server/credits';
import { activeWardrobe, profileText, readOwnFile, wardrobeRows } from '@/lib/server/wardrobe';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const maxDuration = 60;

/** One stylist chat turn. Messages are stored per conversation; the reply can carry outfit cards. */
export const POST = route(z.object({
  conversationId: z.uuid().optional(),
  wardrobeId: z.uuid().optional(),
  message: z.string().min(1).max(2000),
  imagePath: z.string().max(300).optional(),
  context: z.string().max(300).default(''),
}), async ({ userId, body }) => {
  const db = supabaseAdmin();
  const wid = await activeWardrobe(userId, body.wardrobeId);
  let convId = body.conversationId;
  if (convId) {
    const { data } = await db.from('chat_conversations').select('id').eq('id', convId).eq('user_id', userId).single();
    if (!data) return fail('Conversation not found.', 404, 'not_found');
  } else {
    const { data, error } = await db.from('chat_conversations').insert({ user_id: userId, wardrobe_profile_id: wid, title: body.message.slice(0, 60) }).select('id').single();
    if (error || !data) return fail('Could not start a conversation.', 500);
    convId = data.id;
  }
  const { data: past } = await db.from('chat_messages').select('role, content').eq('conversation_id', convId).order('created_at', { ascending: false }).limit(11);
  const history = [...(past ?? []).reverse(), { role: 'user', content: body.message }] as { role: 'user' | 'assistant'; content: string }[];
  const photo = body.imagePath ? await readOwnFile(userId, 'temp', body.imagePath) : undefined;
  const items = await wardrobeRows(userId, wid);

  const answer = await withCredit(userId, 'chat', convId!, async () =>
    chatReply(userId, { items, history, context: body.context, profile: await profileText(userId), photo }))
    .finally(() => { if (body.imagePath) db.storage.from('temp').remove([body.imagePath]); });

  await db.from('chat_messages').insert([
    { conversation_id: convId!, user_id: userId, role: 'user', content: body.message },
    { conversation_id: convId!, user_id: userId, role: 'assistant', content: answer.reply, looks: { looks: answer.looks, itemIds: answer.itemIds } },
  ]);
  await db.from('chat_conversations').update({ updated_at: new Date().toISOString() }).eq('id', convId!);
  return json({ conversationId: convId, ...answer });
});
