export type CompendiumType = 'creature' | 'companion'
export type CompendiumSubtype = 'monster' | 'pet' | 'mount' | 'summon' | 'familiar'
export type CompanionKind = 'pet' | 'mount' | 'summon' | 'familiar'
export type FightEntityType = 'player' | 'monster' | 'npc' | 'summon'
export type FightStatus = 'draft' | 'active' | 'ended'

export interface CompendiumEntry {
  id: string
  type: CompendiumType
  subtype: CompendiumSubtype | null
  slug: string
  name: string
  description: string | null
  is_system: boolean
  data: Record<string, unknown>
  created_by: string | null
  created_at: string
}

export interface CampaignEntryUnlock {
  id: string
  campaign_id: string
  entry_id: string
  player_id: string | null
  is_unlocked: boolean
  created_at: string
}

export interface CharacterCompanion {
  id: string
  character_id: string
  entry_id: string
  kind: CompanionKind
  name_override: string | null
  notes: string | null
  is_active: boolean
  created_at: string
}

export interface Fight {
  id: string
  campaign_id: string
  is_active: boolean
  status: FightStatus
  created_at: string
}

export interface FightEntity {
  id: string
  fight_id: string
  entity_type: FightEntityType
  character_id: string | null
  entry_id: string | null
  name: string
  initiative: number | null
  initiative_mod: number
  current_hp: number | null
  max_hp: number | null
  turn_order: number | null
  notes: string | null
  created_at: string
}

export interface SeedCompendiumEntry {
  type: CompendiumType
  subtype: CompendiumSubtype
  slug: string
  name: string
  description?: string
  data?: Record<string, unknown>
}

export interface StartCombatPayload {
  fightId: string
  campaignId: string
}

export interface InitiativeSubmission {
  characterId: string
  modifier: number
  roll: number
}
