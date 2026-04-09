'use client'

import { useState, useEffect, useRef, memo, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import type { Note } from '@/components/dnd/notes'
import { useAuth } from '@/lib/auth-context'
import { emptyCharacter, emptyInventory, emptySpellbook } from '@/lib/auth-types'
import { loadCurrentPlayerData, loadCurrentPlayerNotes, saveCurrentPlayerData } from '@/lib/supabase-data'
import {
  activateCompanion,
  assignCompanion,
  assignCompanionFromTemplate,
  createCompanionEntry,
  getPendingInitiativeForUser,
  listCompanionTemplates,
  listCompanionsForUser,
  listCreatureCompendiumForUser,
  submitPlayerInitiative,
} from '@/lib/supabase-v3'
import { supabase } from '@/lib/supabase'
import {
  Character,
  Spellbook as SpellbookType,
  Inventory as InventoryType,
  MapSettings,
} from '@/lib/dnd-types'
import type { CharacterCompanion, CompanionKind, CompendiumEntry } from '@/lib/v3-types'
import { User, BookOpen, Package, FileText, Map, LogOut, Sparkles, Plus } from 'lucide-react'
import { AppControls } from '@/components/app/app-controls'
import { APP_VERSION } from '@/lib/app-config'
import { useI18n } from '@/lib/i18n'

const CharacterSheet = dynamic(() => import('@/components/dnd/character-sheet').then((m) => m.CharacterSheet), { ssr: false })
const Spellbook = dynamic(() => import('@/components/dnd/spellbook').then((m) => m.Spellbook), { ssr: false })
const Inventory = dynamic(() => import('@/components/dnd/inventory').then((m) => m.Inventory), { ssr: false })
const Notes = dynamic(() => import('@/components/dnd/notes').then((m) => m.Notes), { ssr: false })
const PlayerMapViewer = dynamic(() => import('@/components/dnd/player-map-viewer').then((m) => m.PlayerMapViewer), { ssr: false })
const PLAYER_DASHBOARD_TABS = ['character', 'inventory', 'spellbook', 'notes', 'map', 'compendium'] as const

function getInitialPlayerTab() {
  if (typeof window === 'undefined') return 'character'
  const saved = window.localStorage.getItem('player-dashboard-active-tab')
  return saved && PLAYER_DASHBOARD_TABS.includes(saved as (typeof PLAYER_DASHBOARD_TABS)[number]) ? saved : 'character'
}

function useDebouncedRemoteSave<T>(value: T, delay: number, enabled: boolean, saveFn: (value: T) => Promise<void>) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestValueRef = useRef(value)
  const latestSaveFnRef = useRef(saveFn)
  const dirtyRef = useRef(false)

  useEffect(() => {
    latestValueRef.current = value
  }, [value])

  useEffect(() => {
    latestSaveFnRef.current = saveFn
  }, [saveFn])

  const flush = useCallback(() => {
    if (!enabled || !dirtyRef.current) return
    dirtyRef.current = false
    void latestSaveFnRef.current(latestValueRef.current)
  }, [enabled])

  useEffect(() => {
    if (!enabled) return
    dirtyRef.current = true
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      flush()
    }, delay)
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [value, delay, enabled, flush])

  useEffect(() => {
    if (!enabled) return

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flush()
    }

    const handlePageHide = () => {
      flush()
    }

    window.addEventListener('pagehide', handlePageHide)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('pagehide', handlePageHide)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      flush()
    }
  }, [enabled, flush])

  return flush
}

const defaultMapSettings: MapSettings = {
  gridEnabled: false,
  gridSize: 50,
  gridOpacity: 0.5,
  zoom: 1,
  panX: 0,
  panY: 0,
}
function formatErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'object' && error !== null) {
    const message = 'message' in error && typeof (error as { message?: unknown }).message === 'string'
      ? (error as { message: string }).message
      : null
    const details = 'details' in error && typeof (error as { details?: unknown }).details === 'string'
      ? (error as { details: string }).details
      : null
    const hint = 'hint' in error && typeof (error as { hint?: unknown }).hint === 'string'
      ? (error as { hint: string }).hint
      : null
    return [message, details, hint].filter(Boolean).join(' — ') || fallback
  }
  return fallback
}

function statValue(entry: Pick<CompendiumEntry, 'data'>, key: string, fallback = '—') {
  const value = entry.data?.[key]
  if (typeof value === 'number') return String(value)
  if (typeof value === 'string' && value.trim()) return value
  return fallback
}

function normalizeList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => (typeof v === 'string' ? v.trim() : '')).filter(Boolean)
  if (typeof value === 'string') return value.split('\n').map((v) => v.trim()).filter(Boolean)
  return []
}

function safeSessionParse<T>(value: string | null): T | null {
  if (!value) return null
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

export const PlayerDashboard = memo(function PlayerDashboard() {
  const { user, logout, updateCurrentPage } = useAuth()
  const { t } = useI18n()
  const [isLoaded, setIsLoaded] = useState(false)
  const [activeTab, setActiveTab] = useState(getInitialPlayerTab)
  const [character, setCharacter] = useState<Character>(emptyCharacter)
  const [spellbook, setSpellbook] = useState<SpellbookType>(emptySpellbook)
  const [inventory, setInventory] = useState<InventoryType>(emptyInventory)
  const [notes, setNotes] = useState<Note[]>([])
  const [notesLoaded, setNotesLoaded] = useState(false)
  const [mapSettings, setMapSettings] = useState<MapSettings>(defaultMapSettings)
  const [initiativePrompt, setInitiativePrompt] = useState<{ requestId: string; initiativeMod: number } | null>(null)
  const [initiativeRollInput, setInitiativeRollInput] = useState('')
  const [isSubmittingInitiative, setIsSubmittingInitiative] = useState(false)
  const [initiativeError, setInitiativeError] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [creatureCompendium, setCreatureCompendium] = useState<Array<{ entry_id: string; is_unlocked: boolean; entry: Pick<CompendiumEntry, 'id' | 'name' | 'subtype' | 'description' | 'data'> }>>([])
  const [companions, setCompanions] = useState<Array<CharacterCompanion & { entry: Pick<CompendiumEntry, 'id' | 'name' | 'subtype' | 'description'> | null }>>([])
  const [companionCharacterId, setCompanionCharacterId] = useState<string | null>(null)
  const [compendiumSearch, setCompendiumSearch] = useState('')
  const [isCreateCompanionOpen, setIsCreateCompanionOpen] = useState(false)
  const [isImportCompanionOpen, setIsImportCompanionOpen] = useState(false)
  const [companionTemplates, setCompanionTemplates] = useState<Awaited<ReturnType<typeof listCompanionTemplates>>>([])
  const [selectedCompanionTemplateId, setSelectedCompanionTemplateId] = useState('')
  const [isCompanionTemplatesLoading, setIsCompanionTemplatesLoading] = useState(false)
  const [companionTemplatesError, setCompanionTemplatesError] = useState<string | null>(null)
  const [customCompanionName, setCustomCompanionName] = useState('')
  const [customCompanionKind, setCustomCompanionKind] = useState<CompanionKind>('pet')
  const [customCompanionAc, setCustomCompanionAc] = useState('')
  const [customCompanionHp, setCustomCompanionHp] = useState('')
  const [customCompanionSpeed, setCustomCompanionSpeed] = useState('')
  const [customCompanionNotes, setCustomCompanionNotes] = useState('')
  const [compendiumError, setCompendiumError] = useState<string | null>(null)
  const [isCompendiumLoading, setIsCompendiumLoading] = useState(false)
  const [selectedCreature, setSelectedCreature] = useState<{ entry: Pick<CompendiumEntry, 'id' | 'name' | 'subtype' | 'description' | 'data'>; isUnlocked: boolean } | null>(null)
  const compendiumLoadedRef = useRef(false)
  const initiativeRefreshTimeoutRef = useRef<number | null>(null)
  const playerCacheHydratedRef = useRef(false)
  const saveStatusTimeoutRef = useRef<number | null>(null)

  const playerDataCacheKey = user?.id ? `player-data-cache:${user.id}` : null
  const compendiumCacheKey = user?.id ? `player-compendium-cache:${user.id}` : null

  useEffect(() => {
    if (!playerDataCacheKey || playerCacheHydratedRef.current) return
    const cached = safeSessionParse<{
      character: Character
      spellbook: SpellbookType
      inventory: InventoryType
    }>(sessionStorage.getItem(playerDataCacheKey))
    if (!cached) return
    setCharacter(cached.character)
    setSpellbook(cached.spellbook)
    setInventory(cached.inventory)
    setIsLoaded(true)
    playerCacheHydratedRef.current = true
  }, [playerDataCacheKey])

  useEffect(() => {
    if (!user?.id) return
    let mounted = true
    ;(async () => {
      try {
        const data = await loadCurrentPlayerData(user.id)
        if (!mounted) return
        setCharacter(data.character)
        setSpellbook(data.spellbook)
        setInventory(data.inventory)
        if (playerDataCacheKey) {
          sessionStorage.setItem(playerDataCacheKey, JSON.stringify({
            character: data.character,
            spellbook: data.spellbook,
            inventory: data.inventory,
          }))
        }
      } catch (e) {
        console.error('Failed to load player data', e)
      } finally {
        if (mounted) setIsLoaded(true)
      }
    })()
    return () => {
      mounted = false
    }
  }, [playerDataCacheKey, user?.id])

  useEffect(() => {
    if (!user?.id || activeTab !== 'notes' || notesLoaded) return
    let mounted = true
    void (async () => {
      try {
        const loadedNotes = await loadCurrentPlayerNotes(user.id)
        if (!mounted) return
        setNotes(loadedNotes)
        setNotesLoaded(true)
      } catch (error) {
        console.error('Failed to load notes', error)
      }
    })()
    return () => {
      mounted = false
    }
  }, [activeTab, notesLoaded, user?.id])

  useEffect(() => {
    void updateCurrentPage(activeTab)
  }, [activeTab, updateCurrentPage])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem('player-dashboard-active-tab', activeTab)
  }, [activeTab])

  useEffect(() => {
    return () => {
      if (saveStatusTimeoutRef.current) clearTimeout(saveStatusTimeoutRef.current)
    }
  }, [])

  const refreshInitiativePrompt = useCallback(async () => {
    if (!user?.id) return
    try {
      console.info('[ui:initiative] refresh prompt start', { userId: user.id })
      const pending = await getPendingInitiativeForUser(user.id)
      if (!pending) {
        console.info('[ui:initiative] no pending request, clearing modal', { userId: user.id })
        setInitiativePrompt(null)
        setInitiativeRollInput('')
        setInitiativeError(null)
        return
      }
      console.info('[ui:initiative] pending request found, opening modal', {
        userId: user.id,
        requestId: pending.requestId,
        fightId: pending.fightId,
        initiativeMod: pending.initiativeMod,
      })
      setInitiativePrompt({ requestId: pending.requestId, initiativeMod: pending.initiativeMod })
      setInitiativeError(null)
    } catch (error) {
      const message = formatErrorMessage(error, 'Failed to check initiative request.')
      console.error('[ui:initiative] refresh failed', { userId: user.id, error, message })
      setInitiativeError(message)
    }
  }, [user?.id])

  const scheduleInitiativeRefreshBurst = useCallback(() => {
    void refreshInitiativePrompt()
    if (initiativeRefreshTimeoutRef.current) clearTimeout(initiativeRefreshTimeoutRef.current)
    initiativeRefreshTimeoutRef.current = window.setTimeout(() => {
      void refreshInitiativePrompt()
    }, 700)
  }, [refreshInitiativePrompt])

  useEffect(() => {
    if (!user?.id) return
    void refreshInitiativePrompt()
  }, [refreshInitiativePrompt, user?.id])

  useEffect(() => {
    compendiumLoadedRef.current = false
  }, [user?.id])

  useEffect(() => {
    if (!isImportCompanionOpen || companionTemplates.length > 0) return
    let active = true
    setIsCompanionTemplatesLoading(true)
    setCompanionTemplatesError(null)

    void listCompanionTemplates()
      .then((rows) => {
        if (!active) return
        setCompanionTemplates(rows)
        if (!selectedCompanionTemplateId && rows[0]?.id) {
          setSelectedCompanionTemplateId(rows[0].id)
        }
      })
      .catch((error) => {
        if (!active) return
        console.error('[companions:templates] load failed', error)
        setCompanionTemplatesError(formatErrorMessage(error, t('compendium.loadTemplatesFailed')))
      })
      .finally(() => {
        if (active) setIsCompanionTemplatesLoading(false)
      })

    return () => {
      active = false
    }
  }, [companionTemplates.length, isImportCompanionOpen, selectedCompanionTemplateId, t])

  const refreshCompendium = useCallback(async () => {
    if (!user?.id) return
    if (!compendiumCacheKey) return
    setIsCompendiumLoading(true)
    setCompendiumError(null)
    try {
      const [creatures, companionState] = await Promise.all([
        listCreatureCompendiumForUser(user.id),
        listCompanionsForUser(user.id),
      ])
      console.info('[compendium:player] refresh success', {
        userId: user.id,
        creatures: creatures.length,
        companions: companionState.companions.length,
      })
      setCreatureCompendium(creatures)
      setCompanions(companionState.companions)
      setCompanionCharacterId(companionState.characterId)
      sessionStorage.setItem(compendiumCacheKey, JSON.stringify({
        creatures,
        companions: companionState.companions,
        characterId: companionState.characterId,
      }))
    } catch (error) {
      console.error('[compendium:player] refresh failed', { userId: user.id, error })
      setCompendiumError(formatErrorMessage(error, 'Failed to load compendium data.'))
    } finally {
      setIsCompendiumLoading(false)
    }
  }, [compendiumCacheKey, user?.id])

  useEffect(() => {
    if (!user?.id || activeTab !== 'compendium' || compendiumLoadedRef.current) return
    compendiumLoadedRef.current = true
    if (compendiumCacheKey) {
      const cached = safeSessionParse<{
        creatures: Array<{ entry_id: string; is_unlocked: boolean; entry: Pick<CompendiumEntry, 'id' | 'name' | 'subtype' | 'description' | 'data'> }>
        companions: Array<CharacterCompanion & { entry: Pick<CompendiumEntry, 'id' | 'name' | 'subtype' | 'description'> | null }>
        characterId: string | null
      }>(sessionStorage.getItem(compendiumCacheKey))
      if (cached) {
        setCreatureCompendium(cached.creatures)
        setCompanions(cached.companions)
        setCompanionCharacterId(cached.characterId)
      }
    }
    void refreshCompendium()
  }, [activeTab, compendiumCacheKey, refreshCompendium, user?.id])

  useEffect(() => {
    if (!user?.id) return
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void refreshInitiativePrompt()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [refreshInitiativePrompt, user?.id])

  useEffect(() => {
    if (!user?.id) return
    const channel = supabase
      .channel(`initiative-requests-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'fights',
          filter: 'status=eq.collecting_initiative',
        },
        () => {
          scheduleInitiativeRefreshBurst()
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'fight_initiative_requests',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          scheduleInitiativeRefreshBurst()
        }
      )
      .subscribe((status) => {
        console.info('[ui:initiative] subscription status', { userId: user.id, status })
        if (status === 'SUBSCRIBED') {
          scheduleInitiativeRefreshBurst()
        }
      })

    return () => {
      if (initiativeRefreshTimeoutRef.current) clearTimeout(initiativeRefreshTimeoutRef.current)
      void supabase.removeChannel(channel)
    }
  }, [scheduleInitiativeRefreshBurst, user?.id])

  useEffect(() => {
    if (!user?.id) return
    const channel = supabase
      .channel(`player-character-sync-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'characters',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new as {
            hp_current?: number | null
            hp_max?: number | null
            death_successes?: number | null
            death_failures?: number | null
          } | null
          if (!row) return
          setCharacter((prev) => ({
            ...prev,
            combat: {
              ...prev.combat,
              currentHp: row.hp_current ?? prev.combat.currentHp,
              maxHp: row.hp_max ?? prev.combat.maxHp,
              deathSaves: {
                successes: [0, 1, 2].map((i) => i < (row.death_successes ?? 0)) as [boolean, boolean, boolean],
                failures: [0, 1, 2].map((i) => i < (row.death_failures ?? 0)) as [boolean, boolean, boolean],
              },
            },
          }))
        }
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [user?.id])

  const flushSave = useDebouncedRemoteSave(
    { character, spellbook, inventory, notes },
    3000,
    isLoaded && !!user?.id,
    async (payload) => {
      if (!user?.id) return
      try {
        if (saveStatusTimeoutRef.current) clearTimeout(saveStatusTimeoutRef.current)
        setSaveStatus('saving')
        await saveCurrentPlayerData(user.id, {
          ...payload,
          notes: notesLoaded ? payload.notes : undefined,
        })
        setSaveStatus('saved')
        setSaveError(null)
        saveStatusTimeoutRef.current = window.setTimeout(() => {
          setSaveStatus('idle')
        }, 1500)
      } catch (e) {
        console.error('Failed to save player data', e)
        setSaveStatus('failed')
        setSaveError(formatErrorMessage(e, 'Failed to save changes.'))
      }
    }
  )

  const creatureRows = creatureCompendium.filter((row) => {
    const query = compendiumSearch.trim().toLowerCase()
    if (!query) return true
    if (!row.is_unlocked) return false
    return row.entry.name.toLowerCase().includes(query) || (row.entry.description ?? '').toLowerCase().includes(query)
  })

  if (!isLoaded) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="text-center">
          <div className="mb-4 size-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="text-muted-foreground">{t('dashboard.loadingCharacter')}</p>
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-dvh bg-background">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex min-h-dvh flex-col">
        <header className="border-b border-border bg-card px-3 py-3">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <img src="/logo.svg" alt="DnD Compendium logo" className="size-5 shrink-0" />
              <span className="text-sm font-bold uppercase tracking-[0.08em] text-primary truncate max-w-[180px]">
                {character.info.name || user?.username || t('character.name')}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-muted-foreground">
                {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? 'Saved' : saveStatus === 'failed' ? 'Save failed' : ''}
              </span>
              <span className="text-xs text-muted-foreground">{APP_VERSION}</span>
              <AppControls />
              <Button variant="ghost" size="icon" className="size-7" onClick={() => void logout()}>
                <LogOut className="size-4" />
              </Button>
            </div>
          </div>
          <TabsList className="w-full justify-between overflow-x-auto scrollbar-hidden">
            <TabsTrigger value="character" className="flex-1 gap-1 px-2">
              <User className="size-4" />
              <span className="hidden sm:inline text-xs">{t('nav.character')}</span>
            </TabsTrigger>
            <TabsTrigger value="inventory" className="flex-1 gap-1 px-2">
              <Package className="size-4" />
              <span className="hidden sm:inline text-xs">{t('nav.inventory')}</span>
            </TabsTrigger>
            <TabsTrigger value="spellbook" className="flex-1 gap-1 px-2">
              <BookOpen className="size-4" />
              <span className="hidden sm:inline text-xs">{t('nav.spells')}</span>
            </TabsTrigger>
            <TabsTrigger value="notes" className="flex-1 gap-1 px-2">
              <FileText className="size-4" />
              <span className="hidden sm:inline text-xs">{t('nav.notes')}</span>
            </TabsTrigger>
            <TabsTrigger value="map" className="flex-1 gap-1 px-2">
              <Map className="size-4" />
              <span className="hidden sm:inline text-xs">{t('nav.map')}</span>
            </TabsTrigger>
            <TabsTrigger value="compendium" className="flex-1 gap-1 px-2">
              <Sparkles className="size-4" />
              <span className="hidden sm:inline text-xs">{t('nav.compendium')}</span>
            </TabsTrigger>
          </TabsList>
          {saveError && (
            <div className="mt-2 rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1 text-xs text-destructive">
              {saveError}
            </div>
          )}
        </header>

        <TabsContent value="character" className="mt-0 flex-1 overflow-hidden">
          {activeTab === 'character' && <CharacterSheet character={character} onChange={setCharacter} />}
        </TabsContent>
        <TabsContent value="inventory" className="mt-0 flex-1 overflow-hidden">
          {activeTab === 'inventory' && <Inventory inventory={inventory} onChange={setInventory} />}
        </TabsContent>
        <TabsContent value="spellbook" className="mt-0 flex-1 overflow-hidden">
          {activeTab === 'spellbook' && <Spellbook spellbook={spellbook} proficiencyBonus={character.proficiencyBonus} abilityScores={character.abilities} onChange={setSpellbook} />}
        </TabsContent>
        <TabsContent value="notes" className="mt-0 flex-1 overflow-hidden">
          {activeTab === 'notes' && <Notes notes={notes} onChange={setNotes} />}
        </TabsContent>
        <TabsContent value="map" className="mt-0 flex-1 overflow-hidden">
          {activeTab === 'map' && <PlayerMapViewer settings={mapSettings} onSettingsChange={setMapSettings} />}
        </TabsContent>
        <TabsContent value="compendium" className="mt-0 flex-1 overflow-y-auto px-4 py-4">
          <div className="mx-auto w-full max-w-4xl space-y-6">
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">{t('compendium.companionsTitle')}</h2>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => setIsCreateCompanionOpen(true)}>
                    <Plus className="mr-1 size-4" />
                    {t('compendium.addCustom')}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setIsImportCompanionOpen(true)}>
                    <Plus className="mr-1 size-4" />
                    {t('compendium.importTemplate')}
                  </Button>
                </div>
              </div>
              {companions.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('compendium.emptyCompanions')}</p>
              ) : (
                <div className="space-y-2">
                  {companions.map((companion) => (
                    <div key={companion.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-3">
                      <div>
                        <p className="font-medium">{companion.name_override || companion.entry?.name || t('compendium.unnamedCompanion')}</p>
                        <p className="text-xs text-muted-foreground">{companion.kind} · {companion.source_origin ?? 'custom'}</p>
                      </div>
                      <Button
                        variant={companion.is_active ? 'default' : 'outline'}
                        size="sm"
                        onClick={async () => {
                          await activateCompanion(companion.id, !companion.is_active)
                          await refreshCompendium()
                        }}
                      >
                        {companion.is_active ? t('compendium.active') : t('compendium.inactive')}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">{t('compendium.creaturesTitle')}</h2>
                <Button variant="outline" size="sm" onClick={() => void refreshCompendium()}>{t('fight.refresh')}</Button>
              </div>
              <Input
                value={compendiumSearch}
                onChange={(e) => setCompendiumSearch(e.target.value)}
                placeholder={t('compendium.searchPlaceholder')}
              />
              {compendiumError ? <p className="text-sm text-destructive">{compendiumError}</p> : null}
              {isCompendiumLoading ? <p className="text-sm text-muted-foreground">{t('common.loading')}</p> : null}
              {creatureRows.length === 0 && !isCompendiumLoading ? (
                <p className="text-sm text-muted-foreground">{t('compendium.emptyCreatures')}</p>
              ) : null}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {creatureRows.map((row) => (
                  <button
                    key={row.entry_id}
                    type="button"
                    onClick={() => setSelectedCreature({ entry: row.entry, isUnlocked: row.is_unlocked })}
                    className="rounded-lg border border-border bg-card p-3 text-left transition hover:border-primary/50"
                  >
                    <div className="mb-1 flex items-center justify-between gap-1">
                      <h3 className="truncate text-sm font-medium">{row.is_unlocked ? row.entry.name : t('compendium.unknownName')}</h3>
                      <Badge variant={row.is_unlocked ? 'default' : 'secondary'}>
                        {row.is_unlocked ? t('compendium.unlocked') : t('compendium.unknown')}
                      </Badge>
                    </div>
                    <p className="text-[11px] uppercase text-muted-foreground">{row.is_unlocked ? (row.entry.subtype ?? 'creature') : '???'}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{row.is_unlocked ? (row.entry.description || t('compendium.noSummary')) : t('compendium.lockedHint')}</p>
                  </button>
                ))}
              </div>
            </section>

          </div>
        </TabsContent>
      </Tabs>

      <Drawer open={!!selectedCreature} onOpenChange={(open) => !open && setSelectedCreature(null)} direction="right">
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{selectedCreature?.isUnlocked ? selectedCreature.entry.name : t('compendium.unknownName')}</DrawerTitle>
            <DrawerDescription>
              {selectedCreature?.isUnlocked ? `${statValue(selectedCreature.entry, 'size', 'Medium')} ${selectedCreature.entry.subtype ?? 'creature'}, ${statValue(selectedCreature.entry, 'alignment', 'Unaligned')}` : '???'}
            </DrawerDescription>
          </DrawerHeader>
          <div className="space-y-3 px-4 pb-6">
            <img
              src={selectedCreature?.isUnlocked && typeof selectedCreature.entry.data?.image === 'string' ? selectedCreature.entry.data.image : '/logo.svg'}
              alt={selectedCreature?.isUnlocked ? selectedCreature.entry.name : t('compendium.unknownName')}
              className="h-40 w-full rounded-md border border-border object-cover"
            />
            {selectedCreature?.isUnlocked ? (
              <div className="space-y-2 rounded-md border border-border p-3 text-sm">
                <div><span className="font-semibold">{t('compendium.stat.ac')}:</span> {statValue(selectedCreature.entry, 'ac')}</div>
                <div><span className="font-semibold">{t('compendium.stat.hp')}:</span> {statValue(selectedCreature.entry, 'hp')}</div>
                <div><span className="font-semibold">{t('compendium.stat.speed')}:</span> {statValue(selectedCreature.entry, 'speed')}</div>
                <div className="grid grid-cols-3 gap-1 text-xs">
                  {(['str', 'dex', 'con', 'int', 'wis', 'cha'] as const).map((key) => (
                    <div key={key} className="rounded bg-muted px-2 py-1 uppercase">
                      {key}: {statValue(selectedCreature.entry, key)}
                    </div>
                  ))}
                </div>
                {!!normalizeList(selectedCreature.entry.data?.skills).length && (
                  <div><span className="font-semibold">{t('compendium.stat.skills')}:</span> {normalizeList(selectedCreature.entry.data?.skills).join(', ')}</div>
                )}
                {!!normalizeList(selectedCreature.entry.data?.senses).length && (
                  <div><span className="font-semibold">{t('compendium.stat.senses')}:</span> {normalizeList(selectedCreature.entry.data?.senses).join(', ')}</div>
                )}
                {!!normalizeList(selectedCreature.entry.data?.traits).length && (
                  <div>
                    <div className="font-semibold">{t('compendium.stat.traits')}</div>
                    <ul className="list-disc pl-5">{normalizeList(selectedCreature.entry.data?.traits).map((trait) => <li key={trait}>{trait}</li>)}</ul>
                  </div>
                )}
                {!!normalizeList(selectedCreature.entry.data?.actions).length && (
                  <div>
                    <div className="font-semibold">{t('compendium.stat.actions')}</div>
                    <ul className="list-disc pl-5">{normalizeList(selectedCreature.entry.data?.actions).map((action) => <li key={action}>{action}</li>)}</ul>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t('compendium.lockedHint')}</p>
            )}
            <p className="text-sm text-muted-foreground">{selectedCreature?.isUnlocked ? (selectedCreature.entry.description || t('compendium.noSummary')) : null}</p>
          </div>
        </DrawerContent>
      </Drawer>

      <Dialog open={isCreateCompanionOpen} onOpenChange={setIsCreateCompanionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('compendium.createCompanionTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input value={customCompanionName} onChange={(e) => setCustomCompanionName(e.target.value)} placeholder={t('compendium.customName')} />
            <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={customCompanionKind} onChange={(e) => setCustomCompanionKind(e.target.value as CompanionKind)}>
              <option value="pet">Pet</option>
              <option value="mount">Mount</option>
              <option value="summon">Summon</option>
              <option value="familiar">Familiar</option>
            </select>
            <div className="grid grid-cols-3 gap-2">
              <Input value={customCompanionAc} onChange={(e) => setCustomCompanionAc(e.target.value)} placeholder="AC" />
              <Input value={customCompanionHp} onChange={(e) => setCustomCompanionHp(e.target.value)} placeholder="HP" />
              <Input value={customCompanionSpeed} onChange={(e) => setCustomCompanionSpeed(e.target.value)} placeholder="Speed" />
            </div>
            <Textarea value={customCompanionNotes} onChange={(e) => setCustomCompanionNotes(e.target.value)} placeholder={t('compendium.customNotes')} />
            <Button onClick={async () => {
              if (!companionCharacterId || !customCompanionName.trim()) return
              const entry = await createCompanionEntry({
                name: customCompanionName.trim(),
                kind: customCompanionKind,
                description: customCompanionNotes.trim() || undefined,
                data: {
                  ac: customCompanionAc || null,
                  hp: customCompanionHp || null,
                  speed: customCompanionSpeed || null,
                },
              })
              await assignCompanion({
                characterId: companionCharacterId,
                entryId: entry.id,
                kind: customCompanionKind,
                notes: customCompanionNotes.trim() || undefined,
                customData: { source: 'custom' },
              })
              setIsCreateCompanionOpen(false)
              setCustomCompanionName('')
              setCustomCompanionAc('')
              setCustomCompanionHp('')
              setCustomCompanionSpeed('')
              setCustomCompanionNotes('')
              await refreshCompendium()
            }}>{t('compendium.createCompanionAction')}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isImportCompanionOpen} onOpenChange={setIsImportCompanionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('compendium.importCompanionTitle')}</DialogTitle>
          </DialogHeader>
          {isCompanionTemplatesLoading ? (
            <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
          ) : companionTemplatesError ? (
            <p className="text-sm text-destructive">{companionTemplatesError}</p>
          ) : companionTemplates.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('compendium.noCompanionTemplates')}</p>
          ) : (
            <div className="space-y-3">
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={selectedCompanionTemplateId}
                onChange={(e) => setSelectedCompanionTemplateId(e.target.value)}
              >
                {companionTemplates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name} ({template.kind})
                  </option>
                ))}
              </select>
              <Button onClick={async () => {
                if (!companionCharacterId || !selectedCompanionTemplateId) return
                const template = companionTemplates.find((row) => row.id === selectedCompanionTemplateId)
                if (!template) return
                await assignCompanionFromTemplate({
                  characterId: companionCharacterId,
                  template,
                })
                setIsImportCompanionOpen(false)
                await refreshCompendium()
              }}>
                {t('compendium.importCompanionAction')}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!initiativePrompt} onOpenChange={() => {}}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('fight.initiativePromptTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('fight.initiativePromptDescription', { mod: initiativePrompt?.initiativeMod ?? 0 })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {initiativeError ? (
            <div className="rounded border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {initiativeError}
            </div>
          ) : null}
          <Input
            type="number"
            min={1}
            max={20}
            value={initiativeRollInput}
            onChange={(e) => setInitiativeRollInput(e.target.value)}
            placeholder={t('fight.initiativeRollPlaceholder')}
            className="text-center"
          />
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={async (e) => {
                e.preventDefault()
                if (!initiativePrompt || !user?.id) return
                const parsed = Number.parseInt(initiativeRollInput, 10)
                if (!Number.isFinite(parsed) || parsed < 1 || parsed > 20) {
                  setInitiativeError(t('fight.initiativeValidation'))
                  return
                }
                setIsSubmittingInitiative(true)
                try {
                  console.info('[ui:initiative] submit clicked', { userId: user.id, requestId: initiativePrompt.requestId, roll: parsed })
                  await submitPlayerInitiative(user.id, initiativePrompt.requestId, parsed)
                  setInitiativePrompt(null)
                  setInitiativeRollInput('')
                  setInitiativeError(null)
                  console.info('[ui:initiative] submit completed, modal closed', { userId: user.id, requestId: initiativePrompt.requestId })
                } catch (error) {
                  const message = formatErrorMessage(error, 'Failed to submit initiative.')
                  console.error('[ui:initiative] submit failed', { userId: user.id, requestId: initiativePrompt.requestId, error, message })
                  setInitiativeError(message)
                } finally {
                  setIsSubmittingInitiative(false)
                }
              }}
              disabled={isSubmittingInitiative}
            >
              {isSubmittingInitiative ? t('fight.submittingInitiative') : t('fight.submitInitiative')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  )
})
