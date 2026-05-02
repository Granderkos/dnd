


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."assign_companion_from_template"("p_character_id" "uuid", "p_template_id" "uuid", "p_name_override" "text" DEFAULT NULL::"text", "p_notes" "text" DEFAULT NULL::"text") RETURNS TABLE("id" "uuid", "character_id" "uuid", "entry_id" "uuid", "kind" "text", "name_override" "text", "notes" "text", "is_active" boolean, "custom_data" "jsonb", "source_companion_template_id" "uuid", "source_origin" "text", "template_snapshot" "jsonb", "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_template public.companion_templates%rowtype;
  v_entry_id uuid;
  v_auth_user uuid;
begin
  v_auth_user := auth.uid();
  if v_auth_user is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1
    from public.characters as c
    where c.id = p_character_id
      and c.user_id = v_auth_user
  ) then
    raise exception 'Character does not belong to current user';
  end if;

  select ct.*
  into v_template
  from public.companion_templates as ct
  where ct.id = p_template_id;

  if not found then
    raise exception 'Companion template not found';
  end if;

  insert into public.compendium_entries (
    type,
    subtype,
    slug,
    name,
    description,
    is_system,
    data,
    created_by,
    updated_at
  )
  values (
    'companion',
    v_template.kind,
    concat(v_template.slug, '-', replace(gen_random_uuid()::text, '-', '')),
    v_template.name,
    v_template.notes,
    false,
    jsonb_build_object(
      'ac', v_template.armor_class,
      'hp', v_template.hit_points,
      'speed', v_template.speed_text
    ) || coalesce(v_template.custom_data, '{}'::jsonb),
    v_auth_user,
    now()
  )
  returning public.compendium_entries.id
  into v_entry_id;

  return query
  insert into public.character_companions as cc (
    character_id,
    entry_id,
    kind,
    name_override,
    notes,
    is_active,
    custom_data,
    source_companion_template_id,
    source_origin,
    template_snapshot,
    updated_at
  )
  values (
    p_character_id,
    v_entry_id,
    v_template.kind,
    p_name_override,
    coalesce(p_notes, v_template.notes),
    true,
    jsonb_build_object('source', 'template', 'template_id', v_template.id),
    v_template.id,
    'template',
    to_jsonb(v_template),
    now()
  )
  returning
    cc.id,
    cc.character_id,
    cc.entry_id,
    cc.kind,
    cc.name_override,
    cc.notes,
    cc.is_active,
    cc.custom_data,
    cc.source_companion_template_id,
    cc.source_origin,
    cc.template_snapshot,
    cc.created_at;
end
$$;


ALTER FUNCTION "public"."assign_companion_from_template"("p_character_id" "uuid", "p_template_id" "uuid", "p_name_override" "text", "p_notes" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."compendium_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "type" "text" NOT NULL,
    "subtype" "text",
    "slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "is_system" boolean DEFAULT true NOT NULL,
    "data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "compendium_entries_subtype_check" CHECK (("subtype" = ANY (ARRAY['monster'::"text", 'pet'::"text", 'mount'::"text", 'summon'::"text", 'familiar'::"text"]))),
    CONSTRAINT "compendium_entries_type_check" CHECK (("type" = ANY (ARRAY['creature'::"text", 'companion'::"text"])))
);


ALTER TABLE "public"."compendium_entries" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_companion_entry_for_user"("p_kind" "text", "p_slug" "text", "p_name" "text", "p_description" "text", "p_data" "jsonb") RETURNS "public"."compendium_entries"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_row public.compendium_entries;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = v_uid
      and role in ('dm', 'player')
  ) then
    raise exception 'Only authenticated DM/Player profiles can create companion entries';
  end if;

  insert into public.compendium_entries (
    type,
    subtype,
    slug,
    name,
    description,
    data,
    is_system,
    created_by
  ) values (
    'companion',
    coalesce(nullif(trim(p_kind), ''), 'pet'),
    p_slug,
    p_name,
    nullif(trim(coalesce(p_description, '')), ''),
    coalesce(p_data, '{}'::jsonb),
    false,
    v_uid
  )
  returning * into v_row;

  return v_row;
end;
$$;


ALTER FUNCTION "public"."create_companion_entry_for_user"("p_kind" "text", "p_slug" "text", "p_name" "text", "p_description" "text", "p_data" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_creature_entry_for_dm"("p_subtype" "text", "p_slug" "text", "p_name" "text", "p_description" "text", "p_data" "jsonb") RETURNS "public"."compendium_entries"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_row public.compendium_entries;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = v_uid
      and role in ('dm', 'player')
  ) then
    raise exception 'Only authenticated DM/Player profiles can create creature entries';
  end if;

  insert into public.compendium_entries (
    type,
    subtype,
    slug,
    name,
    description,
    data,
    is_system,
    created_by
  ) values (
    'creature',
    coalesce(nullif(trim(p_subtype), ''), 'monster'),
    p_slug,
    p_name,
    nullif(trim(coalesce(p_description, '')), ''),
    coalesce(p_data, '{}'::jsonb),
    false,
    v_uid
  )
  returning * into v_row;

  return v_row;
end;
$$;


ALTER FUNCTION "public"."create_creature_entry_for_dm"("p_subtype" "text", "p_slug" "text", "p_name" "text", "p_description" "text", "p_data" "jsonb") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."item_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "category" "text" DEFAULT 'Other'::"text" NOT NULL,
    "rarity" "text",
    "weight" numeric(10,2),
    "value_text" "text",
    "requires_attunement" boolean DEFAULT false NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "properties" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "tags" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "source_name" "text",
    "source_page" "text",
    "is_official" boolean DEFAULT false NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "damage_text" "text",
    "damage_type" "text",
    "range_text" "text",
    "weapon_kind" "text",
    "source_url" "text",
    "item_kind" "text",
    "item_subtype" "text",
    "armor_kind" "text",
    "ac_base" integer,
    "ac_bonus" integer,
    "dex_cap" integer,
    "strength_requirement" integer,
    "stealth_disadvantage" boolean,
    "don_time_text" "text",
    "doff_time_text" "text",
    "attunement_text" "text",
    "source_code" "text",
    "contents_summary" "text",
    "capacity_text" "text",
    "charges_max" integer,
    "charges_current" integer,
    "usage_type" "text",
    CONSTRAINT "item_templates_armor_kind_check" CHECK ((("armor_kind" IS NULL) OR ("armor_kind" = ANY (ARRAY['light'::"text", 'medium'::"text", 'heavy'::"text", 'shield'::"text"])))),
    CONSTRAINT "item_templates_category_check" CHECK (("category" = ANY (ARRAY['Weapons'::"text", 'Armor'::"text", 'Equipment'::"text", 'Consumables'::"text", 'Supplies'::"text", 'Treasure'::"text", 'Other'::"text", 'Tools'::"text"]))),
    CONSTRAINT "item_templates_item_kind_check" CHECK (("item_kind" = ANY (ARRAY['weapon'::"text", 'armor'::"text", 'gear'::"text", 'consumable'::"text", 'container'::"text", 'currency'::"text", 'tool'::"text"]))),
    CONSTRAINT "item_templates_usage_type_check" CHECK ((("usage_type" IS NULL) OR ("usage_type" = ANY (ARRAY['charges'::"text", 'quantity'::"text", 'single_use'::"text"])))),
    CONSTRAINT "item_templates_weapon_kind_check" CHECK ((("weapon_kind" IS NULL) OR ("weapon_kind" = ANY (ARRAY['simple_melee'::"text", 'simple_ranged'::"text", 'martial_melee'::"text", 'martial_ranged'::"text"]))))
);


ALTER TABLE "public"."item_templates" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_item_template_for_dm"("p_slug" "text", "p_name" "text", "p_description" "text", "p_category" "text", "p_item_kind" "text", "p_item_subtype" "text", "p_rarity" "text", "p_weight" numeric, "p_value_text" "text", "p_damage_text" "text", "p_damage_type" "text", "p_range_text" "text", "p_armor_kind" "text", "p_ac_base" integer, "p_charges_max" integer, "p_charges_current" integer, "p_usage_type" "text", "p_properties" "jsonb", "p_tags" "jsonb") RETURNS "public"."item_templates"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_row public.item_templates;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (select 1 from public.profiles where id = v_uid and role = 'dm') then
    raise exception 'Only DM can create item templates';
  end if;

  insert into public.item_templates (
    slug, name, description, category, item_kind, item_subtype, rarity, weight, value_text,
    damage_text, damage_type, range_text, armor_kind, ac_base, charges_max, charges_current,
    usage_type, properties, tags, is_official, created_by
  ) values (
    p_slug, p_name, coalesce(p_description, ''), coalesce(p_category, 'Other'),
    p_item_kind, p_item_subtype, p_rarity, p_weight, p_value_text,
    p_damage_text, p_damage_type, p_range_text, p_armor_kind, p_ac_base, p_charges_max, p_charges_current,
    p_usage_type, coalesce(p_properties, '[]'::jsonb), coalesce(p_tags, '[]'::jsonb), false, v_uid
  )
  returning * into v_row;

  return v_row;
end;
$$;


ALTER FUNCTION "public"."create_item_template_for_dm"("p_slug" "text", "p_name" "text", "p_description" "text", "p_category" "text", "p_item_kind" "text", "p_item_subtype" "text", "p_rarity" "text", "p_weight" numeric, "p_value_text" "text", "p_damage_text" "text", "p_damage_type" "text", "p_range_text" "text", "p_armor_kind" "text", "p_ac_base" integer, "p_charges_max" integer, "p_charges_current" integer, "p_usage_type" "text", "p_properties" "jsonb", "p_tags" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_fight_character_combat_state"("p_fight_id" "uuid") RETURNS TABLE("character_id" "uuid", "hp_current" integer, "hp_max" integer, "death_successes" integer, "death_failures" integer)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select
    c.id as character_id,
    c.hp_current as hp_current,
    c.hp_max as hp_max,
    coalesce(c.death_successes, 0) as death_successes,
    coalesce(c.death_failures, 0) as death_failures
  from public.fight_entities fe
  join public.fights f on f.id = fe.fight_id
  join public.characters c on c.id = fe.character_id
  where fe.fight_id = p_fight_id
    and fe.entity_type = 'player'
    and auth.uid() = f.campaign_id;
$$;


ALTER FUNCTION "public"."get_fight_character_combat_state"("p_fight_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."grant_currency_to_character_for_dm"("p_character_id" "text", "p_gold" integer DEFAULT 0) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_character_id uuid;
  v_notes_text text := '{}';
  v_payload jsonb := '{}'::jsonb;
  v_currency jsonb := '{}'::jsonb;
  v_next_gp integer := 0;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (select 1 from public.profiles where id = v_uid and role = 'dm') then
    raise exception 'Only DM can grant currency';
  end if;

  begin
    v_character_id := p_character_id::uuid;
  exception when invalid_text_representation then
    raise exception 'Invalid target character id format';
  end;

  if not exists (
    select 1
    from public.characters c
    join public.profiles p on p.id = c.user_id
    where c.id = v_character_id and p.role = 'player'
  ) then
    raise exception 'Invalid target character';
  end if;

  select coalesce(notes, '{}')
    into v_notes_text
  from public.character_notes
  where character_id = v_character_id;

  begin
    v_payload := coalesce(v_notes_text::jsonb, '{}'::jsonb);
  exception when others then
    v_payload := '{}'::jsonb;
  end;

  v_currency := coalesce(v_payload->'inventoryCurrency', '{}'::jsonb);
  v_next_gp := greatest(0, coalesce((v_currency->>'gp')::integer, 0) + greatest(0, coalesce(p_gold, 0)));

  v_payload := jsonb_set(
    v_payload,
    '{inventoryCurrency}',
    jsonb_build_object(
      'pp', coalesce((v_currency->>'pp')::integer, 0),
      'gp', v_next_gp,
      'ep', coalesce((v_currency->>'ep')::integer, 0),
      'sp', coalesce((v_currency->>'sp')::integer, 0),
      'cp', coalesce((v_currency->>'cp')::integer, 0)
    ),
    true
  );

  insert into public.character_notes (character_id, notes)
  values (v_character_id, v_payload::text)
  on conflict (character_id)
  do update set notes = excluded.notes;
end;
$$;


ALTER FUNCTION "public"."grant_currency_to_character_for_dm"("p_character_id" "text", "p_gold" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."grant_inventory_item_for_dm"("p_character_id" "text", "p_title" "text", "p_description" "text", "p_quantity" integer, "p_category" "text", "p_source_item_template_id" "text" DEFAULT NULL::"text", "p_source_origin" "text" DEFAULT 'custom'::"text", "p_template_snapshot" "jsonb" DEFAULT NULL::"jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_next_sort integer := 0;
  v_character_id uuid;
  v_template_id uuid := null;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (select 1 from public.profiles where id = v_uid and role = 'dm') then
    raise exception 'Only DM can grant inventory items';
  end if;

  begin
    v_character_id := p_character_id::uuid;
  exception when invalid_text_representation then
    raise exception 'Invalid target character id format';
  end;

  if coalesce(p_source_item_template_id, '') <> '' then
    begin
      v_template_id := p_source_item_template_id::uuid;
    exception when invalid_text_representation then
      raise exception 'Invalid source item template id format';
    end;
  end if;

  if not exists (
    select 1
    from public.characters c
    join public.profiles p on p.id = c.user_id
    where c.id = v_character_id and p.role = 'player'
  ) then
    raise exception 'Invalid target character';
  end if;

  select coalesce(max(sort_order), -1) + 1
  into v_next_sort
  from public.inventory_items
  where character_id = v_character_id;

  insert into public.inventory_items (
    character_id,
    client_id,
    sort_order,
    title,
    description,
    quantity,
    category,
    source_item_template_id,
    source_origin,
    template_snapshot
  ) values (
    v_character_id,
    concat('srv-', replace(gen_random_uuid()::text, '-', '')),
    v_next_sort,
    p_title,
    coalesce(p_description, ''),
    greatest(1, coalesce(p_quantity, 1)),
    coalesce(p_category, 'Other'),
    v_template_id,
    coalesce(p_source_origin, 'custom'),
    p_template_snapshot
  );
end;
$$;


ALTER FUNCTION "public"."grant_inventory_item_for_dm"("p_character_id" "text", "p_title" "text", "p_description" "text", "p_quantity" integer, "p_category" "text", "p_source_item_template_id" "text", "p_source_origin" "text", "p_template_snapshot" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  new_username text;
  new_role text;
begin
  new_username := coalesce(
    new.raw_user_meta_data ->> 'username',
    split_part(coalesce(new.email, ''), '@', 1),
    'user_' || substr(new.id::text, 1, 8)
  );

  new_role := coalesce(
    new.raw_user_meta_data ->> 'role',
    'player'
  );

  insert into public.profiles (id, username, role)
  values (
    new.id,
    new_username,
    case
      when new_role in ('player', 'dm') then new_role
      else 'player'
    end
  )
  on conflict (id) do nothing;

  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_dm"("check_user_id" "uuid" DEFAULT "auth"."uid"()) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.profiles p
    where p.id = check_user_id
      and p.role = 'dm'
  );
$$;


ALTER FUNCTION "public"."is_dm"("check_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_fight_entity_hp"("p_entity_id" "uuid", "p_current_hp" integer) RETURNS TABLE("entity_id" "uuid", "entity_type" "text", "character_id" "uuid", "current_hp" integer, "max_hp" integer, "death_successes" integer, "death_failures" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_owner uuid;
  v_entity public.fight_entities%rowtype;
begin
  select f.campaign_id
    into v_owner
  from public.fight_entities fe
  join public.fights f on f.id = fe.fight_id
  where fe.id = p_entity_id;

  if v_owner is null then
    raise exception 'Fight entity not found';
  end if;

  if auth.uid() is distinct from v_owner then
    raise exception 'Not authorized to update this fight entity';
  end if;

  update public.fight_entities
  set current_hp = greatest(0, p_current_hp)
  where id = p_entity_id
  returning * into v_entity;

  if v_entity.entity_type = 'player' and v_entity.character_id is not null then
    update public.characters as c
    set
      hp_current = greatest(0, p_current_hp),
      death_successes = case
        when p_current_hp > 0 then 0
        else c.death_successes
      end,
      death_failures = case
        when p_current_hp > 0 then 0
        else c.death_failures
      end
    where c.id = v_entity.character_id;
  end if;

  return query
  select
    v_entity.id as entity_id,
    v_entity.entity_type::text as entity_type,
    v_entity.character_id as character_id,
    v_entity.current_hp as current_hp,
    v_entity.max_hp as max_hp,
    coalesce(c.death_successes, 0) as death_successes,
    coalesce(c.death_failures, 0) as death_failures
  from public.characters c
  where c.id = v_entity.character_id

  union all

  select
    v_entity.id as entity_id,
    v_entity.entity_type::text as entity_type,
    v_entity.character_id as character_id,
    v_entity.current_hp as current_hp,
    v_entity.max_hp as max_hp,
    0 as death_successes,
    0 as death_failures
  where v_entity.character_id is null;
end;
$$;


ALTER FUNCTION "public"."set_fight_entity_hp"("p_entity_id" "uuid", "p_current_hp" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."unlock_fight_creatures_for_campaign"("p_campaign_id" "uuid", "p_fight_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  inserted_count integer := 0;
begin
  with candidate_entries as (
    select distinct fe.entry_id
    from public.fight_entities fe
    where fe.fight_id = p_fight_id
      and fe.entity_type = 'monster'
      and fe.entry_id is not null
  )
  insert into public.campaign_entry_unlocks (campaign_id, entry_id, player_id, is_unlocked)
  select p_campaign_id, c.entry_id, null, true
  from candidate_entries c
  on conflict do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;


ALTER FUNCTION "public"."unlock_fight_creatures_for_campaign"("p_campaign_id" "uuid", "p_fight_id" "uuid") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."activity_status" (
    "user_id" "uuid" NOT NULL,
    "last_seen" timestamp with time zone DEFAULT "now"() NOT NULL,
    "current_page" "text" DEFAULT ''::"text" NOT NULL,
    "is_online" boolean DEFAULT false NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."activity_status" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."characters" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" DEFAULT ''::"text",
    "class_name" "text" DEFAULT ''::"text",
    "subclass" "text" DEFAULT ''::"text",
    "race" "text" DEFAULT ''::"text",
    "background" "text" DEFAULT ''::"text",
    "alignment" "text" DEFAULT ''::"text",
    "level" integer DEFAULT 1 NOT NULL,
    "xp" integer DEFAULT 0 NOT NULL,
    "proficiency_bonus" integer DEFAULT 2 NOT NULL,
    "armor_class" integer DEFAULT 10 NOT NULL,
    "initiative" integer DEFAULT 0 NOT NULL,
    "speed" integer DEFAULT 30 NOT NULL,
    "hp_max" integer DEFAULT 0 NOT NULL,
    "hp_current" integer DEFAULT 0 NOT NULL,
    "hp_temp" integer DEFAULT 0 NOT NULL,
    "hit_dice_total" integer DEFAULT 0 NOT NULL,
    "hit_dice_type" "text" DEFAULT ''::"text",
    "death_successes" integer DEFAULT 0 NOT NULL,
    "death_failures" integer DEFAULT 0 NOT NULL,
    "str_score" integer DEFAULT 10 NOT NULL,
    "dex_score" integer DEFAULT 10 NOT NULL,
    "con_score" integer DEFAULT 10 NOT NULL,
    "int_score" integer DEFAULT 10 NOT NULL,
    "wis_score" integer DEFAULT 10 NOT NULL,
    "cha_score" integer DEFAULT 10 NOT NULL,
    "save_str_prof" boolean DEFAULT false NOT NULL,
    "save_dex_prof" boolean DEFAULT false NOT NULL,
    "save_con_prof" boolean DEFAULT false NOT NULL,
    "save_int_prof" boolean DEFAULT false NOT NULL,
    "save_wis_prof" boolean DEFAULT false NOT NULL,
    "save_cha_prof" boolean DEFAULT false NOT NULL,
    "skill_acrobatics_prof" boolean DEFAULT false NOT NULL,
    "skill_animal_handling_prof" boolean DEFAULT false NOT NULL,
    "skill_arcana_prof" boolean DEFAULT false NOT NULL,
    "skill_athletics_prof" boolean DEFAULT false NOT NULL,
    "skill_deception_prof" boolean DEFAULT false NOT NULL,
    "skill_history_prof" boolean DEFAULT false NOT NULL,
    "skill_insight_prof" boolean DEFAULT false NOT NULL,
    "skill_intimidation_prof" boolean DEFAULT false NOT NULL,
    "skill_investigation_prof" boolean DEFAULT false NOT NULL,
    "skill_medicine_prof" boolean DEFAULT false NOT NULL,
    "skill_nature_prof" boolean DEFAULT false NOT NULL,
    "skill_perception_prof" boolean DEFAULT false NOT NULL,
    "skill_performance_prof" boolean DEFAULT false NOT NULL,
    "skill_persuasion_prof" boolean DEFAULT false NOT NULL,
    "skill_religion_prof" boolean DEFAULT false NOT NULL,
    "skill_sleight_of_hand_prof" boolean DEFAULT false NOT NULL,
    "skill_stealth_prof" boolean DEFAULT false NOT NULL,
    "skill_survival_prof" boolean DEFAULT false NOT NULL,
    "features" "text" DEFAULT ''::"text" NOT NULL,
    "languages" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "portrait_preview_url" "text",
    "portrait_original_url" "text",
    "source_class_template_id" "uuid",
    "source_race_template_id" "uuid",
    "source_background_template_id" "uuid",
    "class_source_origin" "text" DEFAULT 'custom'::"text" NOT NULL,
    "race_source_origin" "text" DEFAULT 'custom'::"text" NOT NULL,
    "background_source_origin" "text" DEFAULT 'custom'::"text" NOT NULL,
    "class_template_snapshot" "jsonb",
    "race_template_snapshot" "jsonb",
    "background_template_snapshot" "jsonb",
    CONSTRAINT "characters_background_source_origin_check" CHECK (("background_source_origin" = ANY (ARRAY['custom'::"text", 'template'::"text"]))),
    CONSTRAINT "characters_class_source_origin_check" CHECK (("class_source_origin" = ANY (ARRAY['custom'::"text", 'template'::"text"]))),
    CONSTRAINT "characters_death_failures_check" CHECK ((("death_failures" >= 0) AND ("death_failures" <= 3))),
    CONSTRAINT "characters_death_successes_check" CHECK ((("death_successes" >= 0) AND ("death_successes" <= 3))),
    CONSTRAINT "characters_level_check" CHECK (("level" >= 0)),
    CONSTRAINT "characters_race_source_origin_check" CHECK (("race_source_origin" = ANY (ARRAY['custom'::"text", 'template'::"text"]))),
    CONSTRAINT "characters_xp_check" CHECK (("xp" >= 0))
);


ALTER TABLE "public"."characters" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "username" "text",
    "role" "text" DEFAULT 'player'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "profiles_role_check" CHECK (("role" = ANY (ARRAY['player'::"text", 'dm'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."active_players" WITH ("security_invoker"='on') AS
 SELECT "p"."id" AS "user_id",
    "p"."username",
    "p"."role",
    "a"."last_seen",
    "a"."current_page",
    "a"."is_online",
    "c"."id" AS "character_id",
    "c"."name" AS "character_name",
    "c"."class_name",
    "c"."subclass",
    "c"."race",
    "c"."level",
    "c"."hp_current",
    "c"."hp_max",
    "c"."armor_class"
   FROM (("public"."profiles" "p"
     LEFT JOIN "public"."activity_status" "a" ON (("a"."user_id" = "p"."id")))
     LEFT JOIN "public"."characters" "c" ON (("c"."user_id" = "p"."id")))
  WHERE ("p"."role" = 'player'::"text");


ALTER VIEW "public"."active_players" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."attacks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "character_id" "uuid" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "name" "text" DEFAULT ''::"text" NOT NULL,
    "attack_bonus" "text" DEFAULT ''::"text" NOT NULL,
    "damage" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."attacks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."background_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "skill_proficiencies" "text" DEFAULT ''::"text" NOT NULL,
    "tool_proficiencies" "text" DEFAULT ''::"text" NOT NULL,
    "language_proficiencies" "text" DEFAULT ''::"text" NOT NULL,
    "equipment_summary" "text",
    "feature_summary" "text",
    "short_description" "text",
    "tags" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "source_name" "text",
    "source_page" "text",
    "is_official" boolean DEFAULT false NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."background_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."campaign_entry_unlocks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "campaign_id" "uuid" NOT NULL,
    "entry_id" "uuid" NOT NULL,
    "player_id" "uuid",
    "is_unlocked" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."campaign_entry_unlocks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."character_companions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "character_id" "uuid" NOT NULL,
    "entry_id" "uuid" NOT NULL,
    "kind" "text" NOT NULL,
    "name_override" "text",
    "notes" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "custom_data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "source_companion_template_id" "uuid",
    "source_origin" "text" DEFAULT 'custom'::"text" NOT NULL,
    "template_snapshot" "jsonb",
    CONSTRAINT "character_companions_kind_check" CHECK (("kind" = ANY (ARRAY['pet'::"text", 'mount'::"text", 'summon'::"text", 'familiar'::"text"]))),
    CONSTRAINT "character_companions_source_origin_check" CHECK (("source_origin" = ANY (ARRAY['custom'::"text", 'template'::"text"])))
);


ALTER TABLE "public"."character_companions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."character_notes" (
    "character_id" "uuid" NOT NULL,
    "notes" "text" DEFAULT ''::"text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."character_notes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."class_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "hit_die" "text" DEFAULT ''::"text" NOT NULL,
    "primary_ability" "text",
    "saving_throw_proficiencies" "text" DEFAULT ''::"text" NOT NULL,
    "armor_proficiencies" "text" DEFAULT ''::"text" NOT NULL,
    "weapon_proficiencies" "text" DEFAULT ''::"text" NOT NULL,
    "tool_proficiencies" "text" DEFAULT ''::"text" NOT NULL,
    "short_description" "text",
    "feature_summary" "text",
    "tags" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "source_name" "text",
    "source_page" "text",
    "is_official" boolean DEFAULT false NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."class_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."companion_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "kind" "text" NOT NULL,
    "armor_class" integer,
    "hit_points" integer,
    "speed_text" "text",
    "notes" "text",
    "custom_data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "tags" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "source_name" "text",
    "source_page" "text",
    "is_official" boolean DEFAULT false NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "companion_templates_kind_check" CHECK (("kind" = ANY (ARRAY['pet'::"text", 'mount'::"text", 'summon'::"text", 'familiar'::"text"])))
);


ALTER TABLE "public"."companion_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."creature_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "size" "text",
    "creature_type" "text",
    "subtype" "text",
    "alignment" "text",
    "armor_class" integer,
    "hit_points" integer,
    "speed_text" "text",
    "str_score" integer,
    "dex_score" integer,
    "con_score" integer,
    "int_score" integer,
    "wis_score" integer,
    "cha_score" integer,
    "skills" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "senses" "text",
    "languages" "text",
    "challenge_rating" numeric(8,3),
    "traits" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "actions" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "notes" "text",
    "tags" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "source_name" "text",
    "source_page" "text",
    "is_official" boolean DEFAULT false NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."creature_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."dm_notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_by" "uuid" NOT NULL,
    "title" "text" DEFAULT ''::"text" NOT NULL,
    "content" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."dm_notes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."feat_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "prerequisite" "text",
    "short_description" "text",
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "tags" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "source_name" "text",
    "source_page" "text",
    "is_official" boolean DEFAULT false NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."feat_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."fight_entities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "fight_id" "uuid" NOT NULL,
    "entity_type" "text" NOT NULL,
    "character_id" "uuid",
    "entry_id" "uuid",
    "name" "text" NOT NULL,
    "initiative" integer,
    "current_hp" integer,
    "max_hp" integer,
    "turn_order" integer,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "initiative_mod" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "fight_entities_check" CHECK (((("entity_type" = 'player'::"text") AND ("character_id" IS NOT NULL)) OR ("entity_type" <> 'player'::"text"))),
    CONSTRAINT "fight_entities_entity_type_check" CHECK (("entity_type" = ANY (ARRAY['player'::"text", 'monster'::"text", 'npc'::"text", 'summon'::"text"])))
);


ALTER TABLE "public"."fight_entities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."fight_initiative_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "fight_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "initiative_roll" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "submitted_at" timestamp with time zone,
    CONSTRAINT "fight_initiative_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'submitted'::"text"])))
);


ALTER TABLE "public"."fight_initiative_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."fights" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "campaign_id" "uuid" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "round_number" integer DEFAULT 1 NOT NULL,
    CONSTRAINT "fights_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'collecting_initiative'::"text", 'active'::"text", 'ended'::"text"])))
);


ALTER TABLE "public"."fights" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inventory_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "character_id" "uuid" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "title" "text" DEFAULT ''::"text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "quantity" integer DEFAULT 1 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "client_id" "text" NOT NULL,
    "category" "text" DEFAULT 'Other'::"text" NOT NULL,
    "source_item_template_id" "uuid",
    "source_origin" "text" DEFAULT 'custom'::"text" NOT NULL,
    "template_snapshot" "jsonb",
    CONSTRAINT "inventory_items_quantity_check" CHECK (("quantity" >= 0)),
    CONSTRAINT "inventory_items_source_origin_check" CHECK (("source_origin" = ANY (ARRAY['custom'::"text", 'template'::"text"])))
);


ALTER TABLE "public"."inventory_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."maps" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "uploaded_by" "uuid" NOT NULL,
    "name" "text" DEFAULT ''::"text" NOT NULL,
    "storage_path" "text" DEFAULT ''::"text" NOT NULL,
    "is_active" boolean DEFAULT false NOT NULL,
    "grid_enabled" boolean DEFAULT false NOT NULL,
    "grid_size" integer DEFAULT 50 NOT NULL,
    "grid_opacity" numeric(4,2) DEFAULT 0.50 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "maps_grid_opacity_check" CHECK ((("grid_opacity" >= (0)::numeric) AND ("grid_opacity" <= (1)::numeric))),
    CONSTRAINT "maps_grid_size_check" CHECK (("grid_size" > 0))
);


ALTER TABLE "public"."maps" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."race_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "size" "text",
    "speed" integer,
    "ability_bonuses" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "traits" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "languages" "text" DEFAULT ''::"text" NOT NULL,
    "senses" "text",
    "short_description" "text",
    "tags" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "source_name" "text",
    "source_page" "text",
    "is_official" boolean DEFAULT false NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."race_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."spell_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "level" integer DEFAULT 0 NOT NULL,
    "school" "text" DEFAULT ''::"text" NOT NULL,
    "casting_time" "text" DEFAULT ''::"text" NOT NULL,
    "range_text" "text" DEFAULT ''::"text" NOT NULL,
    "components" "text" DEFAULT ''::"text" NOT NULL,
    "duration_text" "text" DEFAULT ''::"text" NOT NULL,
    "concentration" boolean DEFAULT false NOT NULL,
    "ritual" boolean DEFAULT false NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "higher_level_text" "text",
    "save_type" "text",
    "attack_type" "text",
    "tags" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "source_name" "text",
    "source_page" "text",
    "is_official" boolean DEFAULT false NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "spell_templates_level_check" CHECK ((("level" >= 0) AND ("level" <= 9)))
);


ALTER TABLE "public"."spell_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."spells" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "character_id" "uuid" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "title" "text" DEFAULT ''::"text" NOT NULL,
    "spell_level" "text" DEFAULT ''::"text" NOT NULL,
    "casting_time" "text" DEFAULT ''::"text" NOT NULL,
    "range_text" "text" DEFAULT ''::"text" NOT NULL,
    "components" "text" DEFAULT ''::"text" NOT NULL,
    "duration_text" "text" DEFAULT ''::"text" NOT NULL,
    "dice" "text" DEFAULT ''::"text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "is_cantrip" boolean DEFAULT false NOT NULL,
    "is_ritual" boolean DEFAULT false NOT NULL,
    "is_concentration" boolean DEFAULT false NOT NULL,
    "is_reaction" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "client_id" "text" NOT NULL,
    "source_spell_template_id" "uuid",
    "source_origin" "text" DEFAULT 'custom'::"text" NOT NULL,
    "template_snapshot" "jsonb",
    CONSTRAINT "spells_source_origin_check" CHECK (("source_origin" = ANY (ARRAY['custom'::"text", 'template'::"text"])))
);


ALTER TABLE "public"."spells" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."trait_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "slug" "text" NOT NULL,
    "name" "text" NOT NULL,
    "trait_type" "text" DEFAULT 'general'::"text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "tags" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "source_name" "text",
    "source_page" "text",
    "is_official" boolean DEFAULT false NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."trait_templates" OWNER TO "postgres";


ALTER TABLE ONLY "public"."activity_status"
    ADD CONSTRAINT "activity_status_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."attacks"
    ADD CONSTRAINT "attacks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."background_templates"
    ADD CONSTRAINT "background_templates_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."background_templates"
    ADD CONSTRAINT "background_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."background_templates"
    ADD CONSTRAINT "background_templates_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."campaign_entry_unlocks"
    ADD CONSTRAINT "campaign_entry_unlocks_campaign_id_entry_id_player_id_key" UNIQUE ("campaign_id", "entry_id", "player_id");



ALTER TABLE ONLY "public"."campaign_entry_unlocks"
    ADD CONSTRAINT "campaign_entry_unlocks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."character_companions"
    ADD CONSTRAINT "character_companions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."character_notes"
    ADD CONSTRAINT "character_notes_pkey" PRIMARY KEY ("character_id");



ALTER TABLE ONLY "public"."characters"
    ADD CONSTRAINT "characters_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."characters"
    ADD CONSTRAINT "characters_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."class_templates"
    ADD CONSTRAINT "class_templates_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."class_templates"
    ADD CONSTRAINT "class_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."class_templates"
    ADD CONSTRAINT "class_templates_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."companion_templates"
    ADD CONSTRAINT "companion_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."companion_templates"
    ADD CONSTRAINT "companion_templates_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."compendium_entries"
    ADD CONSTRAINT "compendium_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."compendium_entries"
    ADD CONSTRAINT "compendium_entries_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."creature_templates"
    ADD CONSTRAINT "creature_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."creature_templates"
    ADD CONSTRAINT "creature_templates_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."dm_notes"
    ADD CONSTRAINT "dm_notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."feat_templates"
    ADD CONSTRAINT "feat_templates_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."feat_templates"
    ADD CONSTRAINT "feat_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."feat_templates"
    ADD CONSTRAINT "feat_templates_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."fight_entities"
    ADD CONSTRAINT "fight_entities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fight_initiative_requests"
    ADD CONSTRAINT "fight_initiative_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fights"
    ADD CONSTRAINT "fights_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_items"
    ADD CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."item_templates"
    ADD CONSTRAINT "item_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."item_templates"
    ADD CONSTRAINT "item_templates_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."maps"
    ADD CONSTRAINT "maps_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_username_key" UNIQUE ("username");



ALTER TABLE ONLY "public"."race_templates"
    ADD CONSTRAINT "race_templates_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."race_templates"
    ADD CONSTRAINT "race_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."race_templates"
    ADD CONSTRAINT "race_templates_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."spell_templates"
    ADD CONSTRAINT "spell_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."spell_templates"
    ADD CONSTRAINT "spell_templates_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."spells"
    ADD CONSTRAINT "spells_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trait_templates"
    ADD CONSTRAINT "trait_templates_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."trait_templates"
    ADD CONSTRAINT "trait_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trait_templates"
    ADD CONSTRAINT "trait_templates_slug_key" UNIQUE ("slug");



CREATE INDEX "attacks_character_id_idx" ON "public"."attacks" USING "btree" ("character_id");



CREATE INDEX "characters_user_id_idx" ON "public"."characters" USING "btree" ("user_id");



CREATE INDEX "idx_activity_status_last_seen" ON "public"."activity_status" USING "btree" ("last_seen" DESC);



CREATE INDEX "idx_activity_status_user_id" ON "public"."activity_status" USING "btree" ("user_id");



CREATE INDEX "idx_background_templates_name" ON "public"."background_templates" USING "btree" ("name");



CREATE INDEX "idx_campaign_entry_unlocks_campaign_id" ON "public"."campaign_entry_unlocks" USING "btree" ("campaign_id");



CREATE INDEX "idx_campaign_entry_unlocks_entry_id" ON "public"."campaign_entry_unlocks" USING "btree" ("entry_id");



CREATE UNIQUE INDEX "idx_campaign_unlocks_shared_unique" ON "public"."campaign_entry_unlocks" USING "btree" ("campaign_id", "entry_id") WHERE ("player_id" IS NULL);



CREATE INDEX "idx_character_companions_character_id" ON "public"."character_companions" USING "btree" ("character_id");



CREATE INDEX "idx_character_companions_entry_id" ON "public"."character_companions" USING "btree" ("entry_id");



CREATE INDEX "idx_character_companions_source_companion_template" ON "public"."character_companions" USING "btree" ("source_companion_template_id");



CREATE INDEX "idx_character_notes_character_id" ON "public"."character_notes" USING "btree" ("character_id");



CREATE INDEX "idx_characters_source_background_template" ON "public"."characters" USING "btree" ("source_background_template_id");



CREATE INDEX "idx_characters_source_class_template" ON "public"."characters" USING "btree" ("source_class_template_id");



CREATE INDEX "idx_characters_source_race_template" ON "public"."characters" USING "btree" ("source_race_template_id");



CREATE INDEX "idx_characters_user_id" ON "public"."characters" USING "btree" ("user_id");



CREATE INDEX "idx_class_templates_name" ON "public"."class_templates" USING "btree" ("name");



CREATE INDEX "idx_companion_templates_kind" ON "public"."companion_templates" USING "btree" ("kind");



CREATE INDEX "idx_companion_templates_name" ON "public"."companion_templates" USING "btree" ("name");



CREATE INDEX "idx_companion_templates_tags_gin" ON "public"."companion_templates" USING "gin" ("tags");



CREATE INDEX "idx_compendium_entries_slug" ON "public"."compendium_entries" USING "btree" ("slug");



CREATE INDEX "idx_creature_templates_cr" ON "public"."creature_templates" USING "btree" ("challenge_rating");



CREATE INDEX "idx_creature_templates_name" ON "public"."creature_templates" USING "btree" ("name");



CREATE INDEX "idx_creature_templates_tags_gin" ON "public"."creature_templates" USING "gin" ("tags");



CREATE INDEX "idx_creature_templates_type" ON "public"."creature_templates" USING "btree" ("creature_type");



CREATE INDEX "idx_feat_templates_name" ON "public"."feat_templates" USING "btree" ("name");



CREATE INDEX "idx_feat_templates_tags_gin" ON "public"."feat_templates" USING "gin" ("tags");



CREATE INDEX "idx_fight_entities_character_id" ON "public"."fight_entities" USING "btree" ("character_id");



CREATE INDEX "idx_fight_entities_entry_id" ON "public"."fight_entities" USING "btree" ("entry_id");



CREATE INDEX "idx_fight_entities_fight_entity_type" ON "public"."fight_entities" USING "btree" ("fight_id", "entity_type");



CREATE INDEX "idx_fight_entities_fight_id" ON "public"."fight_entities" USING "btree" ("fight_id");



CREATE INDEX "idx_fight_initiative_requests_fight_id" ON "public"."fight_initiative_requests" USING "btree" ("fight_id");



CREATE INDEX "idx_fight_initiative_requests_fight_status" ON "public"."fight_initiative_requests" USING "btree" ("fight_id", "status");



CREATE INDEX "idx_fight_initiative_requests_status" ON "public"."fight_initiative_requests" USING "btree" ("status");



CREATE UNIQUE INDEX "idx_fight_initiative_requests_unique" ON "public"."fight_initiative_requests" USING "btree" ("fight_id", "user_id");



CREATE INDEX "idx_fight_initiative_requests_user_id" ON "public"."fight_initiative_requests" USING "btree" ("user_id");



CREATE INDEX "idx_fight_initiative_requests_user_status" ON "public"."fight_initiative_requests" USING "btree" ("user_id", "status");



CREATE INDEX "idx_fights_campaign_active_status_created" ON "public"."fights" USING "btree" ("campaign_id", "is_active", "status", "created_at" DESC);



CREATE INDEX "idx_fights_campaign_id" ON "public"."fights" USING "btree" ("campaign_id");



CREATE INDEX "idx_fights_status" ON "public"."fights" USING "btree" ("status");



CREATE INDEX "idx_inventory_items_source_item_template" ON "public"."inventory_items" USING "btree" ("source_item_template_id");



CREATE INDEX "idx_item_templates_armor_kind" ON "public"."item_templates" USING "btree" ("armor_kind");



CREATE INDEX "idx_item_templates_category" ON "public"."item_templates" USING "btree" ("category");



CREATE INDEX "idx_item_templates_damage_type" ON "public"."item_templates" USING "btree" ("damage_type");



CREATE INDEX "idx_item_templates_item_kind" ON "public"."item_templates" USING "btree" ("item_kind");



CREATE INDEX "idx_item_templates_name" ON "public"."item_templates" USING "btree" ("name");



CREATE INDEX "idx_item_templates_source_code" ON "public"."item_templates" USING "btree" ("source_code");



CREATE INDEX "idx_item_templates_tags_gin" ON "public"."item_templates" USING "gin" ("tags");



CREATE INDEX "idx_item_templates_weapon_kind" ON "public"."item_templates" USING "btree" ("weapon_kind");



CREATE INDEX "idx_profiles_role_created_at" ON "public"."profiles" USING "btree" ("role", "created_at");



CREATE INDEX "idx_race_templates_name" ON "public"."race_templates" USING "btree" ("name");



CREATE INDEX "idx_spell_templates_level" ON "public"."spell_templates" USING "btree" ("level");



CREATE INDEX "idx_spell_templates_name" ON "public"."spell_templates" USING "btree" ("name");



CREATE INDEX "idx_spell_templates_tags_gin" ON "public"."spell_templates" USING "gin" ("tags");



CREATE INDEX "idx_spells_source_spell_template" ON "public"."spells" USING "btree" ("source_spell_template_id");



CREATE INDEX "idx_trait_templates_name" ON "public"."trait_templates" USING "btree" ("name");



CREATE INDEX "idx_trait_templates_tags_gin" ON "public"."trait_templates" USING "gin" ("tags");



CREATE INDEX "idx_trait_templates_type" ON "public"."trait_templates" USING "btree" ("trait_type");



CREATE UNIQUE INDEX "inventory_items_character_client_uidx" ON "public"."inventory_items" USING "btree" ("character_id", "client_id");



CREATE INDEX "inventory_items_character_id_idx" ON "public"."inventory_items" USING "btree" ("character_id");



CREATE UNIQUE INDEX "maps_single_active_idx" ON "public"."maps" USING "btree" ("is_active") WHERE ("is_active" = true);



CREATE UNIQUE INDEX "spells_character_client_uidx" ON "public"."spells" USING "btree" ("character_id", "client_id");



CREATE INDEX "spells_character_id_idx" ON "public"."spells" USING "btree" ("character_id");



CREATE OR REPLACE TRIGGER "set_activity_status_updated_at" BEFORE UPDATE ON "public"."activity_status" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_attacks_updated_at" BEFORE UPDATE ON "public"."attacks" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_character_notes_updated_at" BEFORE UPDATE ON "public"."character_notes" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_characters_updated_at" BEFORE UPDATE ON "public"."characters" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_dm_notes_updated_at" BEFORE UPDATE ON "public"."dm_notes" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_inventory_items_updated_at" BEFORE UPDATE ON "public"."inventory_items" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_maps_updated_at" BEFORE UPDATE ON "public"."maps" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_spells_updated_at" BEFORE UPDATE ON "public"."spells" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



ALTER TABLE ONLY "public"."activity_status"
    ADD CONSTRAINT "activity_status_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."attacks"
    ADD CONSTRAINT "attacks_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."campaign_entry_unlocks"
    ADD CONSTRAINT "campaign_entry_unlocks_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "public"."compendium_entries"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."character_companions"
    ADD CONSTRAINT "character_companions_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."character_companions"
    ADD CONSTRAINT "character_companions_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "public"."compendium_entries"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."character_companions"
    ADD CONSTRAINT "character_companions_source_companion_template_id_fkey" FOREIGN KEY ("source_companion_template_id") REFERENCES "public"."companion_templates"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."character_notes"
    ADD CONSTRAINT "character_notes_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."characters"
    ADD CONSTRAINT "characters_source_background_template_id_fkey" FOREIGN KEY ("source_background_template_id") REFERENCES "public"."background_templates"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."characters"
    ADD CONSTRAINT "characters_source_class_template_id_fkey" FOREIGN KEY ("source_class_template_id") REFERENCES "public"."class_templates"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."characters"
    ADD CONSTRAINT "characters_source_race_template_id_fkey" FOREIGN KEY ("source_race_template_id") REFERENCES "public"."race_templates"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."characters"
    ADD CONSTRAINT "characters_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."dm_notes"
    ADD CONSTRAINT "dm_notes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fight_entities"
    ADD CONSTRAINT "fight_entities_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."fight_entities"
    ADD CONSTRAINT "fight_entities_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "public"."compendium_entries"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."fight_entities"
    ADD CONSTRAINT "fight_entities_fight_id_fkey" FOREIGN KEY ("fight_id") REFERENCES "public"."fights"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fight_initiative_requests"
    ADD CONSTRAINT "fight_initiative_requests_fight_id_fkey" FOREIGN KEY ("fight_id") REFERENCES "public"."fights"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_items"
    ADD CONSTRAINT "inventory_items_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."inventory_items"
    ADD CONSTRAINT "inventory_items_source_item_template_id_fkey" FOREIGN KEY ("source_item_template_id") REFERENCES "public"."item_templates"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."maps"
    ADD CONSTRAINT "maps_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."spells"
    ADD CONSTRAINT "spells_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."spells"
    ADD CONSTRAINT "spells_source_spell_template_id_fkey" FOREIGN KEY ("source_spell_template_id") REFERENCES "public"."spell_templates"("id") ON DELETE SET NULL;



CREATE POLICY "Allow all read item templates" ON "public"."item_templates" FOR SELECT USING (true);



CREATE POLICY "Allow authenticated read item templates" ON "public"."item_templates" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow read background templates" ON "public"."background_templates" FOR SELECT USING (true);



CREATE POLICY "Allow read class templates" ON "public"."class_templates" FOR SELECT USING (true);



CREATE POLICY "Allow read companion templates" ON "public"."companion_templates" FOR SELECT USING (true);



CREATE POLICY "Allow read creature templates" ON "public"."creature_templates" FOR SELECT USING (true);



CREATE POLICY "Allow read feat templates" ON "public"."feat_templates" FOR SELECT USING (true);



CREATE POLICY "Allow read item templates" ON "public"."item_templates" FOR SELECT USING (true);



CREATE POLICY "Allow read race templates" ON "public"."race_templates" FOR SELECT USING (true);



CREATE POLICY "Allow read spell templates" ON "public"."spell_templates" FOR SELECT USING (true);



CREATE POLICY "Allow read trait templates" ON "public"."trait_templates" FOR SELECT USING (true);



CREATE POLICY "activity_delete_self" ON "public"."activity_status" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "activity_insert_self" ON "public"."activity_status" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "activity_select_self_or_dm" ON "public"."activity_status" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR "public"."is_dm"()));



ALTER TABLE "public"."activity_status" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "activity_update_self" ON "public"."activity_status" FOR UPDATE USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."attacks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "attacks_delete_owner" ON "public"."attacks" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."characters" "c"
  WHERE (("c"."id" = "attacks"."character_id") AND ("c"."user_id" = "auth"."uid"())))));



CREATE POLICY "attacks_insert_owner" ON "public"."attacks" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."characters" "c"
  WHERE (("c"."id" = "attacks"."character_id") AND ("c"."user_id" = "auth"."uid"())))));



CREATE POLICY "attacks_select_owner_or_dm" ON "public"."attacks" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."characters" "c"
  WHERE (("c"."id" = "attacks"."character_id") AND (("c"."user_id" = "auth"."uid"()) OR "public"."is_dm"())))));



CREATE POLICY "attacks_update_owner" ON "public"."attacks" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."characters" "c"
  WHERE (("c"."id" = "attacks"."character_id") AND ("c"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."characters" "c"
  WHERE (("c"."id" = "attacks"."character_id") AND ("c"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."background_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."campaign_entry_unlocks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "campaign_unlocks_dm_delete" ON "public"."campaign_entry_unlocks" FOR DELETE TO "authenticated" USING (("campaign_id" = "auth"."uid"()));



CREATE POLICY "campaign_unlocks_dm_insert" ON "public"."campaign_entry_unlocks" FOR INSERT TO "authenticated" WITH CHECK (("campaign_id" = "auth"."uid"()));



CREATE POLICY "campaign_unlocks_dm_select" ON "public"."campaign_entry_unlocks" FOR SELECT TO "authenticated" USING (("campaign_id" = "auth"."uid"()));



CREATE POLICY "campaign_unlocks_dm_update" ON "public"."campaign_entry_unlocks" FOR UPDATE TO "authenticated" USING (("campaign_id" = "auth"."uid"())) WITH CHECK (("campaign_id" = "auth"."uid"()));



CREATE POLICY "campaign_unlocks_player_select_shared" ON "public"."campaign_entry_unlocks" FOR SELECT TO "authenticated" USING (("player_id" IS NULL));



ALTER TABLE "public"."character_companions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "character_companions_delete_own" ON "public"."character_companions" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."characters" "c"
  WHERE (("c"."id" = "character_companions"."character_id") AND ("c"."user_id" = "auth"."uid"())))));



CREATE POLICY "character_companions_insert_own" ON "public"."character_companions" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."characters" "c"
  WHERE (("c"."id" = "character_companions"."character_id") AND ("c"."user_id" = "auth"."uid"())))));



CREATE POLICY "character_companions_select_own" ON "public"."character_companions" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."characters" "c"
  WHERE (("c"."id" = "character_companions"."character_id") AND ("c"."user_id" = "auth"."uid"())))));



CREATE POLICY "character_companions_update_own" ON "public"."character_companions" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."characters" "c"
  WHERE (("c"."id" = "character_companions"."character_id") AND ("c"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."characters" "c"
  WHERE (("c"."id" = "character_companions"."character_id") AND ("c"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."character_notes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."characters" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "characters_delete_owner" ON "public"."characters" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "characters_insert_owner" ON "public"."characters" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "characters_select_owner_or_dm" ON "public"."characters" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR "public"."is_dm"()));



CREATE POLICY "characters_update_owner" ON "public"."characters" FOR UPDATE USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."class_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."companion_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."compendium_entries" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "compendium_entries_select_authenticated" ON "public"."compendium_entries" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."creature_templates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "dm_delete_initiative_requests" ON "public"."fight_initiative_requests" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."fights" "f"
  WHERE (("f"."id" = "fight_initiative_requests"."fight_id") AND ("f"."campaign_id" = "auth"."uid"())))));



CREATE POLICY "dm_insert_initiative_requests" ON "public"."fight_initiative_requests" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."fights" "f"
  WHERE (("f"."id" = "fight_initiative_requests"."fight_id") AND ("f"."campaign_id" = "auth"."uid"())))));



ALTER TABLE "public"."dm_notes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "dm_notes_delete_dm_only" ON "public"."dm_notes" FOR DELETE USING ("public"."is_dm"());



CREATE POLICY "dm_notes_insert_dm_only" ON "public"."dm_notes" FOR INSERT WITH CHECK ("public"."is_dm"());



CREATE POLICY "dm_notes_select_dm_only" ON "public"."dm_notes" FOR SELECT USING ("public"."is_dm"());



CREATE POLICY "dm_notes_update_dm_only" ON "public"."dm_notes" FOR UPDATE USING ("public"."is_dm"()) WITH CHECK ("public"."is_dm"());



CREATE POLICY "dm_select_initiative_requests" ON "public"."fight_initiative_requests" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."fights" "f"
  WHERE (("f"."id" = "fight_initiative_requests"."fight_id") AND ("f"."campaign_id" = "auth"."uid"())))));



CREATE POLICY "dm_update_initiative_requests" ON "public"."fight_initiative_requests" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."fights" "f"
  WHERE (("f"."id" = "fight_initiative_requests"."fight_id") AND ("f"."campaign_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."fights" "f"
  WHERE (("f"."id" = "fight_initiative_requests"."fight_id") AND ("f"."campaign_id" = "auth"."uid"())))));



ALTER TABLE "public"."feat_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."fight_entities" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "fight_entity_owner_delete" ON "public"."fight_entities" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."fights" "f"
  WHERE (("f"."id" = "fight_entities"."fight_id") AND ("f"."campaign_id" = "auth"."uid"())))));



CREATE POLICY "fight_entity_owner_insert" ON "public"."fight_entities" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."fights" "f"
  WHERE (("f"."id" = "fight_entities"."fight_id") AND ("f"."campaign_id" = "auth"."uid"())))));



CREATE POLICY "fight_entity_owner_select" ON "public"."fight_entities" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."fights" "f"
  WHERE (("f"."id" = "fight_entities"."fight_id") AND ("f"."campaign_id" = "auth"."uid"())))));



CREATE POLICY "fight_entity_owner_update" ON "public"."fight_entities" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."fights" "f"
  WHERE (("f"."id" = "fight_entities"."fight_id") AND ("f"."campaign_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."fights" "f"
  WHERE (("f"."id" = "fight_entities"."fight_id") AND ("f"."campaign_id" = "auth"."uid"())))));



ALTER TABLE "public"."fight_initiative_requests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "fight_owner_delete" ON "public"."fights" FOR DELETE TO "authenticated" USING (("campaign_id" = "auth"."uid"()));



CREATE POLICY "fight_owner_insert" ON "public"."fights" FOR INSERT TO "authenticated" WITH CHECK (("campaign_id" = "auth"."uid"()));



CREATE POLICY "fight_owner_select" ON "public"."fights" FOR SELECT TO "authenticated" USING (("campaign_id" = "auth"."uid"()));



CREATE POLICY "fight_owner_update" ON "public"."fights" FOR UPDATE TO "authenticated" USING (("campaign_id" = "auth"."uid"())) WITH CHECK (("campaign_id" = "auth"."uid"()));



ALTER TABLE "public"."fights" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "inventory_delete_owner" ON "public"."inventory_items" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."characters" "c"
  WHERE (("c"."id" = "inventory_items"."character_id") AND ("c"."user_id" = "auth"."uid"())))));



CREATE POLICY "inventory_insert_owner" ON "public"."inventory_items" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."characters" "c"
  WHERE (("c"."id" = "inventory_items"."character_id") AND ("c"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."inventory_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "inventory_select_owner_or_dm" ON "public"."inventory_items" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."characters" "c"
  WHERE (("c"."id" = "inventory_items"."character_id") AND (("c"."user_id" = "auth"."uid"()) OR "public"."is_dm"())))));



CREATE POLICY "inventory_update_owner" ON "public"."inventory_items" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."characters" "c"
  WHERE (("c"."id" = "inventory_items"."character_id") AND ("c"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."characters" "c"
  WHERE (("c"."id" = "inventory_items"."character_id") AND ("c"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."item_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."maps" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "maps_delete_dm_only" ON "public"."maps" FOR DELETE USING ("public"."is_dm"());



CREATE POLICY "maps_insert_dm_only" ON "public"."maps" FOR INSERT WITH CHECK ("public"."is_dm"());



CREATE POLICY "maps_read_all_logged_in" ON "public"."maps" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "maps_update_dm_only" ON "public"."maps" FOR UPDATE USING ("public"."is_dm"()) WITH CHECK ("public"."is_dm"());



CREATE POLICY "notes_delete_owner" ON "public"."character_notes" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."characters" "c"
  WHERE (("c"."id" = "character_notes"."character_id") AND ("c"."user_id" = "auth"."uid"())))));



CREATE POLICY "notes_insert_owner" ON "public"."character_notes" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."characters" "c"
  WHERE (("c"."id" = "character_notes"."character_id") AND ("c"."user_id" = "auth"."uid"())))));



CREATE POLICY "notes_select_owner_or_dm" ON "public"."character_notes" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."characters" "c"
  WHERE (("c"."id" = "character_notes"."character_id") AND (("c"."user_id" = "auth"."uid"()) OR "public"."is_dm"())))));



CREATE POLICY "notes_update_owner" ON "public"."character_notes" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."characters" "c"
  WHERE (("c"."id" = "character_notes"."character_id") AND ("c"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."characters" "c"
  WHERE (("c"."id" = "character_notes"."character_id") AND ("c"."user_id" = "auth"."uid"())))));



CREATE POLICY "player_insert_own_fight_entity" ON "public"."fight_entities" FOR INSERT TO "authenticated" WITH CHECK ((("entity_type" = 'player'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."characters" "c"
  WHERE (("c"."id" = "fight_entities"."character_id") AND ("c"."user_id" = "auth"."uid"())))) AND (EXISTS ( SELECT 1
   FROM "public"."fight_initiative_requests" "r"
  WHERE (("r"."fight_id" = "fight_entities"."fight_id") AND ("r"."user_id" = "auth"."uid"()) AND ("r"."status" = ANY (ARRAY['pending'::"text", 'submitted'::"text"])))))));



CREATE POLICY "player_select_own_fight_entity" ON "public"."fight_entities" FOR SELECT TO "authenticated" USING ((("entity_type" = 'player'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."characters" "c"
  WHERE (("c"."id" = "fight_entities"."character_id") AND ("c"."user_id" = "auth"."uid"()))))));



CREATE POLICY "player_select_own_initiative_request" ON "public"."fight_initiative_requests" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "player_update_own_fight_entity" ON "public"."fight_entities" FOR UPDATE TO "authenticated" USING ((("entity_type" = 'player'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."characters" "c"
  WHERE (("c"."id" = "fight_entities"."character_id") AND ("c"."user_id" = "auth"."uid"())))))) WITH CHECK ((("entity_type" = 'player'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."characters" "c"
  WHERE (("c"."id" = "fight_entities"."character_id") AND ("c"."user_id" = "auth"."uid"()))))));



CREATE POLICY "player_update_own_initiative_request" ON "public"."fight_initiative_requests" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_select_self_or_dm" ON "public"."profiles" FOR SELECT USING ((("id" = "auth"."uid"()) OR "public"."is_dm"()));



CREATE POLICY "profiles_update_self" ON "public"."profiles" FOR UPDATE USING (("id" = "auth"."uid"())) WITH CHECK (("id" = "auth"."uid"()));



ALTER TABLE "public"."race_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."spell_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."spells" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "spells_delete_owner" ON "public"."spells" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."characters" "c"
  WHERE (("c"."id" = "spells"."character_id") AND ("c"."user_id" = "auth"."uid"())))));



CREATE POLICY "spells_insert_owner" ON "public"."spells" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."characters" "c"
  WHERE (("c"."id" = "spells"."character_id") AND ("c"."user_id" = "auth"."uid"())))));



CREATE POLICY "spells_select_owner_or_dm" ON "public"."spells" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."characters" "c"
  WHERE (("c"."id" = "spells"."character_id") AND (("c"."user_id" = "auth"."uid"()) OR "public"."is_dm"())))));



CREATE POLICY "spells_update_owner" ON "public"."spells" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."characters" "c"
  WHERE (("c"."id" = "spells"."character_id") AND ("c"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."characters" "c"
  WHERE (("c"."id" = "spells"."character_id") AND ("c"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."trait_templates" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."activity_status";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."characters";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."fight_entities";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."fight_initiative_requests";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."fights";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































REVOKE ALL ON FUNCTION "public"."assign_companion_from_template"("p_character_id" "uuid", "p_template_id" "uuid", "p_name_override" "text", "p_notes" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."assign_companion_from_template"("p_character_id" "uuid", "p_template_id" "uuid", "p_name_override" "text", "p_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."assign_companion_from_template"("p_character_id" "uuid", "p_template_id" "uuid", "p_name_override" "text", "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."assign_companion_from_template"("p_character_id" "uuid", "p_template_id" "uuid", "p_name_override" "text", "p_notes" "text") TO "service_role";



GRANT ALL ON TABLE "public"."compendium_entries" TO "anon";
GRANT ALL ON TABLE "public"."compendium_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."compendium_entries" TO "service_role";



GRANT ALL ON FUNCTION "public"."create_companion_entry_for_user"("p_kind" "text", "p_slug" "text", "p_name" "text", "p_description" "text", "p_data" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."create_companion_entry_for_user"("p_kind" "text", "p_slug" "text", "p_name" "text", "p_description" "text", "p_data" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_companion_entry_for_user"("p_kind" "text", "p_slug" "text", "p_name" "text", "p_description" "text", "p_data" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_creature_entry_for_dm"("p_subtype" "text", "p_slug" "text", "p_name" "text", "p_description" "text", "p_data" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."create_creature_entry_for_dm"("p_subtype" "text", "p_slug" "text", "p_name" "text", "p_description" "text", "p_data" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_creature_entry_for_dm"("p_subtype" "text", "p_slug" "text", "p_name" "text", "p_description" "text", "p_data" "jsonb") TO "service_role";



GRANT ALL ON TABLE "public"."item_templates" TO "anon";
GRANT ALL ON TABLE "public"."item_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."item_templates" TO "service_role";



GRANT ALL ON FUNCTION "public"."create_item_template_for_dm"("p_slug" "text", "p_name" "text", "p_description" "text", "p_category" "text", "p_item_kind" "text", "p_item_subtype" "text", "p_rarity" "text", "p_weight" numeric, "p_value_text" "text", "p_damage_text" "text", "p_damage_type" "text", "p_range_text" "text", "p_armor_kind" "text", "p_ac_base" integer, "p_charges_max" integer, "p_charges_current" integer, "p_usage_type" "text", "p_properties" "jsonb", "p_tags" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."create_item_template_for_dm"("p_slug" "text", "p_name" "text", "p_description" "text", "p_category" "text", "p_item_kind" "text", "p_item_subtype" "text", "p_rarity" "text", "p_weight" numeric, "p_value_text" "text", "p_damage_text" "text", "p_damage_type" "text", "p_range_text" "text", "p_armor_kind" "text", "p_ac_base" integer, "p_charges_max" integer, "p_charges_current" integer, "p_usage_type" "text", "p_properties" "jsonb", "p_tags" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_item_template_for_dm"("p_slug" "text", "p_name" "text", "p_description" "text", "p_category" "text", "p_item_kind" "text", "p_item_subtype" "text", "p_rarity" "text", "p_weight" numeric, "p_value_text" "text", "p_damage_text" "text", "p_damage_type" "text", "p_range_text" "text", "p_armor_kind" "text", "p_ac_base" integer, "p_charges_max" integer, "p_charges_current" integer, "p_usage_type" "text", "p_properties" "jsonb", "p_tags" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_fight_character_combat_state"("p_fight_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_fight_character_combat_state"("p_fight_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_fight_character_combat_state"("p_fight_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_fight_character_combat_state"("p_fight_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."grant_currency_to_character_for_dm"("p_character_id" "text", "p_gold" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."grant_currency_to_character_for_dm"("p_character_id" "text", "p_gold" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."grant_currency_to_character_for_dm"("p_character_id" "text", "p_gold" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."grant_inventory_item_for_dm"("p_character_id" "text", "p_title" "text", "p_description" "text", "p_quantity" integer, "p_category" "text", "p_source_item_template_id" "text", "p_source_origin" "text", "p_template_snapshot" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."grant_inventory_item_for_dm"("p_character_id" "text", "p_title" "text", "p_description" "text", "p_quantity" integer, "p_category" "text", "p_source_item_template_id" "text", "p_source_origin" "text", "p_template_snapshot" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."grant_inventory_item_for_dm"("p_character_id" "text", "p_title" "text", "p_description" "text", "p_quantity" integer, "p_category" "text", "p_source_item_template_id" "text", "p_source_origin" "text", "p_template_snapshot" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_dm"("check_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_dm"("check_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_dm"("check_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_fight_entity_hp"("p_entity_id" "uuid", "p_current_hp" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_fight_entity_hp"("p_entity_id" "uuid", "p_current_hp" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."set_fight_entity_hp"("p_entity_id" "uuid", "p_current_hp" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_fight_entity_hp"("p_entity_id" "uuid", "p_current_hp" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."unlock_fight_creatures_for_campaign"("p_campaign_id" "uuid", "p_fight_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."unlock_fight_creatures_for_campaign"("p_campaign_id" "uuid", "p_fight_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."unlock_fight_creatures_for_campaign"("p_campaign_id" "uuid", "p_fight_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unlock_fight_creatures_for_campaign"("p_campaign_id" "uuid", "p_fight_id" "uuid") TO "service_role";


















GRANT ALL ON TABLE "public"."activity_status" TO "anon";
GRANT ALL ON TABLE "public"."activity_status" TO "authenticated";
GRANT ALL ON TABLE "public"."activity_status" TO "service_role";



GRANT ALL ON TABLE "public"."characters" TO "anon";
GRANT ALL ON TABLE "public"."characters" TO "authenticated";
GRANT ALL ON TABLE "public"."characters" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."active_players" TO "anon";
GRANT ALL ON TABLE "public"."active_players" TO "authenticated";
GRANT ALL ON TABLE "public"."active_players" TO "service_role";



GRANT ALL ON TABLE "public"."attacks" TO "anon";
GRANT ALL ON TABLE "public"."attacks" TO "authenticated";
GRANT ALL ON TABLE "public"."attacks" TO "service_role";



GRANT ALL ON TABLE "public"."background_templates" TO "anon";
GRANT ALL ON TABLE "public"."background_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."background_templates" TO "service_role";



GRANT ALL ON TABLE "public"."campaign_entry_unlocks" TO "anon";
GRANT ALL ON TABLE "public"."campaign_entry_unlocks" TO "authenticated";
GRANT ALL ON TABLE "public"."campaign_entry_unlocks" TO "service_role";



GRANT ALL ON TABLE "public"."character_companions" TO "anon";
GRANT ALL ON TABLE "public"."character_companions" TO "authenticated";
GRANT ALL ON TABLE "public"."character_companions" TO "service_role";



GRANT ALL ON TABLE "public"."character_notes" TO "anon";
GRANT ALL ON TABLE "public"."character_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."character_notes" TO "service_role";



GRANT ALL ON TABLE "public"."class_templates" TO "anon";
GRANT ALL ON TABLE "public"."class_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."class_templates" TO "service_role";



GRANT ALL ON TABLE "public"."companion_templates" TO "anon";
GRANT ALL ON TABLE "public"."companion_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."companion_templates" TO "service_role";



GRANT ALL ON TABLE "public"."creature_templates" TO "anon";
GRANT ALL ON TABLE "public"."creature_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."creature_templates" TO "service_role";



GRANT ALL ON TABLE "public"."dm_notes" TO "anon";
GRANT ALL ON TABLE "public"."dm_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."dm_notes" TO "service_role";



GRANT ALL ON TABLE "public"."feat_templates" TO "anon";
GRANT ALL ON TABLE "public"."feat_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."feat_templates" TO "service_role";



GRANT ALL ON TABLE "public"."fight_entities" TO "anon";
GRANT ALL ON TABLE "public"."fight_entities" TO "authenticated";
GRANT ALL ON TABLE "public"."fight_entities" TO "service_role";



GRANT ALL ON TABLE "public"."fight_initiative_requests" TO "anon";
GRANT ALL ON TABLE "public"."fight_initiative_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."fight_initiative_requests" TO "service_role";



GRANT ALL ON TABLE "public"."fights" TO "anon";
GRANT ALL ON TABLE "public"."fights" TO "authenticated";
GRANT ALL ON TABLE "public"."fights" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_items" TO "anon";
GRANT ALL ON TABLE "public"."inventory_items" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_items" TO "service_role";



GRANT ALL ON TABLE "public"."maps" TO "anon";
GRANT ALL ON TABLE "public"."maps" TO "authenticated";
GRANT ALL ON TABLE "public"."maps" TO "service_role";



GRANT ALL ON TABLE "public"."race_templates" TO "anon";
GRANT ALL ON TABLE "public"."race_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."race_templates" TO "service_role";



GRANT ALL ON TABLE "public"."spell_templates" TO "anon";
GRANT ALL ON TABLE "public"."spell_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."spell_templates" TO "service_role";



GRANT ALL ON TABLE "public"."spells" TO "anon";
GRANT ALL ON TABLE "public"."spells" TO "authenticated";
GRANT ALL ON TABLE "public"."spells" TO "service_role";



GRANT ALL ON TABLE "public"."trait_templates" TO "anon";
GRANT ALL ON TABLE "public"."trait_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."trait_templates" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";



































