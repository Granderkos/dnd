'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { getActiveMap, type StoredMap } from '@/lib/supabase-data'
import { getActiveFight, listFightEntities } from '@/lib/supabase-v3'
import { supabase } from '@/lib/supabase'
import { APP_VERSION } from '@/lib/app-config'
import type { FightEntity } from '@/lib/v3-types'

type TvSceneMode = 'exploration' | 'combat'

function parseEntityConditions(notes: string | null) {
  if (!notes?.trim()) return []
  const conditionChunk = notes.split('|').map((part) => part.trim()).find((part) => part.startsWith('conditions:'))
  if (!conditionChunk) return []
  return conditionChunk.replace('conditions:', '').split(',').map((value) => value.trim()).filter(Boolean)
}

function isSkippedForTvOverlay(entity: FightEntity) {
  const conditions = parseEntityConditions(entity.notes)
  if (conditions.includes('Unconscious') || conditions.includes('Stunned')) return true
  if (entity.entity_type === 'player') return false
  if ((entity.current_hp ?? 0) <= 0) return true
  return conditions.includes('Downed')
}

export function TvMapMode() {
  const { user, isLoading } = useAuth()
  const [activeMap, setActiveMap] = useState<StoredMap | null>(null)
  const [sceneMode, setSceneMode] = useState<TvSceneMode>('exploration')
  const [roundNumber, setRoundNumber] = useState(1)
  const [currentTurn, setCurrentTurn] = useState<FightEntity | null>(null)
  const [nextTurn, setNextTurn] = useState<FightEntity | null>(null)
  const [loadingMap, setLoadingMap] = useState(true)
  const activeFightIdRef = useRef<string | null>(null)
  const refreshInFlightRef = useRef(false)
  const refreshQueuedRef = useRef(false)

  const refreshTvState = useCallback(async () => {
    if (!user?.id) return
    if (refreshInFlightRef.current) {
      refreshQueuedRef.current = true
      return
    }
    refreshInFlightRef.current = true
    try {
      const [map, activeFight] = await Promise.all([
        getActiveMap(),
        getActiveFight(user.id),
      ])
      setActiveMap(map)
      const isCombatActive = Boolean(activeFight && activeFight.status === 'active')
      setSceneMode(isCombatActive ? 'combat' : 'exploration')
      if (!isCombatActive || !activeFight) {
        activeFightIdRef.current = null
        setCurrentTurn(null)
        setNextTurn(null)
        setRoundNumber(1)
        return
      }
      activeFightIdRef.current = activeFight.id
      setRoundNumber(Math.max(1, activeFight.round_number ?? 1))
      const entities = await listFightEntities(activeFight.id)
      const activeEntity = entities.find((entity) => !isSkippedForTvOverlay(entity)) ?? null
      const activeEntityIndex = activeEntity ? entities.findIndex((entity) => entity.id === activeEntity.id) : -1
      const upcoming = activeEntityIndex >= 0
        ? entities.slice(activeEntityIndex + 1).concat(entities.slice(0, activeEntityIndex)).find((entity) => !isSkippedForTvOverlay(entity)) ?? null
        : null
      setCurrentTurn(activeEntity)
      setNextTurn(upcoming)
    } catch (error) {
      console.error('Failed to refresh TV map mode state', error)
    } finally {
      refreshInFlightRef.current = false
      if (refreshQueuedRef.current) {
        refreshQueuedRef.current = false
        void refreshTvState()
      }
      setLoadingMap(false)
    }
  }, [user?.id])

  useEffect(() => {
    if (!user?.id) return
    void refreshTvState()
    const poll = setInterval(() => void refreshTvState(), 2500)
    const channel = supabase
      .channel('tv-map-state')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'maps' }, () => { void refreshTvState() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fights' }, () => { void refreshTvState() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fight_entities' }, (payload) => {
        const row = payload.new as { fight_id?: string } | null
        const oldRow = payload.old as { fight_id?: string } | null
        const incomingFightId = row?.fight_id ?? oldRow?.fight_id ?? null
        if (!activeFightIdRef.current || !incomingFightId || incomingFightId === activeFightIdRef.current) {
          void refreshTvState()
        }
      })
      .subscribe()
    return () => {
      clearInterval(poll)
      void supabase.removeChannel(channel)
    }
  }, [refreshTvState, user?.id])

  const modeLabel = useMemo(() => (sceneMode === 'combat' ? 'Combat' : 'Exploration'), [sceneMode])
  const currentTurnLabel = currentTurn?.name ?? '—'
  const nextTurnLabel = nextTurn?.name ?? '—'

  if (isLoading || loadingMap) {
    return <div className="flex h-dvh items-center justify-center bg-background text-muted-foreground">Loading TV map…</div>
  }

  if (!user) {
    return <div className="flex h-dvh items-center justify-center bg-background text-muted-foreground">Sign in as DM to use TV mode.</div>
  }

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-black text-white">
      <div className="pointer-events-none absolute left-4 top-4 z-10 flex items-center gap-2">
        <span className="rounded bg-black/70 px-2 py-1 text-xs uppercase tracking-wide">{modeLabel}</span>
        <span className="rounded bg-black/70 px-2 py-1 text-xs">{activeMap?.name ?? 'No active map'}</span>
      </div>
      <div className="pointer-events-none absolute right-4 top-4 z-10 rounded bg-black/60 px-2 py-1 text-[10px] text-white/80">{APP_VERSION}</div>
      {!activeMap ? (
        <div className="flex h-full items-center justify-center text-center text-sm text-white/70">
          Waiting for DM to select an active map.
        </div>
      ) : (
        <div className="relative flex h-full w-full items-center justify-center">
          <img src={activeMap.imageData} alt={activeMap.name} className="max-h-full max-w-full object-contain" draggable={false} />
          {activeMap.gridEnabled ? (
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                backgroundImage: `linear-gradient(to right, rgba(255,255,255,${activeMap.gridOpacity ?? 0.3}) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,${activeMap.gridOpacity ?? 0.3}) 1px, transparent 1px)`,
                backgroundSize: `${activeMap.gridSize ?? 50}px ${(activeMap.gridSize ?? 50)}px`,
              }}
            />
          ) : null}
        </div>
      )}
      {sceneMode === 'combat' ? (
        <div className="pointer-events-none absolute bottom-5 left-1/2 z-10 w-[min(92vw,980px)] -translate-x-1/2 rounded-xl border border-white/20 bg-black/55 px-6 py-4 backdrop-blur-[1px]">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs uppercase tracking-[0.2em] text-white/75">ACTIVE COMBAT</span>
            <span className="text-lg font-semibold">Round {roundNumber}</span>
          </div>
          <div className="grid grid-cols-1 gap-3 text-center sm:grid-cols-2">
            <div className="rounded-lg bg-white/10 px-4 py-3">
              <div className="text-xs uppercase tracking-wider text-white/70">Current Turn</div>
              <div className="truncate text-2xl font-bold">{currentTurnLabel}</div>
            </div>
            <div className="rounded-lg bg-white/5 px-4 py-3">
              <div className="text-xs uppercase tracking-wider text-white/70">Next Turn</div>
              <div className="truncate text-xl font-semibold text-white/90">{nextTurnLabel}</div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}
