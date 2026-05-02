# Self-hosted Supabase with Vercel frontend

This app keeps Supabase as the backend and can point the Vercel-hosted frontend to a self-hosted Supabase instance.

## Required environment variables

Set these in Vercel for each environment (Preview/Production as needed):

- `NEXT_PUBLIC_SUPABASE_URL`
  - Your self-hosted Supabase API URL (example: `https://supabase.example.com`)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - The anon/public API key from your self-hosted Supabase project

> Do not put `SUPABASE_SERVICE_ROLE_KEY` in browser/client code. Keep service-role keys only in secure server/admin contexts.

## Local development

Create `.env.local` in the project root:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://supabase.example.com
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Then run:

```bash
npm install
npm run dev
```

Optional env verification page:

- Open `/debug/supabase-env`
- Confirm both variables show `Configured = yes`
- Values are masked intentionally

## Notes for self-hosted migration

- The frontend uses Supabase client APIs (`@supabase/supabase-js`) and does not require Prisma/SQLite.
- Ensure your self-hosted instance has matching schema, RLS policies, storage buckets, and RPC functions used by the app.
- If you run seed scripts, provide server-side credentials in a secure context only.

## Manual test checklist

After updating env vars, run through:

- [ ] Login works
- [ ] Register works
- [ ] Player data loads and saves
- [ ] Spellbook changes save and reload
- [ ] Inventory changes save and reload
- [ ] DM dashboard player list loads
- [ ] Map upload/view/activation works
- [ ] Fight flow and realtime updates work (turn order / entity updates / status changes)
