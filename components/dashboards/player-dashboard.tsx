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
import { loadCurrentPlayerData, saveCurrentPlayerData } from '@/lib/supabase-data'
import {
  activateCompanion,
  assignCompanion,
  createCompanionEntry,
  getPendingInitiativeForUser,
  listCompanionEntries,
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

export const PlayerDashboard = memo(function PlayerDashboard() {
  const { user, logout, updateCurrentPage } = useAuth()
  const { t } = useI18n()
  const [isLoaded, setIsLoaded] = useState(false)
  const [activeTab, setActiveTab] = useState('character')
  const [character, setCharacter] = useState<Character>(emptyCharacter)
  const [spellbook, setSpellbook] = useState<SpellbookType>(emptySpellbook)
  const [inventory, setInventory] = useState<InventoryType>(emptyInventory)
  const [notes, setNotes] = useState<Note[]>([])
  const [mapSettings, setMapSettings] = useState<MapSettings>(defaultMapSettings)
  const [initiativePrompt, setInitiativePrompt] = useState<{ requestId: string; initiativeMod: number } | null>(null)
  const [initiativeRollInput, setInitiativeRollInput] = useState('')
  const [isSubmittingInitiative, setIsSubmittingInitiative] = useState(false)
  const [initiativeError, setInitiativeError] = useState<string | null>(null)
  const [creatureCompendium, setCreatureCompendium] = useState<Array<{ entry_id: string; is_unlocked: boolean; entry: Pick<CompendiumEntry, 'id' | 'name' | 'subtype' | 'description' | 'data'> }>>([])
  const [companionEntries, setCompanionEntries] = useState<Array<Pick<CompendiumEntry, 'id' | 'name' | 'subtype' | 'description' | 'data'>>>([])
  const [companions, setCompanions] = useState<Array<CharacterCompanion & { entry: Pick<CompendiumEntry, 'id' | 'name' | 'subtype' | 'description'> | null }>>([])
  const [companionCharacterId, setCompanionCharacterId] = useState<string | null>(null)
  const [selectedCompanionEntryId, setSelectedCompanionEntryId] = useState('')
  const [compendiumSearch, setCompendiumSearch] = useState('')
  const [isCreateCompanionOpen, setIsCreateCompanionOpen] = useState(false)
  const [customCompanionName, setCustomCompanionName] = useState('')
  const [customCompanionKind, setCustomCompanionKind] = useState<CompanionKind>('pet')
  const [customCompanionAc, setCustomCompanionAc] = useState('')
  const [customCompanionHp, setCustomCompanionHp] = useState('')
  const [customCompanionSpeed, setCustomCompanionSpeed] = useState('')
  const [customCompanionNotes, setCustomCompanionNotes] = useState('')
  const [compendiumError, setCompendiumError] = useState<string | null>(null)
  const [isCompendiumLoading, setIsCompendiumLoading] = useState(false)
  const [selectedCreature, setSelectedCreature] = useState<{ entry: Pick<CompendiumEntry, 'id' | 'name' | 'subtype' | 'description' | 'data'>; isUnlocked: boolean } | null>(null)

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
        setNotes(data.notes)
      } catch (e) {
        console.error('Failed to load player data', e)
      } finally {
        if (mounted) setIsLoaded(true)
      }
    })()
    return () => {
      mounted = false
    }
  }, [user?.id])

  useEffect(() => {
    void updateCurrentPage(activeTab)
  }, [activeTab, updateCurrentPage])

  const refreshInitiativePrompt = useCallback(async () => {
    if (!user?.id) return
    try {
      const pending = await getPendingInitiativeForUser(user.id)
      if (!pending) {
        setInitiativePrompt(null)
        setInitiativeRollInput('')
        setInitiativeError(null)
        return
      }
      setInitiativePrompt({ requestId: pending.requestId, initiativeMod: pending.initiativeMod })
      setInitiativeError(null)
    } catch (error) {
      const message = formatErrorMessage(error, 'Failed to check initiative request.')
      setInitiativeError(message)
    }
  }, [user?.id])

  const scheduleInitiativeRefreshBurst = useCallback(() => {
    const retryDelays = [0, 350, 1000, 2500]
    retryDelays.forEach((delay) => {
      window.setTimeout(() => {
        void refreshInitiativePrompt()
      }, delay)
    })
  }, [refreshInitiativePrompt])

  useEffect(() => {
    if (!user?.id) return
    void refreshInitiativePrompt()
  }, [refreshInitiativePrompt, user?.id])

  const refreshCompendium = useCallback(async () => {
    if (!user?.id) return
    setIsCompendiumLoading(true)
    setCompendiumError(null)
    try {
      const [creatures, allCompanionEntries, companionState] = await Promise.all([
        listCreatureCompendiumForUser(user.id),
        listCompanionEntries(),
        listCompanionsForUser(user.id),
      ])
      console.info('[compendium:player] refresh success', {
        userId: user.id,
        creatures: creatures.length,
        companions: companionState.companions.length,
      })
      setCreatureCompendium(creatures)
      setCompanionEntries(allCompanionEntries)
      setCompanions(companionState.companions)
      setCompanionCharacterId(companionState.characterId)
    } catch (error) {
      console.error('[compendium:player] refresh failed', { userId: user.id, error })
      setCompendiumError(formatErrorMessage(error, 'Failed to load compendium data.'))
    } finally {
      setIsCompendiumLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    if (!user?.id) return
    void refreshCompendium()
  }, [refreshCompendium, user?.id])

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
        if (status === 'SUBSCRIBED') {
          scheduleInitiativeRefreshBurst()
        }
      })

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [scheduleInitiativeRefreshBurst, user?.id])

  const flushSave = useDebouncedRemoteSave(
    { character, spellbook, inventory, notes },
    3000,
    isLoaded && !!user?.id,
    async (payload) => {
      if (!user?.id) return
      try {
        await saveCurrentPlayerData(user.id, payload)
      } catch (e) {
        console.error('Failed to save player data', e)
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

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">{t('compendium.companionsTitle')}</h2>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => setIsCreateCompanionOpen(true)}>
                    <Plus className="mr-1 size-4" />
                    {t('compendium.addCustom')}
                  </Button>
                </div>
              </div>
              <div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3 sm:flex-row sm:items-center">
                <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={selectedCompanionEntryId} onChange={(e) => setSelectedCompanionEntryId(e.target.value)}>
                  <option value="">{t('compendium.chooseCompanion')}</option>
                  {companionEntries.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
                </select>
                <Button size="sm" onClick={async () => {
                  if (!companionCharacterId || !selectedCompanionEntryId) return
                  const selected = companionEntries.find((entry) => entry.id === selectedCompanionEntryId)
                  const kind = (selected?.subtype ?? 'pet') as CompanionKind
                  await assignCompanion({ characterId: companionCharacterId, entryId: selectedCompanionEntryId, kind })
                  setSelectedCompanionEntryId('')
                  await refreshCompendium()
                }} disabled={!companionCharacterId || !selectedCompanionEntryId}>
                  {t('compendium.assignCompanion')}
                </Button>
              </div>
              {companions.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('compendium.emptyCompanions')}</p>
              ) : (
                <div className="space-y-2">
                  {companions.map((companion) => (
                    <div key={companion.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-3">
                      <div>
                        <p className="font-medium">{companion.name_override || companion.entry?.name || t('compendium.unnamedCompanion')}</p>
                        <p className="text-xs text-muted-foreground">{companion.kind}</p>
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
                  await submitPlayerInitiative(user.id, initiativePrompt.requestId, parsed)
                  setInitiativePrompt(null)
                  setInitiativeRollInput('')
                  setInitiativeError(null)
                } catch (error) {
                  const message = formatErrorMessage(error, 'Failed to submit initiative.')
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
