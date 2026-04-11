insert into public.class_templates (
  slug,
  name,
  hit_die,
  primary_ability,
  saving_throw_proficiencies,
  armor_proficiencies,
  weapon_proficiencies,
  tool_proficiencies,
  short_description,
  feature_summary,
  tags,
  source_name,
  source_page,
  is_official
)
values
  ('fighter', 'Fighter', 'd10', 'STR/DEX', 'Strength, Constitution', 'All armor, shields', 'Simple weapons, martial weapons', 'None', 'Disciplined frontline combatant with broad weapon and armor mastery.', 'Fighting Style, Second Wind, Action Surge, Extra Attack, Indomitable.', '["martial","frontline"]'::jsonb, 'Player''s Handbook', 'PHB p.70', true),
  ('wizard', 'Wizard', 'd6', 'INT', 'Intelligence, Wisdom', 'None', 'Daggers, darts, slings, quarterstaffs, light crossbows', 'None', 'Arcane scholar with the broadest spell list and ritual utility.', 'Arcane Recovery, Arcane Tradition, Spell Mastery, Signature Spells.', '["caster","arcane"]'::jsonb, 'Player''s Handbook', 'PHB p.112', true),
  ('rogue', 'Rogue', 'd8', 'DEX', 'Dexterity, Intelligence', 'Light armor', 'Simple weapons, hand crossbows, longswords, rapiers, shortswords', 'Thieves'' tools', 'Stealthy skill specialist focused on precision damage and mobility.', 'Sneak Attack, Cunning Action, Uncanny Dodge, Evasion, Reliable Talent.', '["martial","skill"]'::jsonb, 'Player''s Handbook', 'PHB p.94', true),
  ('cleric', 'Cleric', 'd8', 'WIS', 'Wisdom, Charisma', 'Light armor, medium armor, shields', 'Simple weapons', 'None', 'Divine spellcaster with healing, support, and domain powers.', 'Channel Divinity, Divine Domain, Destroy Undead, Divine Intervention.', '["caster","divine","support"]'::jsonb, 'Player''s Handbook', 'PHB p.56', true),
  ('ranger', 'Ranger', 'd10', 'DEX/WIS', 'Strength, Dexterity', 'Light armor, medium armor, shields', 'Simple weapons, martial weapons', 'None', 'Wilderness hunter blending martial combat with nature magic.', 'Favored Enemy, Natural Explorer, Fighting Style, Spellcasting, Extra Attack.', '["martial","half-caster","exploration"]'::jsonb, 'Player''s Handbook', 'PHB p.89', true),
  ('bard', 'Bard', 'd8', 'CHA', 'Dexterity, Charisma', 'Light armor', 'Simple weapons, hand crossbows, longswords, rapiers, shortswords', 'Three musical instruments', 'Versatile arcane performer with support, control, and social mastery.', 'Bardic Inspiration, Jack of All Trades, Song of Rest, Magical Secrets.', '["caster","support","social"]'::jsonb, 'Player''s Handbook', 'PHB p.51', true),
  ('paladin', 'Paladin', 'd10', 'STR/CHA', 'Wisdom, Charisma', 'All armor, shields', 'Simple weapons, martial weapons', 'None', 'Holy warrior combining heavy armor with divine smite magic.', 'Divine Sense, Lay on Hands, Fighting Style, Divine Smite, Aura of Protection.', '["martial","half-caster","divine"]'::jsonb, 'Player''s Handbook', 'PHB p.82', true),
  ('warlock', 'Warlock', 'd8', 'CHA', 'Wisdom, Charisma', 'Light armor', 'Simple weapons', 'None', 'Pact-bound caster with short-rest spell slots and invocations.', 'Otherworldly Patron, Pact Magic, Eldritch Invocations, Mystic Arcanum.', '["caster","arcane","short-rest"]'::jsonb, 'Player''s Handbook', 'PHB p.105', true),
  ('druid', 'Druid', 'd8', 'WIS', 'Intelligence, Wisdom', 'Light armor, medium armor, shields (nonmetal)', 'Clubs, daggers, darts, javelins, maces, quarterstaffs, scimitars, sickles, slings, spears', 'Herbalism kit', 'Nature spellcaster with battlefield control and shapeshifting.', 'Druidic, Wild Shape, Druid Circle, Timeless Body, Beast Spells.', '["caster","divine","nature"]'::jsonb, 'Player''s Handbook', 'PHB p.64', true),
  ('monk', 'Monk', 'd8', 'DEX/WIS', 'Strength, Dexterity', 'None', 'Simple weapons, shortswords', 'One artisan''s tools or one musical instrument', 'Mobile martial artist using ki for offense, defense, and movement.', 'Martial Arts, Ki, Unarmored Movement, Deflect Missiles, Stunning Strike.', '["martial","mobile"]'::jsonb, 'Player''s Handbook', 'PHB p.76', true),
  ('sorcerer', 'Sorcerer', 'd6', 'CHA', 'Constitution, Charisma', 'None', 'Daggers, darts, slings, quarterstaffs, light crossbows', 'None', 'Innate arcane caster with flexible metamagic manipulation.', 'Sorcerous Origin, Font of Magic, Metamagic, Sorcerous Restoration.', '["caster","arcane"]'::jsonb, 'Player''s Handbook', 'PHB p.99', true),
  ('barbarian', 'Barbarian', 'd12', 'STR', 'Strength, Constitution', 'Light armor, medium armor, shields', 'Simple weapons, martial weapons', 'None', 'Durable frontline berserker with rage-based offense and resistance.', 'Rage, Unarmored Defense, Reckless Attack, Danger Sense, Brutal Critical.', '["martial","frontline","tank"]'::jsonb, 'Player''s Handbook', 'PHB p.46', true)
on conflict (slug) do update
set
  name = excluded.name,
  hit_die = excluded.hit_die,
  primary_ability = excluded.primary_ability,
  saving_throw_proficiencies = excluded.saving_throw_proficiencies,
  armor_proficiencies = excluded.armor_proficiencies,
  weapon_proficiencies = excluded.weapon_proficiencies,
  tool_proficiencies = excluded.tool_proficiencies,
  short_description = excluded.short_description,
  feature_summary = excluded.feature_summary,
  tags = excluded.tags,
  source_name = excluded.source_name,
  source_page = excluded.source_page,
  is_official = excluded.is_official,
  updated_at = now();

insert into public.race_templates (
  slug,
  name,
  size,
  speed,
  ability_bonuses,
  traits,
  languages,
  senses,
  short_description,
  tags,
  source_name,
  source_page,
  is_official
)
values
  ('human', 'Human', 'Medium', 30, '{"STR":1,"DEX":1,"CON":1,"INT":1,"WIS":1,"CHA":1}'::jsonb, '["Versatile and ambitious people spread across all lands."]'::jsonb, 'Common, one extra language', null, 'Adaptable generalist with broad ability improvements.', '["core-race","versatile"]'::jsonb, 'Player''s Handbook', 'PHB p.31', true),
  ('elf', 'Elf', 'Medium', 30, '{"DEX":2}'::jsonb, '["Darkvision 60 ft.","Keen Senses (Perception proficiency)","Fey Ancestry","Trance"]'::jsonb, 'Common, Elvish', 'Darkvision 60 ft.', 'Graceful fey-touched people with keen senses and trance rest.', '["core-race","fey"]'::jsonb, 'Player''s Handbook', 'PHB p.23', true),
  ('dwarf', 'Dwarf', 'Medium', 25, '{"CON":2}'::jsonb, '["Darkvision 60 ft.","Dwarven Resilience","Dwarven Combat Training","Tool Proficiency","Stonecunning"]'::jsonb, 'Common, Dwarvish', 'Darkvision 60 ft.', 'Stout and resilient folk renowned for craftsmanship.', '["core-race","resilient"]'::jsonb, 'Player''s Handbook', 'PHB p.18', true),
  ('halfling', 'Halfling', 'Small', 25, '{"DEX":2}'::jsonb, '["Lucky","Brave","Halfling Nimbleness"]'::jsonb, 'Common, Halfling', null, 'Small and lucky travelers with remarkable courage.', '["core-race","small"]'::jsonb, 'Player''s Handbook', 'PHB p.26', true),
  ('tiefling', 'Tiefling', 'Medium', 30, '{"INT":1,"CHA":2}'::jsonb, '["Darkvision 60 ft.","Hellish Resistance","Infernal Legacy"]'::jsonb, 'Common, Infernal', 'Darkvision 60 ft.', 'Fiend-touched descendants with innate magical gifts.', '["core-race","fiendish"]'::jsonb, 'Player''s Handbook', 'PHB p.42', true),
  ('dragonborn', 'Dragonborn', 'Medium', 30, '{"STR":2,"CHA":1}'::jsonb, '["Draconic Ancestry","Breath Weapon","Damage Resistance"]'::jsonb, 'Common, Draconic', null, 'Proud draconic humanoids with elemental breath.', '["core-race","draconic"]'::jsonb, 'Player''s Handbook', 'PHB p.32', true),
  ('half-elf', 'Half-Elf', 'Medium', 30, '{"CHA":2,"ANY1":1,"ANY2":1}'::jsonb, '["Darkvision 60 ft.","Fey Ancestry","Skill Versatility"]'::jsonb, 'Common, Elvish, one extra language', 'Darkvision 60 ft.', 'Diplomatic bridge between human and elven cultures.', '["core-race","versatile"]'::jsonb, 'Player''s Handbook', 'PHB p.39', true),
  ('half-orc', 'Half-Orc', 'Medium', 30, '{"STR":2,"CON":1}'::jsonb, '["Darkvision 60 ft.","Relentless Endurance","Savage Attacks","Menacing"]'::jsonb, 'Common, Orc', 'Darkvision 60 ft.', 'Powerful survivors known for relentless toughness.', '["core-race","martial"]'::jsonb, 'Player''s Handbook', 'PHB p.40', true),
  ('gnome', 'Gnome', 'Small', 25, '{"INT":2}'::jsonb, '["Darkvision 60 ft.","Gnome Cunning"]'::jsonb, 'Common, Gnomish', 'Darkvision 60 ft.', 'Curious inventors and illusionists with sharp minds.', '["core-race","small","arcane"]'::jsonb, 'Player''s Handbook', 'PHB p.35', true)
on conflict (slug) do update
set
  name = excluded.name,
  size = excluded.size,
  speed = excluded.speed,
  ability_bonuses = excluded.ability_bonuses,
  traits = excluded.traits,
  languages = excluded.languages,
  senses = excluded.senses,
  short_description = excluded.short_description,
  tags = excluded.tags,
  source_name = excluded.source_name,
  source_page = excluded.source_page,
  is_official = excluded.is_official,
  updated_at = now();

insert into public.background_templates (
  slug,
  name,
  skill_proficiencies,
  tool_proficiencies,
  language_proficiencies,
  equipment_summary,
  feature_summary,
  short_description,
  tags,
  source_name,
  source_page,
  is_official
)
values
  ('soldier', 'Soldier', 'Athletics, Intimidation', 'One type of gaming set, vehicles (land)', 'None', 'Insignia of rank, trophy from defeated enemy, set of bone dice or deck of cards, common clothes, belt pouch with 10 gp.', 'Military Rank: soldiers loyal to your former unit still recognize your authority and influence.', 'Trained veteran with battlefield discipline and command presence.', '["background","martial"]'::jsonb, 'Player''s Handbook', 'PHB p.140', true),
  ('sage', 'Sage', 'Arcana, History', 'None', 'Two languages of your choice', 'Bottle of black ink, quill, small knife, letter from dead colleague, common clothes, belt pouch with 10 gp.', 'Researcher: when you do not know a piece of lore, you often know where and from whom to obtain it.', 'Scholarly researcher driven by knowledge and forgotten lore.', '["background","scholar"]'::jsonb, 'Player''s Handbook', 'PHB p.137', true),
  ('criminal', 'Criminal', 'Deception, Stealth', 'One type of gaming set, thieves'' tools', 'None', 'Crowbar, dark common clothes with hood, belt pouch with 15 gp.', 'Criminal Contact: you have a reliable and trustworthy contact in the criminal underworld.', 'Underworld operative skilled in stealth and deception.', '["background","social","stealth"]'::jsonb, 'Player''s Handbook', 'PHB p.129', true),
  ('noble', 'Noble', 'History, Persuasion', 'One type of gaming set', 'One language of your choice', 'Set of fine clothes, signet ring, scroll of pedigree, purse with 25 gp.', 'Position of Privilege: people assume your social standing grants audience and hospitality.', 'High-born social influencer with access to elite circles.', '["background","social"]'::jsonb, 'Player''s Handbook', 'PHB p.135', true),
  ('acolyte', 'Acolyte', 'Insight, Religion', 'None', 'Two languages of your choice', 'Holy symbol, prayer book or wheel, 5 sticks of incense, vestments, common clothes, belt pouch with 15 gp.', 'Shelter of the Faithful: you and companions can expect free healing/care and shelter at your temple.', 'Religious devotee trained in doctrine and sacred service.', '["background","religious"]'::jsonb, 'Player''s Handbook', 'PHB p.127', true),
  ('folk-hero', 'Folk Hero', 'Animal Handling, Survival', 'One type of artisan''s tools, vehicles (land)', 'None', 'Set of artisan''s tools, shovel, iron pot, common clothes, belt pouch with 10 gp.', 'Rustic Hospitality: common folk will shelter and hide you from authority if needed.', 'Community champion known for humble deeds and resilience.', '["background","rural"]'::jsonb, 'Player''s Handbook', 'PHB p.131', true),
  ('charlatan', 'Charlatan', 'Deception, Sleight of Hand', 'Disguise kit, forgery kit', 'None', 'Fine clothes, disguise kit, con toolkit, belt pouch with 15 gp.', 'False Identity: you maintain a second identity complete with documentation and acquaintances.', 'Confidence trickster with forged identities and social manipulation.', '["background","social","deception"]'::jsonb, 'Player''s Handbook', 'PHB p.128', true),
  ('entertainer', 'Entertainer', 'Acrobatics, Performance', 'Disguise kit, one musical instrument', 'None', 'Musical instrument, favor from admirer, costume, belt pouch with 15 gp.', 'By Popular Demand: you can usually find a place to perform for room and board.', 'Performer who thrives in crowds and public venues.', '["background","social","performance"]'::jsonb, 'Player''s Handbook', 'PHB p.130', true),
  ('hermit', 'Hermit', 'Medicine, Religion', 'Herbalism kit', 'One language of your choice', 'Scroll case of notes, winter blanket, common clothes, herbalism kit, 5 gp.', 'Discovery: your quiet studies granted a unique revelation of campaign significance.', 'Solitary mystic with practical healing and spiritual insight.', '["background","mystic"]'::jsonb, 'Player''s Handbook', 'PHB p.134', true),
  ('outlander', 'Outlander', 'Athletics, Survival', 'One type of musical instrument', 'One language of your choice', 'Staff, hunting trap, trophy from slain animal, traveler''s clothes, belt pouch with 10 gp.', 'Wanderer: you have excellent memory for maps/geography and can find food and fresh water for group.', 'Wilderness wanderer adapted to harsh travel and survival.', '["background","exploration"]'::jsonb, 'Player''s Handbook', 'PHB p.136', true)
on conflict (slug) do update
set
  name = excluded.name,
  skill_proficiencies = excluded.skill_proficiencies,
  tool_proficiencies = excluded.tool_proficiencies,
  language_proficiencies = excluded.language_proficiencies,
  equipment_summary = excluded.equipment_summary,
  feature_summary = excluded.feature_summary,
  short_description = excluded.short_description,
  tags = excluded.tags,
  source_name = excluded.source_name,
  source_page = excluded.source_page,
  is_official = excluded.is_official,
  updated_at = now();
