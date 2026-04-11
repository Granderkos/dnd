'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { getActiveMap, type StoredMap } from '@/lib/supabase-data'
import { getActiveFight } from '@/lib/supabase-v3'
import { supabase } from '@/lib/supabase'
import { APP_VERSION } from '@/lib/app-config'

type TvSceneMode = 'exploration' | 'combat'

export function TvMapMode() {
  const { user, isLoading } = useAuth()
  const [activeMap, setActiveMap] = useState<StoredMap | null>(null)
  const [sceneMode, setSceneMode] = useState<TvSceneMode>('exploration')
  const [loadingMap, setLoadingMap] = useState(true)

  const refreshTvState = useCallback(async () => {
    if (!user?.id) return
    try {
      const [map, activeFight] = await Promise.all([
        getActiveMap(),
        getActiveFight(user.id),
      ])
      setActiveMap(map)
      setSceneMode(activeFight && (activeFight.status === 'active' || activeFight.status === 'collecting_initiative') ? 'combat' : 'exploration')
    } catch (error) {
      console.error('Failed to refresh TV map mode state', error)
    } finally {
      setLoadingMap(false)
    }
  }, [user?.id])

  useEffect(() => {
    if (!user?.id) return
    void refreshTvState()
    const poll = setInterval(() => void refreshTvState(), 10000)
    const channel = supabase
      .channel('tv-map-state')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'maps' }, () => { void refreshTvState() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fights' }, () => { void refreshTvState() })
      .subscribe()
    return () => {
      clearInterval(poll)
      void supabase.removeChannel(channel)
    }
  }, [refreshTvState, user?.id])

  const modeLabel = useMemo(() => (sceneMode === 'combat' ? 'Combat' : 'Exploration'), [sceneMode])

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
    </main>
  )
}
