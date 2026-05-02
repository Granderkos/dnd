// Auth & User Types for D&D App

export type UserRole = 'player' | 'dm'

export interface User {
  id: string
  username: string
  role: UserRole
  createdAt?: number
}

export interface AuthState {
  isAuthenticated: boolean
  currentUser: User | null
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
}

// Empty character for new players
import { Character, Spellbook, Inventory } from './dnd-types'

export const emptyCharacter: Character = {
  info: {
    name: '',
    class: '',
    subclass: '',
    race: '',
    background: '',
    alignment: '',
    level: 1,
    xp: 0,
    portraitUrl: '',
    portraitOriginalUrl: '',
  },
  abilities: {
    STR: { value: 10, proficient: false },
    DEX: { value: 10, proficient: false },
    CON: { value: 10, proficient: false },
    INT: { value: 10, proficient: false },
    WIS: { value: 10, proficient: false },
    CHA: { value: 10, proficient: false },
  },
  proficiencyBonus: 2,
  skills: [
    { name: 'Acrobatics', ability: 'DEX', proficient: false },
    { name: 'Animal Handling', ability: 'WIS', proficient: false },
    { name: 'Arcana', ability: 'INT', proficient: false },
    { name: 'Athletics', ability: 'STR', proficient: false },
    { name: 'Deception', ability: 'CHA', proficient: false },
    { name: 'History', ability: 'INT', proficient: false },
    { name: 'Insight', ability: 'WIS', proficient: false },
    { name: 'Intimidation', ability: 'CHA', proficient: false },
    { name: 'Investigation', ability: 'INT', proficient: false },
    { name: 'Medicine', ability: 'WIS', proficient: false },
    { name: 'Nature', ability: 'INT', proficient: false },
    { name: 'Perception', ability: 'WIS', proficient: false },
    { name: 'Performance', ability: 'CHA', proficient: false },
    { name: 'Persuasion', ability: 'CHA', proficient: false },
    { name: 'Religion', ability: 'INT', proficient: false },
    { name: 'Sleight of Hand', ability: 'DEX', proficient: false },
    { name: 'Stealth', ability: 'DEX', proficient: false },
    { name: 'Survival', ability: 'WIS', proficient: false },
  ],
  combat: {
    armorClass: 10,
    initiative: 0,
    initiativeBase: 0,
    initiativeRoll: 0,
    initiativeTotal: 0,
    speed: 30,
    maxHp: 0,
    currentHp: 0,
    tempHp: 0,
    hitDice: '',
    deathSaves: {
      successes: [false, false, false],
      failures: [false, false, false],
    },
  },
  attacks: [],
  attackNotes: '',
  raceFeatures: '',
  classFeatures: '',
  backgroundFeatures: '',
  languages: '',
  passivePerception: 10,
}

export const emptySpellbook: Spellbook = {
  spellcastingClass: '',
  spellcastingAbility: 'INT',
  spellSaveDC: 0,
  spellAttackBonus: 0,
  cantrips: [],
  spells: [],
  slots: {
    1: { total: 0, expended: 0 },
    2: { total: 0, expended: 0 },
    3: { total: 0, expended: 0 },
    4: { total: 0, expended: 0 },
    5: { total: 0, expended: 0 },
    6: { total: 0, expended: 0 },
    7: { total: 0, expended: 0 },
    8: { total: 0, expended: 0 },
    9: { total: 0, expended: 0 },
  },
}

export const emptyInventory: Inventory = {
  items: [],
  currency: {
    cp: 0,
    sp: 0,
    ep: 0,
    gp: 0,
    pp: 0,
  },
}
