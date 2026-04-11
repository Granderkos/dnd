'use client'

import { emptyCharacter, emptyInventory, emptySpellbook } from './auth-types'
import { calculateModifier, calculateSpellAttackBonus, calculateSpellSaveDC } from './dnd-types'
import type { Character, Inventory, Spellbook } from './dnd-types'
import type { Note } from '@/components/dnd/notes'
import { supabase } from './supabase'
import { generateClientId } from './client-id'

export interface ItemTemplate {
  id: string
  name: string
  description: string | null
  category: string | null
  item_kind: string | null
  item_subtype: string | null
  rarity: string | null
  weight: number | null
  value_text: string | null
  damage_text: string | null
  damage_type: string | null
  range_text: string | null
  weapon_kind: string | null
  armor_kind: string | null
  ac_base: number | null
  ac_bonus: number | null
  dex_cap: number | null
  strength_requirement: number | null
  stealth_disadvantage: boolean | null
  source_url: string | null
  requires_attunement: boolean
  capacity_text: string | null
  contents_summary: string | null
  charges_max: number | null
  charges_current: number | null
  usage_type: string | null
  properties: unknown
  tags: unknown
}

export interface CreateItemTemplateInput {
  name: string
  description?: string | null
  category: string
  item_kind: string
  item_subtype?: string | null
  rarity?: string | null
  weight?: number | null
  value_text?: string | null
  damage_text?: string | null
  damage_type?: string | null
  range_text?: string | null
  armor_kind?: string | null
  ac_base?: number | null
  charges_max?: number | null
  charges_current?: number | null
  usage_type?: string | null
  properties?: unknown
  tags?: unknown
}

export interface SpellTemplate {
  id: string
  name: string
  level: number
  school: string
  casting_time: string
  range_text: string
  duration_text: string
  concentration: boolean
  ritual: boolean
  description: string
  higher_level_text: string | null
  save_type: string | null
  attack_type: string | null
}

export interface ClassTemplate {
  id: string
  name: string
  hit_die: string
  primary_ability: string | null
  saving_throw_proficiencies: string
  armor_proficiencies: string
  weapon_proficiencies: string
  tool_proficiencies: string
  short_description: string | null
  feature_summary: string | null
}

export interface RaceTemplate {
  id: string
  name: string
  size: string | null
  speed: number | null
  ability_bonuses: Record<string, unknown>
  traits: unknown
  languages: string
  short_description: string | null
}

export interface BackgroundTemplate {
  id: string
  name: string
  skill_proficiencies: string
  tool_proficiencies: string
  language_proficiencies: string
  equipment_summary: string | null
  feature_summary: string | null
  short_description: string | null
}

const characterSaveQueue = new Map<string, Promise<void>>()
const characterBlobCache = new Map<string, CharacterNotesBlob>()
const portraitUploadCache = new Map<string, string>()
const templateQueryCache = new Map<string, { expiresAt: number; data: unknown[] }>()
const characterSaveSignatures = new Map<string, {
  row: string
  attacks: string
  inventory: string
  spells: string
  blob: string
}>()
const INVENTORY_CATEGORIES = new Set(['Weapons', 'Armor', 'Equipment', 'Tools', 'Consumables', 'Supplies', 'Treasure', 'Other'])
const TEMPLATE_CACHE_TTL_MS = 5 * 60 * 1000

function normalizeInventoryCategory(value: string | null | undefined): string {
  const normalized = (value ?? '').trim().toLowerCase()
  if (!normalized) return 'Other'
  if (['weapon', 'weapons'].includes(normalized)) return 'Weapons'
  if (['armor', 'armour'].includes(normalized)) return 'Armor'
  if (['equipment', 'gear'].includes(normalized)) return 'Equipment'
  if (['tool', 'tools', 'kit', 'kits'].includes(normalized)) return 'Tools'
  if (['consumable', 'consumables', 'potion', 'potions'].includes(normalized)) return 'Consumables'
  if (['supply', 'supplies'].includes(normalized)) return 'Supplies'
  if (['treasure', 'treasures', 'loot'].includes(normalized)) return 'Treasure'
  if (INVENTORY_CATEGORIES.has(value ?? '')) return value as string
  return 'Other'
}

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

async function withRetryQuery<T extends { error: { message?: string } | null }>(
  operation: () => Promise<T>,
  retries = 2,
  delayMs = 250
): Promise<T> {
  return withRetry(async () => {
    const result = await operation()
    if (result.error) {
      throw new Error(result.error.message ?? 'Query failed')
    }
    return result
  }, retries, delayMs)
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
  portraitOriginalUrl?: string
  featuresText?: string
  raceFeatures?: string
  classFeatures?: string
  backgroundFeatures?: string
}

const characterSelectColumnsBase = 'id, name, class_name, subclass, race, background, alignment, level, xp, proficiency_bonus, armor_class, initiative, speed, hp_max, hp_current, hp_temp, hit_dice_type, death_successes, death_failures, str_score, dex_score, con_score, int_score, wis_score, cha_score, save_str_prof, save_dex_prof, save_con_prof, save_int_prof, save_wis_prof, save_cha_prof, skill_acrobatics_prof, skill_animal_handling_prof, skill_arcana_prof, skill_athletics_prof, skill_deception_prof, skill_history_prof, skill_insight_prof, skill_intimidation_prof, skill_investigation_prof, skill_medicine_prof, skill_nature_prof, skill_perception_prof, skill_performance_prof, skill_persuasion_prof, skill_religion_prof, skill_sleight_of_hand_prof, skill_stealth_prof, skill_survival_prof, features, languages, portrait_preview_url'
const characterSelectColumnsWithOriginal = `${characterSelectColumnsBase}, portrait_original_url`
const characterSelectColumnsWithTemplates = `${characterSelectColumnsWithOriginal}, source_class_template_id, source_race_template_id, source_background_template_id, class_source_origin, race_source_origin, background_source_origin, class_template_snapshot, race_template_snapshot, background_template_snapshot`
const inventoryColumnsBase = 'id, client_id, title, quantity, description, category, parent_client_id'
const inventoryColumnsLegacyBase = 'id, client_id, title, quantity, description, category'
const inventoryColumnsWithTemplate = `${inventoryColumnsBase}, source_item_template_id, source_origin, template_snapshot`
const inventoryColumnsWithTemplateLegacyParent = `${inventoryColumnsLegacyBase}, source_item_template_id, source_origin, template_snapshot`

function isMissingColumnError(error: unknown, columnName: string) {
  const message = typeof error === 'object' && error !== null && 'message' in error
    ? String((error as { message?: unknown }).message ?? '')
    : String(error ?? '')
  return message.includes(columnName) && (message.includes('column') || message.includes('schema cache'))
}

function isDataUrl(value: string | null | undefined) {
  return typeof value === 'string' && value.startsWith('data:')
}

async function uploadPortraitDataUrl(userId: string, characterId: string, kind: 'preview' | 'original', dataUrl: string) {
  const cached = portraitUploadCache.get(dataUrl)
  if (cached) return cached

  const response = await fetch(dataUrl)
  const blob = await response.blob()
  const mime = blob.type || 'image/jpeg'
  const ext = mime.includes('webp') ? 'webp' : mime.includes('png') ? 'png' : 'jpg'
  const filePath = `${userId}/${characterId}/${kind}-${Date.now()}.${ext}`
  const bucket = supabase.storage.from('portraits')
  const { error } = await bucket.upload(filePath, blob, {
    upsert: true,
    contentType: mime,
    cacheControl: '31536000',
  })
  if (error) throw error
  const { data } = bucket.getPublicUrl(filePath)
  portraitUploadCache.set(dataUrl, data.publicUrl)
  return data.publicUrl
}

const skillColumnByName: Record<string, string> = {
  Acrobatics: 'skill_acrobatics_prof',
  'Animal Handling': 'skill_animal_handling_prof',
  Arcana: 'skill_arcana_prof',
  Athletics: 'skill_athletics_prof',
  Deception: 'skill_deception_prof',
  History: 'skill_history_prof',
  Insight: 'skill_insight_prof',
  Intimidation: 'skill_intimidation_prof',
  Investigation: 'skill_investigation_prof',
  Medicine: 'skill_medicine_prof',
  Nature: 'skill_nature_prof',
  Perception: 'skill_perception_prof',
  Performance: 'skill_performance_prof',
  Persuasion: 'skill_persuasion_prof',
  Religion: 'skill_religion_prof',
  'Sleight of Hand': 'skill_sleight_of_hand_prof',
  Stealth: 'skill_stealth_prof',
  Survival: 'skill_survival_prof',
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
  const insertPayload = {
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
    portrait_preview_url: '',
    portrait_original_url: '',
  }

  let insertQuery = supabase
    .from('characters')
    .insert(insertPayload)
    .select('id')
    .single()
  let { data, error } = await insertQuery
  if (error && isMissingColumnError(error, 'portrait_original_url')) {
    const { portrait_original_url, ...legacyInsertPayload } = insertPayload
    insertQuery = supabase.from('characters').insert(legacyInsertPayload).select('id').single()
    ;({ data, error } = await insertQuery)
  }

  if (error) throw error
  if (!data?.id) throw new Error('Failed to create character record')

  await supabase.from('character_notes').upsert({
    character_id: data?.id,
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
  const cached = characterBlobCache.get(characterId)
  if (cached) return cached
  const { data, error } = await supabase
    .from('character_notes')
    .select('notes')
    .eq('character_id', characterId)
    .maybeSingle()

  if (error) throw error
  const parsed = safeJsonParse<CharacterNotesBlob>(data?.notes, emptyBlob())
  characterBlobCache.set(characterId, parsed)
  return parsed
}

async function upsertCharacterBlob(characterId: string, blob: CharacterNotesBlob) {
  const { error } = await supabase.from('character_notes').upsert({
    character_id: characterId,
    notes: notesBlobToText(blob),
  })
  if (error) throw error
  characterBlobCache.set(characterId, blob)
}

export async function loadCurrentPlayerData(userId: string): Promise<{ character: Character; spellbook: Spellbook; inventory: Inventory; notes: Note[] }> {
  const t0 = Date.now()
  const characterId = await ensureCharacterRecord(userId)
  const charSelectWithFallback = async () => {
    const withTemplates = await supabase
      .from('characters')
      .select(characterSelectColumnsWithTemplates)
      .eq('id', characterId)
      .single()
    if (!withTemplates.error || !isMissingColumnError(withTemplates.error, 'source_class_template_id')) return withTemplates

    const withOriginal = await supabase
      .from('characters')
      .select(characterSelectColumnsWithOriginal)
      .eq('id', characterId)
      .single()
    if (!withOriginal.error || !isMissingColumnError(withOriginal.error, 'portrait_original_url')) return withOriginal
    return supabase
      .from('characters')
      .select(characterSelectColumnsBase)
      .eq('id', characterId)
      .single()
  }

  const inventoryQuery = async () => {
    const withTemplateFields = await supabase
      .from('inventory_items')
      .select(inventoryColumnsWithTemplate)
      .eq('character_id', characterId)
      .order('sort_order', { ascending: true })
    if (!withTemplateFields.error) return withTemplateFields
    if (isMissingColumnError(withTemplateFields.error, 'parent_client_id')) {
      const withLegacyParent = await supabase
        .from('inventory_items')
        .select(inventoryColumnsWithTemplateLegacyParent)
        .eq('character_id', characterId)
        .order('sort_order', { ascending: true })
      if (!withLegacyParent.error || !isMissingColumnError(withLegacyParent.error, 'source_item_template_id')) return withLegacyParent
    }
    if (!isMissingColumnError(withTemplateFields.error, 'source_item_template_id')) return withTemplateFields
    return supabase
      .from('inventory_items')
      .select(inventoryColumnsLegacyBase)
      .eq('character_id', characterId)
      .order('sort_order', { ascending: true })
  }

  const spellsQuery = async () => {
    const withTemplateFields = await supabase
      .from('spells')
      .select('id, client_id, title, is_cantrip, is_ritual, is_concentration, is_reaction, casting_time, range_text, duration_text, description, dice, spell_level, source_spell_template_id, source_origin, template_snapshot')
      .eq('character_id', characterId)
      .order('sort_order', { ascending: true })
    if (!withTemplateFields.error || !isMissingColumnError(withTemplateFields.error, 'source_spell_template_id')) return withTemplateFields
    return supabase
      .from('spells')
      .select('id, client_id, title, is_cantrip, is_ritual, is_concentration, is_reaction, casting_time, range_text, duration_text, description, dice, spell_level')
      .eq('character_id', characterId)
      .order('sort_order', { ascending: true })
  }

  const [{ data: row, error: charError }, { data: attacksData, error: attacksError }, { data: inventoryData, error: inventoryError }, { data: spellsData, error: spellsError }, blob] = await Promise.all([
    charSelectWithFallback(),
    supabase.from('attacks').select('id, name, attack_bonus, damage').eq('character_id', characterId).order('sort_order', { ascending: true }),
    inventoryQuery(),
    spellsQuery(),
    getCharacterBlob(characterId),
  ])

  if (charError) throw charError
  if (attacksError) throw attacksError
  if (inventoryError) throw inventoryError
  if (spellsError) throw spellsError

  const skills = emptyCharacter.skills.map((skill) => {
    const skillColumn = skillColumnByName[skill.name]
    return {
      ...skill,
      proficient: skillColumn ? Boolean(row[skillColumn as keyof typeof row]) : false,
    }
  })

  const hasNormalizedSpells = Boolean(spellsData?.length)
  const hasNormalizedInventory = Boolean(inventoryData?.length)
  const hasNormalizedAttacks = Boolean(attacksData?.length)
  const hasSeparatedFeatures = Boolean(blob.raceFeatures || blob.classFeatures || blob.backgroundFeatures)
  const fallbackSpellEntries = blob.spellbookEntries ?? emptyBlob().spellbookEntries ?? { cantrips: [], spells: [] }

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
      portraitUrl: blob.portraitUrl || row.portrait_preview_url || '',
      portraitOriginalUrl: blob.portraitOriginalUrl || (row as { portrait_original_url?: string | null }).portrait_original_url || '',
      sourceClassTemplateId: (row as { source_class_template_id?: string | null }).source_class_template_id ?? null,
      sourceRaceTemplateId: (row as { source_race_template_id?: string | null }).source_race_template_id ?? null,
      sourceBackgroundTemplateId: (row as { source_background_template_id?: string | null }).source_background_template_id ?? null,
      classSourceOrigin: ((row as { class_source_origin?: 'custom' | 'template' | null }).class_source_origin ?? 'custom') === 'template' ? 'template' : 'custom',
      raceSourceOrigin: ((row as { race_source_origin?: 'custom' | 'template' | null }).race_source_origin ?? 'custom') === 'template' ? 'template' : 'custom',
      backgroundSourceOrigin: ((row as { background_source_origin?: 'custom' | 'template' | null }).background_source_origin ?? 'custom') === 'template' ? 'template' : 'custom',
      classTemplateSnapshot: ((row as { class_template_snapshot?: Record<string, unknown> | null }).class_template_snapshot ?? null),
      raceTemplateSnapshot: ((row as { race_template_snapshot?: Record<string, unknown> | null }).race_template_snapshot ?? null),
      backgroundTemplateSnapshot: ((row as { background_template_snapshot?: Record<string, unknown> | null }).background_template_snapshot ?? null),
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
    attacks: (hasNormalizedAttacks ? (attacksData ?? []).map((attack) => {
      const damageText = attack.damage ?? ''
      const [damage = '', ...damageType] = damageText.split(' ')
      return {
        id: attack.id,
        name: attack.name ?? '',
        attackBonus: attack.attack_bonus ?? '',
        damage,
        damageType: damageType.join(' '),
      }
    }) : []),
    attackNotes: '',
    raceFeatures: hasSeparatedFeatures ? (blob.raceFeatures ?? '') : '',
    classFeatures: hasSeparatedFeatures ? (blob.classFeatures ?? '') : (row.features ?? blob.featuresText ?? ''),
    backgroundFeatures: hasSeparatedFeatures ? (blob.backgroundFeatures ?? '') : '',
    languages: row.languages ?? '',
    passivePerception: 10,
  }
  character.passivePerception = 10 + getPerceptionModifier(character)

  const spellMeta = blob.spellbookMeta ?? emptyBlob().spellbookMeta
  const spellAbility = spellMeta.spellcastingAbility
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
      prepared: true,
      sourceSpellTemplateId: (s as { source_spell_template_id?: string | null }).source_spell_template_id ?? null,
      sourceOrigin: (s as { source_origin?: string | null }).source_origin === 'template' ? 'template' : 'custom',
      templateSnapshot: ((s as { template_snapshot?: Record<string, unknown> | null }).template_snapshot ?? null),
    })) : fallbackSpellEntries.cantrips ?? []),
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
      prepared: true,
      sourceSpellTemplateId: (s as { source_spell_template_id?: string | null }).source_spell_template_id ?? null,
      sourceOrigin: (s as { source_origin?: string | null }).source_origin === 'template' ? 'template' : 'custom',
      templateSnapshot: ((s as { template_snapshot?: Record<string, unknown> | null }).template_snapshot ?? null),
    })) : []),
    slots: spellMeta.slots ?? emptySpellbook.slots,
  }

  const inventory: Inventory = {
    items: (hasNormalizedInventory ? (inventoryData ?? []).map((item) => {
      const itemRecord = item as Record<string, unknown>
      const normalizedId = item.client_id ?? item.id
      return {
        id: normalizedId,
        name: item.title,
        quantity: item.quantity,
        description: item.description,
        category: normalizeInventoryCategory(typeof item.category === 'string' ? item.category : null),
        parentItemId: typeof itemRecord.parent_client_id === 'string' ? itemRecord.parent_client_id : null,
        sourceItemTemplateId: 'source_item_template_id' in itemRecord ? itemRecord.source_item_template_id as string | null : null,
        sourceOrigin: (typeof itemRecord.source_origin === 'string' && itemRecord.source_origin === 'template')
          ? 'template'
          : 'custom',
        templateSnapshot: 'template_snapshot' in itemRecord && itemRecord.template_snapshot && typeof itemRecord.template_snapshot === 'object'
          ? itemRecord.template_snapshot as Record<string, unknown>
          : null,
      }
    }) : []),
    currency: blob.inventoryCurrency ?? emptyInventory.currency,
  }

  console.log('[perf]', 'loadCurrentPlayerData', Date.now() - t0)
  return {
    character,
    spellbook,
    inventory,
    notes: [],
  }
}

export async function loadCurrentPlayerNotes(userId: string): Promise<Note[]> {
  const t0 = Date.now()
  const characterId = await ensureCharacterRecord(userId)
  const blob = await getCharacterBlob(characterId)
  console.log('[perf]', 'loadCurrentPlayerNotes', Date.now() - t0)
  return blob.notes || []
}

export async function saveCurrentPlayerData(userId: string, payload: { character: Character; spellbook: Spellbook; inventory: Inventory; notes?: Note[] }) {
  const characterId = await ensureCharacterRecord(userId)
  const previous = characterSaveQueue.get(characterId) ?? Promise.resolve()
  const saveTask = previous.then(async () => {
    const startedAt = Date.now()
    const timings: Partial<Record<'attacksMs' | 'inventoryMs' | 'spellsMs' | 'blobMs' | 'rowMs', number>> = {}
    const { character, spellbook, inventory, notes } = payload
    const spellcastingScore = character.abilities[spellbook.spellcastingAbility]?.value ?? 10
    const derivedSpellSaveDC = calculateSpellSaveDC(character.proficiencyBonus, spellcastingScore)
    const derivedSpellAttackBonus = calculateSpellAttackBonus(character.proficiencyBonus, spellcastingScore)
    const initiativeModifier = calculateModifier(character.abilities.DEX.value)
    const initiativeRoll = character.combat.initiativeRoll ?? 0
    const initiativeTotal = initiativeModifier + initiativeRoll

    const existingBlob = notes ? null : await getCharacterBlob(characterId)
    const persistedNotes = notes ?? existingBlob?.notes ?? []
    const portraitPreviewUrl = isDataUrl(character.info.portraitUrl)
      ? await uploadPortraitDataUrl(userId, characterId, 'preview', character.info.portraitUrl as string)
      : (character.info.portraitUrl ?? '')
    const portraitOriginalUrl = isDataUrl(character.info.portraitOriginalUrl)
      ? await uploadPortraitDataUrl(userId, characterId, 'original', character.info.portraitOriginalUrl as string)
      : (character.info.portraitOriginalUrl ?? null)

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
      features: character.classFeatures ?? '',
      languages: character.languages,
      portrait_preview_url: portraitPreviewUrl,
      portrait_original_url: portraitOriginalUrl,
      source_class_template_id: character.info.sourceClassTemplateId ?? null,
      source_race_template_id: character.info.sourceRaceTemplateId ?? null,
      source_background_template_id: character.info.sourceBackgroundTemplateId ?? null,
      class_source_origin: character.info.classSourceOrigin === 'template' ? 'template' : 'custom',
      race_source_origin: character.info.raceSourceOrigin === 'template' ? 'template' : 'custom',
      background_source_origin: character.info.backgroundSourceOrigin === 'template' ? 'template' : 'custom',
      class_template_snapshot: character.info.classTemplateSnapshot ?? null,
      race_template_snapshot: character.info.raceTemplateSnapshot ?? null,
      background_template_snapshot: character.info.backgroundTemplateSnapshot ?? null,
    }

    const allSpells = [...spellbook.cantrips.map((s) => ({ ...s, level: 0 })), ...spellbook.spells]
    const normalizedInventory = inventory.items.map((item) => ({
      ...item,
      quantity: Number.isFinite(item.quantity) ? Math.max(0, Math.floor(item.quantity)) : 0,
    }))

    const blobPayload: CharacterNotesBlob = {
      notes: persistedNotes,
      inventoryCurrency: inventory.currency,
      inventoryItems: normalizedInventory,
      spellbookMeta: {
        spellcastingClass: spellbook.spellcastingClass,
        spellcastingAbility: spellbook.spellcastingAbility,
        spellSaveDC: derivedSpellSaveDC,
        spellAttackBonus: derivedSpellAttackBonus,
        slots: spellbook.slots,
      },
      featuresText: [character.raceFeatures, character.classFeatures, character.backgroundFeatures].filter(Boolean).join('\n'),
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

    try {
      if (!previousSignatures || previousSignatures.attacks !== signatures.attacks) {
        const tSection = Date.now()
        const { error: attacksDeleteError } = await supabase.from('attacks').delete().eq('character_id', characterId)
        if (attacksDeleteError) throw new Error(`attacks.delete: ${attacksDeleteError.message ?? 'failed'}`)

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
          if (error) throw new Error(`attacks.insert: ${error.message ?? 'failed'}`)
        }
        timings.attacksMs = Date.now() - tSection
      }

      if (!previousSignatures || previousSignatures.inventory !== signatures.inventory) {
        const tSection = Date.now()
        await syncInventoryRows(characterId, normalizedInventory)
        timings.inventoryMs = Date.now() - tSection
      }
      if (!previousSignatures || previousSignatures.spells !== signatures.spells) {
        const tSection = Date.now()
        await syncSpellRows(characterId, allSpells)
        timings.spellsMs = Date.now() - tSection
      }
      if (!previousSignatures || previousSignatures.blob !== signatures.blob) {
        const tSection = Date.now()
        await upsertCharacterBlob(characterId, blobPayload)
        timings.blobMs = Date.now() - tSection
      }
      if (!previousSignatures || previousSignatures.row !== signatures.row) {
        const tSection = Date.now()
        let { error: characterUpsertError } = await supabase.from('characters').upsert(row, { onConflict: 'id' })
        if (characterUpsertError && isMissingColumnError(characterUpsertError, 'source_class_template_id')) {
          const {
            source_class_template_id,
            source_race_template_id,
            source_background_template_id,
            class_source_origin,
            race_source_origin,
            background_source_origin,
            class_template_snapshot,
            race_template_snapshot,
            background_template_snapshot,
            ...legacyTemplateRow
          } = row
          ;({ error: characterUpsertError } = await supabase.from('characters').upsert(legacyTemplateRow, { onConflict: 'id' }))
        }
        if (characterUpsertError && isMissingColumnError(characterUpsertError, 'portrait_original_url')) {
          const { portrait_original_url, ...legacyRow } = row
          ;({ error: characterUpsertError } = await supabase.from('characters').upsert(legacyRow, { onConflict: 'id' }))
        }
        if (characterUpsertError) throw new Error(`characters.upsert: ${characterUpsertError.message ?? 'failed'}`)
        const { error: fightEntitySyncError } = await supabase
          .from('fight_entities')
          .update({
            current_hp: character.combat.currentHp,
            max_hp: character.combat.maxHp,
          })
          .eq('entity_type', 'player')
          .eq('character_id', characterId)
        if (fightEntitySyncError) throw new Error(`fight_entities.update: ${fightEntitySyncError.message ?? 'failed'}`)
        timings.rowMs = Date.now() - tSection
      }
    } catch (error) {
      console.log('[perf] saveCurrentPlayerData:failed', {
        characterId,
        totalMs: Date.now() - startedAt,
        timings,
      })
      throw new Error(`[saveCurrentPlayerData] ${error instanceof Error ? error.message : String(error)}`)
    }

    console.log('[perf] saveCurrentPlayerData', {
      characterId,
      totalMs: Date.now() - startedAt,
      timings,
      changed: {
        row: !previousSignatures || previousSignatures.row !== signatures.row,
        attacks: !previousSignatures || previousSignatures.attacks !== signatures.attacks,
        inventory: !previousSignatures || previousSignatures.inventory !== signatures.inventory,
        spells: !previousSignatures || previousSignatures.spells !== signatures.spells,
        blob: !previousSignatures || previousSignatures.blob !== signatures.blob,
      },
    })
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
    category: normalizeInventoryCategory(item.category),
    parent_client_id: item.parentItemId ?? null,
    source_item_template_id: item.sourceItemTemplateId ?? null,
    source_origin: item.sourceOrigin === 'template' ? 'template' : 'custom',
    template_snapshot: item.templateSnapshot ?? null,
  }))
  let { error: upsertError } = await supabase
    .from('inventory_items')
    .upsert(rows, { onConflict: 'character_id,client_id' })
  if (upsertError && isMissingColumnError(upsertError, 'parent_client_id')) {
    const legacyRows = rows.map(({ parent_client_id, ...legacyRow }) => legacyRow)
    ;({ error: upsertError } = await supabase
      .from('inventory_items')
      .upsert(legacyRows, { onConflict: 'character_id,client_id' }))
  }
  if (upsertError && isMissingColumnError(upsertError, 'source_item_template_id')) {
    const legacyRows = rows.map(({ parent_client_id, source_item_template_id, source_origin, template_snapshot, ...legacyRow }) => legacyRow)
    ;({ error: upsertError } = await supabase
      .from('inventory_items')
      .upsert(legacyRows, { onConflict: 'character_id,client_id' }))
  }
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

export async function listItemTemplates() {
  const cached = templateQueryCache.get('item_templates')
  if (cached && cached.expiresAt > Date.now()) return cached.data as ItemTemplate[]
  const fullSelect = 'id, name, description, category, item_kind, item_subtype, rarity, weight, value_text, damage_text, damage_type, range_text, weapon_kind, armor_kind, ac_base, ac_bonus, dex_cap, strength_requirement, stealth_disadvantage, source_url, requires_attunement, capacity_text, contents_summary, charges_max, charges_current, usage_type, properties, tags'
  const legacySelect = 'id, name, description, category, item_kind, item_subtype, rarity, weight, value_text, damage_text, damage_type, range_text, weapon_kind, armor_kind, ac_base, ac_bonus, dex_cap, strength_requirement, stealth_disadvantage, source_url, requires_attunement, capacity_text, contents_summary, properties, tags'

  const fullResult = await supabase
    .from('item_templates')
    .select(fullSelect)
    .order('name', { ascending: true })
  let rows = fullResult.data as Record<string, unknown>[] | null
  let error = fullResult.error
  if (error && (isMissingColumnError(error, 'charges_max') || isMissingColumnError(error, 'charges_current') || isMissingColumnError(error, 'usage_type'))) {
    const legacyResult = await supabase
      .from('item_templates')
      .select(legacySelect)
      .order('name', { ascending: true })
    rows = legacyResult.data as Record<string, unknown>[] | null
    error = legacyResult.error
    if (!error) {
      rows = (rows ?? []).map((row) => ({
        ...row,
        charges_max: null,
        charges_current: null,
        usage_type: null,
      }))
    }
  }
  if (error) throw error
  const normalizedRows = (rows ?? []) as unknown as ItemTemplate[]
  templateQueryCache.set('item_templates', { expiresAt: Date.now() + TEMPLATE_CACHE_TTL_MS, data: normalizedRows as unknown[] })
  return normalizedRows
}

function slugifyTemplateName(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export async function createItemTemplate(userId: string, input: CreateItemTemplateInput) {
  const baseSlug = slugifyTemplateName(input.name) || 'custom-item'
  const slug = `${baseSlug}-${Date.now().toString(36)}`
  const { data, error } = await supabase
    .from('item_templates')
    .insert({
      slug,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      category: normalizeInventoryCategory(input.category),
      item_kind: input.item_kind,
      item_subtype: input.item_subtype ?? null,
      rarity: input.rarity ?? null,
      weight: input.weight ?? null,
      value_text: input.value_text?.trim() || null,
      damage_text: input.damage_text?.trim() || null,
      damage_type: input.damage_type?.trim() || null,
      range_text: input.range_text?.trim() || null,
      armor_kind: input.armor_kind ?? null,
      ac_base: input.ac_base ?? null,
      charges_max: input.charges_max ?? null,
      charges_current: input.charges_current ?? null,
      usage_type: input.usage_type ?? null,
      properties: input.properties ?? [],
      tags: input.tags ?? ['custom'],
      is_official: false,
      created_by: userId,
    })
    .select('id, name, description, category, item_kind, item_subtype, rarity, weight, value_text, damage_text, damage_type, range_text, weapon_kind, armor_kind, ac_base, ac_bonus, dex_cap, strength_requirement, stealth_disadvantage, source_url, requires_attunement, capacity_text, contents_summary, charges_max, charges_current, usage_type, properties, tags')
    .single()

  if (error) throw error
  templateQueryCache.delete('item_templates')
  return data as ItemTemplate
}

async function appendInventoryRow(
  characterId: string,
  payload: {
    title: string
    description: string
    quantity: number
    category: string
    sourceItemTemplateId?: string | null
    sourceOrigin?: 'template' | 'custom'
    templateSnapshot?: Record<string, unknown> | null
  }
) {
  const { data: lastRow, error: sortError } = await supabase
    .from('inventory_items')
    .select('sort_order')
    .eq('character_id', characterId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (sortError) throw sortError

  const row = {
    character_id: characterId,
    client_id: generateClientId(),
    sort_order: (lastRow?.sort_order ?? -1) + 1,
    title: payload.title,
    description: payload.description,
    quantity: Math.max(1, Math.floor(payload.quantity)),
    category: normalizeInventoryCategory(payload.category),
    parent_client_id: null as string | null,
    source_item_template_id: payload.sourceItemTemplateId ?? null,
    source_origin: payload.sourceOrigin ?? 'custom',
    template_snapshot: payload.templateSnapshot ?? null,
  }

  let { error } = await supabase.from('inventory_items').insert(row)
  if (error && isMissingColumnError(error, 'parent_client_id')) {
    const { parent_client_id, ...legacyRow } = row
    ;({ error } = await supabase.from('inventory_items').insert(legacyRow))
  }
  if (error && isMissingColumnError(error, 'source_item_template_id')) {
    const { parent_client_id, source_item_template_id, source_origin, template_snapshot, ...legacyRow } = row
    ;({ error } = await supabase.from('inventory_items').insert(legacyRow))
  }
  if (error) throw error
}

export async function grantItemTemplateToCharacter(characterId: string, template: ItemTemplate, quantity = 1) {
  const normalizedQuantity = Math.max(1, Math.floor(quantity))
  await appendInventoryRow(characterId, {
    title: template.name,
    description: template.description ?? '',
    quantity: normalizedQuantity,
    category: template.category ?? 'Other',
    sourceItemTemplateId: template.id,
    sourceOrigin: 'template',
    templateSnapshot: template as unknown as Record<string, unknown>,
  })
}

export async function grantCustomInventoryItemToCharacter(
  characterId: string,
  input: { name: string; description?: string; category?: string; quantity?: number }
) {
  await appendInventoryRow(characterId, {
    title: input.name,
    description: input.description ?? '',
    quantity: input.quantity ?? 1,
    category: input.category ?? 'Treasure',
    sourceOrigin: 'custom',
    templateSnapshot: null,
  })
}

export async function listSpellTemplates() {
  const cached = templateQueryCache.get('spell_templates')
  if (cached && cached.expiresAt > Date.now()) return cached.data as SpellTemplate[]
  const { data, error } = await supabase
    .from('spell_templates')
    .select('id, name, level, school, casting_time, range_text, duration_text, concentration, ritual, description, higher_level_text, save_type, attack_type')
    .order('level', { ascending: true })
    .order('name', { ascending: true })
  if (error) throw error
  const rows = (data ?? []) as SpellTemplate[]
  templateQueryCache.set('spell_templates', { expiresAt: Date.now() + TEMPLATE_CACHE_TTL_MS, data: rows as unknown[] })
  return rows
}

export async function listClassTemplates() {
  const cached = templateQueryCache.get('class_templates')
  if (cached && cached.expiresAt > Date.now()) return cached.data as ClassTemplate[]
  const { data, error } = await supabase
    .from('class_templates')
    .select('id, name, hit_die, primary_ability, saving_throw_proficiencies, armor_proficiencies, weapon_proficiencies, tool_proficiencies, short_description, feature_summary')
    .order('name', { ascending: true })
  if (error) throw error
  const rows = (data ?? []) as ClassTemplate[]
  templateQueryCache.set('class_templates', { expiresAt: Date.now() + TEMPLATE_CACHE_TTL_MS, data: rows as unknown[] })
  return rows
}

export async function listRaceTemplates() {
  const cached = templateQueryCache.get('race_templates')
  if (cached && cached.expiresAt > Date.now()) return cached.data as RaceTemplate[]
  const { data, error } = await supabase
    .from('race_templates')
    .select('id, name, size, speed, ability_bonuses, traits, languages, short_description')
    .order('name', { ascending: true })
  if (error) throw error
  const rows = (data ?? []) as RaceTemplate[]
  templateQueryCache.set('race_templates', { expiresAt: Date.now() + TEMPLATE_CACHE_TTL_MS, data: rows as unknown[] })
  return rows
}

export async function listBackgroundTemplates() {
  const cached = templateQueryCache.get('background_templates')
  if (cached && cached.expiresAt > Date.now()) return cached.data as BackgroundTemplate[]
  const { data, error } = await supabase
    .from('background_templates')
    .select('id, name, skill_proficiencies, tool_proficiencies, language_proficiencies, equipment_summary, feature_summary, short_description')
    .order('name', { ascending: true })
  if (error) throw error
  const rows = (data ?? []) as BackgroundTemplate[]
  templateQueryCache.set('background_templates', { expiresAt: Date.now() + TEMPLATE_CACHE_TTL_MS, data: rows as unknown[] })
  return rows
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
    source_spell_template_id: spell.sourceSpellTemplateId ?? null,
    source_origin: spell.sourceOrigin === 'template' ? 'template' : 'custom',
    template_snapshot: spell.templateSnapshot ?? null,
  }))
  let { error: upsertError } = await supabase
    .from('spells')
    .upsert(rows, { onConflict: 'character_id,client_id' })
  if (upsertError && isMissingColumnError(upsertError, 'source_spell_template_id')) {
    const legacyRows = rows.map(({ source_spell_template_id, source_origin, template_snapshot, ...legacyRow }) => legacyRow)
    ;({ error: upsertError } = await supabase
      .from('spells')
      .upsert(legacyRows, { onConflict: 'character_id,client_id' }))
  }
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
  const t0 = Date.now()
  const { data: players, error } = await supabase
    .from('profiles')
    .select('id, username')
    .eq('role', 'player')
    .order('created_at', { ascending: true })

  if (error) throw error
  const playerIds = (players ?? []).map((player) => player.id).filter(Boolean)
  if (playerIds.length === 0) return []

  const [{ data: characterRows, error: charactersError }, { data: activityRows, error: activityError }] = await Promise.all([
    supabase
      .from('characters')
      .select('id, user_id, name, class_name, subclass, race, background, alignment, level, xp, proficiency_bonus, armor_class, initiative, speed, hp_max, hp_current, hp_temp, hit_dice_type, str_score, dex_score, con_score, int_score, wis_score, cha_score, save_str_prof, save_dex_prof, save_con_prof, save_int_prof, save_wis_prof, save_cha_prof, features, languages, portrait_preview_url')
      .in('user_id', playerIds),
    supabase
      .from('activity_status')
      .select('user_id, last_seen, current_page, is_online')
      .in('user_id', playerIds),
  ])
  if (charactersError) throw charactersError
  if (activityError) throw activityError

  const characterByUserId = new Map((characterRows ?? []).map((row) => [row.user_id, row]))
  const activityByUserId = new Map((activityRows ?? []).map((row) => [row.user_id, row]))

  const results = (players ?? []).map((player) => {
    const row = characterByUserId.get(player.id)
    if (!row) {
      return { id: player.id, characterId: null, username: player.username, character: emptyCharacter, activity: activityByUserId.get(player.id) ?? null }
    }

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
        portraitUrl: row.portrait_preview_url ?? '',
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
      attacks: emptyCharacter.attacks,
      attackNotes: '',
      raceFeatures: '',
      classFeatures: row.features ?? '',
      backgroundFeatures: '',
      languages: row.languages ?? '',
      passivePerception: 10,
    }
    character.passivePerception = 10 + getPerceptionModifier(character)

    return {
      id: player.id,
      characterId: row.id,
      username: player.username,
      character,
      activity: activityByUserId.get(player.id) ?? null,
    }
  })

  console.log('[perf]', 'listPlayerCharacters', Date.now() - t0)
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
  const { data, error } = await supabase.from('dm_notes').select('content').order('created_at', { ascending: true }).limit(1)
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
  const { data, error } = await withRetryQuery(async () =>
    await supabase
      .from('maps')
      .select('id, name, storage_path, created_at, grid_enabled, grid_size, grid_opacity, uploaded_by, is_active')
      .order('created_at', { ascending: false })
  )
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
  }).select('id, name, storage_path, created_at, grid_enabled, grid_size, grid_opacity, uploaded_by, is_active').single()
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

export async function updateMapGridSettings(mapId: string, patch: Pick<StoredMap, 'gridEnabled' | 'gridSize' | 'gridOpacity'>) {
  const { data, error } = await supabase
    .from('maps')
    .update({
      grid_enabled: patch.gridEnabled ?? false,
      grid_size: patch.gridSize ?? 50,
      grid_opacity: patch.gridOpacity ?? 0.3,
    })
    .eq('id', mapId)
    .select('id, name, storage_path, created_at, grid_enabled, grid_size, grid_opacity, uploaded_by, is_active')
    .single()

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

export async function getActiveMap() {
  const { data, error } = await withRetryQuery(async () =>
    await supabase
      .from('maps')
      .select('id, name, storage_path, created_at, grid_enabled, grid_size, grid_opacity, uploaded_by, is_active')
      .eq('is_active', true)
      .maybeSingle()
  )
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
