# V3.0 Core Implementation Order

1. **DB migration rollout**
   - Apply `20260331_v3_core_systems.sql` in staging.
   - Verify constraints + indexes.

2. **Seed baseline data**
   - Run `npm run seed:compendium` with service role key.
   - Validate slug uniqueness and imported rows.

3. **Type-safe domain layer**
   - Adopt `lib/v3-types.ts` in services/API routes.

4. **Backend services**
   - Wire `lib/supabase-v3.ts` into API routes.
   - Implement bestiary CRUD and fight entity management first.

5. **DM UI incremental integration**
   - Add Bestiary tab (list/create/edit/add-to-fight).
   - Add Fight tab with initiative/turn/hp controls.

6. **Player UI integration**
   - Add Compendium tab.
   - Creatures (unlock-aware list + locked placeholders).
   - Companions assignment and active toggle.

7. **Display mode**
   - Add read-only route/component for TV-style fight display.

8. **Hardening**
   - Add RLS policies and integration tests for campaign scoping.
   - Add telemetry for fight events and compendium fetch paths.
