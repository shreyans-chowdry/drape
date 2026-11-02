import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { AIError } from '@/lib/ai/gemini';

export type CreditKind = 'studio' | 'styling' | 'chat' | 'ownit' | 'trip';

/**
 * Run `fn` against one credit of `kind`: the credit is held first (so parallel
 * requests can't overspend), charged if `fn` succeeds and refunded if it throws
 * or reports that nothing billable was produced.
 */
export async function withCredit<T>(userId: string, kind: CreditKind, ref: string, fn: () => Promise<T>, charged: (r: T) => boolean = () => true): Promise<T> {
  const db = supabaseAdmin();
  const { data: creditId, error } = await db.rpc('hold_ai_credit', { uid: userId, k: kind, why: kind, reference: ref });
  if (error) {
    if (/quota_exceeded/.test(error.message)) throw new AIError(QUOTA_MESSAGES[kind], 402, 'quota_exceeded');
    throw new AIError('Could not check your AI allowance. Try again.', 500, 'credit_error');
  }
  try {
    const result = await fn();
    await db.rpc('settle_ai_credit', { credit: creditId as string, ok: charged(result) });
    return result;
  } catch (err) {
    await db.rpc('settle_ai_credit', { credit: creditId as string, ok: false });
    throw err;
  }
}

const QUOTA_MESSAGES: Record<CreditKind, string> = {
  studio: "You've used all your studio photo credits. Upgrade or add a credit pack to make more.",
  styling: "You've used this month's AI styling requests. Upgrade for more, or use the instant (non-AI) suggestions.",
  chat: "You've used this month's stylist chat messages. Upgrade for more.",
  ownit: "You've used this month's Own It checks. Upgrade for more.",
  trip: "You've used this month's trip plans. Upgrade for more.",
};

export async function quota(userId: string, kind: CreditKind) {
  const { data } = await supabaseAdmin().rpc('ai_quota', { uid: userId, k: kind });
  return data as { plan: string; limit: number; used: number; bonus: number; remaining: number };
}
