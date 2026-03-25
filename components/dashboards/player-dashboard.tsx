'use client'

import { useState, useEffect, useRef, memo, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import type { Note } from '@/components/dnd/notes'
import { useAuth } from '@/lib/auth-context'
import { emptyCharacter, emptyInventory, emptySpellbook } from '@/lib/auth-types'
import { loadCurrentPlayerData, saveCurrentPlayerData } from '@/lib/supabase-data'
import {
  Character,
  Spellbook as SpellbookType,
  Inventory as InventoryType,
  MapSettings,
} from '@/lib/dnd-types'
import { User, BookOpen, Package, FileText, Map, LogOut } from 'lucide-react'
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
const PLAYER_TAB_STORAGE_KEY = 'dnd:player-active-tab'
const PLAYER_TABS = new Set(['character', 'inventory', 'spellbook', 'notes', 'map'])

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

  useEffect(() => {
    const storedTab = window.localStorage.getItem(PLAYER_TAB_STORAGE_KEY)
    if (storedTab && PLAYER_TABS.has(storedTab)) setActiveTab(storedTab)
  }, [])

  useEffect(() => {
    window.localStorage.setItem(PLAYER_TAB_STORAGE_KEY, activeTab)
  }, [activeTab])

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

  const flushSave = useDebouncedRemoteSave(
    { character, spellbook, inventory, notes },
    1500,
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

  useEffect(() => {
    if (!isLoaded) return
    flushSave()
  }, [isLoaded, flushSave])

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
      </Tabs>
    </main>
  )
})
