# Database schema

Migrations: `supabase/migrations/`. Generated types: `src/lib/database.types.ts`.

## Catalogue & settings (public read, server write)
- `plans` — free/plus/pro: prices (INR), `limits` JSON (items, profiles, studio_initial, studio_monthly, styling/chat/ownit/trip monthly), features, Razorpay plan ids.
- `credit_packs` — e.g. `studio10`: 10 studio credits for ₹79.
- `admin_settings` — `models`, `model_pricing`, `fx` (service role only).

## People
- `profiles` — one per auth user (created by `handle_new_user`): name, preferences, location, onboarding progress, tour flag, email settings, active wardrobe.
- `wardrobe_profiles` — separate wardrobes per account (limit by plan; default one can’t be deleted).

## Wardrobe (own-row RLS + ownership triggers)
- `clothing_locations` — tree via `parent_id` (room → wardrobe → shelf/drawer → box).
- `clothing_items` — every attribute (category, type, colours, pattern, material, seasons[], occasions[], formality, warmth, price/date, location, laundry, wear count, favourite, review flag, AI metadata, photo mode); `search` tsvector maintained by trigger.
- `clothing_images` — original / thumb / studio per item (bucket + path).
- `outfit_combinations`, `outfit_items`, `outfit_calendar` (one per wardrobe per day), `wear_history` (`apply_wear` updates counts and laundry).
- `shopping_wishlist`, `trip_plans`, `trip_outfits`, `chat_conversations`, `chat_messages`, `ai_jobs` (batch queue state).
- `feedback` — contact-form and feedback messages.

## Money & metering (users read own rows; server writes)
- `subscriptions`, `payments`, `webhook_events` (idempotency by Razorpay event id).
- `user_ai_usage` — every AI call: user, model, feature, operation, tokens, images, USD/INR cost, status, latency.
- `ai_credit_ledger` — allowance/bonus debits and purchases; `held → charged | refunded`.

## Functions
`user_plan`, `period_start`, `ai_quota`, `hold_ai_credit`, `settle_ai_credit` (service role only), `my_quotas` (authenticated), `enforce_item_limit`, `enforce_profile_limit`, `check_wardrobe_owner`, `check_parent_owner`, `clothing_items_search`, `apply_wear`, `handle_new_user`.

## Storage buckets (private)
`originals` (user read/write own folder), `studio` (user read/delete; server writes), `temp` (12 MB images), `backups` (200 MB json/zip). Paths always start with the user id.
