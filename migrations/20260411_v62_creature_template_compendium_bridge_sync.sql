insert into public.compendium_entries (
  type,
  subtype,
  slug,
  name,
  description,
  is_system,
  data
)
select
  'creature' as type,
  'monster' as subtype,
  'creature-template-' || ct.slug as slug,
  ct.name,
  ct.notes,
  true as is_system,
  jsonb_build_object(
    'ac', ct.armor_class,
    'hp', ct.hit_points,
    'speed', ct.speed_text,
    'str', ct.str_score,
    'dex', ct.dex_score,
    'con', ct.con_score,
    'int', ct.int_score,
    'wis', ct.wis_score,
    'cha', ct.cha_score,
    'skills', coalesce(ct.skills, '{}'::jsonb),
    'senses', ct.senses,
    'traits', coalesce(ct.traits, '[]'::jsonb),
    'actions', coalesce(ct.actions, '[]'::jsonb),
    'source_creature_template_id', ct.id,
    'source_origin', 'template'
  ) as data
from public.creature_templates ct
on conflict (slug) do update
set
  name = excluded.name,
  description = excluded.description,
  subtype = excluded.subtype,
  is_system = true,
  data = excluded.data;
