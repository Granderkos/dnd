'use client'

import { useEffect, useMemo, useState } from 'react'
import { MonsterCard } from '@/components/dm/MonsterCard'
import { addCompendiumMonsterToActiveFight, createCreature, listCreatures } from '@/lib/supabase-v3'
import type { CompendiumEntry } from '@/lib/v3-types'
import { useI18n } from '@/lib/i18n'
import { useAuth } from '@/lib/auth-context'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

function numberFromData(data: Record<string, unknown>, key: string, fallback = 0) {
  const value = data[key]
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : fallback
  }
  return fallback
}

function formatError(error: unknown, fallback: string) {
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

let cachedMonsters: CompendiumEntry[] | null = null
const SIZE_OPTIONS = ['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan'] as const
const CREATURE_TYPE_OPTIONS = ['Humanoid', 'Beast', 'Undead', 'Dragon', 'Fiend', 'Construct', 'Monstrosity', 'Aberration', 'Elemental'] as const
const ALIGNMENT_OPTIONS = ['Lawful Good', 'Neutral Good', 'Chaotic Good', 'Lawful Neutral', 'Neutral', 'Chaotic Neutral', 'Lawful Evil', 'Neutral Evil', 'Chaotic Evil', 'Unaligned'] as const

export function DmBestiaryPanel({ onMonsterAdded }: { onMonsterAdded?: () => void }) {
  const { t } = useI18n()
  const { user } = useAuth()
  const [monsters, setMonsters] = useState<CompendiumEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [pendingEntryIds, setPendingEntryIds] = useState<string[]>([])
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionSuccess, setActionSuccess] = useState<string | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [customName, setCustomName] = useState('')
  const [customSize, setCustomSize] = useState('Medium')
  const [customType, setCustomType] = useState('Humanoid')
  const [customSubtype, setCustomSubtype] = useState('')
  const [customAlignment, setCustomAlignment] = useState('Unaligned')
  const [customAc, setCustomAc] = useState('10')
  const [customHp, setCustomHp] = useState('10')
  const [customSpeed, setCustomSpeed] = useState('30 ft.')
  const [customNotes, setCustomNotes] = useState('')
  const [customStr, setCustomStr] = useState('10')
  const [customDex, setCustomDex] = useState('10')
  const [customCon, setCustomCon] = useState('10')
  const [customInt, setCustomInt] = useState('10')
  const [customWis, setCustomWis] = useState('10')
  const [customCha, setCustomCha] = useState('10')
  const [createError, setCreateError] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  useEffect(() => {
    let active = true
    const load = async () => {
      if (cachedMonsters) {
        setMonsters(cachedMonsters)
        setIsLoading(false)
        return
      }
      try {
        setLoadError(null)
        const rows = await listCreatures()
        if (!active) return
        cachedMonsters = rows
        setMonsters(rows)
      } catch (error) {
        console.error('Failed to load bestiary monsters', error)
        if (!active) return
        const message = formatError(error, t('common.unknownError'))
        setLoadError(message)
        setMonsters([])
      } finally {
        if (active) setIsLoading(false)
      }
    }

    void load()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (isCreateOpen) {
      setCreateError(null)
    }
  }, [isCreateOpen])

  const monsterCards = useMemo(() => {
    return monsters.map((monster) => {
      const data = (monster.data ?? {}) as Record<string, unknown>
      return {
        entry: monster,
        id: monster.id,
        name: monster.name,
        hp: numberFromData(data, 'hp', 0),
        ac: numberFromData(data, 'ac', 0),
        initiativeBonus: numberFromData(data, 'initiative_bonus', 0),
      }
    })
  }, [monsters])

  if (isLoading) {
    return <div className="flex h-full items-center justify-center text-muted-foreground">{t('common.loading')}</div>
  }

  const handleAddToFight = async (monster: CompendiumEntry) => {
    if (!user?.id) {
      setActionError(t('bestiary.mustBeLoggedIn'))
      setActionSuccess(null)
      return
    }
    if (pendingEntryIds.includes(monster.id)) return

    setPendingEntryIds((prev) => [...prev, monster.id])
    setActionError(null)
    setActionSuccess(null)
    try {
      const { entity } = await addCompendiumMonsterToActiveFight(user.id, monster)
      setActionSuccess(t('bestiary.addSuccess', { name: monster.name, initiative: `${entity.initiative ?? '—'}` }))
      onMonsterAdded?.()
    } catch (error) {
      console.error('Failed to add monster to fight', error)
      const message = formatError(error, t('common.unknownError'))
      setActionError(t('bestiary.addError', { name: monster.name, message }))
    } finally {
      setPendingEntryIds((prev) => prev.filter((id) => id !== monster.id))
    }
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto p-3">
      {loadError ? (
        <div className="mb-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {t('bestiary.loadError', { message: loadError })}
        </div>
      ) : null}
      {actionSuccess ? (
        <div className="mb-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-700">
          {actionSuccess}
        </div>
      ) : null}
      {actionError ? (
        <div className="mb-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {actionError}
        </div>
      ) : null}

      {monsterCards.length === 0 ? (
        <div className="rounded-lg border p-4 text-muted-foreground">{t('bestiary.empty')}</div>
      ) : (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button size="sm" variant="outline" onClick={() => setIsCreateOpen(true)}>Add custom creature</Button>
          </div>
          {monsterCards.map((monster) => (
            <MonsterCard
              key={monster.id}
              isAdding={pendingEntryIds.includes(monster.id)}
              name={monster.name}
              hp={monster.hp}
              ac={monster.ac}
              initiativeBonus={monster.initiativeBonus}
              isCustom={((monster.entry.data ?? {}) as Record<string, unknown>).source_origin === 'custom'}
              addToFightLabel={t('bestiary.addToFight')}
              onAddToFight={() => void handleAddToFight(monster.entry)}
            />
          ))}
        </div>
      )}

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add custom creature</DialogTitle>
            <DialogDescription>Create a custom bestiary creature entry.</DialogDescription>
          </DialogHeader>
          {createError ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
              {createError}
            </div>
          ) : null}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="sm:col-span-2 text-xs font-medium text-muted-foreground">
              Name
              <Input value={customName} onChange={(e) => setCustomName(e.target.value)} />
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              Size
              <Select value={customSize} onValueChange={setCustomSize}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SIZE_OPTIONS.map((size) => (
                    <SelectItem key={size} value={size}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              Creature Type
              <Select value={customType} onValueChange={setCustomType}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CREATURE_TYPE_OPTIONS.map((creatureType) => (
                    <SelectItem key={creatureType} value={creatureType}>
                      {creatureType}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              Subtype
              <Input value={customSubtype} onChange={(e) => setCustomSubtype(e.target.value)} />
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              Alignment
              <Select value={customAlignment} onValueChange={setCustomAlignment}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALIGNMENT_OPTIONS.map((alignment) => (
                    <SelectItem key={alignment} value={alignment}>
                      {alignment}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              Armor Class
              <Input type="number" placeholder="13" value={customAc} onChange={(e) => setCustomAc(e.target.value)} />
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              Hit Points
              <Input type="number" placeholder="22" value={customHp} onChange={(e) => setCustomHp(e.target.value)} />
            </label>
            <label className="sm:col-span-2 text-xs font-medium text-muted-foreground">
              Speed
              <Input placeholder="30 ft." value={customSpeed} onChange={(e) => setCustomSpeed(e.target.value)} />
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              STR
              <Input type="number" value={customStr} onChange={(e) => setCustomStr(e.target.value)} />
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              DEX
              <Input type="number" value={customDex} onChange={(e) => setCustomDex(e.target.value)} />
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              CON
              <Input type="number" value={customCon} onChange={(e) => setCustomCon(e.target.value)} />
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              INT
              <Input type="number" value={customInt} onChange={(e) => setCustomInt(e.target.value)} />
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              WIS
              <Input type="number" value={customWis} onChange={(e) => setCustomWis(e.target.value)} />
            </label>
            <label className="text-xs font-medium text-muted-foreground">
              CHA
              <Input type="number" value={customCha} onChange={(e) => setCustomCha(e.target.value)} />
            </label>
            <label className="sm:col-span-2 text-xs font-medium text-muted-foreground">
              Notes / Description
              <Textarea value={customNotes} onChange={(e) => setCustomNotes(e.target.value)} className="min-h-20 break-all" />
            </label>
          </div>
          <DialogFooter>
            <Button
              disabled={isCreating}
              onClick={async () => {
                if (!customName.trim() || isCreating) return
                setCreateError(null)
                setIsCreating(true)
                try {
                  const creature = await createCreature({
                    subtype: 'monster',
                    slug: `custom-${customName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}-${Date.now()}`,
                    name: customName.trim(),
                    description: customNotes.trim() || null,
                    data: {
                      size: customSize.trim() || 'Medium',
                      creature_type: customType.trim() || 'Humanoid',
                      subtype: customSubtype.trim() || null,
                      alignment: customAlignment.trim() || 'Unaligned',
                      ac: Number(customAc) || 10,
                      hp: Number(customHp) || 1,
                      speed: customSpeed.trim() || '30 ft.',
                      str: Number(customStr) || 10,
                      dex: Number(customDex) || 10,
                      con: Number(customCon) || 10,
                      int: Number(customInt) || 10,
                      wis: Number(customWis) || 10,
                      cha: Number(customCha) || 10,
                      source_origin: 'custom',
                    },
                  })
                  cachedMonsters = [...(cachedMonsters ?? monsters), creature]
                  setMonsters((current) => [...current, creature].sort((a, b) => a.name.localeCompare(b.name)))
                  setIsCreateOpen(false)
                } catch (error) {
                  console.error('Failed to create custom creature', error)
                  setCreateError(formatError(error, 'Failed to save creature.'))
                } finally {
                  setIsCreating(false)
                }
              }}
            >
              {isCreating ? 'Saving…' : 'Save creature'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
