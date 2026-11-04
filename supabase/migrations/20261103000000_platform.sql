-- Drape platform schema.
-- Every user-owned row carries user_id and is protected by Row Level Security.
-- Entitlements, credits, usage, payments and subscriptions can only be written
-- by the server (service role); users can read their own rows.

create extension if not exists pgcrypto;

-- ───────────────────────────────────────────── enums
create type public.laundry_status as enum ('clean', 'worn', 'in_laundry', 'unavailable');
create type public.image_kind as enum ('original', 'studio', 'thumb');
create type public.ai_kind as enum ('studio', 'styling', 'chat', 'ownit', 'trip', 'scan');
create type public.credit_status as enum ('held', 'charged', 'refunded');
create type public.job_status as enum ('queued', 'processing', 'done', 'failed', 'paused');

-- ───────────────────────────────────────────── helpers
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ───────────────────────────────────────────── configuration (editable from the admin dashboard)
create table public.plans (
  id text primary key,                         -- 'free' | 'plus' | 'pro'
  name text not null,
  tagline text not null default '',
  price_monthly_inr integer not null default 0,
  price_annual_inr integer not null default 0,
  -- {items, profiles, studio_initial, studio_monthly, styling_monthly, chat_monthly, ownit_monthly, trip_monthly, analytics}
  limits jsonb not null,
  features jsonb not null default '[]',
  razorpay_plan_monthly text,                  -- Razorpay plan ids, created in the Razorpay dashboard
  razorpay_plan_annual text,
  sort integer not null default 0,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table public.credit_packs (
  id text primary key,
  name text not null,
  studio_credits integer not null check (studio_credits > 0),
  price_inr integer not null check (price_inr > 0),
  active boolean not null default true
);

create table public.admin_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.plans (id, name, tagline, price_monthly_inr, price_annual_inr, limits, features, sort) values
('free', 'Free', 'Get your wardrobe organised', 0, 0,
 '{"items":30,"profiles":1,"studio_initial":5,"studio_monthly":0,"styling_monthly":10,"chat_monthly":20,"ownit_monthly":5,"trip_monthly":1,"analytics":"basic"}',
 '["30 wardrobe items","5 studio photos to start","10 AI styling requests a month","Own It: 5 checks a month","1 trip plan a month","Closet Finder and weather styling"]', 0),
('plus', 'Plus', 'For a full, styled wardrobe', 199, 1999,
 '{"items":300,"profiles":1,"studio_initial":0,"studio_monthly":20,"styling_monthly":100,"chat_monthly":300,"ownit_monthly":60,"trip_monthly":10,"analytics":"full"}',
 '["300 wardrobe items","20 studio photos a month","100 AI styling requests a month","Chat stylist included","Own It included","Trip planner included","Full wardrobe insights"]', 1),
('pro', 'Pro', 'For big wardrobes and families', 349, 3499,
 '{"items":1000,"profiles":3,"studio_initial":0,"studio_monthly":50,"styling_monthly":300,"chat_monthly":900,"ownit_monthly":200,"trip_monthly":30,"analytics":"full"}',
 '["1,000 wardrobe items","Up to 3 wardrobe profiles","50 studio photos a month","300 AI styling requests a month","Higher chat limit","Advanced trip planning","Full wardrobe insights"]', 2);

insert into public.credit_packs (id, name, studio_credits, price_inr) values ('studio10', '10 studio photos', 10, 79);

-- Prices per 1M tokens / per image in USD, from ai.google.dev pricing (Nov 2026). Edit in Admin → Settings.
insert into public.admin_settings (key, value) values
('model_pricing', '{
  "gemini-3.1-flash-lite": {"input": 0.25, "output": 1.50, "image": 0},
  "gemini-3.6-flash": {"input": 0.75, "output": 3.75, "image": 0},
  "gemini-3.1-flash-lite-image": {"input": 0.25, "output": 1.50, "image": 0.0336},
  "gemini-nano-banana-2.1": {"input": 1.50, "output": 7.50, "image": 0.0336},
  "gemini-3.1-flash-image": {"input": 0.50, "output": 3.00, "image": 0.067}
}'),
('fx', '{"usd_inr": 94.6}'),
('models', '{"text": "gemini-3.1-flash-lite", "reasoning": "gemini-3.6-flash", "image": "gemini-3.1-flash-lite-image", "image_fallback": "gemini-nano-banana-2.1"}');

-- ───────────────────────────────────────────── people
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  email text,
  avatar_url text,
  active_wardrobe_id uuid,
  -- style quiz answers: {clothing, colours, styles, occasions, aesthetics}
  preferences jsonb not null default '{}',
  city text,
  lat double precision,
  lon double precision,
  use_device_location boolean not null default false,
  units text not null default 'metric',
  onboarding jsonb not null default '{"step": 0, "done": false}',
  tour_done boolean not null default false,
  notify jsonb not null default '{"product": true, "usage": true}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.wardrobe_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null check (length(name) between 1 and 40),
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.wardrobe_profiles (user_id);

alter table public.profiles add constraint profiles_active_wardrobe_fk
  foreign key (active_wardrobe_id) references public.wardrobe_profiles on delete set null;

-- New account → profile row + default wardrobe.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare w uuid;
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)));
  insert into public.wardrobe_profiles (user_id, name, is_default) values (new.id, 'My wardrobe', true) returning id into w;
  update public.profiles set active_wardrobe_id = w where id = new.id;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ───────────────────────────────────────────── closet finder
create table public.clothing_locations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  wardrobe_profile_id uuid not null references public.wardrobe_profiles on delete cascade,
  parent_id uuid references public.clothing_locations on delete cascade,
  name text not null check (length(name) between 1 and 60),
  kind text not null default 'place',          -- room | wardrobe | shelf | drawer | box | pouch | place
  sort integer not null default 0,
  created_at timestamptz not null default now()
);
create index on public.clothing_locations (user_id, wardrobe_profile_id);

-- ───────────────────────────────────────────── wardrobe
create table public.clothing_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  wardrobe_profile_id uuid not null references public.wardrobe_profiles on delete cascade,
  name text not null check (length(name) between 1 and 120),
  category text not null,                      -- top | bottom | outer | shoes | onepiece | accessory
  subcategory text not null,                   -- tshirt, jeans, sneakers, socks…
  brand text,
  color text,
  color2 text,
  pattern text not null default 'solid',
  material text,
  style_tags text[] not null default '{}',
  seasons text[] not null default '{}',        -- summer | winter | spring | autumn | rainy | all
  occasions text[] not null default '{}',
  formality smallint not null default 2 check (formality between 1 and 5),
  warmth smallint not null default 2 check (warmth between 1 and 5),
  description text,
  fingerprint text,                            -- what tells it apart from similar pieces
  keywords text[] not null default '{}',
  purchase_price numeric(10, 2) check (purchase_price is null or purchase_price >= 0),
  purchase_date date,
  location_id uuid references public.clothing_locations on delete set null,
  laundry public.laundry_status not null default 'clean',
  wear_count integer not null default 0,
  last_worn_on date,
  favourite boolean not null default false,
  needs_review boolean not null default false,
  ai_meta jsonb not null default '{}',         -- raw scan output, kept for re-analysis without re-billing
  photo_mode text not null default 'studio',   -- which image to show: studio | original
  sample boolean not null default false,
  search tsvector,                             -- kept current by clothing_items_search
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.clothing_items (user_id, wardrobe_profile_id);
create index on public.clothing_items using gin (search);
create trigger clothing_items_touch before update on public.clothing_items for each row execute function public.touch_updated_at();

create or replace function public.clothing_items_search() returns trigger
language plpgsql as $$
begin
  new.search := to_tsvector('simple', concat_ws(' ', new.name, new.brand, new.color, new.color2, new.subcategory,
    new.description, new.fingerprint, array_to_string(new.keywords, ' ')));
  return new;
end $$;
create trigger clothing_items_search before insert or update on public.clothing_items for each row execute function public.clothing_items_search();

create table public.clothing_images (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  item_id uuid not null references public.clothing_items on delete cascade,
  kind public.image_kind not null,
  bucket text not null,
  path text not null,
  width integer,
  height integer,
  model text,                                  -- image model that produced a studio photo
  checks jsonb,                                -- quality-verification result
  created_at timestamptz not null default now(),
  unique (item_id, kind)
);
create index on public.clothing_images (user_id);

-- ───────────────────────────────────────────── outfits, calendar, wear history
create table public.outfit_combinations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  wardrobe_profile_id uuid not null references public.wardrobe_profiles on delete cascade,
  title text,
  occasion text,
  source text not null default 'engine',       -- engine | ai | trip | chat | manual
  why text,
  tips text,
  favourite boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.outfit_combinations (user_id, wardrobe_profile_id);

create table public.outfit_items (
  outfit_id uuid not null references public.outfit_combinations on delete cascade,
  item_id uuid not null references public.clothing_items on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  slot text,
  primary key (outfit_id, item_id)
);

create table public.outfit_calendar (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  wardrobe_profile_id uuid not null references public.wardrobe_profiles on delete cascade,
  date date not null,
  outfit_id uuid not null references public.outfit_combinations on delete cascade,
  note text,
  unique (wardrobe_profile_id, date)
);

create table public.wear_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  wardrobe_profile_id uuid not null references public.wardrobe_profiles on delete cascade,
  outfit_id uuid references public.outfit_combinations on delete set null,
  item_ids uuid[] not null,
  worn_on date not null default current_date,
  created_at timestamptz not null default now()
);
create index on public.wear_history (user_id, wardrobe_profile_id, worn_on desc);

-- Logging a wear updates each piece's counters and marks it worn.
create or replace function public.apply_wear() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.clothing_items
     set wear_count = wear_count + 1,
         last_worn_on = greatest(coalesce(last_worn_on, new.worn_on), new.worn_on),
         laundry = case when laundry = 'clean' then 'worn'::public.laundry_status else laundry end
   where id = any(new.item_ids) and user_id = new.user_id;
  return new;
end $$;
create trigger wear_history_apply after insert on public.wear_history for each row execute function public.apply_wear();

-- ───────────────────────────────────────────── wishlist, trips, chat, feedback
create table public.shopping_wishlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  wardrobe_profile_id uuid not null references public.wardrobe_profiles on delete cascade,
  name text not null,
  image_path text,                             -- in the "originals" bucket
  verdict text,                                -- exact | similar | not_found
  result jsonb,
  url text,
  price numeric(10, 2),
  note text,
  created_at timestamptz not null default now()
);

create table public.trip_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  wardrobe_profile_id uuid not null references public.wardrobe_profiles on delete cascade,
  destination text not null,
  lat double precision,
  lon double precision,
  start_date date not null,
  end_date date not null check (end_date >= start_date),
  activities text,
  preferences text,
  forecast jsonb,
  plan jsonb,                                  -- {days:[{date, day:{pieceIds,why}, evening}], packing, remember, laundry}
  created_at timestamptz not null default now()
);

create table public.trip_outfits (
  trip_id uuid not null references public.trip_plans on delete cascade,
  outfit_id uuid not null references public.outfit_combinations on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  day date not null,
  slot text not null default 'day',            -- day | evening
  primary key (trip_id, outfit_id)
);

create table public.chat_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  wardrobe_profile_id uuid not null references public.wardrobe_profiles on delete cascade,
  title text not null default 'New chat',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.chat_conversations on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  looks jsonb,                                 -- outfit cards attached to an assistant reply
  created_at timestamptz not null default now()
);
create index on public.chat_messages (conversation_id, created_at);

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete set null,
  message text not null check (length(message) between 1 and 4000),
  context jsonb,
  created_at timestamptz not null default now()
);

-- ───────────────────────────────────────────── billing (server-written only)
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  plan_id text not null references public.plans,
  billing_interval text not null check (billing_interval in ('monthly', 'annual')),
  status text not null,                        -- created | authenticated | active | pending | halted | cancelled | completed | expired
  razorpay_subscription_id text unique,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.subscriptions (user_id);
create trigger subscriptions_touch before update on public.subscriptions for each row execute function public.touch_updated_at();

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete set null,
  kind text not null,                          -- subscription | credit_pack
  razorpay_payment_id text unique,
  razorpay_order_id text,
  razorpay_subscription_id text,
  amount_paise integer not null,
  currency text not null default 'INR',
  status text not null,                        -- created | authorized | captured | failed | refunded | partially_refunded
  pack_id text references public.credit_packs,
  description text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.payments (user_id, created_at desc);
create index on public.payments (razorpay_order_id);
create trigger payments_touch before update on public.payments for each row execute function public.touch_updated_at();

create table public.webhook_events (
  id text primary key,                         -- Razorpay x-razorpay-event-id: makes processing idempotent
  event text not null,
  payload jsonb not null,
  processed_at timestamptz,
  error text,
  received_at timestamptz not null default now()
);

-- ───────────────────────────────────────────── AI metering (server-written only)
create table public.user_ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete set null,
  model text not null,
  feature text not null,                       -- scan | studio | verify | styling | chat | ownit | trip
  operation text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  images integer not null default 0,
  cost_usd numeric(12, 6) not null default 0,
  cost_inr numeric(12, 4) not null default 0,
  status text not null,                        -- ok | error | cached
  error text,
  latency_ms integer,
  created_at timestamptz not null default now()
);
create index on public.user_ai_usage (user_id, created_at desc);
create index on public.user_ai_usage (created_at desc);

create table public.ai_credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  kind public.ai_kind not null,
  bucket text not null check (bucket in ('allowance', 'bonus')),
  delta integer not null,                      -- negative = use, positive = purchase/grant (bonus only)
  status public.credit_status not null default 'charged',
  reason text,
  ref text,                                    -- payment id, item id, job id…
  created_at timestamptz not null default now()
);
create index on public.ai_credit_ledger (user_id, kind, created_at);

create table public.ai_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  wardrobe_profile_id uuid not null references public.wardrobe_profiles on delete cascade,
  batch_id uuid not null,
  kind text not null default 'scan',
  status public.job_status not null default 'queued',
  temp_path text,                              -- uploaded photo waiting to be processed
  want_studio boolean not null default false,
  result jsonb,
  error text,
  attempts integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.ai_jobs (user_id, batch_id);
create trigger ai_jobs_touch before update on public.ai_jobs for each row execute function public.touch_updated_at();

-- ───────────────────────────────────────────── entitlements
-- The plan a user is entitled to right now. Paid access comes only from a
-- subscription the server recorded from a verified Razorpay event.
create or replace function public.user_plan(uid uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce((
    select s.plan_id from public.subscriptions s
     where s.user_id = uid
       and s.status in ('active', 'authenticated', 'pending', 'cancelled')
       and s.current_period_end > now()
     order by s.current_period_end desc limit 1
  ), 'free')
$$;

create or replace function public.period_start(uid uuid) returns timestamptz
language sql stable security definer set search_path = public as $$
  select coalesce((
    select s.current_period_start from public.subscriptions s
     where s.user_id = uid and s.current_period_end > now() and s.current_period_start is not null
     order by s.current_period_end desc limit 1
  ), date_trunc('month', now()))
$$;

-- Remaining quota of one kind: {plan, limit, used, bonus, remaining, period_start}
create or replace function public.ai_quota(uid uuid, k public.ai_kind) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  p text := public.user_plan(uid);
  lim jsonb := (select limits from public.plans where id = p);
  since timestamptz := public.period_start(uid);
  allowance integer;
  used integer;
  bonus integer;
begin
  if k = 'scan' then
    return jsonb_build_object('plan', p, 'limit', null, 'used', 0, 'bonus', 0, 'remaining', null);
  end if;
  if k = 'studio' then
    allowance := coalesce((lim->>'studio_monthly')::int, 0);
    if allowance = 0 then
      -- free plan: a one-off starter allowance, never refilled
      allowance := coalesce((lim->>'studio_initial')::int, 0);
      since := '-infinity';
    end if;
  else
    allowance := coalesce((lim->>(k::text || '_monthly'))::int, 0);
  end if;
  select coalesce(-sum(delta), 0) into used from public.ai_credit_ledger
   where user_id = uid and kind = k and bucket = 'allowance' and status <> 'refunded' and created_at >= since;
  select coalesce(sum(delta), 0) into bonus from public.ai_credit_ledger
   where user_id = uid and kind = k and bucket = 'bonus' and status <> 'refunded';
  return jsonb_build_object('plan', p, 'limit', allowance, 'used', used, 'bonus', greatest(bonus, 0),
    'remaining', greatest(allowance - used, 0) + greatest(bonus, 0), 'period_start', since);
end $$;

-- Reserve one credit (status 'held'). Raises 'quota_exceeded' when nothing is left.
-- Serialised per user so parallel requests can't overspend.
create or replace function public.hold_ai_credit(uid uuid, k public.ai_kind, why text, reference text)
returns uuid language plpgsql security definer set search_path = public as $$
declare q jsonb; id uuid; b text;
begin
  if k = 'scan' then return null; end if;
  perform pg_advisory_xact_lock(hashtext(uid::text || k::text));
  q := public.ai_quota(uid, k);
  if (q->>'limit')::int - (q->>'used')::int > 0 then b := 'allowance';
  elsif (q->>'bonus')::int > 0 then b := 'bonus';
  else raise exception 'quota_exceeded' using errcode = 'P0001';
  end if;
  insert into public.ai_credit_ledger (user_id, kind, bucket, delta, status, reason, ref)
  values (uid, k, b, -1, 'held', why, reference) returning ai_credit_ledger.id into id;
  return id;
end $$;

create or replace function public.settle_ai_credit(credit uuid, ok boolean)
returns void language sql security definer set search_path = public as $$
  update public.ai_credit_ledger set status = case when ok then 'charged'::public.credit_status else 'refunded'::public.credit_status end
   where id = credit and status = 'held'
$$;

-- Plan limits on rows a user creates.
create or replace function public.enforce_item_limit() returns trigger
language plpgsql security definer set search_path = public as $$
declare lim integer;
begin
  select (limits->>'items')::int into lim from public.plans where id = public.user_plan(new.user_id);
  if (select count(*) from public.clothing_items where user_id = new.user_id and not sample) >= lim then
    raise exception 'item_limit_reached' using errcode = 'P0001', hint = lim::text;
  end if;
  return new;
end $$;
create trigger clothing_items_limit before insert on public.clothing_items
  for each row when (not new.sample) execute function public.enforce_item_limit();

create or replace function public.enforce_profile_limit() returns trigger
language plpgsql security definer set search_path = public as $$
declare lim integer;
begin
  select (limits->>'profiles')::int into lim from public.plans where id = public.user_plan(new.user_id);
  if (select count(*) from public.wardrobe_profiles where user_id = new.user_id) >= lim then
    raise exception 'profile_limit_reached' using errcode = 'P0001', hint = lim::text;
  end if;
  return new;
end $$;
create trigger wardrobe_profiles_limit before insert on public.wardrobe_profiles
  for each row when (not new.is_default) execute function public.enforce_profile_limit();

-- A row's wardrobe must belong to the same user (stops writing into someone else's wardrobe id).
create or replace function public.check_wardrobe_owner() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.wardrobe_profiles w where w.id = new.wardrobe_profile_id and w.user_id = new.user_id) then
    raise exception 'wardrobe_not_owned' using errcode = '42501';
  end if;
  return new;
end $$;
do $$
declare t text;
begin
  foreach t in array array['clothing_locations','clothing_items','outfit_combinations','outfit_calendar','wear_history','shopping_wishlist','trip_plans','chat_conversations','ai_jobs'] loop
    execute format('create trigger %I before insert or update of wardrobe_profile_id, user_id on public.%I for each row execute function public.check_wardrobe_owner()', t || '_owner', t);
  end loop;
end $$;

-- ───────────────────────────────────────────── row level security
alter table public.plans enable row level security;
alter table public.credit_packs enable row level security;
alter table public.admin_settings enable row level security;
create policy "plans are public" on public.plans for select using (true);
create policy "packs are public" on public.credit_packs for select using (true);
-- admin_settings: no policies → only the service role can read or write it.

alter table public.profiles enable row level security;
create policy "own profile: read" on public.profiles for select using (id = auth.uid());
create policy "own profile: update" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- Full CRUD on own rows for user-content tables.
do $$
declare t text;
begin
  foreach t in array array['wardrobe_profiles','clothing_locations','clothing_items','clothing_images','outfit_combinations','outfit_items',
                           'outfit_calendar','wear_history','shopping_wishlist','trip_plans','trip_outfits','chat_conversations','chat_messages','ai_jobs'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "own rows: select" on public.%I for select using (user_id = auth.uid())', t);
    execute format('create policy "own rows: insert" on public.%I for insert with check (user_id = auth.uid())', t);
    execute format('create policy "own rows: update" on public.%I for update using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
    execute format('create policy "own rows: delete" on public.%I for delete using (user_id = auth.uid())', t);
  end loop;
end $$;

-- The default wardrobe can't be deleted (it anchors the account).
drop policy "own rows: delete" on public.wardrobe_profiles;
create policy "own rows: delete" on public.wardrobe_profiles for delete using (user_id = auth.uid() and not is_default);

-- Read-only to the owner; only the server writes these.
do $$
declare t text;
begin
  foreach t in array array['subscriptions','payments','user_ai_usage','ai_credit_ledger'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "own rows: select" on public.%I for select using (user_id = auth.uid())', t);
  end loop;
end $$;

alter table public.webhook_events enable row level security;  -- no policies: server only

alter table public.feedback enable row level security;
create policy "send feedback" on public.feedback for insert with check (user_id = auth.uid());

-- Credit functions are callable by the server only.
revoke execute on function public.hold_ai_credit(uuid, public.ai_kind, text, text) from public, anon, authenticated;
revoke execute on function public.settle_ai_credit(uuid, boolean) from public, anon, authenticated;
revoke execute on function public.ai_quota(uuid, public.ai_kind) from public, anon, authenticated;
revoke execute on function public.user_plan(uuid) from public, anon, authenticated;
revoke execute on function public.period_start(uuid) from public, anon, authenticated;

-- Users may read their own quota through this wrapper.
create or replace function public.my_quotas() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'plan', public.user_plan(auth.uid()),
    'studio', public.ai_quota(auth.uid(), 'studio'),
    'styling', public.ai_quota(auth.uid(), 'styling'),
    'chat', public.ai_quota(auth.uid(), 'chat'),
    'ownit', public.ai_quota(auth.uid(), 'ownit'),
    'trip', public.ai_quota(auth.uid(), 'trip'),
    'items', (select count(*) from public.clothing_items where user_id = auth.uid() and not sample),
    'profiles', (select count(*) from public.wardrobe_profiles where user_id = auth.uid())
  ) where auth.uid() is not null
$$;
grant execute on function public.my_quotas() to authenticated;

-- ───────────────────────────────────────────── storage
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('originals', 'originals', false, 12582912, array['image/jpeg','image/png','image/webp']),
  ('studio', 'studio', false, 12582912, array['image/jpeg','image/png','image/webp']),
  ('temp', 'temp', false, 12582912, array['image/jpeg','image/png','image/webp']),
  ('backups', 'backups', false, 209715200, array['application/json','application/zip'])
on conflict (id) do nothing;

-- Objects live under "<user id>/…"; a user can only touch their own folder.
-- The studio bucket is read-only to users: only the server writes verified studio photos.
create policy "own files: read" on storage.objects for select to authenticated
  using (bucket_id in ('originals', 'studio', 'temp', 'backups') and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own files: upload" on storage.objects for insert to authenticated
  with check (bucket_id in ('originals', 'temp', 'backups') and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own files: update" on storage.objects for update to authenticated
  using (bucket_id in ('originals', 'temp', 'backups') and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own files: delete" on storage.objects for delete to authenticated
  using (bucket_id in ('originals', 'studio', 'temp', 'backups') and (storage.foldername(name))[1] = auth.uid()::text);

-- Child rows must point at parents the same user owns.
create or replace function public.check_parent_owner() returns trigger
language plpgsql security definer set search_path = public as $$
declare ok boolean;
begin
  ok := case tg_table_name
    when 'clothing_images' then exists (select 1 from public.clothing_items p where p.id = new.item_id and p.user_id = new.user_id)
    when 'outfit_items' then exists (select 1 from public.outfit_combinations p where p.id = new.outfit_id and p.user_id = new.user_id)
                         and exists (select 1 from public.clothing_items p where p.id = new.item_id and p.user_id = new.user_id)
    when 'trip_outfits' then exists (select 1 from public.trip_plans p where p.id = new.trip_id and p.user_id = new.user_id)
                         and exists (select 1 from public.outfit_combinations p where p.id = new.outfit_id and p.user_id = new.user_id)
    when 'chat_messages' then exists (select 1 from public.chat_conversations p where p.id = new.conversation_id and p.user_id = new.user_id)
    when 'outfit_calendar' then exists (select 1 from public.outfit_combinations p where p.id = new.outfit_id and p.user_id = new.user_id)
    when 'clothing_locations' then new.parent_id is null or exists (select 1 from public.clothing_locations p where p.id = new.parent_id and p.user_id = new.user_id)
    else true end;
  if not ok then raise exception 'parent_not_owned' using errcode = '42501'; end if;
  return new;
end $$;
do $$
declare t text;
begin
  foreach t in array array['clothing_images','outfit_items','trip_outfits','chat_messages','outfit_calendar','clothing_locations'] loop
    execute format('create trigger %I before insert or update on public.%I for each row execute function public.check_parent_owner()', t || '_parent', t);
  end loop;
end $$;

-- An item's location must be the owner's too.
create or replace function public.check_item_location() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.location_id is not null and not exists (select 1 from public.clothing_locations l where l.id = new.location_id and l.user_id = new.user_id) then
    raise exception 'location_not_owned' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger clothing_items_location before insert or update of location_id on public.clothing_items
  for each row execute function public.check_item_location();
