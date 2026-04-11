insert into public.companion_templates (
  slug,
  name,
  kind,
  armor_class,
  hit_points,
  speed_text,
  notes,
  custom_data,
  tags,
  source_name,
  source_page,
  is_official
)
values
  ('cat', 'Cat', 'familiar', 12, 2, '40 ft., climb 30 ft.', 'Tiny stealthy familiar with keen smell. Great scout in urban and indoor play.', '{"size":"Tiny","senses":"Passive Perception 13","languages":"Understands summoner"}'::jsonb, '["familiar","scout"]'::jsonb, 'Player''s Handbook', 'PHB p.320', true),
  ('owl', 'Owl', 'familiar', 11, 1, '5 ft., fly 60 ft.', 'Fast flying familiar with strong Perception and flyby behavior.', '{"size":"Tiny","senses":"Darkvision 120 ft., Passive Perception 13","languages":"Understands summoner"}'::jsonb, '["familiar","scout","flying"]'::jsonb, 'Player''s Handbook', 'PHB p.333', true),
  ('hawk', 'Hawk', 'familiar', 13, 1, '10 ft., fly 60 ft.', 'Aerial scout with sharp sight for outdoor tracking and watch duty.', '{"size":"Tiny","senses":"Passive Perception 14","languages":"Understands summoner"}'::jsonb, '["familiar","scout","flying"]'::jsonb, 'Player''s Handbook', 'PHB p.330', true),
  ('raven', 'Raven', 'familiar', 12, 1, '10 ft., fly 50 ft.', 'Intelligent bird familiar suited for scouting and message delivery.', '{"size":"Tiny","senses":"Passive Perception 12","languages":"Understands summoner"}'::jsonb, '["familiar","scout","flying"]'::jsonb, 'Player''s Handbook', 'PHB p.335', true),
  ('wolf', 'Wolf', 'pet', 13, 11, '40 ft.', 'Pack-oriented companion with keen hearing/smell and trip-focused melee.', '{"size":"Medium","senses":"Passive Perception 13"}'::jsonb, '["pet","beast","pack"]'::jsonb, 'Player''s Handbook', 'PHB p.341', true),
  ('mastiff', 'Mastiff', 'pet', 12, 5, '40 ft.', 'Reliable hound companion used for guarding, tracking, and travel support.', '{"size":"Medium","senses":"Passive Perception 13"}'::jsonb, '["pet","beast","guard"]'::jsonb, 'Player''s Handbook', 'PHB p.332', true),
  ('rat', 'Rat', 'familiar', 10, 1, '20 ft.', 'Small familiar useful for infiltration, vents, and dungeon scouting.', '{"size":"Tiny","senses":"Darkvision 30 ft., Passive Perception 10","languages":"Understands summoner"}'::jsonb, '["familiar","scout"]'::jsonb, 'Player''s Handbook', 'PHB p.335', true),
  ('pseudodragon', 'Pseudodragon', 'familiar', 13, 7, '15 ft., fly 60 ft.', 'Magic-friendly draconic familiar with strong senses and sting utility.', '{"size":"Tiny","senses":"Blindsight 10 ft., Darkvision 60 ft., Passive Perception 13","languages":"Understands Common and Draconic"}'::jsonb, '["familiar","dragon","flying"]'::jsonb, 'Monster Manual', 'MM p.254', true),
  ('imp', 'Imp', 'familiar', 13, 10, '20 ft., fly 40 ft.', 'Fiend familiar option with shapechanging and poison sting support.', '{"size":"Tiny","senses":"Darkvision 120 ft., Passive Perception 11","languages":"Infernal, Common"}'::jsonb, '["familiar","fiend","flying"]'::jsonb, 'Monster Manual', 'MM p.76', true),
  ('sprite', 'Sprite', 'familiar', 15, 2, '10 ft., fly 40 ft.', 'Fey familiar option with stealth and ranged utility attacks.', '{"size":"Tiny","senses":"Passive Perception 13","languages":"Common, Elvish, Sylvan"}'::jsonb, '["familiar","fey","flying"]'::jsonb, 'Monster Manual', 'MM p.283', true),
  ('spider', 'Spider', 'familiar', 12, 1, '20 ft., climb 20 ft.', 'Wall-crawling familiar good for stealth, corners, and confined spaces.', '{"size":"Tiny","senses":"Darkvision 30 ft., Passive Perception 10","languages":"Understands summoner"}'::jsonb, '["familiar","scout","climber"]'::jsonb, 'Player''s Handbook', 'PHB p.337', true),
  ('bat', 'Bat', 'familiar', 12, 1, '5 ft., fly 30 ft.', 'Echolocation-based familiar for dark dungeon scouting.', '{"size":"Tiny","senses":"Blindsight 60 ft., Passive Perception 11","languages":"Understands summoner"}'::jsonb, '["familiar","scout","flying"]'::jsonb, 'Player''s Handbook', 'PHB p.318', true)
on conflict (slug) do update
set
  name = excluded.name,
  kind = excluded.kind,
  armor_class = excluded.armor_class,
  hit_points = excluded.hit_points,
  speed_text = excluded.speed_text,
  notes = excluded.notes,
  custom_data = excluded.custom_data,
  tags = excluded.tags,
  source_name = excluded.source_name,
  source_page = excluded.source_page,
  is_official = excluded.is_official,
  updated_at = now();
