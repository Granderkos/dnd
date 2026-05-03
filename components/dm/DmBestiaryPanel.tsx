'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { MonsterCard } from '@/components/dm/MonsterCard'
import { addCompendiumMonsterToActiveFight, createCreature, listCreatures, updateCreature } from '@/lib/supabase-v3'
import type { CompendiumEntry } from '@/lib/v3-types'
import { useI18n } from '@/lib/i18n'
import { useAuth } from '@/lib/auth-context'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { resolveHpFromFormula } from '@/lib/hp-formula'
import { supabase } from '@/lib/supabase'

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
  const [viewingCreature, setViewingCreature] = useState<CompendiumEntry | null>(null)
  const [editingCreatureId, setEditingCreatureId] = useState<string | null>(null)
  const [customName, setCustomName] = useState('')
  const [customSize, setCustomSize] = useState('Medium')
  const [customType, setCustomType] = useState('Humanoid')
  const [customSubtype, setCustomSubtype] = useState('')
  const [customAlignment, setCustomAlignment] = useState('Unaligned')
  const [customAc, setCustomAc] = useState('10')
  const [customHp, setCustomHp] = useState('10')
  const [customHpFormula, setCustomHpFormula] = useState('')
  const [customSpeed, setCustomSpeed] = useState('30 ft.')
  const [customImageUrl, setCustomImageUrl] = useState('')
  const [customNotes, setCustomNotes] = useState('')
  const [customStr, setCustomStr] = useState('10')
  const [customDex, setCustomDex] = useState('10')
  const [customCon, setCustomCon] = useState('10')
  const [customInt, setCustomInt] = useState('10')
  const [customWis, setCustomWis] = useState('10')
  const [customCha, setCustomCha] = useState('10')
  const [createError, setCreateError] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [isUploadingImage, setIsUploadingImage] = useState(false)

  const hydrateEditorFromEntry = useCallback((entry: CompendiumEntry | null) => {
    const data = (entry?.data ?? {}) as Record<string, unknown>
    setCustomName(entry?.name ?? '')
    setCustomSize(String(data.size ?? 'Medium'))
    setCustomType(String(data.creature_type ?? 'Humanoid'))
    setCustomSubtype(String(data.subtype ?? ''))
    setCustomAlignment(String(data.alignment ?? 'Unaligned'))
    setCustomAc(String(numberFromData(data, 'ac', 10)))
    setCustomHp(String(numberFromData(data, 'hp', 10)))
    setCustomHpFormula(typeof data.hp_formula === 'string' ? data.hp_formula : '')
    setCustomSpeed(String(data.speed ?? '30 ft.'))
    setCustomImageUrl(String(data.image_url ?? data.image ?? ''))
    setCustomStr(String(numberFromData(data, 'str', 10)))
    setCustomDex(String(numberFromData(data, 'dex', 10)))
    setCustomCon(String(numberFromData(data, 'con', 10)))
    setCustomInt(String(numberFromData(data, 'int', 10)))
    setCustomWis(String(numberFromData(data, 'wis', 10)))
    setCustomCha(String(numberFromData(data, 'cha', 10)))
    setCustomNotes(entry?.description ?? '')
  }, [])

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



  const handleUploadImage = useCallback(async (file: File | null) => {
    if (!file || !user?.id) return
    setCreateError(null)
    setIsUploadingImage(true)
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'webp'
      const safeExt = ['png', 'jpg', 'jpeg', 'webp'].includes(ext) ? ext : 'webp'
      const path = `creatures/${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${safeExt}`
      const { error: uploadError } = await supabase.storage.from('portraits').upload(path, file, { upsert: true })
      if (uploadError) throw uploadError
      const { data } = supabase.storage.from('portraits').getPublicUrl(path)
      setCustomImageUrl(data.publicUrl)
    } catch (error) {
      console.error('Failed to upload creature image', error)
      setCreateError(formatError(error, 'Failed to upload image. Ensure Supabase storage bucket/policies allow upload.'))
    } finally {
      setIsUploadingImage(false)
    }
  }, [user?.id])
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
        hpFormula: typeof data.hp_formula === 'string' ? data.hp_formula : null,
        creatureType: typeof data.creature_type === 'string' ? data.creature_type : null,
        descriptionPreview: monster.description ?? null,
        imageUrl: typeof data.image_url === 'string' ? data.image_url : (typeof data.image === 'string' ? data.image : null),
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
      const data = (monster.data ?? {}) as Record<string, unknown>
      const hpFormula = typeof data.hp_formula === 'string' ? data.hp_formula : ''
      const numericHp = numberFromData(data, 'hp', 10)
      const resolvedHp = resolveHpFromFormula(numericHp, hpFormula).hp
      const normalizedMonster: CompendiumEntry = {
        ...monster,
        data: {
          ...data,
          hp: resolvedHp,
        },
      }
      const { entity } = await addCompendiumMonsterToActiveFight(user.id, normalizedMonster)
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
            <Button size="sm" variant="outline" onClick={() => {
              setEditingCreatureId(null)
              hydrateEditorFromEntry(null)
              setIsCreateOpen(true)
            }}>Add custom creature</Button>
          </div>
          {monsterCards.map((monster) => (
            <MonsterCard
              key={monster.id}
              isAdding={pendingEntryIds.includes(monster.id)}
              name={monster.name}
              hp={monster.hp}
              ac={monster.ac}
              initiativeBonus={monster.initiativeBonus}
              hpFormula={monster.hpFormula}
              creatureType={monster.creatureType}
              descriptionPreview={monster.descriptionPreview}
              imageUrl={monster.imageUrl}
              onView={() => setViewingCreature(monster.entry)}
              onEdit={((monster.entry.data ?? {}) as Record<string, unknown>).source_origin === 'custom'
                ? () => {
                    setEditingCreatureId(monster.entry.id)
                    hydrateEditorFromEntry(monster.entry)
                    setIsCreateOpen(true)
                  }
                : undefined}
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
            <DialogTitle>{editingCreatureId ? 'Edit custom creature' : 'Add custom creature'}</DialogTitle>
            <DialogDescription>{editingCreatureId ? 'Update existing custom bestiary creature entry.' : 'Create a custom bestiary creature entry.'}</DialogDescription>
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
            <label className="text-xs font-medium text-muted-foreground">
              HP Formula
              <Input placeholder="7d8 + 14" value={customHpFormula} onChange={(e) => setCustomHpFormula(e.target.value)} />
            </label>
            <label className="sm:col-span-2 text-xs font-medium text-muted-foreground">
              Creature Image
              <div className="space-y-2">
                <Input type="file" accept="image/png,image/jpeg,image/webp" disabled={isUploadingImage} onChange={(e) => { void handleUploadImage(e.target.files?.[0] ?? null) }} />
                <Input placeholder="Image URL (optional fallback)" value={customImageUrl} onChange={(e) => setCustomImageUrl(e.target.value)} />
                {isUploadingImage ? <p className="text-[11px] text-muted-foreground">Uploading image…</p> : null}
              </div>
            </label>
            <label className="sm:col-span-2 text-xs font-medium text-muted-foreground">
              Notes / Description
              <Textarea value={customNotes} onChange={(e) => setCustomNotes(e.target.value)} className="min-h-24 max-h-72 overflow-y-auto" />
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
                  const numericHpInput = Number(customHp) || 1
                  const hpResolution = resolveHpFromFormula(numericHpInput, customHpFormula)
                  const resolvedHp = hpResolution.hp
                  if (hpResolution.warning) {
                    setCreateError(hpResolution.warning)
                  }
                  const payload = {
                    name: customName.trim(),
                    description: customNotes.trim() || null,
                    data: {
                      size: customSize.trim() || 'Medium',
                      creature_type: customType.trim() || 'Humanoid',
                      subtype: customSubtype.trim() || null,
                      alignment: customAlignment.trim() || 'Unaligned',
                      ac: Number(customAc) || 10,
                      hp: resolvedHp,
                      hp_formula: customHpFormula.trim() || null,
                      speed: customSpeed.trim() || '30 ft.',
                      image_url: customImageUrl.trim() || null,
                      str: Number(customStr) || 10,
                      dex: Number(customDex) || 10,
                      con: Number(customCon) || 10,
                      int: Number(customInt) || 10,
                      wis: Number(customWis) || 10,
                      cha: Number(customCha) || 10,
                      source_origin: 'custom',
                    },
                  }
                  if (editingCreatureId) {
                    const existing = monsters.find((row) => row.id === editingCreatureId) ?? null
                    console.info('[bestiary:edit] saving creature', {
                      editingCreatureId,
                      existingRow: existing ? {
                        id: existing.id,
                        type: existing.type,
                        subtype: existing.subtype,
                        is_system: existing.is_system,
                        created_by: existing.created_by,
                        source_origin: ((existing.data ?? {}) as Record<string, unknown>).source_origin ?? null,
                      } : null,
                    })
                    const updated = await updateCreature(editingCreatureId, payload)
                    setMonsters((current) => current.map((row) => row.id === updated.id ? updated : row))
                    cachedMonsters = (cachedMonsters ?? monsters).map((row) => row.id === updated.id ? updated : row)
                  } else {
                    const creature = await createCreature({
                      subtype: 'monster',
                      slug: `custom-${customName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}-${Date.now()}`,
                      ...payload,
                    })
                    cachedMonsters = [...(cachedMonsters ?? monsters), creature]
                    setMonsters((current) => [...current, creature].sort((a, b) => a.name.localeCompare(b.name)))
                  }
                  setEditingCreatureId(null)
                  setIsCreateOpen(false)
                } catch (error) {
                  console.error('Failed to create custom creature', error)
                  setCreateError(formatError(error, 'Failed to save creature.'))
                } finally {
                  setIsCreating(false)
                }
              }}
            >
              {isCreating ? 'Saving…' : editingCreatureId ? 'Save changes' : 'Save creature'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!viewingCreature} onOpenChange={(open) => { if (!open) setViewingCreature(null) }}>
        <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewingCreature?.name ?? 'Creature detail'}</DialogTitle>
            <DialogDescription>Detailed creature preview.</DialogDescription>
          </DialogHeader>
          {viewingCreature ? (() => {
            const data = (viewingCreature.data ?? {}) as Record<string, unknown>
            return (
              <div className="space-y-2 text-sm">
                <img src={typeof data.image_url === 'string' ? data.image_url : (typeof data.image === 'string' ? data.image : '/logo.svg')} alt={viewingCreature.name} className="h-40 w-full rounded-md border object-cover" loading="lazy" />
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <div><b>Size</b>: {String(data.size ?? 'Medium')}</div>
                  <div><b>Type</b>: {String(data.creature_type ?? 'Humanoid')}</div>
                  <div><b>Subtype</b>: {String(data.subtype ?? '—')}</div>
                  <div><b>Alignment</b>: {String(data.alignment ?? 'Unaligned')}</div>
                  <div><b>AC</b>: {numberFromData(data, 'ac', 10)}</div>
                  <div><b>HP</b>: {numberFromData(data, 'hp', 10)}{typeof data.hp_formula === 'string' && data.hp_formula ? ` (${data.hp_formula})` : ''}</div>
                  <div><b>Speed</b>: {String(data.speed ?? '30 ft.')}</div>
                  <div><b>Initiative bonus</b>: {numberFromData(data, 'initiative_bonus', 0)}</div>
                </div>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {(['str', 'dex', 'con', 'int', 'wis', 'cha'] as const).map((ability) => (
                    <div key={ability} className="rounded border px-2 py-1 text-center"><b>{ability.toUpperCase()}</b><div>{numberFromData(data, ability, 10)}</div></div>
                  ))}
                </div>
                <div className="rounded border p-2 whitespace-pre-wrap break-words max-h-48 overflow-y-auto">
                  {viewingCreature.description?.trim() ? viewingCreature.description : 'No notes/description'}
                </div>
              </div>
            )
          })() : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
