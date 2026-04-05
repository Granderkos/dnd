'use client'

import { emptyCharacter, emptyInventory, emptySpellbook } from './auth-types'
import { calculateModifier, calculateSpellAttackBonus, calculateSpellSaveDC } from './dnd-types'
import type { Character, Inventory, Spellbook } from './dnd-types'
import type { Note } from '@/components/dnd/notes'
import { supabase } from './supabase'
import { generateClientId } from './client-id'

const characterSaveQueue = new Map<string, Promise<void>>()
const characterSaveSignatures = new Map<string, {
  row: string
  attacks: string
  inventory: string
  spells: string
  blob: string
}>()

async function withRetry<T>(operation: () => Promise<T>, retries = 2, delayMs = 250): Promise<T> {
  let attempt = 0
  let lastError: unknown
  while (attempt <= retries) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      if (attempt === retries) break
      const wait = delayMs * (attempt + 1)
      await new Promise((resolve) => setTimeout(resolve, wait))
      attempt += 1
    }
  }
  throw lastError
}

export interface StoredMap {
  id: string
  name: string
  imageData: string
  createdAt: number
  gridEnabled?: boolean
  gridSize?: number
  gridOpacity?: number
  uploadedBy?: string
  isActive?: boolean
}

interface CharacterNotesBlob {
  notes: Note[]
  inventoryCurrency: Inventory['currency']
  spellbookMeta: Pick<Spellbook, 'spellcastingClass' | 'spellcastingAbility' | 'spellSaveDC' | 'spellAttackBonus' | 'slots'>
  spellbookEntries?: Pick<Spellbook, 'cantrips' | 'spells'>
  inventoryItems?: Inventory['items']
  attacks?: Character['attacks']
  portraitUrl?: string
  featuresText?: string
  raceFeatures?: string
  classFeatures?: string
  backgroundFeatures?: string
}

const emptyBlob = (): CharacterNotesBlob => ({
  notes: [],
  inventoryCurrency: emptyInventory.currency,
  spellbookMeta: {
    spellcastingClass: '',
    spellcastingAbility: 'INT',
    spellSaveDC: 0,
    spellAttackBonus: 0,
    slots: emptySpellbook.slots,
  },
  spellbookEntries: {
    cantrips: emptySpellbook.cantrips,
    spells: emptySpellbook.spells,
  },
  inventoryItems: emptyInventory.items,
  attacks: emptyCharacter.attacks,
  portraitUrl: '',
  featuresText: '',
  raceFeatures: '',
  classFeatures: '',
  backgroundFeatures: '',
})

function safeJsonParse<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

async function getCharacterIdForUser(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('characters')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw error
  return data?.id ?? null
}

async function ensureCharacterRecord(userId: string) {
  const existingId = await getCharacterIdForUser(userId)
  if (existingId) return existingId

  const c = emptyCharacter
  const { data, error } = await supabase
    .from('characters')
    .insert({
      user_id: userId,
      name: c.info.name,
      class_name: c.info.class,
      subclass: c.info.subclass,
      race: c.info.race,
      background: c.info.background,
      alignment: c.info.alignment,
      level: c.info.level,
      xp: c.info.xp,
      proficiency_bonus: c.proficiencyBonus,
      armor_class: c.combat.armorClass,
      initiative: c.combat.initiative,
      speed: c.combat.speed,
      hp_max: c.combat.maxHp,
      hp_current: c.combat.currentHp,
      hp_temp: c.combat.tempHp,
      hit_dice_total: 0,
      hit_dice_type: c.combat.hitDice,
      death_successes: 0,
      death_failures: 0,
      str_score: c.abilities.STR.value,
      dex_score: c.abilities.DEX.value,
      con_score: c.abilities.CON.value,
      int_score: c.abilities.INT.value,
      wis_score: c.abilities.WIS.value,
      cha_score: c.abilities.CHA.value,
      save_str_prof: c.abilities.STR.proficient,
      save_dex_prof: c.abilities.DEX.proficient,
      save_con_prof: c.abilities.CON.proficient,
      save_int_prof: c.abilities.INT.proficient,
      save_wis_prof: c.abilities.WIS.proficient,
      save_cha_prof: c.abilities.CHA.proficient,
      skill_acrobatics_prof: false,
      skill_animal_handling_prof: false,
      skill_arcana_prof: false,
      skill_athletics_prof: false,
      skill_deception_prof: false,
      skill_history_prof: false,
      skill_insight_prof: false,
      skill_intimidation_prof: false,
      skill_investigation_prof: false,
      skill_medicine_prof: false,
      skill_nature_prof: false,
      skill_perception_prof: false,
      skill_performance_prof: false,
      skill_persuasion_prof: false,
      skill_religion_prof: false,
      skill_sleight_of_hand_prof: false,
      skill_stealth_prof: false,
      skill_survival_prof: false,
      features: '',
      languages: '',
    })
    .select('id')
    .single()

  if (error) throw error

  await supabase.from('character_notes').upsert({
    character_id: data.id,
    notes: JSON.stringify(emptyBlob()),
  })

  return data.id
}

function notesBlobToText(blob: CharacterNotesBlob) {
  return JSON.stringify(blob)
}

function getPerceptionModifier(character: Character): number {
  const wisMod = calculateModifier(character.abilities.WIS.value)
  const perceptionSkill = character.skills.find((skill) => skill.name === 'Perception')
  return wisMod + (perceptionSkill?.proficient ? character.proficiencyBonus : 0)
}

async function getCharacterBlob(characterId: string): Promise<CharacterNotesBlob> {
  const { data, error } = await supabase
    .from('character_notes')
    .select('notes')
    .eq('character_id', characterId)
    .maybeSingle()

  if (error) throw error
  return safeJsonParse<CharacterNotesBlob>(data?.notes, emptyBlob())
}

async function upsertCharacterBlob(characterId: string, blob: CharacterNotesBlob) {
  const { error } = await supabase.from('character_notes').upsert({
    character_id: characterId,
    notes: notesBlobToText(blob),
  })
  if (error) throw error
}

export async function loadCurrentPlayerData(userId: string): Promise<{ character: Character; spellbook: Spellbook; inventory: Inventory; notes: Note[] }> {
  const characterId = await ensureCharacterRecord(userId)

  const [{ data: row, error: charError }, { data: inventoryData, error: inventoryError }, { data: spellsData, error: spellsError }, blob] = await Promise.all([
    supabase
      .from('characters')
      .select('id, name, class_name, subclass, race, background, alignment, level, xp, proficiency_bonus, armor_class, initiative, speed, hp_max, hp_current, hp_temp, hit_dice_type, death_successes, death_failures, str_score, dex_score, con_score, int_score, wis_score, cha_score, save_str_prof, save_dex_prof, save_con_prof, save_int_prof, save_wis_prof, save_cha_prof, skill_acrobatics_prof, skill_animal_handling_prof, skill_arcana_prof, skill_athletics_prof, skill_deception_prof, skill_history_prof, skill_insight_prof, skill_intimidation_prof, skill_investigation_prof, skill_medicine_prof, skill_nature_prof, skill_perception_prof, skill_performance_prof, skill_persuasion_prof, skill_religion_prof, skill_sleight_of_hand_prof, skill_stealth_prof, skill_survival_prof, features, languages')
      .eq('id', characterId)
      .single(),
    supabase.from('inventory_items').select('*').eq('character_id', characterId).order('sort_order', { ascending: true }),
    supabase.from('spells').select('*').eq('character_id', characterId).order('sort_order', { ascending: true }),
    getCharacterBlob(characterId),
  ])

  if (charError) throw charError
  if (inventoryError) throw inventoryError
  if (spellsError) throw spellsError

  const skills = emptyCharacter.skills.map((skill) => {
    const key = skill.name
      .toLowerCase()
      .replace(/ /g, '_')
      .replace(/'/g, '')
    return {
      ...skill,
      proficient: Boolean((row as any)[`skill_${key}_prof`]),
    }
  })

  const fallbackSpellEntries = blob.spellbookEntries ?? emptyBlob().spellbookEntries!
  const fallbackInventoryItems = blob.inventoryItems ?? emptyInventory.items
  const fallbackAttacks = blob.attacks ?? emptyCharacter.attacks
  const hasNormalizedSpells = Boolean(spellsData?.length)
  const hasNormalizedInventory = Boolean(inventoryData?.length)
  const fallbackPreparedById = new Map(
    [...fallbackSpellEntries.cantrips, ...fallbackSpellEntries.spells]
      .map((spell) => [spell.id, spell.prepared] as const)
  )

  const character: Character = {
    info: {
      name: row.name ?? '',
      class: row.class_name ?? '',
      subclass: row.subclass ?? '',
      race: row.race ?? '',
      background: row.background ?? '',
      alignment: row.alignment ?? '',
      level: row.level ?? 1,
      xp: row.xp ?? 0,
      portraitUrl: blob.portraitUrl ?? '',
    },
    abilities: {
      STR: { value: row.str_score ?? 10, proficient: row.save_str_prof ?? false },
      DEX: { value: row.dex_score ?? 10, proficient: row.save_dex_prof ?? false },
      CON: { value: row.con_score ?? 10, proficient: row.save_con_prof ?? false },
      INT: { value: row.int_score ?? 10, proficient: row.save_int_prof ?? false },
      WIS: { value: row.wis_score ?? 10, proficient: row.save_wis_prof ?? false },
      CHA: { value: row.cha_score ?? 10, proficient: row.save_cha_prof ?? false },
    },
    proficiencyBonus: row.proficiency_bonus ?? 2,
    skills,
    combat: {
      initiativeBase: calculateModifier(row.dex_score ?? 10),
      initiativeRoll: 0,
      initiativeTotal: calculateModifier(row.dex_score ?? 10),
      armorClass: row.armor_class ?? 10,
      initiative: calculateModifier(row.dex_score ?? 10),
      speed: row.speed ?? 30,
      maxHp: row.hp_max ?? 0,
      currentHp: row.hp_current ?? 0,
      tempHp: row.hp_temp ?? 0,
      hitDice: row.hit_dice_type ?? '',
      deathSaves: {
        successes: [0, 1, 2].map((i) => i < (row.death_successes ?? 0)) as [boolean, boolean, boolean],
        failures: [0, 1, 2].map((i) => i < (row.death_failures ?? 0)) as [boolean, boolean, boolean],
      },
    },
    attacks: fallbackAttacks,
    attackNotes: '',
    raceFeatures: blob.raceFeatures ?? '',
    classFeatures: blob.classFeatures ?? blob.featuresText ?? row.features ?? '',
    backgroundFeatures: blob.backgroundFeatures ?? '',
    languages: row.languages ?? '',
    passivePerception: 10,
  }
  character.passivePerception = 10 + getPerceptionModifier(character)

  const spellMeta = blob.spellbookMeta ?? emptyBlob().spellbookMeta
  const spellAbility = spellMeta.spellcastingAbility || 'INT'
  const spellAbilityScore = row[`${spellAbility.toLowerCase()}_score` as keyof typeof row] as number | null
  const fallbackSpellSaveDC = calculateSpellSaveDC(row.proficiency_bonus ?? 2, spellAbilityScore ?? 10)
  const fallbackSpellAttackBonus = calculateSpellAttackBonus(row.proficiency_bonus ?? 2, spellAbilityScore ?? 10)
  const spellbook: Spellbook = {
    spellcastingClass: spellMeta.spellcastingClass || row.class_name || '',
    spellcastingAbility: spellAbility,
    spellSaveDC: spellMeta.spellSaveDC ?? fallbackSpellSaveDC,
    spellAttackBonus: spellMeta.spellAttackBonus ?? fallbackSpellAttackBonus,
    cantrips: (hasNormalizedSpells ? (spellsData ?? []).filter((s) => s.is_cantrip).map((s) => ({
      id: s.client_id ?? s.id,
      name: s.title,
      level: 0,
      ritual: s.is_ritual,
      concentration: s.is_concentration,
      reaction: s.is_reaction,
      castingTime: s.casting_time,
      range: s.range_text,
      duration: s.duration_text,
      description: s.description,
      damage: s.dice,
      prepared: fallbackPreparedById.get(s.client_id ?? s.id) ?? true,
    })) : fallbackSpellEntries.cantrips),
    spells: (hasNormalizedSpells ? (spellsData ?? []).filter((s) => !s.is_cantrip).map((s) => ({
      id: s.client_id ?? s.id,
      name: s.title,
      level: Number(s.spell_level || 1),
      ritual: s.is_ritual,
      concentration: s.is_concentration,
      reaction: s.is_reaction,
      castingTime: s.casting_time,
      range: s.range_text,
      duration: s.duration_text,
      description: s.description,
      damage: s.dice,
      prepared: fallbackPreparedById.get(s.client_id ?? s.id) ?? true,
    })) : fallbackSpellEntries.spells),
    slots: spellMeta.slots ?? emptySpellbook.slots,
  }

  const inventory: Inventory = {
    items: (hasNormalizedInventory ? (inventoryData ?? []).map((item, index) => {
      const fallbackMatch = fallbackInventoryItems.find((blobItem) => blobItem.name === item.title && blobItem.description === (item.description ?? '') && blobItem.quantity === item.quantity) ?? fallbackInventoryItems[index]
      return {
        id: item.client_id ?? item.id,
        name: item.title,
        quantity: item.quantity,
        description: item.description,
        category: fallbackMatch?.category || 'Other',
      }
    }) : fallbackInventoryItems),
    currency: blob.inventoryCurrency || emptyInventory.currency,
  }

  return {
    character,
    spellbook,
    inventory,
    notes: blob.notes || [],
  }
}

export async function saveCurrentPlayerData(userId: string, payload: { character: Character; spellbook: Spellbook; inventory: Inventory; notes: Note[] }) {
  const characterId = await ensureCharacterRecord(userId)
  const previous = characterSaveQueue.get(characterId) ?? Promise.resolve()
  const saveTask = previous.then(async () => {
    const { character, spellbook, inventory, notes } = payload
    const spellcastingScore = character.abilities[spellbook.spellcastingAbility]?.value ?? 10
    const derivedSpellSaveDC = calculateSpellSaveDC(character.proficiencyBonus, spellcastingScore)
    const derivedSpellAttackBonus = calculateSpellAttackBonus(character.proficiencyBonus, spellcastingScore)
    const initiativeModifier = calculateModifier(character.abilities.DEX.value)
    const initiativeRoll = character.combat.initiativeRoll ?? 0
    const initiativeTotal = initiativeModifier + initiativeRoll

    const row = {
      id: characterId,
      user_id: userId,
      name: character.info.name,
      class_name: character.info.class,
      subclass: character.info.subclass,
      race: character.info.race,
      background: character.info.background,
      alignment: character.info.alignment,
      level: character.info.level,
      xp: character.info.xp,
      proficiency_bonus: character.proficiencyBonus,
      armor_class: character.combat.armorClass,
      initiative: initiativeTotal,
      speed: character.combat.speed,
      hp_max: character.combat.maxHp,
      hp_current: character.combat.currentHp,
      hp_temp: character.combat.tempHp,
      hit_dice_type: character.combat.hitDice,
      hit_dice_total: 0,
      death_successes: character.combat.deathSaves.successes.filter(Boolean).length,
      death_failures: character.combat.deathSaves.failures.filter(Boolean).length,
      str_score: character.abilities.STR.value,
      dex_score: character.abilities.DEX.value,
      con_score: character.abilities.CON.value,
      int_score: character.abilities.INT.value,
      wis_score: character.abilities.WIS.value,
      cha_score: character.abilities.CHA.value,
      save_str_prof: character.abilities.STR.proficient,
      save_dex_prof: character.abilities.DEX.proficient,
      save_con_prof: character.abilities.CON.proficient,
      save_int_prof: character.abilities.INT.proficient,
      save_wis_prof: character.abilities.WIS.proficient,
      save_cha_prof: character.abilities.CHA.proficient,
      skill_acrobatics_prof: findSkill(character, 'Acrobatics'),
      skill_animal_handling_prof: findSkill(character, 'Animal Handling'),
      skill_arcana_prof: findSkill(character, 'Arcana'),
      skill_athletics_prof: findSkill(character, 'Athletics'),
      skill_deception_prof: findSkill(character, 'Deception'),
      skill_history_prof: findSkill(character, 'History'),
      skill_insight_prof: findSkill(character, 'Insight'),
      skill_intimidation_prof: findSkill(character, 'Intimidation'),
      skill_investigation_prof: findSkill(character, 'Investigation'),
      skill_medicine_prof: findSkill(character, 'Medicine'),
      skill_nature_prof: findSkill(character, 'Nature'),
      skill_perception_prof: findSkill(character, 'Perception'),
      skill_performance_prof: findSkill(character, 'Performance'),
      skill_persuasion_prof: findSkill(character, 'Persuasion'),
      skill_religion_prof: findSkill(character, 'Religion'),
      skill_sleight_of_hand_prof: findSkill(character, 'Sleight of Hand'),
      skill_stealth_prof: findSkill(character, 'Stealth'),
      skill_survival_prof: findSkill(character, 'Survival'),
      features: [character.raceFeatures, character.classFeatures, character.backgroundFeatures].filter(Boolean).join('\n'),
      languages: character.languages,
    }

    const allSpells = [...spellbook.cantrips.map((s) => ({ ...s, level: 0 })), ...spellbook.spells]
    const normalizedInventory = inventory.items.map((item) => ({
      ...item,
      quantity: Number.isFinite(item.quantity) ? Math.max(0, Math.floor(item.quantity)) : 0,
    }))

    const blobPayload: CharacterNotesBlob = {
      notes,
      inventoryCurrency: inventory.currency,
      spellbookMeta: {
        spellcastingClass: spellbook.spellcastingClass,
        spellcastingAbility: spellbook.spellcastingAbility,
        spellSaveDC: derivedSpellSaveDC,
        spellAttackBonus: derivedSpellAttackBonus,
        slots: spellbook.slots,
      },
      spellbookEntries: {
        cantrips: allSpells.filter((s) => s.level === 0),
        spells: allSpells.filter((s) => s.level > 0),
      },
      inventoryItems: normalizedInventory,
      attacks: character.attacks,
      portraitUrl: character.info.portraitUrl,
      featuresText: [character.raceFeatures, character.classFeatures, character.backgroundFeatures].filter(Boolean).join('\n\n'),
      raceFeatures: character.raceFeatures,
      classFeatures: character.classFeatures,
      backgroundFeatures: character.backgroundFeatures,
    }

    const signatures = {
      row: JSON.stringify(row),
      attacks: JSON.stringify(character.attacks),
      inventory: JSON.stringify(normalizedInventory),
      spells: JSON.stringify(allSpells),
      blob: JSON.stringify(blobPayload),
    }
    const previousSignatures = characterSaveSignatures.get(characterId)

    if (!previousSignatures || previousSignatures.row !== signatures.row) {
      const { error: characterUpsertError } = await supabase.from('characters').upsert(row, { onConflict: 'id' })
      if (characterUpsertError) throw characterUpsertError
    }

    if (!previousSignatures || previousSignatures.attacks !== signatures.attacks) {
      const { error: attacksDeleteError } = await supabase.from('attacks').delete().eq('character_id', characterId)
      if (attacksDeleteError) throw attacksDeleteError

      if (character.attacks.length) {
        const { error } = await supabase.from('attacks').insert(
          character.attacks.map((attack, index) => ({
            character_id: characterId,
            sort_order: index,
            name: attack.name,
            attack_bonus: attack.attackBonus,
            damage: [attack.damage, attack.damageType].filter(Boolean).join(' '),
          }))
        )
        if (error) throw error
      }
    }

    if (!previousSignatures || previousSignatures.inventory !== signatures.inventory) {
      await syncInventoryRows(characterId, normalizedInventory)
    }
    if (!previousSignatures || previousSignatures.spells !== signatures.spells) {
      await syncSpellRows(characterId, allSpells)
    }
    if (!previousSignatures || previousSignatures.blob !== signatures.blob) {
      await upsertCharacterBlob(characterId, blobPayload)
    }

    characterSaveSignatures.set(characterId, signatures)
  })

  const chained = saveTask.catch(() => {})
  characterSaveQueue.set(characterId, chained)
  try {
    await saveTask
  } finally {
    if (characterSaveQueue.get(characterId) === chained) {
      characterSaveQueue.delete(characterId)
    }
  }
}

function findSkill(character: Character, name: string) {
  return character.skills.find((skill) => skill.name === name)?.proficient ?? false
}

async function syncInventoryRows(characterId: string, items: Inventory['items']) {
  if (!items.length) {
    const { error } = await supabase.from('inventory_items').delete().eq('character_id', characterId)
    if (error) throw error
    return
  }

  const rows = items.map((item, index) => ({
    character_id: characterId,
    client_id: item.id,
    sort_order: index,
    title: item.name,
    description: item.description,
    quantity: item.quantity,
  }))
  const { error: upsertError } = await supabase
    .from('inventory_items')
    .upsert(rows, { onConflict: 'character_id,client_id' })
  if (upsertError) {
    console.error('[inventory:save] upsert failed', {
      characterId,
      rowCount: rows.length,
      sample: rows.slice(0, 5).map((row) => ({
        client_id: row.client_id,
        title: row.title,
        quantity: row.quantity,
      })),
      error: upsertError,
    })
    throw upsertError
  }
  await deleteMissingInventoryRows(characterId, items.map((item) => item.id))
}

async function syncSpellRows(characterId: string, spells: Spellbook['spells'][number][]) {
  if (!spells.length) {
    const { error } = await supabase.from('spells').delete().eq('character_id', characterId)
    if (error) throw error
    return
  }

  const rows = spells.map((spell, index) => ({
    character_id: characterId,
    client_id: spell.id,
    sort_order: index,
    title: spell.name,
    spell_level: String(spell.level),
    casting_time: spell.castingTime,
    range_text: spell.range,
    components: '',
    duration_text: spell.duration,
    dice: spell.damage,
    description: spell.description,
    is_cantrip: spell.level === 0,
    is_ritual: spell.ritual,
    is_concentration: spell.concentration,
    is_reaction: spell.reaction,
  }))
  const { error: upsertError } = await supabase
    .from('spells')
    .upsert(rows, { onConflict: 'character_id,client_id' })
  if (upsertError) {
    console.error('[spells:save] upsert failed', { characterId, rowCount: rows.length, error: upsertError })
    throw upsertError
  }

  await deleteMissingSpellRows(characterId, spells.map((spell) => spell.id))
}

function dedupeByClientId<T extends { id: string }>(rows: T[]): T[] {
  const map = new Map<string, T>()
  for (const row of rows) {
    map.set(row.id, row)
  }
  return Array.from(map.values())
}

async function deleteMissingInventoryRows(characterId: string, keepClientIds: string[]) {
  const keepSet = new Set(keepClientIds)
  const { data, error } = await supabase
    .from('inventory_items')
    .select('client_id')
    .eq('character_id', characterId)
  if (error) throw error
  const stale = (data ?? []).map((row) => row.client_id as string).filter((id) => !keepSet.has(id))
  if (!stale.length) return
  const { error: deleteError } = await supabase
    .from('inventory_items')
    .delete()
    .eq('character_id', characterId)
    .in('client_id', stale)
  if (deleteError) {
    console.error('[inventory:save] delete missing rows failed', { characterId, staleCount: stale.length, error: deleteError })
    throw deleteError
  }
}

async function deleteMissingSpellRows(characterId: string, keepClientIds: string[]) {
  const keepSet = new Set(keepClientIds)
  const { data, error } = await supabase
    .from('spells')
    .select('client_id')
    .eq('character_id', characterId)
  if (error) throw error
  const stale = (data ?? []).map((row) => row.client_id as string).filter((id) => !keepSet.has(id))
  if (!stale.length) return
  const { error: deleteError } = await supabase
    .from('spells')
    .delete()
    .eq('character_id', characterId)
    .in('client_id', stale)
  if (deleteError) {
    console.error('[spells:save] delete missing rows failed', { characterId, staleCount: stale.length, error: deleteError })
    throw deleteError
  }
}

export async function listPlayerCharacters() {
  const { data: players, error } = await supabase
    .from('profiles')
    .select(`
      id,
      username,
      role,
      characters (*),
      activity_status (last_seen, current_page, is_online)
    `)
    .eq('role', 'player')
    .order('created_at', { ascending: true })

  if (error) throw error

  const results = await Promise.all((players ?? []).map(async (player: any) => {
    const row = Array.isArray(player.characters) ? player.characters[0] : player.characters
    if (!row) {
      return { id: player.id, username: player.username, character: emptyCharacter, activity: player.activity_status }
    }

    const blob = await getCharacterBlob(row.id)

    const character: Character = {
      info: {
        name: row.name ?? '',
        class: row.class_name ?? '',
        subclass: row.subclass ?? '',
        race: row.race ?? '',
        background: row.background ?? '',
        alignment: row.alignment ?? '',
        level: row.level ?? 1,
        xp: row.xp ?? 0,
        portraitUrl: blob.portraitUrl ?? '',
      },
      abilities: {
        STR: { value: row.str_score ?? 10, proficient: row.save_str_prof ?? false },
        DEX: { value: row.dex_score ?? 10, proficient: row.save_dex_prof ?? false },
        CON: { value: row.con_score ?? 10, proficient: row.save_con_prof ?? false },
        INT: { value: row.int_score ?? 10, proficient: row.save_int_prof ?? false },
        WIS: { value: row.wis_score ?? 10, proficient: row.save_wis_prof ?? false },
        CHA: { value: row.cha_score ?? 10, proficient: row.save_cha_prof ?? false },
      },
      proficiencyBonus: row.proficiency_bonus ?? 2,
      skills: emptyCharacter.skills,
      combat: {
        initiativeBase: calculateModifier(row.dex_score ?? 10),
        initiativeRoll: 0,
        initiativeTotal: calculateModifier(row.dex_score ?? 10),
        armorClass: row.armor_class ?? 10,
        initiative: calculateModifier(row.dex_score ?? 10),
        speed: row.speed ?? 30,
        maxHp: row.hp_max ?? 0,
        currentHp: row.hp_current ?? 0,
        tempHp: row.hp_temp ?? 0,
        hitDice: row.hit_dice_type ?? '',
        deathSaves: { successes: [false, false, false], failures: [false, false, false] },
      },
      attacks: blob.attacks ?? emptyCharacter.attacks,
      attackNotes: '',
      raceFeatures: blob.raceFeatures ?? '',
      classFeatures: blob.classFeatures ?? blob.featuresText ?? row.features ?? '',
      backgroundFeatures: blob.backgroundFeatures ?? '',
      languages: row.languages ?? '',
      passivePerception: 10,
    }
    character.passivePerception = 10 + getPerceptionModifier(character)

    return {
      id: player.id,
      username: player.username,
      character,
      activity: Array.isArray(player.activity_status) ? player.activity_status[0] : player.activity_status,
    }
  }))

  return results
}

export async function updateActivityStatus(userId: string, currentPage: string, isOnline = true) {
  const { error } = await supabase.from('activity_status').upsert({
    user_id: userId,
    current_page: currentPage,
    is_online: isOnline,
    last_seen: new Date().toISOString(),
  })
  if (error) throw error
}

export async function setOffline(userId: string) {
  const { error } = await supabase.from('activity_status').upsert({
    user_id: userId,
    current_page: '',
    is_online: false,
    last_seen: new Date().toISOString(),
  })
  if (error) throw error
}

export async function loadDmNotes() {
  const { data, error } = await supabase.from('dm_notes').select('*').order('created_at', { ascending: true }).limit(1)
  if (error) throw error
  return data?.[0]?.content ?? ''
}

export async function saveDmNotes(userId: string, content: string) {
  const { data, error } = await supabase.from('dm_notes').select('id').eq('created_by', userId).order('created_at', { ascending: true }).limit(1)
  if (error) throw error
  const existing = data?.[0]
  if (existing) {
    const { error: updateError } = await supabase.from('dm_notes').update({ content, title: 'Main Notes' }).eq('id', existing.id)
    if (updateError) throw updateError
  } else {
    const { error: insertError } = await supabase.from('dm_notes').insert({ created_by: userId, title: 'Main Notes', content })
    if (insertError) throw insertError
  }
}

export async function loadMaps() {
  const { data, error } = await withRetry(async () => await supabase.from('maps').select('*').order('created_at', { ascending: false }))
  if (error) throw error
  return (data ?? []).map((map) => ({
    id: map.id,
    name: map.name,
    imageData: map.storage_path,
    createdAt: new Date(map.created_at).getTime(),
    gridEnabled: map.grid_enabled,
    gridSize: map.grid_size,
    gridOpacity: Number(map.grid_opacity),
    uploadedBy: map.uploaded_by,
    isActive: map.is_active,
  })) as StoredMap[]
}

export async function createMap(userId: string, map: Omit<StoredMap, 'id' | 'createdAt'>) {
  const { data, error } = await supabase.from('maps').insert({
    uploaded_by: userId,
    name: map.name,
    storage_path: map.imageData,
    is_active: false,
    grid_enabled: map.gridEnabled ?? false,
    grid_size: map.gridSize ?? 50,
    grid_opacity: map.gridOpacity ?? 0.3,
  }).select('*').single()
  if (error) throw error
  return {
    id: data.id,
    name: data.name,
    imageData: data.storage_path,
    createdAt: new Date(data.created_at).getTime(),
    gridEnabled: data.grid_enabled,
    gridSize: data.grid_size,
    gridOpacity: Number(data.grid_opacity),
    uploadedBy: data.uploaded_by,
    isActive: data.is_active,
  } as StoredMap
}

export async function deleteMap(mapId: string) {
  const { error } = await supabase.from('maps').delete().eq('id', mapId)
  if (error) throw error
}

export async function setActiveMap(mapId: string | null) {
  const { error: clearError } = await supabase.from('maps').update({ is_active: false }).eq('is_active', true)
  if (clearError) throw clearError
  if (mapId) {
    const { error } = await supabase.from('maps').update({ is_active: true }).eq('id', mapId)
    if (error) throw error
  }
}

export async function getActiveMap() {
  const { data, error } = await withRetry(async () => await supabase.from('maps').select('*').eq('is_active', true).maybeSingle())
  if (error) throw error
  if (!data) return null
  return {
    id: data.id,
    name: data.name,
    imageData: data.storage_path,
    createdAt: new Date(data.created_at).getTime(),
    gridEnabled: data.grid_enabled,
    gridSize: data.grid_size,
    gridOpacity: Number(data.grid_opacity),
    uploadedBy: data.uploaded_by,
    isActive: data.is_active,
  } as StoredMap
}
