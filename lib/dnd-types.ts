// D&D 5e Character Types

export type AbilityName = 'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA'

export interface AbilityScore {
  value: number
  proficient: boolean
}

export interface Skill {
  name: string
  ability: AbilityName
  proficient: boolean
}

export interface Attack {
  id: string
  name: string
  damage: string
  damageType: string
  attackBonus: string
}

export interface DeathSaves {
  successes: [boolean, boolean, boolean]
  failures: [boolean, boolean, boolean]
}

export interface CharacterInfo {
  name: string
  class: string
  subclass: string
  race: string
  background: string
  alignment: string
  level: number
  xp: number
  portraitUrl?: string
  portraitOriginalUrl?: string
}

export interface CombatInfo {
  armorClass: number
  initiative: number
  initiativeBase: number
  initiativeRoll: number
  initiativeTotal: number
  speed: number
  maxHp: number
  currentHp: number
  tempHp: number
  hitDice: string
  deathSaves: DeathSaves
}

export interface Character {
  info: CharacterInfo
  abilities: Record<AbilityName, AbilityScore>
  proficiencyBonus: number
  skills: Skill[]
  combat: CombatInfo
  attacks: Attack[]
  attackNotes: string
  raceFeatures: string
  classFeatures: string
  backgroundFeatures: string
  languages: string
  passivePerception: number
}

export interface Spell {
  id: string
  name: string
  level: number
  ritual: boolean
  concentration: boolean
  reaction: boolean
  castingTime: string
  range: string
  duration: string
  description: string
  damage: string
  prepared: boolean
}

export interface SpellSlots {
  total: number
  expended: number
}

export interface Spellbook {
  spellcastingClass: string
  spellcastingAbility: AbilityName
  spellSaveDC: number
  spellAttackBonus: number
  cantrips: Spell[]
  spells: Spell[]
  slots: Record<number, SpellSlots>
}

export interface InventoryItem {
  id: string
  name: string
  quantity: number
  description: string
  category: string
}

export interface Currency {
  cp: number
  sp: number
  ep: number
  gp: number
  pp: number
}

export interface Inventory {
  items: InventoryItem[]
  currency: Currency
}

export interface MapSettings {
  gridEnabled: boolean
  gridSize: number
  gridOpacity: number
  zoom: number
  panX: number
  panY: number
}

// Utility function to convert feet to squares (5 feet = 1 square)
export function feetToSquares(feet: number): number {
  return Math.floor(feet / 5)
}

// Utility function to format feet with squares
export function formatFeetWithSquares(feetStr: string, language: 'en' | 'cs' = 'en'): string {
  // Extract number from string like "60 feet", "120 ft", "30ft", etc.
  const match = feetStr.match(/(\d+(?:[.,]\d+)?)\s*(?:feet|foot|ft|stop|stopa|stopy)/i)
  if (match) {
    const feet = Number.parseFloat(match[1].replace(',', '.'))
    if (Number.isNaN(feet)) return feetStr
    const squares = feetToSquares(feet)
    if (language === 'cs') {
      const meters = (feet * 0.3048).toFixed(1)
      return feetStr.replace(match[0], `${meters} m (${squares} polí)`)
    }
    return feetStr.replace(match[0], `${feet} ft (${squares} sq)`)
  }
  return feetStr
}

// Default character based on the provided sheets (Elaris Vaelthorn)
export const defaultCharacter: Character = {
  info: {
    name: 'Elaris Vaelthorn',
    class: 'Wizard',
    subclass: 'Divination',
    race: 'High Elf',
    background: 'Sage',
    alignment: 'Lawful Neutral',
    level: 1,
    xp: 0,
    portraitUrl: '',
  },
  abilities: {
    STR: { value: 7, proficient: false },
    DEX: { value: 10, proficient: false },
    CON: { value: 8, proficient: false },
    INT: { value: 16, proficient: true },
    WIS: { value: 13, proficient: true },
    CHA: { value: 12, proficient: false },
  },
  proficiencyBonus: 2,
  skills: [
    { name: 'Acrobatics', ability: 'DEX', proficient: false },
    { name: 'Animal Handling', ability: 'WIS', proficient: false },
    { name: 'Arcana', ability: 'INT', proficient: true },
    { name: 'Athletics', ability: 'STR', proficient: false },
    { name: 'Deception', ability: 'CHA', proficient: false },
    { name: 'History', ability: 'INT', proficient: true },
    { name: 'Insight', ability: 'WIS', proficient: true },
    { name: 'Intimidation', ability: 'CHA', proficient: false },
    { name: 'Investigation', ability: 'INT', proficient: true },
    { name: 'Medicine', ability: 'WIS', proficient: false },
    { name: 'Nature', ability: 'INT', proficient: false },
    { name: 'Perception', ability: 'WIS', proficient: false },
    { name: 'Performance', ability: 'CHA', proficient: false },
    { name: 'Persuasion', ability: 'CHA', proficient: false },
    { name: 'Religion', ability: 'INT', proficient: true },
    { name: 'Sleight of Hand', ability: 'DEX', proficient: false },
    { name: 'Stealth', ability: 'DEX', proficient: false },
    { name: 'Survival', ability: 'WIS', proficient: false },
  ],
  combat: {
    armorClass: 12,
    initiative: 0,
    initiativeBase: 0,
    initiativeRoll: 0,
    initiativeTotal: 0,
    speed: 30,
    maxHp: 9,
    currentHp: 9,
    tempHp: 0,
    hitDice: '1d6',
    deathSaves: {
      successes: [false, false, false],
      failures: [false, false, false],
    },
  },
  attacks: [
    { id: '1', name: 'Fire Bolt', damage: '1d10', damageType: 'fire', attackBonus: '+5' },
    { id: '2', name: 'Dagger', damage: '1d4', damageType: 'piercing', attackBonus: '+2' },
  ],
  attackNotes: '',
  raceFeatures: `Darkvision
Fey Ancestry
Trance
Keen Senses
Extra Language`,
  classFeatures: `Spellcasting
Arcane Recovery
Wizard Cantrip`,
  backgroundFeatures: `Researcher
Skill: Arcana, History`,
  languages: `Common, Elvish, Draconic

Proficiencies: Daggers, darts, slings, quarterstaffs, light crossbows`,
  passivePerception: 11,
}

export const defaultSpellbook: Spellbook = {
  spellcastingClass: 'Wizard',
  spellcastingAbility: 'INT',
  spellSaveDC: 13,
  spellAttackBonus: 5,
  cantrips: [
    { id: 'c1', name: 'Fire Bolt', level: 0, ritual: false, concentration: false, reaction: false, castingTime: '1 action', range: '120 feet', duration: 'Instantaneous', description: 'You hurl a mote of fire at a creature or object within range.', damage: '1d10 fire', prepared: true },
    { id: 'c2', name: 'Mage Hand', level: 0, ritual: false, concentration: false, reaction: false, castingTime: '1 action', range: '30 feet', duration: '1 minute', description: 'A spectral, floating hand appears at a point you choose within range.', damage: '', prepared: true },
    { id: 'c3', name: 'Minor Illusion', level: 0, ritual: false, concentration: false, reaction: false, castingTime: '1 action', range: '30 feet', duration: '1 minute', description: 'You create a sound or an image of an object within range.', damage: '', prepared: true },
    { id: 'c4', name: 'Prestidigitation', level: 0, ritual: false, concentration: false, reaction: false, castingTime: '1 action', range: '10 feet', duration: 'Up to 1 hour', description: 'A minor magical trick.', damage: '', prepared: true },
  ],
  spells: [
    { id: 's1', name: 'Sleep', level: 1, ritual: false, concentration: false, reaction: false, castingTime: '1 action', range: '90 feet', duration: '1 minute', description: 'This spell sends creatures into a magical slumber.', damage: '5d8 HP affected', prepared: true },
    { id: 's2', name: 'Mage Armor', level: 1, ritual: false, concentration: false, reaction: false, castingTime: '1 action', range: 'Touch', duration: '8 hours', description: 'You touch a willing creature. The target\'s base AC becomes 13 + DEX modifier.', damage: '', prepared: true },
    { id: 's3', name: 'Shield', level: 1, ritual: false, concentration: false, reaction: true, castingTime: '1 reaction', range: 'Self', duration: '1 round', description: '+5 AC until start of your next turn, including against triggering attack.', damage: '', prepared: true },
    { id: 's4', name: 'Magic Missile', level: 1, ritual: false, concentration: false, reaction: false, castingTime: '1 action', range: '120 feet', duration: 'Instantaneous', description: 'Three darts of magical force hit creatures of your choice.', damage: '3x 1d4+1 force', prepared: true },
    { id: 's5', name: 'Detect Magic', level: 1, ritual: true, concentration: true, reaction: false, castingTime: '1 action', range: 'Self', duration: '10 minutes', description: 'You sense the presence of magic within 30 feet.', damage: '', prepared: true },
    { id: 's6', name: 'Find Familiar', level: 1, ritual: true, concentration: false, reaction: false, castingTime: '1 hour', range: '10 feet', duration: 'Instantaneous', description: 'You gain the service of a familiar, a spirit in animal form.', damage: '', prepared: false },
    { id: 's7', name: "Tasha's Hideous Laughter", level: 1, ritual: false, concentration: true, reaction: false, castingTime: '1 action', range: '30 feet', duration: '1 minute', description: 'A creature falls prone and becomes incapacitated.', damage: '', prepared: true },
    { id: 's8', name: 'Identify', level: 1, ritual: true, concentration: false, reaction: false, castingTime: '1 minute', range: 'Touch', duration: 'Instantaneous', description: 'You learn magic properties of an item.', damage: '', prepared: false },
  ],
  slots: {
    1: { total: 2, expended: 0 },
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

export const defaultInventory: Inventory = {
  items: [
    { id: '1', name: 'Dagger', quantity: 2, description: '1d4 piercing, finesse, light, thrown', category: 'Weapons' },
    { id: '2', name: 'Arcane Focus', quantity: 1, description: 'A crystal orb for casting spells', category: 'Equipment' },
    { id: '3', name: 'Robe', quantity: 1, description: 'Simple traveling robe', category: 'Armor' },
    { id: '4', name: 'Spellbook', quantity: 1, description: 'Contains your wizard spells', category: 'Equipment' },
    { id: '5', name: "Scholar's Pack", quantity: 1, description: 'Backpack, book, ink, quill, parchment, etc.', category: 'Equipment' },
    { id: '6', name: 'Bottle of Ink', quantity: 1, description: 'Black ink for writing', category: 'Supplies' },
    { id: '7', name: 'Quill', quantity: 1, description: 'Writing implement', category: 'Supplies' },
    { id: '8', name: 'Brass Brazier', quantity: 1, description: 'For Find Familiar ritual', category: 'Equipment' },
    { id: '9', name: 'Potion of Healing', quantity: 2, description: '2d4+2 HP', category: 'Consumables' },
  ],
  currency: {
    cp: 0,
    sp: 0,
    ep: 0,
    gp: 50,
    pp: 0,
  },
}

// Utility functions
export function calculateModifier(score: number): number {
  return Math.floor((score - 10) / 2)
}

export function calculateSpellAttackBonus(proficiencyBonus: number, castingAbilityScore: number): number {
  return proficiencyBonus + calculateModifier(castingAbilityScore)
}

export function calculateSpellSaveDC(proficiencyBonus: number, castingAbilityScore: number): number {
  return 8 + calculateSpellAttackBonus(proficiencyBonus, castingAbilityScore)
}

export function formatModifier(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`
}
