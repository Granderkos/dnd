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

function activeSinceIso(minutes = 2) {
  return new Date(Date.now() - minutes * 60_000).toISOString()
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

export async function createCreature(input: {
  subtype: CompendiumEntry['subtype']
  slug: string
  name: string
  description?: string | null
  data?: Record<string, unknown>
}) {
  const { data, error } = await supabase
    .from('compendium_entries')
    .insert({
      type: 'creature',
      is_system: false,
      ...input,
    })
    .select('id, type, subtype, slug, name, description, is_system, data, created_by, created_at')
    .single()

  if (error) throw error
  return data as CompendiumEntry
}

function createSlug(value: string) {
  const normalized = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return normalized || `entry-${Date.now()}`
}

export async function createCompanionEntry(input: {
  name: string
  kind: CompanionKind
  description?: string
  data?: Record<string, unknown>
}) {
  const slug = `${createSlug(input.name)}-${Date.now()}`
  const { data, error } = await supabase
    .from('compendium_entries')
    .insert({
      type: 'companion',
      subtype: input.kind,
      slug,
      name: input.name,
      description: input.description ?? null,
      data: input.data ?? {},
      is_system: false,
    })
    .select('id, type, subtype, slug, name, description, data')
    .single()

  if (error) throw error
  return data as Pick<CompendiumEntry, 'id' | 'type' | 'subtype' | 'slug' | 'name' | 'description' | 'data'>
}

export interface CompanionTemplate {
  id: string
  slug: string
  name: string
  kind: CompanionKind
  armor_class: number | null
  hit_points: number | null
  speed_text: string | null
  notes: string | null
  custom_data: Record<string, unknown>
}

export interface CreatureTemplate {
  id: string
  slug: string
  name: string
  subtype: string | null
  alignment: string | null
  armor_class: number | null
  hit_points: number | null
  speed_text: string | null
  str_score: number | null
  dex_score: number | null
  con_score: number | null
  int_score: number | null
  wis_score: number | null
  cha_score: number | null
  skills: Record<string, unknown>
  senses: string | null
  notes: string | null
  traits: unknown
  actions: unknown
}

export async function listCompanionTemplates() {
  const { data, error } = await supabase
    .from('companion_templates')
    .select('id, slug, name, kind, armor_class, hit_points, speed_text, notes, custom_data')
    .order('name', { ascending: true })
  if (error) throw error
  return (data ?? []) as CompanionTemplate[]
}

export async function listCreatureTemplates() {
  const { data, error } = await supabase
    .from('creature_templates')
    .select('id, slug, name, subtype, alignment, armor_class, hit_points, speed_text, str_score, dex_score, con_score, int_score, wis_score, cha_score, skills, senses, notes, traits, actions')
    .order('name', { ascending: true })
  if (error) throw error
  return (data ?? []) as CreatureTemplate[]
}

export async function createCreatureEntryFromTemplate(template: CreatureTemplate) {
  const { data, error } = await supabase
    .from('compendium_entries')
    .insert({
      type: 'creature',
      subtype: 'monster',
      slug: `${template.slug}-${Date.now()}`,
      name: template.name,
      description: template.notes ?? null,
      is_system: false,
      data: {
        ac: template.armor_class,
        hp: template.hit_points,
        speed: template.speed_text,
        str: template.str_score,
        dex: template.dex_score,
        con: template.con_score,
        int: template.int_score,
        wis: template.wis_score,
        cha: template.cha_score,
        senses: template.senses,
        skills: template.skills,
        traits: template.traits,
        actions: template.actions,
        source_creature_template_id: template.id,
        source_origin: 'template',
        template_snapshot: template,
      },
    })
    .select('id, type, subtype, slug, name, description, is_system, data, created_by, created_at')
    .single()
  if (error) throw error
  return data as CompendiumEntry
}

export async function updateCreature(id: string, patch: Partial<CompendiumEntry>) {
  const { data, error } = await supabase
    .from('compendium_entries')
    .update(patch)
    .eq('id', id)
    .select('id, type, subtype, slug, name, description, is_system, data, created_by, created_at')
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
    .neq('status', 'ended')
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
    await unlockFightCreaturesForCampaign(campaignId, fight.id)

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
  const { error: rpcError } = await supabase.rpc('set_fight_entity_hp', {
    p_entity_id: entityId,
    p_current_hp: currentHp,
  })
  if (!rpcError) return

  const isMissingRpc = typeof rpcError.message === 'string' && rpcError.message.toLowerCase().includes('set_fight_entity_hp')
  if (!isMissingRpc) throw rpcError

  const { data, error } = await supabase
    .from('fight_entities')
    .update({ current_hp: currentHp })
    .eq('id', entityId)
    .select('id, entity_type, character_id')
    .maybeSingle()
  if (error) throw error

  if (data?.entity_type === 'player' && data.character_id) {
    const patch: { hp_current: number; death_successes?: number; death_failures?: number } = { hp_current: currentHp }
    if (currentHp > 0) {
      patch.death_successes = 0
      patch.death_failures = 0
    }
    const { error: characterError } = await supabase.from('characters').update(patch).eq('id', data.character_id)
    if (characterError) throw characterError
  }
}

export async function listFightCharacterCombatState(fightId: string) {
  const { data, error } = await supabase.rpc('get_fight_character_combat_state', {
    p_fight_id: fightId,
  })
  if (error) throw error
  return (data ?? []) as Array<{
    character_id: string
    hp_current: number | null
    hp_max: number | null
    death_successes: number | null
    death_failures: number | null
  }>
}

export async function setCharacterDeathSaves(characterId: string, deathSuccesses: number, deathFailures: number) {
  const nextSuccesses = Math.max(0, Math.min(3, Math.floor(deathSuccesses)))
  const nextFailures = Math.max(0, Math.min(3, Math.floor(deathFailures)))
  const { error } = await supabase
    .from('characters')
    .update({
      death_successes: nextSuccesses,
      death_failures: nextFailures,
    })
    .eq('id', characterId)

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
    .select('id, character_id, entry_id, kind, name_override, notes, is_active, custom_data, source_companion_template_id, source_origin, template_snapshot, created_at')
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
  customData?: Record<string, unknown>
  sourceCompanionTemplateId?: string
  sourceOrigin?: 'custom' | 'template'
  templateSnapshot?: Record<string, unknown> | null
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
      custom_data: input.customData ?? {},
      source_companion_template_id: input.sourceCompanionTemplateId ?? null,
      source_origin: input.sourceOrigin ?? 'custom',
      template_snapshot: input.templateSnapshot ?? null,
    })
    .select('id, character_id, entry_id, kind, name_override, notes, is_active, custom_data, source_companion_template_id, source_origin, template_snapshot, created_at')
    .single()

  if (error) throw error
  return data as CharacterCompanion
}

export async function assignCompanionFromTemplate(input: {
  characterId: string
  template: CompanionTemplate
  nameOverride?: string
  notes?: string
}) {
  const { data, error } = await supabase.rpc('assign_companion_from_template', {
    p_character_id: input.characterId,
    p_template_id: input.template.id,
    p_name_override: input.nameOverride ?? null,
    p_notes: input.notes ?? null,
  })
  if (error) throw error
  const row = Array.isArray(data) ? data[0] : data
  if (!row) throw new Error('assign_companion_from_template returned no row')
  return row as CharacterCompanion
}

export async function activateCompanion(companionId: string, isActive: boolean) {
  const { data, error } = await supabase
    .from('character_companions')
    .update({ is_active: isActive })
    .eq('id', companionId)
    .select('id, character_id, entry_id, kind, name_override, notes, is_active, custom_data, source_companion_template_id, source_origin, template_snapshot, created_at')
    .single()

  if (error) throw error
  return data as CharacterCompanion
}

export async function deleteCompanionAssignment(companionId: string) {
  const { error } = await supabase
    .from('character_companions')
    .delete()
    .eq('id', companionId)
  if (error) throw error
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
  const isActive = status === 'ended' ? false : true
  const { data, error } = await supabase
    .from('fights')
    .update({ status, is_active: isActive })
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
  const t0 = Date.now()
  const fight = await createOrGetDraftFight(campaignId)
  const [{ data: playerProfiles, error: playersError }, { data: activityUsers, error: activityUsersError }, { error: clearPlayerEntitiesError }, { error: clearRequestsError }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id')
      .eq('role', 'player'),
    supabase
      .from('activity_status')
      .select('user_id, is_online, last_seen')
      .eq('is_online', true)
      .gte('last_seen', activeSinceIso(2)),
    supabase.from('fight_entities').delete().eq('fight_id', fight.id).eq('entity_type', 'player'),
    supabase.from('fight_initiative_requests').delete().eq('fight_id', fight.id),
  ])

  if (playersError) throw playersError
  if (activityUsersError) throw activityUsersError
  if (clearPlayerEntitiesError) throw clearPlayerEntitiesError
  if (clearRequestsError) throw clearRequestsError

  const profileIds = (playerProfiles ?? []).map((profile) => profile.id).filter(Boolean)
  const activityUserIds = (activityUsers ?? []).map((row) => row.user_id).filter(Boolean)
  const knownPlayerIds = new Set(profileIds)
  const activePlayerIds = activityUserIds.filter((id) => knownPlayerIds.has(id))
  const uniquePlayerIds = [...new Set(activePlayerIds)]
  const requests = uniquePlayerIds.map((playerId) => ({
    fight_id: fight.id,
    user_id: playerId,
    status: 'pending' as const,
    initiative_roll: null as number | null,
    submitted_at: null as string | null,
  }))

  if (requests.length > 0) {
    const { error: requestError } = await supabase
      .from('fight_initiative_requests')
      .insert(requests)
    if (requestError) throw requestError
    console.info('[fight:start] inserted initiative requests', { fightId: fight.id, inserted: requests.length })
  } else {
    console.warn('[fight:start] no participants resolved for initiative requests', { campaignId, fightId: fight.id })
  }

  await unlockFightCreaturesForCampaign(campaignId, fight.id)
  await setFightStatus(fight.id, requests.length > 0 ? 'collecting_initiative' : 'active')
  console.log('[perf]', 'startCombatForCampaign', Date.now() - t0)
  return fight
}

export async function unlockFightCreaturesForCampaign(campaignId: string, fightId: string) {
  const { data: rpcCount, error: rpcError } = await supabase.rpc('unlock_fight_creatures_for_campaign', {
    p_campaign_id: campaignId,
    p_fight_id: fightId,
  })
  if (!rpcError) {
    const inserted = Number(rpcCount ?? 0)
    console.info('[compendium:unlock] rpc success', { campaignId, fightId, inserted })
    return inserted
  }
  console.warn('[compendium:unlock] rpc failed, falling back to client insert path', {
    campaignId,
    fightId,
    error: rpcError.message,
  })

  const { data: fightCreatures, error: fightCreatureError } = await supabase
    .from('fight_entities')
    .select('entry_id')
    .eq('fight_id', fightId)
    .eq('entity_type', 'monster')
    .not('entry_id', 'is', null)

  if (fightCreatureError) throw fightCreatureError
  const candidateEntryIds = [...new Set((fightCreatures ?? []).map((row) => row.entry_id).filter(Boolean))]
  if (candidateEntryIds.length === 0) {
    console.info('[compendium:unlock] no candidate monster entries found', { campaignId, fightId })
    return 0
  }

  const { data: existing, error: existingError } = await supabase
    .from('campaign_entry_unlocks')
    .select('entry_id')
    .eq('campaign_id', campaignId)
    .is('player_id', null)
    .in('entry_id', candidateEntryIds)
  if (existingError) throw existingError

  const existingEntryIds = new Set((existing ?? []).map((row) => row.entry_id))
  const missing = candidateEntryIds.filter((entryId) => !existingEntryIds.has(entryId))
  if (missing.length === 0) return 0

  const rows = missing.map((entryId) => ({
    campaign_id: campaignId,
    entry_id: entryId,
    player_id: null as string | null,
    is_unlocked: true,
  }))

  const { error: insertError } = await supabase.from('campaign_entry_unlocks').insert(rows)
  if (insertError) throw insertError
  console.info('[compendium:unlock] fallback insert success', {
    campaignId,
    fightId,
    inserted: rows.length,
    candidates: candidateEntryIds.length,
  })
  return rows.length
}

export async function endCombatForFight(fightId: string) {
  const result = await setFightStatus(fightId, 'ended')
  const { error } = await supabase.from('fight_initiative_requests').delete().eq('fight_id', fightId)
  if (error) throw error
  return result
}

export async function finalizeInitiativeCollectionForFight(fightId: string) {
  const { count, error: pendingCountError } = await supabase
    .from('fight_initiative_requests')
    .select('id', { count: 'exact', head: true })
    .eq('fight_id', fightId)
    .eq('status', 'pending')

  if (pendingCountError) throw pendingCountError
  if ((count ?? 0) > 0) return false

  await setFightStatus(fightId, 'active')
  await sortInitiative(fightId)
  return true
}

export async function getPendingInitiativeForUser(_userId: string) {
  const { data, error } = await supabase
    .from('fight_initiative_requests')
    .select('id, fight_id, status')
    .eq('user_id', _userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  if (!data) {
    console.info('[initiative:pending] no pending request visible for current auth user', { requestedUserId: _userId })
    return null
  }

  const { data: character, error: characterError } = await supabase
    .from('characters')
    .select('dex_score')
    .eq('user_id', _userId)
    .limit(1)
    .maybeSingle()

  if (characterError) console.warn('[initiative] failed to load character dex modifier, defaulting to +0', { userId: _userId, error: characterError })
  const initiativeMod = abilityModifier(character?.dex_score ?? 10)
  console.info('[initiative:pending] resolved pending request', {
    requestedUserId: _userId,
    requestId: data.id,
    fightId: data.fight_id,
    initiativeMod,
  })

  return { requestId: data.id as string, fightId: data.fight_id as string, initiativeMod }
}

export async function submitPlayerInitiative(_userId: string, requestId: string, roll: number) {
  const { data: request, error: requestError } = await supabase
    .from('fight_initiative_requests')
    .select('id, fight_id, user_id, status')
    .eq('id', requestId)
    .single()

  if (requestError) throw requestError
  if (request.user_id !== _userId) {
    throw new Error('Initiative request does not belong to this user.')
  }
  if (request.status !== 'pending') {
    throw new Error('Initiative already submitted for this fight.')
  }
  console.info('[initiative:submit] request visible, submitting', { requestedUserId: _userId, requestId, fightId: request.fight_id, roll })

  const { data: character, error: characterError } = await supabase
    .from('characters')
    .select('id, name, dex_score, hp_current, hp_max')
    .eq('user_id', _userId)
    .limit(1)
    .maybeSingle()

  if (characterError) throw characterError
  if (!character) throw new Error('Character not found for initiative submission.')

  const initiativeMod = abilityModifier(character.dex_score ?? 10)
  const finalInitiative = roll + initiativeMod

  const { data: existingEntity, error: existingError } = await supabase
    .from('fight_entities')
    .select('id')
    .eq('fight_id', request.fight_id)
    .eq('character_id', character.id)
    .eq('entity_type', 'player')
    .maybeSingle()

  if (existingError) throw existingError

  if (existingEntity?.id) {
    const { error: updateEntityError } = await supabase
      .from('fight_entities')
      .update({
        name: character.name || 'Player',
        initiative: finalInitiative,
        initiative_mod: initiativeMod,
        current_hp: character.hp_current ?? 0,
        max_hp: character.hp_max ?? 0,
      })
      .eq('id', existingEntity.id)
    if (updateEntityError) throw updateEntityError
  } else {
    const { error: insertEntityError } = await supabase
      .from('fight_entities')
      .insert({
        fight_id: request.fight_id,
        entity_type: 'player',
        character_id: character.id,
        name: character.name || 'Player',
        initiative: finalInitiative,
        initiative_mod: initiativeMod,
        current_hp: character.hp_current ?? 0,
        max_hp: character.hp_max ?? 0,
      })
    if (insertEntityError) throw insertEntityError
  }

  const { error: updateRequestError } = await supabase
    .from('fight_initiative_requests')
    .update({
      status: 'submitted',
      initiative_roll: roll,
      submitted_at: new Date().toISOString(),
    })
    .eq('id', requestId)
  if (updateRequestError) throw updateRequestError
  return finalInitiative
}

export async function ensureActivePlayerInitiativeRequest(fightId: string, userId: string) {
  const { data: request, error: requestError } = await supabase
    .from('fight_initiative_requests')
    .select('id')
    .eq('fight_id', fightId)
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle()
  if (requestError) throw requestError
  if (request) return false

  const { error: insertError } = await supabase
    .from('fight_initiative_requests')
    .insert({
      fight_id: fightId,
      user_id: userId,
      status: 'pending',
      initiative_roll: null,
      submitted_at: null,
    })
  if (insertError) throw insertError
  return true
}

export async function listCampaignCreatureCompendium(campaignId: string) {
  const { data, error } = await supabase
    .from('campaign_entry_unlocks')
    .select('entry_id, is_unlocked, compendium_entries!inner(id, type, subtype, slug, name, description, data)')
    .eq('campaign_id', campaignId)
    .is('player_id', null)
    .eq('compendium_entries.type', 'creature')
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data ?? []).map((row) => ({
    entry_id: row.entry_id as string,
    is_unlocked: Boolean(row.is_unlocked),
    entry: Array.isArray(row.compendium_entries) ? row.compendium_entries[0] : row.compendium_entries,
  })) as Array<{
    entry_id: string
    is_unlocked: boolean
    entry: Pick<CompendiumEntry, 'id' | 'type' | 'subtype' | 'slug' | 'name' | 'description' | 'data'>
  }>
}

export async function listCreatureCompendiumForUser(userId: string) {
  const t0 = Date.now()
  const [{ data: entries, error: entriesError }, { data: unlockRows, error: unlockError }] = await Promise.all([
    supabase
      .from('compendium_entries')
      .select('id, type, subtype, slug, name, description')
      .eq('type', 'creature')
      .order('name', { ascending: true }),
    supabase
      .from('campaign_entry_unlocks')
      .select('entry_id')
      .or(`player_id.is.null,player_id.eq.${userId}`)
      .eq('is_unlocked', true),
  ])
  if (entriesError) throw entriesError
  if (unlockError) throw unlockError

  const unlockedIds = new Set((unlockRows ?? []).map((row) => row.entry_id as string))
  const unlockedEntryIds = [...unlockedIds]
  const unlockedDataById = new Map<string, Record<string, unknown>>()
  if (unlockedEntryIds.length > 0) {
    const { data: unlockedEntries, error: unlockedEntriesError } = await supabase
      .from('compendium_entries')
      .select('id, data')
      .in('id', unlockedEntryIds)
    if (unlockedEntriesError) throw unlockedEntriesError
    for (const row of unlockedEntries ?? []) {
      unlockedDataById.set(row.id as string, (row.data ?? {}) as Record<string, unknown>)
    }
  }

  const mapped = (entries ?? []).map((entry) => ({
    entry_id: entry.id as string,
    is_unlocked: unlockedIds.has(entry.id as string),
    entry: {
      ...entry,
      data: unlockedDataById.get(entry.id as string) ?? {},
    },
  })) as Array<{
    entry_id: string
    is_unlocked: boolean
    entry: Pick<CompendiumEntry, 'id' | 'type' | 'subtype' | 'slug' | 'name' | 'description' | 'data'>
  }>
  console.log('[perf]', 'listCreatureCompendiumForUser', Date.now() - t0)
  return mapped
}

export async function listCompanionEntries() {
  const { data, error } = await supabase
    .from('compendium_entries')
    .select('id, type, subtype, slug, name, description, data')
    .eq('type', 'companion')
    .order('name', { ascending: true })
  if (error) throw error
  return (data ?? []) as Array<Pick<CompendiumEntry, 'id' | 'type' | 'subtype' | 'slug' | 'name' | 'description' | 'data'>>
}

export async function listCompanionsForUser(userId: string) {
  const t0 = Date.now()
  const { data: character, error: characterError } = await supabase
    .from('characters')
    .select('id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle()
  if (characterError) throw characterError
  if (!character) {
    console.log('[perf]', 'listCompanionsForUser', Date.now() - t0)
    return { characterId: null, companions: [] as Array<CharacterCompanion & { entry: Pick<CompendiumEntry, 'id' | 'name' | 'subtype' | 'description'> | null }> }
  }

  const { data, error } = await supabase
    .from('character_companions')
    .select('id, character_id, entry_id, kind, name_override, notes, is_active, custom_data, source_companion_template_id, source_origin, template_snapshot, created_at, compendium_entries(id, name, subtype, description)')
    .eq('character_id', character.id)
    .order('created_at', { ascending: true })
  if (error) throw error

  const companions = (data ?? []).map((row) => ({
    id: row.id as string,
    character_id: row.character_id as string,
    entry_id: row.entry_id as string,
    kind: row.kind as CompanionKind,
    name_override: row.name_override as string | null,
    notes: row.notes as string | null,
    is_active: Boolean(row.is_active),
    custom_data: (row.custom_data as Record<string, unknown>) ?? {},
    source_companion_template_id: row.source_companion_template_id as string | null,
    source_origin: (row.source_origin as 'custom' | 'template' | null) ?? 'custom',
    template_snapshot: (row.template_snapshot as Record<string, unknown> | null) ?? null,
    created_at: row.created_at as string,
    entry: Array.isArray(row.compendium_entries) ? row.compendium_entries[0] : row.compendium_entries,
  }))

  const result = {
    characterId: character.id as string,
    companions,
  }
  console.log('[perf]', 'listCompanionsForUser', Date.now() - t0)
  return result
}

export async function getPlayerCombatState(userId: string): Promise<'none' | 'collecting_initiative' | 'active'> {
  const { data: pending, error: pendingError } = await supabase
    .from('fight_initiative_requests')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .limit(1)
    .maybeSingle()

  if (pendingError) throw pendingError
  if (pending) return 'collecting_initiative'

  const { data: submitted, error: submittedError } = await supabase
    .from('fight_initiative_requests')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'submitted')
    .limit(1)
    .maybeSingle()

  if (submittedError) throw submittedError
  if (submitted) return 'active'

  return 'none'
}
