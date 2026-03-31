import { supabase } from '@/lib/supabase'
import type {
  CampaignEntryUnlock,
  CharacterCompanion,
  CompendiumEntry,
  CompanionKind,
  Fight,
  FightEntity,
  FightEntityType,
  InitiativeSubmission,
} from '@/lib/v3-types'

function randomInitiative(modifier = 0) {
  return Math.floor(Math.random() * 20) + 1 + modifier
}

export async function listCreatures() {
  const { data, error } = await supabase
    .from('compendium_entries')
    .select('*')
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
    .insert({ campaign_id: campaignId, is_active: true })
    .select('*')
    .single()

  if (error) throw error
  return data as Fight
}

export async function addFightEntity(input: {
  fightId: string
  entityType: FightEntityType
  name: string
  characterId?: string | null
  entryId?: string | null
  initiative?: number | null
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
      current_hp: input.currentHp ?? null,
      max_hp: input.maxHp ?? null,
      notes: input.notes ?? null,
    })
    .select('*')
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

export async function sortInitiative(fightId: string) {
  const { data, error } = await supabase
    .from('fight_entities')
    .select('*')
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

  return entities
}

export async function advanceTurn(fightId: string) {
  const { data, error } = await supabase
    .from('fight_entities')
    .select('*')
    .eq('fight_id', fightId)
    .order('turn_order', { ascending: true })

  if (error) throw error
  const entities = (data ?? []) as FightEntity[]
  if (entities.length === 0) return []

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
    .select('*')
    .single()

  if (error) throw error
  return data as FightEntity
}

export async function updateFightEntityNotes(entityId: string, notes: string) {
  const { data, error } = await supabase
    .from('fight_entities')
    .update({ notes })
    .eq('id', entityId)
    .select('*')
    .single()

  if (error) throw error
  return data as FightEntity
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
    .select('*, compendium_entries(*)')
    .eq('campaign_id', campaignId)
    .eq('is_unlocked', true)

  if (playerId) {
    query = query.or(`player_id.is.null,player_id.eq.${playerId}`)
  } else {
    query = query.is('player_id', null)
  }

  const { data, error } = await query
  if (error) throw error

  return (data ?? []) as (CampaignEntryUnlock & { compendium_entries: CompendiumEntry })[]
}

export async function listCharacterCompanions(characterId: string) {
  const { data, error } = await supabase
    .from('character_companions')
    .select('*')
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
    .select('*')
    .single()

  if (error) throw error
  return data as CharacterCompanion
}

export async function activateCompanion(companionId: string, isActive: boolean) {
  const { data, error } = await supabase
    .from('character_companions')
    .update({ is_active: isActive })
    .eq('id', companionId)
    .select('*')
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
