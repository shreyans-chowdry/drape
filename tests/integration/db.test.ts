// Runs against the local Supabase stack (`npx supabase start`). Uses only the local demo keys from .env.local.
import { readFileSync } from 'node:fs';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from '@/lib/database.types';

const env = Object.fromEntries(readFileSync('.env.local', 'utf8').split('\n').filter(l => /^[A-Z_]+=/.test(l)).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]));
const URL = env.NEXT_PUBLIC_SUPABASE_URL, PUB = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, SECRET = env.SUPABASE_SECRET_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL?.includes('127.0.0.1') && !URL?.includes('localhost')) throw new Error('Integration tests only run against the local Supabase stack.');

type DB = SupabaseClient<Database>;
const admin: DB = createClient<Database>(URL, SECRET, { auth: { persistSession: false } });
const stamp = Date.now();
const users: { id: string; sb: DB; wardrobe: string }[] = [];

async function makeUser(n: number) {
  const email = `it-${stamp}-${n}@example.test`, password = `pw-${stamp}-${n}-Aa1!`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  const sb = createClient<Database>(URL, PUB, { auth: { persistSession: false } });
  await sb.auth.signInWithPassword({ email, password });
  const { data: w } = await sb.from('wardrobe_profiles').select('id').single();
  return { id: data.user.id, sb, wardrobe: w!.id };
}
const addItem = (u: (typeof users)[number], name = 'Shirt') =>
  u.sb.from('clothing_items').insert({ user_id: u.id, wardrobe_profile_id: u.wardrobe, name, category: 'top', subcategory: 'shirt' }).select('id').single();

beforeAll(async () => { users.push(await makeUser(1), await makeUser(2)); });
afterAll(async () => { for (const u of users) await admin.auth.admin.deleteUser(u.id); });

describe('row level security', () => {
  it('creates a profile and default wardrobe for each new user', async () => {
    const [a] = users;
    const { data } = await a.sb.from('profiles').select('id, onboarding').single();
    expect(data?.id).toBe(a.id);
    expect(a.wardrobe).toBeTruthy();
  });

  it('keeps each user’s wardrobe private', async () => {
    const [a, b] = users;
    const { data: item } = await addItem(a, 'Private shirt');
    const { data: seen } = await b.sb.from('clothing_items').select('id').eq('id', item!.id);
    expect(seen).toEqual([]);
    const { data: upd } = await b.sb.from('clothing_items').update({ name: 'hacked' }).eq('id', item!.id).select('id');
    expect(upd).toEqual([]);
    const { data: del } = await b.sb.from('clothing_items').delete().eq('id', item!.id).select('id');
    expect(del).toEqual([]);
  });

  it('rejects rows that claim someone else’s user id or wardrobe', async () => {
    const [a, b] = users;
    const spoofUser = await b.sb.from('clothing_items').insert({ user_id: a.id, wardrobe_profile_id: a.wardrobe, name: 'x', category: 'top', subcategory: 'shirt' });
    expect(spoofUser.error).toBeTruthy();
    const foreignWardrobe = await b.sb.from('clothing_items').insert({ user_id: b.id, wardrobe_profile_id: a.wardrobe, name: 'x', category: 'top', subcategory: 'shirt' });
    expect(foreignWardrobe.error).toBeTruthy();
  });

  it('does not let users grant themselves plans or credits', async () => {
    const [a] = users;
    const sub = await a.sb.from('subscriptions').insert({ user_id: a.id, plan_id: 'pro', billing_interval: 'monthly', status: 'active' });
    expect(sub.error).toBeTruthy();
    const led = await a.sb.from('ai_credit_ledger').insert({ user_id: a.id, kind: 'studio', bucket: 'bonus', delta: 1000 });
    expect(led.error).toBeTruthy();
    const hold = await a.sb.rpc('hold_ai_credit', { uid: a.id, k: 'studio', why: 'x', reference: 'x' });
    expect(hold.error).toBeTruthy();
    const plan = await a.sb.from('plans').update({ price_monthly_inr: 0 }).eq('id', 'pro').select('id');
    expect(plan.data ?? []).toEqual([]);
  });

  it('keeps storage folders private', async () => {
    const [a, b] = users;
    const path = `${a.id}/it/test.jpg`;
    expect((await a.sb.storage.from('originals').upload(path, new Blob([new Uint8Array([255, 216, 255])], { type: 'image/jpeg' }))).error).toBeNull();
    expect((await b.sb.storage.from('originals').download(path)).error).toBeTruthy();
    expect((await b.sb.storage.from('originals').upload(`${a.id}/it/evil.jpg`, new Blob(['x'], { type: 'image/jpeg' }))).error).toBeTruthy();
    expect((await a.sb.storage.from('studio').upload(`${a.id}/it/s.jpg`, new Blob(['x'], { type: 'image/jpeg' }))).error).toBeTruthy();
    await a.sb.storage.from('originals').remove([path]);
  });
});

describe('child rows (photos, outfits, calendar, places, chat)', () => {
  it('lets owners add child rows and blocks pointing at someone else’s parent', async () => {
    const [a, b] = users;
    const { data: item } = await addItem(a, 'Parent shirt');
    expect((await a.sb.from('clothing_images').insert({ user_id: a.id, item_id: item!.id, kind: 'original', bucket: 'originals', path: `${a.id}/${item!.id}/original.jpg` })).error).toBeNull();
    const { data: outfit, error: oe } = await a.sb.from('outfit_combinations').insert({ user_id: a.id, wardrobe_profile_id: a.wardrobe, source: 'manual' }).select('id').single();
    expect(oe).toBeNull();
    expect((await a.sb.from('outfit_items').insert({ outfit_id: outfit!.id, item_id: item!.id, user_id: a.id })).error).toBeNull();
    expect((await a.sb.from('outfit_calendar').insert({ user_id: a.id, wardrobe_profile_id: a.wardrobe, date: '2026-12-01', outfit_id: outfit!.id })).error).toBeNull();
    const { data: room } = await a.sb.from('clothing_locations').insert({ user_id: a.id, wardrobe_profile_id: a.wardrobe, name: 'Bedroom', kind: 'room' }).select('id').single();
    expect((await a.sb.from('clothing_locations').insert({ user_id: a.id, wardrobe_profile_id: a.wardrobe, name: 'Shelf', kind: 'shelf', parent_id: room!.id })).error).toBeNull();
    const { data: conv } = await a.sb.from('chat_conversations').insert({ user_id: a.id, wardrobe_profile_id: a.wardrobe }).select('id').single();
    expect((await a.sb.from('chat_messages').insert({ conversation_id: conv!.id, user_id: a.id, role: 'user', content: 'hi' })).error).toBeNull();

    // b cannot attach its rows to a's parents
    expect((await b.sb.from('clothing_images').insert({ user_id: b.id, item_id: item!.id, kind: 'thumb', bucket: 'originals', path: `${b.id}/x.jpg` })).error).toBeTruthy();
    expect((await b.sb.from('chat_messages').insert({ conversation_id: conv!.id, user_id: b.id, role: 'user', content: 'x' })).error).toBeTruthy();
    expect((await b.sb.from('clothing_locations').insert({ user_id: b.id, wardrobe_profile_id: b.wardrobe, name: 'x', parent_id: room!.id })).error).toBeTruthy();
  });
});

describe('plan limits and credits', () => {
  it('stops adding items past the Free limit', async () => {
    const [, b] = users;
    const rows = Array.from({ length: 30 }, (_, i) => ({ user_id: b.id, wardrobe_profile_id: b.wardrobe, name: `Item ${i}`, category: 'top', subcategory: 'tshirt' }));
    const { count } = await b.sb.from('clothing_items').select('id', { count: 'exact', head: true });
    expect((await b.sb.from('clothing_items').insert(rows.slice(0, 30 - (count ?? 0)))).error).toBeNull();
    const over = await addItem(b, 'One too many');
    expect(over.error?.message).toContain('item_limit_reached');
  });

  it('holds, charges and refunds credits; failures never consume one', async () => {
    const [a] = users;
    const before = (await admin.rpc('ai_quota', { uid: a.id, k: 'studio' })).data as { remaining: number };
    expect(before.remaining).toBe(5);
    const held = await admin.rpc('hold_ai_credit', { uid: a.id, k: 'studio', why: 'test', reference: 'r1' });
    expect(held.error).toBeNull();
    expect(((await admin.rpc('ai_quota', { uid: a.id, k: 'studio' })).data as { remaining: number }).remaining).toBe(4);
    await admin.rpc('settle_ai_credit', { credit: held.data!, ok: false });
    expect(((await admin.rpc('ai_quota', { uid: a.id, k: 'studio' })).data as { remaining: number }).remaining).toBe(5);
    const ok = await admin.rpc('hold_ai_credit', { uid: a.id, k: 'studio', why: 'test', reference: 'r2' });
    await admin.rpc('settle_ai_credit', { credit: ok.data!, ok: true });
    expect(((await admin.rpc('ai_quota', { uid: a.id, k: 'studio' })).data as { remaining: number }).remaining).toBe(4);
  });

  it('refuses a hold when the allowance is used up', async () => {
    const [a] = users;
    for (let i = 0; i < 4; i++) await admin.rpc('hold_ai_credit', { uid: a.id, k: 'studio', why: 'drain', reference: `d${i}` });
    const extra = await admin.rpc('hold_ai_credit', { uid: a.id, k: 'studio', why: 'drain', reference: 'd5' });
    expect(extra.error?.message).toContain('quota_exceeded');
  });

  it('exposes the caller’s own quotas', async () => {
    const [a] = users;
    const { data, error } = await a.sb.rpc('my_quotas');
    expect(error).toBeNull();
    expect((data as { plan: string }).plan).toBe('free');
  });
});
