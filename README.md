# Drape

**Your entire wardrobe. One intelligent stylist.** Drape catalogues clothes from a photo, styles outfits only from what you own, finds where each piece is kept, plans trips, and tells you whether you already own something before you buy it.

Next.js 16 (App Router, TypeScript, Tailwind v4) · Supabase (Postgres, Auth, Storage, RLS) · Google Gemini (server-side only) · Razorpay · Resend · Vercel.

## Quick start

```bash
nvm use            # Node 22+
npm install
npx supabase start # local Postgres, Auth, Storage, Mailpit (needs Docker)
cp .env.example .env.local   # fill in the keys printed by `supabase start` and your GEMINI_API_KEY
npm run dev
```

Open http://localhost:3000. Confirmation and reset emails land in Mailpit at http://127.0.0.1:54324.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run typecheck` | TypeScript |
| `npm run lint` | ESLint |
| `npm test` | Unit tests |
| `npm run test:integration` | Database/RLS/credit tests against the local Supabase |
| `npm run db:types` | Regenerate `src/lib/database.types.ts` |

## Docs

- [Setup](docs/SETUP.md) · [Environment variables](docs/ENVIRONMENT_VARIABLES.md) · [Deployment](docs/DEPLOYMENT.md)
- [Architecture](docs/ARCHITECTURE.md) · [Database schema](docs/DATABASE_SCHEMA.md) · [AI costs](docs/AI_COSTS.md) · [Testing](docs/TESTING.md)

The brand lives in one file: `src/lib/brand.ts`. The previous static PWA is kept in `legacy/`.
