import { supabase } from '@/lib/supabase'
import type {
  CampaignEntryUnlock,
  CharacterCompanion,
  CompendiumEntry,
  CompanionKind,
  Fight,
  FightEntity,
  FightEntityType,
  FightStatus,
  InitiativeSubmission,
} from '@/lib/v3-types'

function randomInitiative(modifier = 0) {
  return Math.floor(Math.random() * 20) + 1 + modifier
}

function numberFromData(data: Record<string, unknown>, key: string, fallback = 0) {
  const value = data[key]
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : fallback
  }
  return fallback
}

function abilityModifier(score: number) {
  return Math.floor((score - 10) / 2)
}

export async function listCreatures() {
  const { data, error } = await supabase
    .from('compendium_entries')
    .select('id, type, subtype, slug, name, description, is_system, data, created_by, created_at')
    .eq('type', 'creature')
    .eq('subtype', 'monster')
    .order('name', { ascending: true })

  if (error) throw error
  return (data ?? []) as CompendiumEntry[]
}

export async function createCreature(input: Omit<CompendiumEntry, 'id' | 'created_at' | 'is_system' | 'type'>) {
  const { data, error } = await supabase
    .from('compendium_entries')
    .insert({
      type: 'creature',
      is_system: false,
      ...input,
    })
    .select('*')
    .single()

  if (error) throw error
  return data as CompendiumEntry
}

export async function updateCreature(id: string, patch: Partial<CompendiumEntry>) {
  const { data, error } = await supabase
    .from('compendium_entries')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw error
  return data as CompendiumEntry
}

export async function createFight(campaignId: string) {
  const { data, error } = await supabase
    .from('fights')
    .insert({ campaign_id: campaignId, is_active: true, status: 'draft' })
    .select('id, campaign_id, is_active, status, created_at')
    .single()

  if (error) throw error
  return data as Fight
}

export async function getActiveFight(campaignId: string) {
  const { data, error } = await supabase
    .from('fights')
    .select('id, campaign_id, is_active, status, created_at')
    .eq('campaign_id', campaignId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return (data ?? null) as Fight | null
}

export async function getOrCreateActiveFight(campaignId: string) {
  const existing = await getActiveFight(campaignId)
  if (existing && existing.status !== 'ended') return existing
  return createFight(campaignId)
}

export async function addFightEntity(input: {
  fightId: string
  entityType: FightEntityType
  name: string
  characterId?: string | null
  entryId?: string | null
  initiative?: number | null
  initiativeMod?: number | null
  currentHp?: number | null
  maxHp?: number | null
  notes?: string | null
}) {
  const { data, error } = await supabase
    .from('fight_entities')
    .insert({
      fight_id: input.fightId,
      entity_type: input.entityType,
      name: input.name,
      character_id: input.characterId ?? null,
      entry_id: input.entryId ?? null,
      initiative: input.initiative ?? null,
      initiative_mod: input.initiativeMod ?? 0,
      current_hp: input.currentHp ?? null,
      max_hp: input.maxHp ?? null,
      notes: input.notes ?? null,
    })
    .select('id, fight_id, entity_type, character_id, entry_id, name, initiative, initiative_mod, current_hp, max_hp, turn_order, notes, created_at')
    .single()

  if (error) throw error
  return data as FightEntity
}

export async function addMonsterToFight(fightId: string, entryId: string, name: string) {
  return addFightEntity({
    fightId,
    entryId,
    name,
    entityType: 'monster',
    initiative: randomInitiative(),
  })
}

export async function addCompendiumMonsterToActiveFight(campaignId: string, entry: CompendiumEntry) {
  let fight: Fight
  try {
    fight = await getOrCreateActiveFight(campaignId)
  } catch (error) {
    console.error('[fight:add] failed to resolve active fight', { campaignId, entryId: entry.id, error })
    throw error
  }

  const data = (entry.data ?? {}) as Record<string, unknown>
  const hp = numberFromData(data, 'hp', 0)
  const ac = numberFromData(data, 'ac', 0)
  const initiativeBonus = numberFromData(data, 'initiative_bonus', 0)
  const initiative = randomInitiative(initiativeBonus)

  try {
    const entity = await addFightEntity({
      fightId: fight.id,
      entityType: 'monster',
      entryId: entry.id,
      name: entry.name,
      currentHp: hp,
      maxHp: hp,
      initiative,
      notes: `ac:${ac}`,
    })
    await sortInitiative(fight.id)

    return { fight, entity }
  } catch (error) {
    console.error('[fight:add] failed to insert fight entity', { fightId: fight.id, entryId: entry.id, error })
    throw error
  }
}

export async function sortInitiative(fightId: string) {
  const { data, error } = await supabase
    .from('fight_entities')
    .select('id, fight_id, entity_type, character_id, entry_id, name, initiative, initiative_mod, current_hp, max_hp, turn_order, notes, created_at')
    .eq('fight_id', fightId)
    .order('initiative', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: true })

  if (error) throw error

  const entities = (data ?? []) as FightEntity[]
  await Promise.all(
    entities.map((entity, index) =>
      supabase
        .from('fight_entities')
        .update({ turn_order: index + 1 })
        .eq('id', entity.id)
    )
  )

  return entities.map((entity, index) => ({ ...entity, turn_order: index + 1 }))
}

export async function advanceTurn(fightId: string) {
  const { data, error } = await supabase
    .from('fight_entities')
    .select('id, fight_id, entity_type, character_id, entry_id, name, initiative, initiative_mod, current_hp, max_hp, turn_order, notes, created_at')
    .eq('fight_id', fightId)
    .order('turn_order', { ascending: true })

  if (error) throw error
  let entities = (data ?? []) as FightEntity[]
  if (entities.length === 0) return []
  if (entities.some((entity) => !entity.turn_order)) {
    entities = await sortInitiative(fightId)
  }

  const [first, ...rest] = entities
  const rotated = [...rest, first]

  await Promise.all(
    rotated.map((entity, index) =>
      supabase.from('fight_entities').update({ turn_order: index + 1 }).eq('id', entity.id)
    )
  )

  return rotated
}

export async function updateHP(entityId: string, currentHp: number) {
  const { data, error } = await supabase
    .from('fight_entities')
    .update({ current_hp: currentHp })
    .eq('id', entityId)
    .select('id, fight_id, entity_type, character_id, entry_id, name, initiative, initiative_mod, current_hp, max_hp, turn_order, notes, created_at')
    .single()

  if (error) throw error
  return data as FightEntity
}

export async function updateFightEntityNotes(entityId: string, notes: string) {
  const { data, error } = await supabase
    .from('fight_entities')
    .update({ notes })
    .eq('id', entityId)
    .select('id, fight_id, entity_type, character_id, entry_id, name, initiative, initiative_mod, current_hp, max_hp, turn_order, notes, created_at')
    .single()

  if (error) throw error
  return data as FightEntity
}

export async function moveFightTurnToEnd(entityId: string, turnOrder: number) {
  const { error } = await supabase
    .from('fight_entities')
    .update({ turn_order: turnOrder })
    .eq('id', entityId)

  if (error) throw error
}

export async function setFightEntityCurrentHp(entityId: string, currentHp: number) {
  const { error } = await supabase
    .from('fight_entities')
    .update({ current_hp: currentHp })
    .eq('id', entityId)

  if (error) throw error
}

export async function clearFightEntities(fightId: string) {
  const { error } = await supabase
    .from('fight_entities')
    .delete()
    .eq('fight_id', fightId)

  if (error) throw error
}

export async function removeEntity(entityId: string) {
  const { error } = await supabase
    .from('fight_entities')
    .delete()
    .eq('id', entityId)

  if (error) throw error
}

export async function getUnlockedCreatures(campaignId: string, playerId?: string) {
  let query = supabase
    .from('campaign_entry_unlocks')
    .select('id, campaign_id, entry_id, player_id, is_unlocked, created_at, compendium_entries(id, type, subtype, slug, name, description, is_system, data, created_by, created_at)')
    .eq('campaign_id', campaignId)
    .eq('is_unlocked', true)

  if (playerId) {
    query = query.or(`player_id.is.null,player_id.eq.${playerId}`)
  } else {
    query = query.is('player_id', null)
  }

  const { data, error } = await query
  if (error) throw error

  return (data ?? []).map((row) => ({
    ...row,
    compendium_entries: Array.isArray(row.compendium_entries) ? row.compendium_entries[0] : row.compendium_entries,
  })) as (CampaignEntryUnlock & { compendium_entries: CompendiumEntry })[]
}

export async function listCharacterCompanions(characterId: string) {
  const { data, error } = await supabase
    .from('character_companions')
    .select('id, character_id, entry_id, kind, name_override, notes, is_active, created_at')
    .eq('character_id', characterId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data ?? []) as CharacterCompanion[]
}

export async function assignCompanion(input: {
  characterId: string
  entryId: string
  kind: CompanionKind
  nameOverride?: string
  notes?: string
}) {
  const { data, error } = await supabase
    .from('character_companions')
    .insert({
      character_id: input.characterId,
      entry_id: input.entryId,
      kind: input.kind,
      name_override: input.nameOverride ?? null,
      notes: input.notes ?? null,
      is_active: true,
    })
    .select('id, character_id, entry_id, kind, name_override, notes, is_active, created_at')
    .single()

  if (error) throw error
  return data as CharacterCompanion
}

export async function activateCompanion(companionId: string, isActive: boolean) {
  const { data, error } = await supabase
    .from('character_companions')
    .update({ is_active: isActive })
    .eq('id', companionId)
    .select('id, character_id, entry_id, kind, name_override, notes, is_active, created_at')
    .single()

  if (error) throw error
  return data as CharacterCompanion
}

export async function startCombat(fightId: string, submissions: InitiativeSubmission[]) {
  await Promise.all(
    submissions.map((submission) =>
      supabase
        .from('fight_entities')
        .update({ initiative: submission.roll + submission.modifier })
        .eq('fight_id', fightId)
        .eq('character_id', submission.characterId)
    )
  )

  return sortInitiative(fightId)
}

export async function addPlayerToFight(input: {
  fightId: string
  characterId: string
  name: string
  modifier?: number
  currentHp?: number | null
  maxHp?: number | null
}) {
  return addFightEntity({
    fightId: input.fightId,
    entityType: 'player',
    characterId: input.characterId,
    name: input.name,
    initiative: randomInitiative(input.modifier ?? 0),
    currentHp: input.currentHp ?? null,
    maxHp: input.maxHp ?? null,
  })
}

export async function listFightEntities(fightId: string) {
  const { data, error } = await supabase
    .from('fight_entities')
    .select('id, fight_id, entity_type, character_id, entry_id, name, initiative, initiative_mod, current_hp, max_hp, turn_order, notes, created_at')
    .eq('fight_id', fightId)
    .order('turn_order', { ascending: true, nullsFirst: false })
    .order('initiative', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data ?? []) as FightEntity[]
}

export async function setFightStatus(fightId: string, status: FightStatus) {
  const { data, error } = await supabase
    .from('fights')
    .update({ status })
    .eq('id', fightId)
    .select('id, campaign_id, is_active, status, created_at')
    .single()

  if (error) throw error
  return data as Fight
}

export async function createOrGetDraftFight(campaignId: string) {
  const existing = await getActiveFight(campaignId)
  if (existing) return existing
  return createFight(campaignId)
}

export async function preparePlayerEntitiesForFight(fightId: string) {
  const [{ data: existingEntities, error: existingError }, { data: characters, error: charactersError }] = await Promise.all([
    supabase
      .from('fight_entities')
      .select('character_id')
      .eq('fight_id', fightId)
      .eq('entity_type', 'player'),
    supabase
      .from('characters')
      .select('id, user_id, name, hp_current, hp_max, dex_score'),
  ])

  if (existingError) throw existingError
  if (charactersError) throw charactersError

  const existingCharacterIds = new Set((existingEntities ?? []).map((entity) => entity.character_id).filter(Boolean))
  const rowsToInsert = (characters ?? [])
    .filter((character) => !existingCharacterIds.has(character.id))
    .map((character) => ({
      fight_id: fightId,
      entity_type: 'player',
      character_id: character.id,
      name: character.name || 'Player',
      initiative: null,
      initiative_mod: abilityModifier(character.dex_score ?? 10),
      current_hp: character.hp_current ?? 0,
      max_hp: character.hp_max ?? 0,
      notes: null as string | null,
    }))

  if (rowsToInsert.length === 0) return

  const { error } = await supabase.from('fight_entities').insert(rowsToInsert)
  if (error) throw error
}

export async function startCombatForCampaign(campaignId: string) {
  const fight = await createOrGetDraftFight(campaignId)
  await preparePlayerEntitiesForFight(fight.id)
  await setFightStatus(fight.id, 'active')
  await sortInitiative(fight.id)
  return fight
}

export async function endCombatForFight(fightId: string) {
  return setFightStatus(fightId, 'ended')
}

export async function getPendingInitiativeForUser(userId: string) {
  const { data: character, error: characterError } = await supabase
    .from('characters')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle()

  if (characterError) throw characterError
  if (!character?.id) return null

  const { data, error } = await supabase
    .from('fight_entities')
    .select('id, fight_id, initiative_mod, fights!inner(id, status)')
    .eq('character_id', character.id)
    .eq('entity_type', 'player')
    .is('initiative', null)
    .eq('fights.status', 'active')
    .limit(1)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  return { entityId: data.id as string, fightId: data.fight_id as string, initiativeMod: data.initiative_mod as number }
}

export async function submitPlayerInitiative(entityId: string, roll: number) {
  const { data, error } = await supabase
    .from('fight_entities')
    .select('id, fight_id, initiative_mod')
    .eq('id', entityId)
    .single()

  if (error) throw error

  const finalInitiative = roll + (data.initiative_mod ?? 0)
  const { error: updateError } = await supabase
    .from('fight_entities')
    .update({ initiative: finalInitiative })
    .eq('id', entityId)

  if (updateError) throw updateError

  await sortInitiative(data.fight_id)
  return finalInitiative
}
