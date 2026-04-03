'use client'

import { useEffect, useMemo, useRef, useState, memo, useCallback } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { BookOpen, Crosshair, Eye, FileText, Heart, LogOut, Map, Shield, Users } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { loadDmNotes, saveDmNotes } from '@/lib/supabase-data'
import { DMMapManager } from '@/components/dnd/dm-map-manager'
import { DmBestiaryPanel } from '@/components/dm/DmBestiaryPanel'
import { clearFightEntities, getActiveFight, listFightEntities, moveFightTurnToEnd, removeEntity, setFightEntityCurrentHp } from '@/lib/supabase-v3'
import type { FightEntity } from '@/lib/v3-types'
import { Character, calculateModifier, formatModifier } from '@/lib/dnd-types'
import { AppControls } from '@/components/app/app-controls'
import { APP_VERSION } from '@/lib/app-config'
import { useI18n } from '@/lib/i18n'

interface PlayerCharacterData {
  username: string
  character: Character
  activity?: { last_seen?: string; current_page?: string; is_online?: boolean } | null
}
const DM_TAB_STORAGE_KEY = 'dnd:dm-active-tab'
const DM_TABS = new Set(['players', 'maps', 'notes'])

function useDebouncedRemoteText(value: string, delay: number, enabled: boolean, saveFn: (value: string) => Promise<void>) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!enabled) return
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      void saveFn(value)
    }, delay)
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [value, delay, enabled, saveFn])
}

function isRecentlyActive(activity?: PlayerCharacterData['activity']) {
  if (!activity?.last_seen) return false
  const age = Date.now() - new Date(activity.last_seen).getTime()
  return Boolean(activity.is_online) && age < 45000
}

const DM_DASHBOARD_TABS = ['players', 'maps', 'notes', 'bestiary', 'fight'] as const

function getInitialDmTab() {
  if (typeof window === 'undefined') return 'players'
  const saved = window.localStorage.getItem('dm-dashboard-active-tab')
  return saved && DM_DASHBOARD_TABS.includes(saved as (typeof DM_DASHBOARD_TABS)[number]) ? saved : 'players'
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
    return [message, details].filter(Boolean).join(' — ') || fallback
  }
  return fallback
}

export const DMDashboard = memo(function DMDashboard() {
  const { logout, getAllPlayerCharacters, updateCurrentPage, user } = useAuth()
  const { t } = useI18n()
  const [isLoaded, setIsLoaded] = useState(false)
  const [dmNotes, setDmNotes] = useState('')
  const [players, setPlayers] = useState<PlayerCharacterData[]>([])
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerCharacterData | null>(null)
  const [activeTab, setActiveTab] = useState(getInitialDmTab)
  const [fightEntities, setFightEntities] = useState<FightEntity[]>([])
  const [fightId, setFightId] = useState<string | null>(null)
  const [fightError, setFightError] = useState<string | null>(null)
  const [isLoadingFight, setIsLoadingFight] = useState(false)
  const [isAdvancingTurn, setIsAdvancingTurn] = useState(false)
  const [isClearingFight, setIsClearingFight] = useState(false)
  const [pendingRemoveIds, setPendingRemoveIds] = useState<string[]>([])
  const [pendingHpIds, setPendingHpIds] = useState<string[]>([])
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false)
  const fightLoadedRef = useRef(false)
  const hpPersistTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const confirmedHpRef = useRef<Record<string, number>>({})

  useEffect(() => {
    return () => {
      Object.values(hpPersistTimersRef.current).forEach((timeout) => clearTimeout(timeout))
      hpPersistTimersRef.current = {}
    }
  }, [])

  useEffect(() => {
    void updateCurrentPage(`dm:${activeTab}`)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('dm-dashboard-active-tab', activeTab)
    }
  }, [activeTab, updateCurrentPage])

  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        const [playersData, notesData] = await Promise.all([
          getAllPlayerCharacters(),
          loadDmNotes(),
        ])
        if (!mounted) return
        setPlayers(playersData as PlayerCharacterData[])
        setDmNotes(notesData)
      } catch (e) {
        console.error('Failed to load DM data', e)
      } finally {
        if (mounted) setIsLoaded(true)
      }
    }
    void load()
    return () => {
      mounted = false
    }
  }, [getAllPlayerCharacters])

  const loadFightState = async () => {
    if (!user?.id) return
    setIsLoadingFight(true)
    setFightError(null)
    try {
      const activeFight = await getActiveFight(user.id)
      if (!activeFight) {
        setFightId(null)
        setFightEntities([])
        fightLoadedRef.current = true
        return
      }
      const entities = await listFightEntities(activeFight.id)
      setFightId(activeFight.id)
      setFightEntities(entities)
      confirmedHpRef.current = Object.fromEntries(entities.map((entity) => [entity.id, entity.current_hp ?? 0]))
      fightLoadedRef.current = true
    } catch (e) {
      const message = formatErrorMessage(e, t('common.unknownError'))
      setFightError(message)
    } finally {
      setIsLoadingFight(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'fight' && !fightLoadedRef.current) {
      void loadFightState()
    }
  }, [activeTab, user?.id])

  useDebouncedRemoteText(dmNotes, 3000, isLoaded && !!user?.id, async (value) => {
    if (!user?.id) return
    await saveDmNotes(user.id, value)
  })

  const activePlayers = useMemo(() => players.filter((player) => isRecentlyActive(player.activity)), [players])

  const persistHp = useCallback((entityId: string, currentHp: number) => {
    if (hpPersistTimersRef.current[entityId]) {
      clearTimeout(hpPersistTimersRef.current[entityId])
    }
    setPendingHpIds((prev) => (prev.includes(entityId) ? prev : [...prev, entityId]))
    hpPersistTimersRef.current[entityId] = setTimeout(() => {
      void (async () => {
        try {
          await setFightEntityCurrentHp(entityId, currentHp)
          confirmedHpRef.current[entityId] = currentHp
        } catch (error) {
          const fallbackHp = confirmedHpRef.current[entityId] ?? 0
          setFightEntities((prev) => prev.map((entity) => (entity.id === entityId ? { ...entity, current_hp: fallbackHp } : entity)))
          setFightError(formatErrorMessage(error, t('common.unknownError')))
        } finally {
          delete hpPersistTimersRef.current[entityId]
          setPendingHpIds((prev) => prev.filter((id) => id !== entityId))
        }
      })()
    }, 250)
  }, [t])

  const handleAdvanceTurn = useCallback(async () => {
    if (!fightId || fightEntities.length === 0 || isAdvancingTurn) return
    const [current, ...rest] = fightEntities
    const maxTurnOrder = fightEntities.reduce((max, entity) => Math.max(max, entity.turn_order ?? 0), 0)
    const nextTurnOrder = maxTurnOrder + 1
    const rotated = [...rest, { ...current, turn_order: nextTurnOrder }]
    setFightEntities(rotated)
    setIsAdvancingTurn(true)
    try {
      await moveFightTurnToEnd(current.id, nextTurnOrder)
    } catch (error) {
      setFightEntities(fightEntities)
      setFightError(formatErrorMessage(error, t('common.unknownError')))
    } finally {
      setIsAdvancingTurn(false)
    }
  }, [fightEntities, fightId, isAdvancingTurn, t])

  const handleRemoveEntity = useCallback(async (entityId: string) => {
    if (pendingRemoveIds.includes(entityId)) return
    const previous = fightEntities
    const next = fightEntities.filter((entity) => entity.id !== entityId)
    setFightEntities(next)
    setPendingRemoveIds((prev) => [...prev, entityId])
    try {
      await removeEntity(entityId)
      delete confirmedHpRef.current[entityId]
    } catch (error) {
      setFightEntities(previous)
      setFightError(formatErrorMessage(error, t('common.unknownError')))
    } finally {
      setPendingRemoveIds((prev) => prev.filter((id) => id !== entityId))
    }
  }, [fightEntities, pendingRemoveIds, t])

  const handleClearFight = useCallback(async () => {
    if (!fightId || isClearingFight) return
    const previous = fightEntities
    setFightEntities([])
    setIsClearingFight(true)
    setClearConfirmOpen(false)
    try {
      await clearFightEntities(fightId)
      confirmedHpRef.current = {}
    } catch (error) {
      setFightEntities(previous)
      setFightError(formatErrorMessage(error, t('common.unknownError')))
    } finally {
      setIsClearingFight(false)
    }
  }, [fightEntities, fightId, isClearingFight, t])

  const handleSetEntityHp = useCallback((entityId: string, value: number) => {
    const normalized = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0
    setFightEntities((prev) => prev.map((entity) => (entity.id === entityId ? { ...entity, current_hp: normalized } : entity)))
    persistHp(entityId, normalized)
  }, [persistHp])

  if (!isLoaded) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <div className="text-center">
          <div className="mb-4 size-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="text-muted-foreground">{t('dashboard.loadingDm')}</p>
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-dvh bg-background">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex min-h-dvh flex-col">
        <header className="border-b border-border bg-card px-3 py-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.12em] text-primary">
              <img src="/logo.svg" alt="DnD Compendium logo" className="size-5 shrink-0" />
              <span>{t('dashboard.dmTitle')}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground">{APP_VERSION}</span>
              <AppControls />
              <Button variant="ghost" size="icon" className="size-8" onClick={() => void logout()}>
                <LogOut className="size-4" />
              </Button>
            </div>
          </div>
          <TabsList className="w-full justify-between">
            <TabsTrigger value="players" className="flex-1 gap-1 px-2"><Users className="size-4" /><span className="hidden sm:inline text-xs">{t('nav.players')}</span></TabsTrigger>
            <TabsTrigger value="maps" className="flex-1 gap-1 px-2"><Map className="size-4" /><span className="hidden sm:inline text-xs">{t('nav.maps')}</span></TabsTrigger>
            <TabsTrigger value="notes" className="flex-1 gap-1 px-2"><FileText className="size-4" /><span className="hidden sm:inline text-xs">{t('nav.notes')}</span></TabsTrigger>
            <TabsTrigger value="bestiary" className="flex-1 gap-1 px-2"><BookOpen className="size-4" /><span className="hidden sm:inline text-xs">{t('nav.bestiary')}</span></TabsTrigger>
            <TabsTrigger value="fight" className="flex-1 gap-1 px-2"><Crosshair className="size-4" /><span className="hidden sm:inline text-xs">{t('nav.fight')}</span></TabsTrigger>
          </TabsList>
        </header>

        <TabsContent value="players" className="mt-0 flex-1 overflow-hidden">
            <div className="h-full min-h-0 overflow-y-auto p-3 space-y-3">
              <div className="text-base font-bold uppercase tracking-[0.08em] text-primary">{t('dashboard.activePlayers')}</div>
              {activePlayers.length === 0 ? (
                <Card><CardContent className="py-6 text-sm text-muted-foreground">{t('dashboard.noActivePlayers')}</CardContent></Card>
              ) : (
                <div className="space-y-3">{activePlayers.map((player) => <PlayerCard key={`active-${player.username}`} data={player} onOpen={() => setSelectedPlayer(player)} active />)}</div>
              )}

              <div className="pt-2 text-base font-bold uppercase tracking-[0.08em] text-primary">{t('dashboard.allPlayers')}</div>
              {players.length === 0 ? (
                <Card><CardContent className="py-8 text-center"><Users className="size-12 text-muted-foreground mx-auto mb-3" /><p className="text-muted-foreground">{t('dashboard.noPlayers')}</p></CardContent></Card>
              ) : (
                <div className="space-y-3">{players.map((player) => <PlayerCard key={player.username} data={player} onOpen={() => setSelectedPlayer(player)} active={isRecentlyActive(player.activity)} />)}</div>
              )}
            </div>
        </TabsContent>

        <TabsContent value="maps" className="mt-0 flex-1 overflow-hidden"><DMMapManager /></TabsContent>

        <TabsContent value="notes" className="mt-0 flex-1 overflow-hidden">
          <div className="h-full flex flex-col p-3">
            <div className="mb-3 text-base font-bold uppercase tracking-[0.08em] text-primary">{t('dashboard.dmNotes')}</div>
            <Textarea value={dmNotes} onChange={(e) => setDmNotes(e.target.value)} placeholder={t('dashboard.dmNotesPlaceholder')} className="flex-1 min-h-[300px] resize-none" />
            <p className="mt-2 text-xs text-muted-foreground">{t('dashboard.autoSaves')}</p>
          </div>
        </TabsContent>
        <TabsContent value="bestiary" className="mt-0 flex-1 overflow-hidden"><DmBestiaryPanel onMonsterAdded={() => void loadFightState()} /></TabsContent>
        <TabsContent value="fight" className="mt-0 flex-1 overflow-hidden">
          <DMFightPanel
            fightId={fightId}
            entities={fightEntities}
            isLoading={isLoadingFight}
            error={fightError}
            onRefresh={() => void loadFightState()}
            isAdvancingTurn={isAdvancingTurn}
            isClearingFight={isClearingFight}
            pendingRemoveIds={pendingRemoveIds}
            pendingHpIds={pendingHpIds}
            onAdvanceTurn={handleAdvanceTurn}
            onRemoveEntity={handleRemoveEntity}
            onClearFight={() => setClearConfirmOpen(true)}
            onSetEntityHp={handleSetEntityHp}
            labels={{
              title: t('fight.title'),
              refresh: t('fight.refresh'),
              nextTurn: t('fight.nextTurn'),
              clearFight: t('fight.clearFight'),
              remove: t('fight.remove'),
              removing: t('fight.removing'),
              clearing: t('fight.clearing'),
              hpCurrent: t('fight.hpCurrent'),
              loading: t('fight.loading'),
              noActive: t('fight.noActiveFight'),
              noEntities: t('fight.noEntities'),
              initiative: t('fight.initiative'),
              hp: t('fight.hp'),
              ac: t('fight.ac'),
              clearConfirmTitle: t('fight.clearConfirmTitle'),
              clearConfirmDescription: t('fight.clearConfirmDescription'),
            }}
          />
        </TabsContent>
      </Tabs>

      <AlertDialog open={clearConfirmOpen} onOpenChange={setClearConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('fight.clearConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('fight.clearConfirmDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleClearFight()}>{t('common.confirm')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Sheet open={!!selectedPlayer} onOpenChange={(open) => !open && setSelectedPlayer(null)}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto p-0">
          {selectedPlayer && <CharacterSummary character={selectedPlayer.character} />}
        </SheetContent>
      </Sheet>
    </main>
  )
})

function DMFightPanel({
  fightId,
  entities,
  isLoading,
  error,
  onRefresh,
  onAdvanceTurn,
  onRemoveEntity,
  onClearFight,
  onSetEntityHp,
  isAdvancingTurn,
  isClearingFight,
  pendingRemoveIds,
  pendingHpIds,
  labels,
}: {
  fightId: string | null
  entities: FightEntity[]
  isLoading: boolean
  error: string | null
  onRefresh: () => void
  onAdvanceTurn: () => Promise<void>
  onRemoveEntity: (entityId: string) => Promise<void>
  onClearFight: () => void
  onSetEntityHp: (entityId: string, value: number) => void
  isAdvancingTurn: boolean
  isClearingFight: boolean
  pendingRemoveIds: string[]
  pendingHpIds: string[]
  labels: {
    title: string
    refresh: string
    nextTurn: string
    clearFight: string
    remove: string
    removing: string
    clearing: string
    hpCurrent: string
    loading: string
    noActive: string
    noEntities: string
    initiative: string
    hp: string
    ac: string
    clearConfirmTitle: string
    clearConfirmDescription: string
  }
}) {
  const [activePulseId, setActivePulseId] = useState<string | null>(null)
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const activeEntityId = entities[0]?.id ?? null

  useEffect(() => {
    if (!activeEntityId) return
    setActivePulseId(activeEntityId)
    rowRefs.current[activeEntityId]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    const timeout = window.setTimeout(() => setActivePulseId((current) => (current === activeEntityId ? null : current)), 750)
    return () => window.clearTimeout(timeout)
  }, [activeEntityId])

  if (isLoading) {
    return <div className="flex h-full items-center justify-center text-muted-foreground">{labels.loading}</div>
  }

  return (
    <div className="h-full overflow-y-auto p-3 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold uppercase tracking-[0.08em] text-primary">{labels.title}</h2>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={onRefresh}>{labels.refresh}</Button>
          <Button size="sm" variant="outline" onClick={onClearFight} disabled={!fightId || entities.length === 0 || isClearingFight}>
            {isClearingFight ? labels.clearing : labels.clearFight}
          </Button>
          <Button size="sm" onClick={() => void onAdvanceTurn()} disabled={!fightId || entities.length === 0 || isAdvancingTurn}>{labels.nextTurn}</Button>
        </div>
      </div>
      {error ? <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</div> : null}
      {!fightId ? (
        <div className="rounded-lg border p-4 text-sm text-muted-foreground">{labels.noActive}</div>
      ) : entities.length === 0 ? (
        <div className="rounded-lg border p-4 text-sm text-muted-foreground">{labels.noEntities}</div>
      ) : (
        <div className="space-y-2">
          {entities.map((entity, index) => (
            <Card
              key={entity.id}
              className={index === 0 ? 'border-primary' : ''}
            >
              <CardContent className={`py-3 transition-colors ${activePulseId === entity.id ? 'bg-primary/10' : ''}`}>
                <div ref={(node) => { rowRefs.current[entity.id] = node }} className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold">{entity.name}</div>
                    <div className="text-xs text-muted-foreground uppercase">{entity.entity_type}</div>
                  </div>
                  <div className="text-right text-sm space-y-1">
                    <div>{labels.initiative}: <span className="font-semibold">{entity.initiative ?? '—'}</span></div>
                    <div>{labels.hp}: <span className="font-semibold">{entity.current_hp ?? 0}/{entity.max_hp ?? 0}</span></div>
                    <div>{labels.ac}: <span className="font-semibold">{entity.notes?.startsWith('ac:') ? entity.notes.replace('ac:', '') : '—'}</span></div>
                    <div className="flex items-center justify-end gap-1">
                      <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => onSetEntityHp(entity.id, Math.max(0, (entity.current_hp ?? 0) - 5))} disabled={pendingHpIds.includes(entity.id)}>-5</Button>
                      <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => onSetEntityHp(entity.id, Math.max(0, (entity.current_hp ?? 0) - 1))} disabled={pendingHpIds.includes(entity.id)}>-1</Button>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={entity.current_hp ?? 0}
                        onChange={(e) => onSetEntityHp(entity.id, Number.parseInt(e.target.value, 10) || 0)}
                        className="h-7 w-16 rounded border border-border bg-background px-2 text-center text-xs"
                        aria-label={labels.hpCurrent}
                      />
                      <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => onSetEntityHp(entity.id, (entity.current_hp ?? 0) + 1)} disabled={pendingHpIds.includes(entity.id)}>+1</Button>
                      <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => onSetEntityHp(entity.id, (entity.current_hp ?? 0) + 5)} disabled={pendingHpIds.includes(entity.id)}>+5</Button>
                    </div>
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-destructive hover:text-destructive"
                        onClick={() => void onRemoveEntity(entity.id)}
                        disabled={pendingRemoveIds.includes(entity.id)}
                      >
                        {pendingRemoveIds.includes(entity.id) ? labels.removing : labels.remove}
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

const PlayerCard = memo(function PlayerCard({ data, onOpen, active }: { data: PlayerCharacterData; onOpen: () => void; active?: boolean }) {
  const { t } = useI18n()
  const { username, character } = data
  const info = character.info
  const combat = character.combat
  return (
    <button className="w-full text-left" onClick={onOpen}>
      <Card className="overflow-hidden hover:border-primary/60 transition-colors">
        <div className="bg-primary px-5 py-3 text-primary-foreground">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-lg font-bold uppercase tracking-wide flex items-center gap-2">{info.name || `(${username})`}{active ? <span className="inline-block size-2 rounded-full bg-green-400" /> : null}</div>
              <div className="text-xs italic opacity-90">{[info.class, info.subclass].filter(Boolean).join(' ') || t('dashboard.unassignedCharacter')}</div>
            </div>
            <Eye className="size-4 shrink-0 opacity-80" />
          </div>
        </div>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-center">
            <div className="text-sm text-muted-foreground">{[info.race, t('character.levelWithValue', { value: info.level })].filter(Boolean).join(' • ')}</div>
            <div className="flex items-center gap-1 text-sm"><Heart className="size-4 text-destructive" /> {combat.currentHp}/{combat.maxHp}</div>
            <div className="flex items-center gap-1 text-sm"><Shield className="size-4 text-primary" /> {combat.armorClass}</div>
          </div>
        </CardContent>
      </Card>
    </button>
  )
})

function proficientSkills(character: Character) {
  return character.skills
    .filter((skill) => skill.proficient)
    .map((skill) => `${skill.name} ${formatModifier(calculateModifier(character.abilities[skill.ability].value) + character.proficiencyBonus)}`)
    .join(', ')
}

function buildTypeLine(character: Character) {
  const parts = ['Medium Humanoid', character.info.race, character.info.class]
  const subclass = character.info.subclass ? `(${character.info.subclass})` : ''
  return `${parts.filter(Boolean).join(', ')} ${subclass}`.trim()
}

function CharacterSummary({ character }: { character: Character }) {
  const { t, language } = useI18n()
  const proficient = proficientSkills(character)
  return (
    <div className="statblock-panel min-h-full overflow-hidden">
      <SheetHeader className="statblock-header pr-12">
        <SheetTitle className="text-3xl font-bold uppercase tracking-wide text-primary-foreground">{character.info.name || t('dashboard.unnamedCharacter')}</SheetTitle>
        <SheetDescription className="text-primary-foreground/90 italic">{buildTypeLine(character)}</SheetDescription>
      </SheetHeader>
      <div className="space-y-4 p-5">
        <div className="space-y-1 text-sm leading-6">
          <div><span className="statblock-label">{t('dashboard.armorClass')}</span> {character.combat.armorClass}</div>
          <div><span className="statblock-label">{t('dashboard.hitPoints')}</span> {character.combat.maxHp} / {character.combat.currentHp}</div>
          <div><span className="statblock-label">{t('dashboard.speed')}</span> {formatFeetWithSquares(`${character.combat.speed} ft`, language)}</div>
          <div><span className="statblock-label">{t('character.level')}</span> {character.info.level} <span className="ml-4 statblock-label">{t('character.proficiencyBonus')}</span> {formatModifier(character.proficiencyBonus)}</div>
        </div>
        <div className="statblock-rule" />
        <div className="statblock-abilities">
          {(['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] as const).map((ability) => {
            const score = character.abilities[ability].value
            return <div key={ability}><div className="text-xs font-bold uppercase tracking-wide text-primary">{ability}</div><div className="text-base font-semibold">{score} ({formatModifier(calculateModifier(score))})</div></div>
          })}
        </div>
        <div className="statblock-rule" />
        <div className="space-y-2 text-sm leading-6">
          {!!proficient && <div><span className="statblock-label">{t('character.skills')}</span> {proficient}</div>}
          <div><span className="statblock-label">{t('dashboard.passivePerception')}</span> {character.passivePerception}</div>
          <div><span className="statblock-label">{t('dashboard.languages')}</span> {character.languages || '—'}</div>
        </div>
        <div className="statblock-rule" />
        <div>
          <div className="mb-2 text-xl font-bold uppercase tracking-wide text-primary">{t('dashboard.actions')}</div>
          <div className="space-y-3 text-sm leading-6">
            {character.attacks.length === 0 ? <div className="text-muted-foreground">{t('dashboard.noAttacks')}</div> : character.attacks.map((attack) => (
              <div key={attack.id}><span className="font-bold">{attack.name}.</span>{' '}<span>{attack.damageType ? `${attack.damageType} Attack` : 'Attack'}: {attack.attackBonus} to hit.</span>{' '}<span><em>Hit:</em> {attack.damage}{attack.damageType ? ` ${attack.damageType}` : ''} damage.</span></div>
            ))}
          </div>
        </div>
        <div className="statblock-rule" />
        <div>
          <div className="mb-2 text-xl font-bold uppercase tracking-wide text-primary">{t('character.combat.featuresTraits')}</div>
          <div className="space-y-2 text-sm leading-6">
            {`${character.raceFeatures}\n${character.classFeatures}\n${character.backgroundFeatures}`.split('\n').map((line) => line.trim()).filter(Boolean).map((line, i) => <div key={`${line}-${i}`}><span className="font-bold">{line}.</span></div>)}
          </div>
        </div>
      </div>
    </div>
  )
}
