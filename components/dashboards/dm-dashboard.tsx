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
import { clearFightEntities, endCombatForFight, ensureActivePlayerInitiativeRequest, finalizeInitiativeCollectionForFight, getActiveFight, listCharacterCombatState, listFightEntities, moveFightTurnToEnd, removeEntity, setFightEntityCurrentHp, startCombatForCampaign } from '@/lib/supabase-v3'
import type { FightStatus } from '@/lib/v3-types'
import type { FightEntity } from '@/lib/v3-types'
import { Character, calculateModifier, formatFeetWithSquares, formatModifier } from '@/lib/dnd-types'
import { AppControls } from '@/components/app/app-controls'
import { APP_VERSION } from '@/lib/app-config'
import { useI18n } from '@/lib/i18n'
import { supabase } from '@/lib/supabase'

interface PlayerCharacterData {
  id: string
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
  return Boolean(activity.is_online) && age < 180000
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

function isDownedEntity(entity: FightEntity) {
  return (entity.current_hp ?? 0) <= 0
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
  const [fightStatus, setFightStatus] = useState<FightStatus>('draft')
  const [fightError, setFightError] = useState<string | null>(null)
  const [isLoadingFight, setIsLoadingFight] = useState(false)
  const [isAdvancingTurn, setIsAdvancingTurn] = useState(false)
  const [isClearingFight, setIsClearingFight] = useState(false)
  const [isStartingCombat, setIsStartingCombat] = useState(false)
  const [isEndingCombat, setIsEndingCombat] = useState(false)
  const [characterCombatState, setCharacterCombatState] = useState<Record<string, { hpCurrent: number; hpMax: number; deathSuccesses: number; deathFailures: number }>>({})
  const [pendingRemoveIds, setPendingRemoveIds] = useState<string[]>([])
  const [pendingHpIds, setPendingHpIds] = useState<string[]>([])
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false)
  const fightLoadedRef = useRef(false)
  const hpPersistTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const confirmedHpRef = useRef<Record<string, number>>({})
  const fightRefreshInFlightRef = useRef(false)
  const fightRefreshQueuedRef = useRef(false)
  const fightRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      Object.values(hpPersistTimersRef.current).forEach((timeout) => clearTimeout(timeout))
      hpPersistTimersRef.current = {}
      if (fightRefreshTimerRef.current) clearTimeout(fightRefreshTimerRef.current)
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
    const loadPlayers = async () => {
      const t0 = Date.now()
      try {
        const playersData = await getAllPlayerCharacters()
        if (!mounted) return
        setPlayers(playersData as PlayerCharacterData[])
      } catch (e) {
        console.error('Failed to load DM players', e)
      } finally {
        console.log('[perf]', 'dm.loadPlayers', Date.now() - t0)
      }
    }
    const load = async () => {
      try {
        const notesData = await loadDmNotes()
        if (!mounted) return
        setDmNotes(notesData)
        void loadPlayers()
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

  useEffect(() => {
    const channel = supabase
      .channel('dm-player-activity')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'activity_status',
        },
        (payload) => {
          const next = payload.new as { user_id?: string; last_seen?: string; current_page?: string; is_online?: boolean } | null
          const userId = next?.user_id
          if (!userId) return
          setPlayers((prev) => {
            let changed = false
            const updated = prev.map((player) => {
              if (player.id !== userId) return player
              changed = true
              return {
                ...player,
                activity: {
                  last_seen: next.last_seen,
                  current_page: next.current_page,
                  is_online: next.is_online,
                },
              }
            })
            return changed ? updated : prev
          })

          if (fightId && fightStatus === 'collecting_initiative' && next?.is_online) {
            void ensureActivePlayerInitiativeRequest(fightId, userId)
          }
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [fightId, fightStatus])

  const loadFightState = useCallback(async (showLoader = true) => {
    const t0 = Date.now()
    if (!user?.id) return
    if (fightRefreshInFlightRef.current) {
      fightRefreshQueuedRef.current = true
      return
    }
    fightRefreshInFlightRef.current = true
    if (showLoader) setIsLoadingFight(true)
    setFightError(null)
    try {
      const activeFight = await getActiveFight(user.id)
      if (!activeFight) {
        setFightId(null)
        setFightStatus('draft')
        setFightEntities([])
        setCharacterCombatState({})
        fightLoadedRef.current = true
        return
      }
      const entities = await listFightEntities(activeFight.id)
      const characterIds = entities.map((entity) => entity.character_id).filter((id): id is string => Boolean(id))
      const combatRows = await listCharacterCombatState(characterIds)
      setFightId(activeFight.id)
      setFightStatus(activeFight.status)
      setFightEntities(entities)
      setCharacterCombatState(Object.fromEntries(combatRows.map((row) => [row.id, {
        hpCurrent: row.hp_current ?? 0,
        hpMax: row.hp_max ?? 0,
        deathSuccesses: row.death_successes ?? 0,
        deathFailures: row.death_failures ?? 0,
      }])))
      confirmedHpRef.current = Object.fromEntries(entities.map((entity) => [entity.id, entity.current_hp ?? 0]))
      fightLoadedRef.current = true
    } catch (e) {
      const message = formatErrorMessage(e, t('common.unknownError'))
      setFightError(message)
    } finally {
      console.log('[perf]', 'dm.loadFightState', Date.now() - t0)
      if (showLoader) setIsLoadingFight(false)
      fightRefreshInFlightRef.current = false
      if (fightRefreshQueuedRef.current) {
        fightRefreshQueuedRef.current = false
        void loadFightState(false)
      }
    }
  }, [t, user?.id])

  const scheduleFightRefresh = useCallback((delayMs = 120, showLoader = false) => {
    if (fightRefreshTimerRef.current) clearTimeout(fightRefreshTimerRef.current)
    fightRefreshTimerRef.current = setTimeout(() => {
      void loadFightState(showLoader)
    }, delayMs)
  }, [loadFightState])

  useEffect(() => {
    if (!fightId) return
    const channel = supabase
      .channel(`dm-character-combat-${fightId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'characters',
        },
        (payload) => {
          const updated = payload.new as { id?: string; hp_current?: number | null; hp_max?: number | null; death_successes?: number | null; death_failures?: number | null } | null
          const characterId = updated?.id
          if (!characterId) return
          setCharacterCombatState((prev) => {
            if (!prev[characterId]) return prev
            return {
              ...prev,
              [characterId]: {
                hpCurrent: updated.hp_current ?? prev[characterId].hpCurrent,
                hpMax: updated.hp_max ?? prev[characterId].hpMax,
                deathSuccesses: updated.death_successes ?? prev[characterId].deathSuccesses,
                deathFailures: updated.death_failures ?? prev[characterId].deathFailures,
              },
            }
          })
        }
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [fightId])

  useEffect(() => {
    if (activeTab === 'fight' && !fightLoadedRef.current) {
      void loadFightState(true)
    }
  }, [activeTab, loadFightState, user?.id])

  useEffect(() => {
    if (!user?.id) return
    let channel = supabase
      .channel(`dm-fight-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'fight_initiative_requests',
        },
        () => {
          if (!fightId) return
          void (async () => {
            try {
              await finalizeInitiativeCollectionForFight(fightId)
            } catch {
              // Ignore race conditions from simultaneous DM tabs.
            } finally {
              scheduleFightRefresh(80)
            }
          })()
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'fights',
          filter: `campaign_id=eq.${user.id}`,
        },
        () => {
          scheduleFightRefresh()
        }
      )

    if (fightId) {
      channel = channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'fight_entities',
          filter: `fight_id=eq.${fightId}`,
        },
        () => {
          scheduleFightRefresh()
        }
      )
    }

    channel = channel.subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [fightId, scheduleFightRefresh, user?.id])

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
    if (!fightId || fightEntities.length === 0 || isAdvancingTurn || fightStatus !== 'active') return
    const activeIndex = fightEntities.findIndex((entity) => !isDownedEntity(entity))
    if (activeIndex === -1) {
      setFightError(t('fight.allDowned'))
      return
    }
    const current = fightEntities[activeIndex]
    const rest = fightEntities.filter((_, index) => index !== activeIndex)
    const maxTurnOrder = fightEntities.reduce((max, entity) => Math.max(max, entity.turn_order ?? 0), 0)
    const nextTurnOrder = maxTurnOrder + 1
    const rotated = [...rest, { ...current, turn_order: nextTurnOrder }]
    window.setTimeout(() => {
      setFightEntities(rotated)
    }, 180)
    setIsAdvancingTurn(true)
    try {
      await moveFightTurnToEnd(current.id, nextTurnOrder)
    } catch (error) {
      setFightEntities(fightEntities)
      setFightError(formatErrorMessage(error, t('common.unknownError')))
    } finally {
      setIsAdvancingTurn(false)
    }
  }, [fightEntities, fightId, isAdvancingTurn, fightStatus, t])

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

  const handleStartCombat = useCallback(async () => {
    if (!user?.id || isStartingCombat) return
    setFightError(null)
    setIsStartingCombat(true)
    try {
      const fight = await startCombatForCampaign(user.id)
      setFightId(fight.id)
      setFightStatus('collecting_initiative')
      void loadFightState(false)
    } catch (error) {
      console.error('Failed to start combat', error)
      setFightError(formatErrorMessage(error, 'Failed to start combat'))
    } finally {
      setIsStartingCombat(false)
    }
  }, [isStartingCombat, user?.id])

  const handleEndCombat = useCallback(async () => {
    if (!fightId || isEndingCombat) return
    setIsEndingCombat(true)
    try {
      await endCombatForFight(fightId)
      setFightStatus('draft')
      setFightId(null)
      setFightEntities([])
    } catch (error) {
      setFightError(formatErrorMessage(error, t('common.unknownError')))
    } finally {
      setIsEndingCombat(false)
    }
  }, [fightId, isEndingCombat, t])

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
            fightStatus={fightStatus}
            isStartingCombat={isStartingCombat}
            isEndingCombat={isEndingCombat}
            onAdvanceTurn={handleAdvanceTurn}
            onRemoveEntity={handleRemoveEntity}
            onClearFight={() => setClearConfirmOpen(true)}
            onSetEntityHp={handleSetEntityHp}
            onStartCombat={handleStartCombat}
            onEndCombat={handleEndCombat}
            characterCombatState={characterCombatState}
            labels={{
              title: t('fight.title'),
              refresh: t('fight.refresh'),
              nextTurn: t('fight.nextTurn'),
              startCombat: t('fight.startCombat'),
              endCombat: t('fight.endCombat'),
              starting: t('fight.starting'),
              ending: t('fight.ending'),
              clearFight: t('fight.clearFight'),
              remove: t('fight.remove'),
              removing: t('fight.removing'),
              clearing: t('fight.clearing'),
              hpCurrent: t('fight.hpCurrent'),
              statusActive: t('fight.statusActive'),
              statusDowned: t('fight.statusDowned'),
              stateDraft: t('fight.stateDraft'),
              stateCollecting: t('fight.stateCollecting'),
              stateActive: t('fight.stateActive'),
              stateEnded: t('fight.stateEnded'),
              loading: t('fight.loading'),
              noActive: t('fight.noActiveFight'),
              noEntities: t('fight.noEntities'),
              noEntitiesCollecting: t('fight.noEntitiesCollecting'),
              noEntitiesDraft: t('fight.noEntitiesDraft'),
              allDowned: t('fight.allDowned'),
              initiative: t('fight.initiative'),
              hp: t('fight.hp'),
              ac: t('fight.ac'),
              deathSaves: t('fight.deathSaves'),
              deathSuccess: t('fight.deathSuccess'),
              deathFailure: t('fight.deathFailure'),
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
  fightStatus,
  isStartingCombat,
  isEndingCombat,
  onStartCombat,
  onEndCombat,
  characterCombatState,
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
  fightStatus: FightStatus
  isStartingCombat: boolean
  isEndingCombat: boolean
  onStartCombat: () => Promise<void>
  onEndCombat: () => Promise<void>
  characterCombatState: Record<string, { hpCurrent: number; hpMax: number; deathSuccesses: number; deathFailures: number }>
  labels: {
    title: string
    refresh: string
    nextTurn: string
    startCombat: string
    endCombat: string
    starting: string
    ending: string
    clearFight: string
    remove: string
    removing: string
    clearing: string
    hpCurrent: string
    statusActive: string
    statusDowned: string
    stateDraft: string
    stateCollecting: string
    stateActive: string
    stateEnded: string
    loading: string
    noActive: string
    noEntities: string
    noEntitiesCollecting: string
    noEntitiesDraft: string
    allDowned: string
    initiative: string
    hp: string
    ac: string
    deathSaves: string
    deathSuccess: string
    deathFailure: string
    clearConfirmTitle: string
    clearConfirmDescription: string
  }
}) {
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const activeEntity = entities.find((entity) => !isDownedEntity(entity)) ?? null
  const activeEntityId = activeEntity?.id ?? null
  const hasActiveTurn = Boolean(activeEntity)
  const emptyStateMessage = fightStatus === 'collecting_initiative'
    ? labels.noEntitiesCollecting
    : fightStatus === 'draft'
      ? labels.noEntitiesDraft
      : fightStatus === 'ended'
        ? labels.noActive
        : labels.noEntities
  const fightStateLabel = fightStatus === 'active'
    ? labels.stateActive
    : fightStatus === 'collecting_initiative'
      ? labels.stateCollecting
      : fightStatus === 'ended'
        ? labels.stateEnded
        : labels.stateDraft

  useEffect(() => {
    if (!activeEntityId) return
    rowRefs.current[activeEntityId]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [activeEntityId])

  if (isLoading) {
    return <div className="flex h-full items-center justify-center text-muted-foreground">{labels.loading}</div>
  }

  return (
    <div className="h-full overflow-y-auto p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold uppercase tracking-[0.08em] text-primary">{labels.title}</h2>
          <span className={`rounded px-2 py-0.5 text-[10px] font-medium uppercase ${
            fightStatus === 'active'
              ? 'bg-primary/15 text-primary'
              : fightStatus === 'ended'
                ? 'bg-muted text-muted-foreground'
                : 'bg-amber-500/15 text-amber-700'
          }`}>
            {fightStateLabel}
          </span>
        </div>
        <div className="flex gap-2">
          {fightStatus === 'active' || fightStatus === 'collecting_initiative' ? (
            <Button size="sm" variant="outline" onClick={() => void onEndCombat()} disabled={isEndingCombat}>
              {isEndingCombat ? labels.ending : labels.endCombat}
            </Button>
          ) : (
            <Button size="sm" onClick={() => void onStartCombat()} disabled={isStartingCombat || isClearingFight}>
              {isStartingCombat ? labels.starting : labels.startCombat}
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={onRefresh}>{labels.refresh}</Button>
          <Button size="sm" variant="outline" onClick={onClearFight} disabled={!fightId || entities.length === 0 || isClearingFight}>
            {isClearingFight ? labels.clearing : labels.clearFight}
          </Button>
          <Button size="sm" onClick={() => void onAdvanceTurn()} disabled={!fightId || entities.length === 0 || isAdvancingTurn || !hasActiveTurn || fightStatus !== 'active'}>{labels.nextTurn}</Button>
        </div>
      </div>
      {error ? <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</div> : null}
      {!fightId ? (
        <div className="rounded-lg border p-4 text-sm text-muted-foreground">{labels.noActive}</div>
      ) : entities.length === 0 ? (
        <div className="rounded-lg border p-4 text-sm text-muted-foreground">{emptyStateMessage}</div>
      ) : (
        <div className="space-y-2">
          {!activeEntity ? (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700">
              {labels.allDowned}
            </div>
          ) : null}
          {entities.map((entity, index) => (
            <Card
              key={entity.id}
              className={`transition-all duration-500 ease-out ${
                entity.id === activeEntityId
                  ? 'border-primary shadow-[0_0_0_1px_hsl(var(--primary)/0.45)] scale-100'
                  : 'scale-[0.98] opacity-95'
              } ${isDownedEntity(entity) ? 'border-destructive/40 bg-destructive/5' : ''}`}
            >
              <CardContent className="py-2.5 transition-all duration-500 ease-out">
                <div
                  ref={(node) => { rowRefs.current[entity.id] = node }}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 scroll-mt-24"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className={`truncate text-sm font-semibold ${isDownedEntity(entity) ? 'line-through opacity-70' : ''}`}>{entity.name}</div>
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${
                        isDownedEntity(entity)
                          ? 'bg-destructive/15 text-destructive'
                          : entity.id === activeEntityId
                            ? 'bg-primary/15 text-primary'
                            : 'bg-muted text-muted-foreground'
                      }`}>
                        {isDownedEntity(entity) ? labels.statusDowned : labels.statusActive}
                      </span>
                    </div>
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{entity.entity_type}</div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center justify-end gap-2 text-[11px] text-muted-foreground">
                      <span>{labels.initiative}: <span className="font-semibold text-foreground">{entity.initiative ?? '—'}</span></span>
                      <span>{labels.ac}: <span className="font-semibold text-foreground">{entity.notes?.startsWith('ac:') ? entity.notes.replace('ac:', '') : '—'}</span></span>
                    </div>
                    <div className="mt-2 w-full max-w-[280px] ml-auto">
                      <div className="mb-1.5 flex items-center justify-between text-[11px]">
                        <span className="text-muted-foreground">{labels.hp}</span>
                        <span className="font-semibold text-foreground">{entity.current_hp ?? 0} / {entity.max_hp ?? 0}</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${
                            (entity.current_hp ?? 0) <= 0 ? 'bg-destructive' : 'bg-primary'
                          }`}
                          style={{
                            width: `${Math.min(
                              100,
                              Math.max(0, Math.round(((entity.current_hp ?? 0) / Math.max(1, entity.max_hp ?? 1)) * 100))
                            )}%`,
                          }}
                        />
                      </div>
                      {entity.entity_type === 'player' && entity.character_id && characterCombatState[entity.character_id] ? (
                        <div className="mt-1.5 text-[11px] text-muted-foreground">
                          {labels.deathSaves}: {labels.deathSuccess} {characterCombatState[entity.character_id].deathSuccesses}/3 • {labels.deathFailure} {characterCombatState[entity.character_id].deathFailures}/3
                        </div>
                      ) : null}
                    </div>
                    <div className="mt-1.5 flex items-center justify-end gap-2">
                      <div className="flex items-center rounded-md border border-border bg-background/70 p-0.5">
                        <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-destructive hover:text-destructive" onClick={() => onSetEntityHp(entity.id, Math.max(0, (entity.current_hp ?? 0) - 5))} disabled={pendingHpIds.includes(entity.id)}>-5</Button>
                        <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-destructive hover:text-destructive" onClick={() => onSetEntityHp(entity.id, Math.max(0, (entity.current_hp ?? 0) - 1))} disabled={pendingHpIds.includes(entity.id)}>-1</Button>
                      </div>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={entity.current_hp ?? 0}
                        onChange={(e) => onSetEntityHp(entity.id, Number.parseInt(e.target.value, 10) || 0)}
                        className="h-6 w-16 rounded-md border border-border bg-background px-1 text-center text-xs font-semibold"
                        aria-label={labels.hpCurrent}
                      />
                      <div className="flex items-center rounded-md border border-border bg-background/70 p-0.5">
                        <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-primary hover:text-primary" onClick={() => onSetEntityHp(entity.id, (entity.current_hp ?? 0) + 1)} disabled={pendingHpIds.includes(entity.id)}>+1</Button>
                        <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-primary hover:text-primary" onClick={() => onSetEntityHp(entity.id, (entity.current_hp ?? 0) + 5)} disabled={pendingHpIds.includes(entity.id)}>+5</Button>
                      </div>
                    </div>
                    <div className="mt-1 flex justify-end">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-1.5 text-xs text-destructive hover:text-destructive"
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
