# Setup

## Requirements
- **Node 22+** (`.nvmrc`). supabase-js needs Node's native WebSocket.
- **Docker** (for the local Supabase stack).

## Local development
1. `npm install`
2. `npx supabase start` — applies `supabase/migrations/*`, creates storage buckets, starts Mailpit. It prints the local URL and keys.
3. `cp .env.example .env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` from step 2
   - `GEMINI_API_KEY` from https://aistudio.google.com/apikey
   - `ADMIN_EMAILS` with your own email to open `/admin`
4. `npm run dev`, then sign up at http://localhost:3000/signup. Open the confirmation email in Mailpit (http://127.0.0.1:54324).

After changing the schema: add a new file in `supabase/migrations/`, run `npx supabase migration up --local`, then `npm run db:types`.
Email templates in `supabase/templates/` are read when the stack starts — restart it (`npx supabase stop && npx supabase start`) after editing them.

## Optional services
- **Razorpay** (test mode): see [DEPLOYMENT.md](DEPLOYMENT.md#razorpay). Without keys, checkout buttons show “Payments are not switched on yet.”
- **Resend**: without `RESEND_API_KEY`/`EMAIL_FROM`, transactional emails are logged as “not configured” and not sent. Auth emails are sent by Supabase itself.
- **Google sign-in**: configure the Google provider in Supabase, then set `NEXT_PUBLIC_GOOGLE_AUTH=true`.
- **Image generation (studio photos)**: Gemini image models are not on the free tier. Enable billing on the Google AI project; until then studio requests fail cleanly and never use a credit.
