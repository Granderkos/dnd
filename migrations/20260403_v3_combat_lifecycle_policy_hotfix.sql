-- Hotfix: remove recursive fights policy chain.
-- `player_select_active_fights` caused recursion via fight_entities policies that reference fights.

DROP POLICY IF EXISTS "player_select_active_fights" ON public.fights;
