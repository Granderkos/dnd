insert into public.spell_templates (
  slug,
  name,
  level,
  school,
  casting_time,
  range_text,
  components,
  duration_text,
  concentration,
  ritual,
  description,
  higher_level_text,
  save_type,
  attack_type,
  source_name,
  source_page,
  is_official,
  tags
)
values
  -- Level 3
  ('counterspell', 'Counterspell', 3, 'Abjuration', '1 reaction', '60 feet', 'S', 'Instantaneous', false, false, 'You attempt to interrupt a creature in the process of casting a spell. If the spell is 3rd level or lower, it fails automatically. For 4th level or higher, make an ability check using your spellcasting ability.', 'When cast with a slot higher than 3rd level, interrupted spell succeeds only if its level is greater than the slot used.', null, null, 'Player''s Handbook', 'PHB p.228', true, '["reaction","control"]'::jsonb),
  ('fireball', 'Fireball', 3, 'Evocation', '1 action', '150 feet', 'V, S, M', 'Instantaneous', false, false, 'A bright streak flashes to a point you choose, then blossoms into an explosion of flame. Each creature in a 20-foot-radius sphere must make a Dexterity saving throw, taking 8d6 fire damage on a failed save, or half as much on a success.', 'Damage increases by 1d6 for each slot level above 3rd.', 'dexterity', null, 'Player''s Handbook', 'PHB p.241', true, '["damage","fire"]'::jsonb),
  ('fly', 'Fly', 3, 'Transmutation', '1 action', 'Touch', 'V, S, M', 'Concentration, up to 10 minutes', true, false, 'You touch a willing creature. The target gains a flying speed of 60 feet for the duration.', 'When cast with a slot of 4th level or higher, you can target one additional creature for each slot level above 3rd.', null, null, 'Player''s Handbook', 'PHB p.243', true, '["mobility","buff","concentration"]'::jsonb),
  ('lightning-bolt', 'Lightning Bolt', 3, 'Evocation', '1 action', 'Self (100-foot line)', 'V, S, M', 'Instantaneous', false, false, 'A stroke of lightning forming a line 100 feet long and 5 feet wide blasts from you. Each creature in line must make a Dexterity saving throw, taking 8d6 lightning damage on fail, half on success.', 'Damage increases by 1d6 for each slot level above 3rd.', 'dexterity', null, 'Player''s Handbook', 'PHB p.255', true, '["damage","lightning"]'::jsonb),

  -- Level 4
  ('banishment', 'Banishment', 4, 'Abjuration', '1 action', '60 feet', 'V, S, M', 'Concentration, up to 1 minute', true, false, 'You attempt to send one creature that you can see within range to another plane. The target must succeed on a Charisma saving throw or be banished.', 'When cast with a slot of 5th level or higher, you can target one additional creature for each slot level above 4th.', 'charisma', null, 'Player''s Handbook', 'PHB p.217', true, '["control","concentration"]'::jsonb),
  ('dimension-door', 'Dimension Door', 4, 'Conjuration', '1 action', '500 feet', 'V', 'Instantaneous', false, false, 'You teleport yourself from your current location to any other spot within range. You can bring one willing creature of your size or smaller carrying gear up to its carrying capacity.', null, null, null, 'Player''s Handbook', 'PHB p.233', true, '["mobility","utility"]'::jsonb),
  ('greater-invisibility', 'Greater Invisibility', 4, 'Illusion', '1 action', 'Touch', 'V, S', 'Concentration, up to 1 minute', true, false, 'You or a creature you touch becomes invisible until the spell ends. Anything the target wears or carries is invisible. The spell does not end when the target attacks or casts a spell.', null, null, null, 'Player''s Handbook', 'PHB p.246', true, '["stealth","buff","concentration"]'::jsonb),
  ('polymorph', 'Polymorph', 4, 'Transmutation', '1 action', '60 feet', 'V, S, M', 'Concentration, up to 1 hour', true, false, 'This spell transforms a creature you can see within range into a new beast form. The target must make a Wisdom saving throw if unwilling.', null, 'wisdom', null, 'Player''s Handbook', 'PHB p.266', true, '["control","utility","concentration"]'::jsonb),

  -- Level 5
  ('cone-of-cold', 'Cone of Cold', 5, 'Evocation', '1 action', 'Self (60-foot cone)', 'V, S, M', 'Instantaneous', false, false, 'A blast of cold air erupts from your hands. Each creature in a 60-foot cone must make a Constitution saving throw, taking 8d8 cold damage on a failed save, or half as much on a success.', 'Damage increases by 1d8 for each slot level above 5th.', 'constitution', null, 'Player''s Handbook', 'PHB p.224', true, '["damage","cold"]'::jsonb),
  ('greater-restoration', 'Greater Restoration', 5, 'Abjuration', '1 action', 'Touch', 'V, S, M', 'Instantaneous', false, false, 'You imbue a creature you touch with positive energy to undo debilitating effects, such as one level of exhaustion, charm/petrification/curse, ability score reduction, or reduced hit point maximum.', null, null, null, 'Player''s Handbook', 'PHB p.246', true, '["healing","support"]'::jsonb),
  ('hold-monster', 'Hold Monster', 5, 'Enchantment', '1 action', '90 feet', 'V, S, M', 'Concentration, up to 1 minute', true, false, 'Choose a creature you can see within range. It must succeed on a Wisdom saving throw or be paralyzed for the duration.', 'When cast with a slot of 6th level or higher, you can target one additional creature per slot level above 5th.', 'wisdom', null, 'Player''s Handbook', 'PHB p.251', true, '["control","concentration"]'::jsonb),
  ('wall-of-force', 'Wall of Force', 5, 'Evocation', '1 action', '120 feet', 'V, S, M', 'Concentration, up to 10 minutes', true, false, 'An invisible wall of force springs into existence at a point you choose. It is immune to damage and cannot be dispelled by dispel magic.', null, null, null, 'Player''s Handbook', 'PHB p.285', true, '["control","utility","concentration"]'::jsonb),

  -- Level 6
  ('chain-lightning', 'Chain Lightning', 6, 'Evocation', '1 action', '150 feet', 'V, S, M', 'Instantaneous', false, false, 'You create a bolt of lightning that arcs toward a target you choose and then can leap to additional targets within 30 feet. Each target must make a Dexterity saving throw, taking 10d8 lightning damage on fail, half on success.', null, 'dexterity', null, 'Player''s Handbook', 'PHB p.221', true, '["damage","lightning"]'::jsonb),
  ('disintegrate', 'Disintegrate', 6, 'Transmutation', '1 action', '60 feet', 'V, S, M', 'Instantaneous', false, false, 'A thin green ray springs from your finger toward a target. A creature must make a Dexterity saving throw. On a failed save, it takes 10d6 + 40 force damage; if reduced to 0 hit points, it is disintegrated.', 'Damage increases by 3d6 for each slot level above 6th.', 'dexterity', null, 'Player''s Handbook', 'PHB p.233', true, '["damage","force"]'::jsonb),
  ('heal', 'Heal', 6, 'Evocation', '1 action', '60 feet', 'V, S', 'Instantaneous', false, false, 'Choose a creature you can see within range. A surge of positive energy washes through the creature, restoring 70 hit points and ending blindness, deafness, and diseases.', null, null, null, 'Player''s Handbook', 'PHB p.250', true, '["healing"]'::jsonb),
  ('mass-suggestion', 'Mass Suggestion', 6, 'Enchantment', '1 action', '60 feet', 'V, M', '24 hours', false, false, 'You suggest a course of activity to up to twelve creatures that can hear and understand you. Each target makes a Wisdom saving throw.', 'When cast with a 7th-level slot, duration is 10 days; 8th-level, 30 days; 9th-level, 1 year and 1 day.', 'wisdom', null, 'Player''s Handbook', 'PHB p.258', true, '["control","social"]'::jsonb),

  -- Level 7
  ('plane-shift', 'Plane Shift', 7, 'Conjuration', '1 action', 'Touch', 'V, S, M', 'Instantaneous', false, false, 'You and up to eight willing creatures can travel to a different plane. You can also use this spell offensively against an unwilling creature with a melee spell attack and Charisma save.', null, 'charisma', 'melee_spell', 'Player''s Handbook', 'PHB p.266', true, '["travel","utility"]'::jsonb),
  ('resurrection', 'Resurrection', 7, 'Necromancy', '1 hour', 'Touch', 'V, S, M', 'Instantaneous', false, false, 'You touch a dead creature that has been dead no more than a century, that didn''t die of old age, and that isn''t undead. If soul is free and willing, target returns to life with full hit points.', null, null, null, 'Player''s Handbook', 'PHB p.272', true, '["healing","revival"]'::jsonb),
  ('reverse-gravity', 'Reverse Gravity', 7, 'Transmutation', '1 action', '100 feet', 'V, S, M', 'Concentration, up to 1 minute', true, false, 'This spell reverses gravity in a 50-foot-radius, 100-foot-high cylinder centered on a point within range.', null, null, null, 'Player''s Handbook', 'PHB p.272', true, '["control","concentration"]'::jsonb),
  ('teleport', 'Teleport', 7, 'Conjuration', '1 action', '10 feet', 'V', 'Instantaneous', false, false, 'This spell instantly transports you and up to eight willing creatures, or a single object, to a destination you select with varying familiarity accuracy.', null, null, null, 'Player''s Handbook', 'PHB p.281', true, '["travel","utility"]'::jsonb),

  -- Level 8
  ('dominate-monster', 'Dominate Monster', 8, 'Enchantment', '1 action', '60 feet', 'V, S', 'Concentration, up to 1 hour', true, false, 'You attempt to beguile a creature you can see within range. It must succeed on a Wisdom saving throw or be charmed by you for duration.', null, 'wisdom', null, 'Player''s Handbook', 'PHB p.235', true, '["control","concentration"]'::jsonb),
  ('earthquake', 'Earthquake', 8, 'Evocation', '1 action', '500 feet', 'V, S, M', 'Concentration, up to 1 minute', true, false, 'You create a seismic disturbance at a point on the ground that you can see. For duration, intense tremors rip through the ground in a 100-foot-radius circle.', null, null, null, 'Player''s Handbook', 'PHB p.236', true, '["area-control","concentration"]'::jsonb),
  ('power-word-stun', 'Power Word Stun', 8, 'Enchantment', '1 action', '60 feet', 'V', 'Instantaneous', false, false, 'You speak a word of power that can overwhelm one creature you can see within range, leaving it stunned if it has 150 hit points or fewer.', null, null, null, 'Player''s Handbook', 'PHB p.267', true, '["control"]'::jsonb),

  -- Level 9
  ('foresight', 'Foresight', 9, 'Divination', '1 minute', 'Touch', 'V, S, M', '8 hours', false, false, 'You touch a willing creature and grant a limited ability to see into the immediate future. For duration, target cannot be surprised and has advantage on attack rolls, ability checks, and saving throws; attackers have disadvantage.', null, null, null, 'Player''s Handbook', 'PHB p.244', true, '["buff","utility"]'::jsonb),
  ('meteor-swarm', 'Meteor Swarm', 9, 'Evocation', '1 action', '1 mile', 'V, S', 'Instantaneous', false, false, 'Blazing orbs of fire plummet to the ground at four different points you can see within range. Each creature in a 40-foot-radius sphere must make a Dexterity save, taking 20d6 fire + 20d6 bludgeoning damage on fail, half on success.', null, 'dexterity', null, 'Player''s Handbook', 'PHB p.259', true, '["damage","fire","bludgeoning"]'::jsonb),
  ('power-word-kill', 'Power Word Kill', 9, 'Enchantment', '1 action', '60 feet', 'V', 'Instantaneous', false, false, 'You utter a word of power that can compel one creature you can see within range to die instantly if it has 100 hit points or fewer.', null, null, null, 'Player''s Handbook', 'PHB p.266', true, '["control","finisher"]'::jsonb),
  ('wish', 'Wish', 9, 'Conjuration', '1 action', 'Self', 'V', 'Instantaneous', false, false, 'Wish is the mightiest spell a mortal creature can cast. At minimum, it duplicates any spell of 8th level or lower without meeting requirements. Greater effects are possible at DM discretion with stress risks.', null, null, null, 'Player''s Handbook', 'PHB p.288', true, '["utility","reality-altering"]'::jsonb)
on conflict (slug) do update
set
  name = excluded.name,
  level = excluded.level,
  school = excluded.school,
  casting_time = excluded.casting_time,
  range_text = excluded.range_text,
  components = excluded.components,
  duration_text = excluded.duration_text,
  concentration = excluded.concentration,
  ritual = excluded.ritual,
  description = excluded.description,
  higher_level_text = excluded.higher_level_text,
  save_type = excluded.save_type,
  attack_type = excluded.attack_type,
  source_name = excluded.source_name,
  source_page = excluded.source_page,
  is_official = excluded.is_official,
  tags = excluded.tags,
  updated_at = now();
