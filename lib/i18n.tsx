'use client'

import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react'

export type Language = 'en' | 'cs'

type TranslationValue = string | ((params: Record<string, string | number>) => string)
type TranslationMap = Record<string, TranslationValue>

const translations: Record<Language, TranslationMap> = {
  en: {
    'common.loading': 'Loading...',
    'common.all': 'All',
    'common.confirm': 'Confirm',
    'common.cancel': 'Cancel',
    'common.delete': 'Delete',
    'common.empty': 'Empty',
    'theme.toggle': 'Toggle theme',
    'lang.switch': 'Switch language',

    'auth.title': 'D&D Character Manager',
    'auth.subtitle': 'Manage your characters, spells, and adventures',
    'auth.login': 'Login',
    'auth.register': 'Register',
    'auth.username': 'Username',
    'auth.password': 'Password',
    'auth.enterUsername': 'Enter username',
    'auth.enterPassword': 'Enter password',
    'auth.chooseUsername': 'Choose username',
    'auth.choosePassword': 'Choose password',
    'auth.role': 'Role',
    'auth.player': 'Player',
    'auth.dm': 'Dungeon Master',
    'auth.playerHint': 'Players manage their own character sheet',
    'auth.dmHint': 'DMs can view all players and manage maps',
    'auth.createAccount': 'Create Account',
    'auth.loginFailed': 'Login failed',
    'auth.registrationFailed': 'Registration failed',

    'nav.character': 'Character',
    'nav.inventory': 'Inventory',
    'nav.spells': 'Spells',
    'nav.notes': 'Notes',
    'nav.map': 'Map',
    'nav.players': 'Players',
    'nav.maps': 'Maps',

    'dashboard.loadingCharacter': 'Loading character data...',
    'dashboard.loadingDm': 'Loading DM Dashboard...',
    'dashboard.dmTitle': 'DM Dashboard',
    'dashboard.activePlayers': 'Active Players',
    'dashboard.allPlayers': 'All Players',
    'dashboard.noActivePlayers': 'No active players right now.',
    'dashboard.noPlayers': 'No players registered yet',
    'dashboard.unassignedCharacter': 'Unassigned Character',
    'dashboard.dmNotes': 'DM Notes',
    'dashboard.dmNotesPlaceholder': 'NPC names, quest notes, boss info, story details...',
    'dashboard.autoSaves': 'Auto-saves as you type',

    'character.name': 'Character Name',
    'character.class': 'Class',
    'character.level': 'Level',
    'character.subclass': 'Subclass',
    'character.race': 'Race',
    'character.background': 'Background',
    'character.alignment': 'Alignment',
    'character.abilitiesSection': 'Abilities, Saves & Skills',
    'character.proficiencyBonus': 'Proficiency Bonus',
    'character.skills': 'Skills',
    'character.passivePerception': ({ value }) => `Passive Perception: ${value}`,
    'character.combat.ac': 'AC',
    'character.combat.init': 'Initiative',
    'character.combat.speed': 'Speed',
    'character.combat.max': 'Max',
    'character.combat.temp': 'Temp',
    'character.combat.hitDice': 'Hit Dice',
    'character.combat.actions': 'Attacks & Spellcasting',
    'character.combat.featuresTraits': 'Features & Traits',
    'character.combat.raceFeatures': 'Race Features',
    'character.combat.classFeatures': 'Class Features',
    'character.combat.backgroundFeatures': 'Background Features',
    'character.proficienciesLanguages': 'Other Proficiencies & Languages',
    'character.toggleSaveTitle': 'Toggle Save Proficiency',
    'character.toggleSaveDescription': ({ action, ability }) => `Are you sure you want to ${action} proficiency for ${ability} saving throw?`,
    'character.toggleSkillTitle': 'Toggle Skill Proficiency',
    'character.toggleSkillDescription': ({ action, skill }) => `Are you sure you want to ${action} proficiency for ${skill}?`,
    'character.deleteAttackTitle': 'Delete Attack',
    'character.deleteAttackDescription': ({ name }) => `Are you sure you want to delete "${name}"?`,

    'inventory.addItem': 'Add Item',
    'inventory.editItem': 'Edit Item',
    'inventory.saveChanges': 'Save Changes',
    'inventory.name': 'Name',
    'inventory.quantity': 'Quantity',
    'inventory.category': 'Category',
    'inventory.description': 'Description',
    'inventory.treasureTotal': 'Treasure Total',
    'inventory.weapons': 'Weapons',
    'inventory.armor': 'Armor',
    'inventory.equipment': 'Equipment',
    'inventory.consumables': 'Consumables',
    'inventory.supplies': 'Supplies',
    'inventory.treasure': 'Treasure',
    'inventory.other': 'Other',

    'notes.session': 'Session',
    'notes.quest': 'Quest',
    'notes.npcs': 'NPCs',
    'notes.combat': 'Combat',
    'notes.general': 'General',
    'notes.newNote': 'New Note',
    'notes.titlePlaceholder': 'Note title',
    'notes.contentPlaceholder': 'Write your notes here...',
    'notes.noNotes': 'No notes yet',
    'notes.emptyNote': 'Empty note',
    'notes.deleteTitle': 'Delete Note',
    'notes.deleteDescription': ({ title }) => `Delete "${title}"?`,
  },
  cs: {
    'common.loading': 'Načítání...',
    'common.all': 'Vše',
    'common.confirm': 'Potvrdit',
    'common.cancel': 'Zrušit',
    'common.delete': 'Smazat',
    'common.empty': 'Prázdné',
    'theme.toggle': 'Přepnout motiv',
    'lang.switch': 'Přepnout jazyk',

    'auth.title': 'D&D správce postav',
    'auth.subtitle': 'Spravuj své postavy, kouzla a dobrodružství',
    'auth.login': 'Přihlášení',
    'auth.register': 'Registrace',
    'auth.username': 'Uživatelské jméno',
    'auth.password': 'Heslo',
    'auth.enterUsername': 'Zadej uživatelské jméno',
    'auth.enterPassword': 'Zadej heslo',
    'auth.chooseUsername': 'Vyber uživatelské jméno',
    'auth.choosePassword': 'Vyber heslo',
    'auth.role': 'Role',
    'auth.player': 'Hráč',
    'auth.dm': 'Dungeon Master',
    'auth.playerHint': 'Hráči spravují svůj vlastní sheet',
    'auth.dmHint': 'DM vidí všechny hráče a spravuje mapy',
    'auth.createAccount': 'Vytvořit účet',
    'auth.loginFailed': 'Přihlášení selhalo',
    'auth.registrationFailed': 'Registrace selhala',

    'nav.character': 'Postava',
    'nav.inventory': 'Inventář',
    'nav.spells': 'Kouzla',
    'nav.notes': 'Poznámky',
    'nav.map': 'Mapa',
    'nav.players': 'Hráči',
    'nav.maps': 'Mapy',

    'dashboard.loadingCharacter': 'Načítám data postavy...',
    'dashboard.loadingDm': 'Načítám DM dashboard...',
    'dashboard.dmTitle': 'DM Dashboard',
    'dashboard.activePlayers': 'Aktivní hráči',
    'dashboard.allPlayers': 'Všichni hráči',
    'dashboard.noActivePlayers': 'Teď není aktivní žádný hráč.',
    'dashboard.noPlayers': 'Zatím nejsou registrovaní žádní hráči',
    'dashboard.unassignedCharacter': 'Nepřiřazená postava',
    'dashboard.dmNotes': 'DM poznámky',
    'dashboard.dmNotesPlaceholder': 'Jména NPC, quest poznámky, info o bossech, detaily příběhu...',
    'dashboard.autoSaves': 'Ukládá se automaticky při psaní',

    'character.name': 'Jméno postavy',
    'character.class': 'Povolání',
    'character.level': 'Úroveň',
    'character.subclass': 'Podtřída',
    'character.race': 'Rasa',
    'character.background': 'Původ',
    'character.alignment': 'Přesvědčení',
    'character.abilitiesSection': 'Atributy, záchrany a dovednosti',
    'character.proficiencyBonus': 'Proficiency bonus',
    'character.skills': 'Dovednosti',
    'character.passivePerception': ({ value }) => `Pasivní vnímání: ${value}`,
    'character.combat.ac': 'AC',
    'character.combat.init': 'Iniciativa',
    'character.combat.speed': 'Rychlost',
    'character.combat.max': 'Max',
    'character.combat.temp': 'Temp',
    'character.combat.hitDice': 'Hit dice',
    'character.combat.actions': 'Attacks & Spellcasting',
    'character.combat.featuresTraits': 'Schopnosti a vlastnosti',
    'character.combat.raceFeatures': 'Rasové schopnosti',
    'character.combat.classFeatures': 'Class Features',
    'character.combat.backgroundFeatures': 'Background Features',
    'character.proficienciesLanguages': 'Other Proficiencies & Languages',
    'character.toggleSaveTitle': 'Přepnout proficiency záchrany',
    'character.toggleSaveDescription': ({ action, ability }) => `Opravdu chceš ${action} proficiency pro záchranný hod ${ability}?`,
    'character.toggleSkillTitle': 'Přepnout proficiency dovednosti',
    'character.toggleSkillDescription': ({ action, skill }) => `Opravdu chceš ${action} proficiency pro ${skill}?`,
    'character.deleteAttackTitle': 'Smazat útok',
    'character.deleteAttackDescription': ({ name }) => `Opravdu chceš smazat „${name}“?`,

    'inventory.addItem': 'Přidat předmět',
    'inventory.editItem': 'Upravit předmět',
    'inventory.saveChanges': 'Uložit změny',
    'inventory.name': 'Název',
    'inventory.quantity': 'Počet',
    'inventory.category': 'Kategorie',
    'inventory.description': 'Popis',
    'inventory.treasureTotal': 'Celková hodnota',
    'inventory.weapons': 'Zbraně',
    'inventory.armor': 'Zbroj',
    'inventory.equipment': 'Vybavení',
    'inventory.consumables': 'Spotřební věci',
    'inventory.supplies': 'Zásoby',
    'inventory.treasure': 'Poklady',
    'inventory.other': 'Ostatní',

    'notes.session': 'Session',
    'notes.quest': 'Quest',
    'notes.npcs': 'NPC',
    'notes.combat': 'Combat',
    'notes.general': 'Obecné',
    'notes.newNote': 'Nová poznámka',
    'notes.titlePlaceholder': 'Název poznámky',
    'notes.contentPlaceholder': 'Piš své poznámky sem...',
    'notes.noNotes': 'Zatím žádné poznámky',
    'notes.emptyNote': 'Prázdná poznámka',
    'notes.deleteTitle': 'Smazat poznámku',
    'notes.deleteDescription': ({ title }) => `Smazat „${title}“?`,
  },
}

interface I18nContextType {
  language: Language
  setLanguage: (language: Language) => void
  t: (key: string, params?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18nContextType | undefined>(undefined)
const STORAGE_KEY = 'dnd-language'

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en')

  useEffect(() => {
    document.documentElement.lang = language
    document.documentElement.setAttribute('translate', 'no')
  }, [language])

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY) as Language | null
    if (stored === 'en' || stored === 'cs') {
      setLanguageState(stored)
      return
    }
    const browserLanguage = navigator.language.toLowerCase()
    setLanguageState(browserLanguage.startsWith('cs') ? 'cs' : 'en')
  }, [])

  const setLanguage = (nextLanguage: Language) => {
    setLanguageState(nextLanguage)
    window.localStorage.setItem(STORAGE_KEY, nextLanguage)
  }

  const value = useMemo<I18nContextType>(() => ({
    language,
    setLanguage,
    t: (key, params = {}) => {
      const message = translations[language][key] ?? translations.en[key] ?? key
      return typeof message === 'function' ? message(params) : message
    },
  }), [language])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const context = useContext(I18nContext)
  if (!context) throw new Error('useI18n must be used within an I18nProvider')
  return context
}
