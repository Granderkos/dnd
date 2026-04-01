'use client'

import { useEffect, useMemo, useRef, useState, memo } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { BookOpen, Crosshair, Eye, FileText, Heart, LogOut, Map, Shield, Users } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { loadDmNotes, saveDmNotes } from '@/lib/supabase-data'
import { DMMapManager } from '@/components/dnd/dm-map-manager'
import { DmBestiaryPanel } from '@/components/dm/DmBestiaryPanel'
import { advanceTurn, getActiveFight, listFightEntities } from '@/lib/supabase-v3'
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
        return
      }
      const entities = await listFightEntities(activeFight.id)
      setFightId(activeFight.id)
      setFightEntities(entities)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error'
      setFightError(message)
    } finally {
      setIsLoadingFight(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'fight') {
      void loadFightState()
    }
  }, [activeTab, user?.id])

  useDebouncedRemoteText(dmNotes, 500, isLoaded && !!user?.id, async (value) => {
    if (!user?.id) return
    await saveDmNotes(user.id, value)
  })

  const activePlayers = useMemo(() => players.filter((player) => isRecentlyActive(player.activity)), [players])

  if (!isLoaded) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mb-4 size-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="text-muted-foreground">{t('dashboard.loadingDm')}</p>
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-background">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex h-screen flex-col">
        <header className="border-b border-border bg-card px-3 py-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm font-bold uppercase tracking-[0.12em] text-primary">{t('dashboard.dmTitle')}</div>
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
            <TabsTrigger value="fight" className="flex-1 gap-1 px-2"><Crosshair className="size-4" /><span className="hidden sm:inline text-xs">Fight</span></TabsTrigger>
          </TabsList>
        </header>

        <TabsContent value="players" className="mt-0 flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-3 space-y-3">
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
          </ScrollArea>
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
            onAdvanceTurn={async () => {
              if (!fightId) return
              await advanceTurn(fightId)
              await loadFightState()
            }}
          />
        </TabsContent>
      </Tabs>

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
}: {
  fightId: string | null
  entities: FightEntity[]
  isLoading: boolean
  error: string | null
  onRefresh: () => void
  onAdvanceTurn: () => Promise<void>
}) {
  if (isLoading) {
    return <div className="flex h-full items-center justify-center text-muted-foreground">Loading fight…</div>
  }

  return (
    <div className="h-full overflow-y-auto p-3 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold uppercase tracking-[0.08em] text-primary">Fight</h2>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={onRefresh}>Refresh</Button>
          <Button size="sm" onClick={() => void onAdvanceTurn()} disabled={!fightId || entities.length === 0}>Next Turn</Button>
        </div>
      </div>
      {error ? <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</div> : null}
      {!fightId ? (
        <div className="rounded-lg border p-4 text-sm text-muted-foreground">No active fight yet. Add a monster from Bestiary to start.</div>
      ) : entities.length === 0 ? (
        <div className="rounded-lg border p-4 text-sm text-muted-foreground">Active fight has no entities.</div>
      ) : (
        <div className="space-y-2">
          {entities.map((entity, index) => (
            <Card key={entity.id} className={index === 0 ? 'border-primary' : ''}>
              <CardContent className="py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold">{entity.name}</div>
                    <div className="text-xs text-muted-foreground uppercase">{entity.entity_type}</div>
                  </div>
                  <div className="text-right text-sm">
                    <div>Init: <span className="font-semibold">{entity.initiative ?? '—'}</span></div>
                    <div>HP: <span className="font-semibold">{entity.current_hp ?? 0}/{entity.max_hp ?? 0}</span></div>
                    <div>AC: <span className="font-semibold">{entity.notes?.startsWith('ac:') ? entity.notes.replace('ac:', '') : '—'}</span></div>
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
            <div className="text-sm text-muted-foreground">{[info.race, `Level ${info.level}`].filter(Boolean).join(' • ')}</div>
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
  const proficient = proficientSkills(character)
  return (
    <div className="statblock-panel min-h-full overflow-hidden">
      <SheetHeader className="statblock-header pr-12">
        <SheetTitle className="text-3xl font-bold uppercase tracking-wide text-primary-foreground">{character.info.name || 'Unnamed Character'}</SheetTitle>
        <SheetDescription className="text-primary-foreground/90 italic">{buildTypeLine(character)}</SheetDescription>
      </SheetHeader>
      <div className="space-y-4 p-5">
        <div className="space-y-1 text-sm leading-6">
          <div><span className="statblock-label">Armor Class</span> {character.combat.armorClass}</div>
          <div><span className="statblock-label">Hit Points</span> {character.combat.maxHp} / {character.combat.currentHp}</div>
          <div><span className="statblock-label">Speed</span> {character.combat.speed} ft.</div>
          <div><span className="statblock-label">Level</span> {character.info.level} <span className="ml-4 statblock-label">Proficiency Bonus</span> {formatModifier(character.proficiencyBonus)}</div>
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
          {!!proficient && <div><span className="statblock-label">Skills</span> {proficient}</div>}
          <div><span className="statblock-label">Passive Perception</span> {character.passivePerception}</div>
          <div><span className="statblock-label">Languages</span> {character.languages || '—'}</div>
        </div>
        <div className="statblock-rule" />
        <div>
          <div className="mb-2 text-xl font-bold uppercase tracking-wide text-primary">Actions</div>
          <div className="space-y-3 text-sm leading-6">
            {character.attacks.length === 0 ? <div className="text-muted-foreground">No attacks added.</div> : character.attacks.map((attack) => (
              <div key={attack.id}><span className="font-bold">{attack.name}.</span>{' '}<span>{attack.damageType ? `${attack.damageType} Attack` : 'Attack'}: {attack.attackBonus} to hit.</span>{' '}<span><em>Hit:</em> {attack.damage}{attack.damageType ? ` ${attack.damageType}` : ''} damage.</span></div>
            ))}
          </div>
        </div>
        <div className="statblock-rule" />
        <div>
          <div className="mb-2 text-xl font-bold uppercase tracking-wide text-primary">Features & Traits</div>
          <div className="space-y-2 text-sm leading-6">
            {`${character.raceFeatures}\n${character.classFeatures}\n${character.backgroundFeatures}`.split('\n').map((line) => line.trim()).filter(Boolean).map((line, i) => <div key={`${line}-${i}`}><span className="font-bold">{line}.</span></div>)}
          </div>
        </div>
      </div>
    </div>
  )
}
