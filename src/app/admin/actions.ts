'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdmin } from '@/lib/server/admin';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { clearSettingsCache } from '@/lib/ai/gemini';
import type { Json } from '@/lib/database.types';

export type Result = { ok: boolean; message: string };

const Limits = z.object({
  items: z.number().int().min(0), profiles: z.number().int().min(1), studio_initial: z.number().int().min(0), studio_monthly: z.number().int().min(0),
  styling_monthly: z.number().int().min(0), chat_monthly: z.number().int().min(0), ownit_monthly: z.number().int().min(0), trip_monthly: z.number().int().min(0),
  analytics: z.enum(['basic', 'full']),
});
const Plan = z.object({
  id: z.enum(['free', 'plus', 'pro']), name: z.string().min(1).max(40), tagline: z.string().max(120),
  price_monthly_inr: z.number().int().min(0), price_annual_inr: z.number().int().min(0),
  limits: Limits, features: z.array(z.string().min(1).max(120)).max(15),
  razorpay_plan_monthly: z.string().max(60).nullable(), razorpay_plan_annual: z.string().max(60).nullable(), active: z.boolean(),
});
const Pack = z.object({ id: z.string().min(1).max(40), name: z.string().min(1).max(60), studio_credits: z.number().int().min(1).max(1000), price_inr: z.number().int().min(1), active: z.boolean() });
const SETTINGS = {
  model_pricing: z.record(z.string().min(3), z.object({ input: z.number().min(0), output: z.number().min(0), image: z.number().min(0) })),
  fx: z.object({ usd_inr: z.number().min(1).max(1000) }),
  models: z.object({ text: z.string().min(3), reasoning: z.string().min(3), image: z.string().min(3), image_fallback: z.string().min(3) }),
} as const;

const parse = (raw: string) => { try { return { v: JSON.parse(raw) as unknown }; } catch { return { e: 'That is not valid JSON.' }; } };
const issues = (e: z.ZodError) => e.issues.slice(0, 3).map(i => `${i.path.join('.') || 'value'}: ${i.message}`).join('; ');

export async function savePlan(_: Result | null, form: FormData): Promise<Result> {
  await requireAdmin();
  const j = parse(String(form.get('json')));
  if ('e' in j) return { ok: false, message: j.e! };
  const p = Plan.safeParse(j.v);
  if (!p.success) return { ok: false, message: issues(p.error) };
  const { id, ...row } = p.data;
  const { error } = await supabaseAdmin().from('plans').update({ ...row, limits: row.limits as NonNullable<Json>, features: row.features as NonNullable<Json>, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) return { ok: false, message: error.message };
  revalidatePath('/admin'); revalidatePath('/');
  return { ok: true, message: `Saved ${p.data.name}.` };
}

export async function savePack(_: Result | null, form: FormData): Promise<Result> {
  await requireAdmin();
  const j = parse(String(form.get('json')));
  if ('e' in j) return { ok: false, message: j.e! };
  const p = Pack.safeParse(j.v);
  if (!p.success) return { ok: false, message: issues(p.error) };
  const { error } = await supabaseAdmin().from('credit_packs').upsert(p.data);
  if (error) return { ok: false, message: error.message };
  revalidatePath('/admin'); revalidatePath('/');
  return { ok: true, message: `Saved ${p.data.name}.` };
}

export async function saveSetting(_: Result | null, form: FormData): Promise<Result> {
  await requireAdmin();
  const key = String(form.get('key')) as keyof typeof SETTINGS;
  if (!(key in SETTINGS)) return { ok: false, message: 'Unknown setting.' };
  const j = parse(String(form.get('json')));
  if ('e' in j) return { ok: false, message: j.e! };
  const p = SETTINGS[key].safeParse(j.v);
  if (!p.success) return { ok: false, message: issues(p.error) };
  const { error } = await supabaseAdmin().from('admin_settings').upsert({ key, value: p.data as NonNullable<Json>, updated_at: new Date().toISOString() });
  if (error) return { ok: false, message: error.message };
  clearSettingsCache();
  revalidatePath('/admin');
  return { ok: true, message: 'Saved. Takes effect on new requests (other server instances within a minute).' };
}
