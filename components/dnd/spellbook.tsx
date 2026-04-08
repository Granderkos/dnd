'use client'

import { useState, memo, useCallback, useMemo, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
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
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, X, Eye, Zap, BookOpen } from 'lucide-react'
import { listSpellTemplates, type SpellTemplateRecord } from '@/lib/supabase-data'
import {
  Spellbook as SpellbookType,
  Spell,
  AbilityName,
  calculateModifier,
  formatModifier,
  formatFeetWithSquares,
} from '@/lib/dnd-types'
import { useI18n } from '@/lib/i18n'

interface SpellbookProps {
  spellbook: SpellbookType
  proficiencyBonus: number
  abilityScores: Record<AbilityName, { value: number; proficient: boolean }>
  onChange: (spellbook: SpellbookType) => void
}

export function Spellbook({
  spellbook,
  proficiencyBonus,
  abilityScores,
  onChange,
}: SpellbookProps) {
  const { t } = useI18n()
  const [selectedSpell, setSelectedSpell] = useState<Spell | null>(null)
  const [isAddingSpell, setIsAddingSpell] = useState(false)
  const [newSpellLevel, setNewSpellLevel] = useState(0)
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean
    title: string
    description: string
    onConfirm: () => void
  }>({ open: false, title: '', description: '', onConfirm: () => {} })

  const spellcastingMod = useMemo(
    () => calculateModifier(abilityScores[spellbook.spellcastingAbility].value),
    [abilityScores, spellbook.spellcastingAbility],
  )
  const calculatedDC = 8 + proficiencyBonus + spellcastingMod
  const calculatedAttack = proficiencyBonus + spellcastingMod

  const updateSpellcastingAbility = useCallback((ability: AbilityName) => {
    onChange({ ...spellbook, spellcastingAbility: ability })
  }, [spellbook, onChange, t])

  const toggleSlot = useCallback((level: number, index: number) => {
    const currentSlots = spellbook.slots[level]
    const newExpended = index < currentSlots.expended ? index : index + 1
    onChange({
      ...spellbook,
      slots: {
        ...spellbook.slots,
        [level]: { ...currentSlots, expended: Math.min(newExpended, currentSlots.total) },
      },
    })
  }, [spellbook, onChange, t])

  const updateSlotTotal = useCallback((level: number, total: number) => {
    onChange({
      ...spellbook,
      slots: {
        ...spellbook.slots,
        [level]: {
          total: Math.max(0, total),
          expended: Math.min(spellbook.slots[level].expended, Math.max(0, total)),
        },
      },
    })
  }, [spellbook, onChange])

  const toggleSpellPrepared = useCallback((spellId: string, spellName: string, isCantrip: boolean, currentlyPrepared: boolean) => {
    setConfirmDialog({
      open: true,
      title: currentlyPrepared ? t('spellbook.unprepareTitle') : t('spellbook.prepareTitle'),
      description: currentlyPrepared ? t('spellbook.unprepareDescription', { name: spellName }) : t('spellbook.prepareDescription', { name: spellName }),
      onConfirm: () => {
        if (isCantrip) {
          const newCantrips = spellbook.cantrips.map((s) => (s.id === spellId ? { ...s, prepared: !s.prepared } : s))
          onChange({ ...spellbook, cantrips: newCantrips })
        } else {
          const newSpells = spellbook.spells.map((s) => (s.id === spellId ? { ...s, prepared: !s.prepared } : s))
          onChange({ ...spellbook, spells: newSpells })
        }
      },
    })
  }, [spellbook, onChange, t])

  const deleteSpell = useCallback((spellId: string, spellName: string, isCantrip: boolean) => {
    setConfirmDialog({
      open: true,
      title: t('spellbook.deleteTitle'),
      description: t('spellbook.deleteDescription', { name: spellName }),
      onConfirm: () => {
        if (isCantrip) {
          onChange({ ...spellbook, cantrips: spellbook.cantrips.filter((s) => s.id !== spellId) })
        } else {
          onChange({ ...spellbook, spells: spellbook.spells.filter((s) => s.id !== spellId) })
        }
      },
    })
  }, [spellbook, onChange, t])

  const addSpell = useCallback((spell: Spell) => {
    const duplicate = [...spellbook.cantrips, ...spellbook.spells].some(
      (existing) => existing.name.trim().toLowerCase() === spell.name.trim().toLowerCase() && existing.level === spell.level
    )
    if (duplicate) {
      setConfirmDialog({
        open: true,
        title: t('spellbook.duplicateTitle'),
        description: t('spellbook.duplicateDescription', { name: spell.name }),
        onConfirm: () => {
          if (spell.level === 0) {
            onChange({ ...spellbook, cantrips: [...spellbook.cantrips, spell] })
          } else {
            onChange({ ...spellbook, spells: [...spellbook.spells, spell] })
          }
          setIsAddingSpell(false)
        },
      })
      return
    }
    if (spell.level === 0) {
      onChange({ ...spellbook, cantrips: [...spellbook.cantrips, spell] })
    } else {
      onChange({ ...spellbook, spells: [...spellbook.spells, spell] })
    }
    setIsAddingSpell(false)
  }, [spellbook, onChange])

  const getSpellsByLevel = useCallback((level: number) => spellbook.spells.filter((s) => s.level === level), [spellbook.spells])

  return (
    <ScrollArea className="h-[calc(100vh-4rem)]">
      <div className="flex flex-col gap-3 p-3">
        <Card>
          <CardContent className="pt-4">
            <div className="grid grid-cols-3 gap-2">
              <div className="flex flex-col items-center justify-center rounded-lg border bg-muted/30 p-3">
                <span className="text-xs text-muted-foreground">{t('spellbook.ability')}</span>
                <Select value={spellbook.spellcastingAbility} onValueChange={(v) => updateSpellcastingAbility(v as AbilityName)}>
                  <SelectTrigger className="mt-1 h-9 w-full border-0 bg-transparent text-center text-lg font-bold shadow-none">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INT">INT</SelectItem>
                    <SelectItem value="WIS">WIS</SelectItem>
                    <SelectItem value="CHA">CHA</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col items-center justify-center rounded-lg border bg-primary/10 p-3">
                <span className="text-xs text-muted-foreground">{t('spellbook.spellDc')}</span>
                <span className="mt-1 text-2xl font-bold">{calculatedDC}</span>
              </div>
              <div className="flex flex-col items-center justify-center rounded-lg border bg-muted/30 p-3">
                <span className="text-xs text-muted-foreground">{t('spellbook.attack')}</span>
                <span className="mt-1 text-2xl font-bold">{formatModifier(calculatedAttack)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-[0.08em]">
                <span className="flex size-6 items-center justify-center rounded bg-muted text-xs font-bold">0</span>
                {t('spellbook.cantrips')}
              </CardTitle>
              <Button size="sm" variant="outline" className="h-8" onClick={() => { setNewSpellLevel(0); setIsAddingSpell(true) }}>
                <Plus className="size-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {spellbook.cantrips.map((spell) => (
                <SpellRow key={spell.id} spell={spell} onClick={() => setSelectedSpell(spell)} onTogglePrepared={() => toggleSpellPrepared(spell.id, spell.name, true, spell.prepared)} onDelete={() => deleteSpell(spell.id, spell.name, true)} isCantrip />
              ))}
            </div>
          </CardContent>
        </Card>

        {[1,2,3,4,5,6,7,8,9].map((level) => {
          const slots = spellbook.slots[level]
          const spells = getSpellsByLevel(level)
          if (slots.total === 0 && spells.length === 0) return null
          return (
            <Card key={level}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-[0.08em]">
                    <span className="flex size-6 items-center justify-center rounded bg-muted text-xs font-bold">{level}</span>
                    {t('spellbook.level', { level })}
                  </CardTitle>
                  <Button size="sm" variant="outline" className="h-8" onClick={() => { setNewSpellLevel(level); setIsAddingSpell(true) }}>
                    <Plus className="size-4" />
                  </Button>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">{t('spellbook.slots')}</span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {Array.from({ length: slots.total }).map((_, i) => (
                      <button key={i} onClick={() => toggleSlot(level, i)} className={`size-5 rounded-full border-2 transition-colors ${i < slots.expended ? 'border-muted-foreground bg-muted-foreground' : 'border-primary bg-transparent hover:bg-primary/20'}`} />
                    ))}
                  </div>
                  <div className="ml-auto flex items-center gap-1">
                    <Button size="icon" variant="ghost" className="size-6" onClick={() => updateSlotTotal(level, slots.total - 1)}>-</Button>
                    <span className="w-5 text-center text-xs">{slots.total}</span>
                    <Button size="icon" variant="ghost" className="size-6" onClick={() => updateSlotTotal(level, slots.total + 1)}>+</Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-1.5">
                  {spells.map((spell) => (
                    <SpellRow key={spell.id} spell={spell} onClick={() => setSelectedSpell(spell)} onTogglePrepared={() => toggleSpellPrepared(spell.id, spell.name, false, spell.prepared)} onDelete={() => deleteSpell(spell.id, spell.name, false)} />
                  ))}
                </div>
              </CardContent>
            </Card>
          )
        })}

        {[1,2,3,4,5,6,7,8,9].map((level) => {
          const slots = spellbook.slots[level]
          const spells = getSpellsByLevel(level)
          if (slots.total > 0 || spells.length > 0) return null
          return (
            <Card key={level} className="opacity-50 transition-opacity hover:opacity-100">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-[0.08em]">
                    <span className="flex size-6 items-center justify-center rounded bg-muted text-xs font-bold">{level}</span>
                    {t('spellbook.level', { level })}
                  </CardTitle>
                  <Button size="sm" variant="outline" className="h-8" onClick={() => { setNewSpellLevel(level); setIsAddingSpell(true) }}>
                    <Plus className="size-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-center text-sm text-muted-foreground">{t('spellbook.noSpells')}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Dialog open={!!selectedSpell} onOpenChange={() => setSelectedSpell(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          {selectedSpell && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <span className="truncate">{selectedSpell.name}</span>
                  {selectedSpell.level > 0 && <Badge variant="secondary" className="shrink-0">{t('spellbook.level', { level: selectedSpell.level })}</Badge>}
                </DialogTitle>
                <DialogDescription className="sr-only">{t('spellbook.spellDetails')}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {selectedSpell.ritual && <Badge variant="outline" className="gap-1"><BookOpen className="size-3" /> {t('spellbook.ritual')}</Badge>}
                  {selectedSpell.concentration && <Badge variant="outline" className="gap-1"><Eye className="size-3" /> {t('spellbook.concentration')}</Badge>}
                  {selectedSpell.reaction && <Badge variant="outline" className="gap-1"><Zap className="size-3" /> {t('spellbook.reaction')}</Badge>}
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-muted-foreground">{t('spellbook.castingTime')}: </span><span className="break-words">{selectedSpell.castingTime}</span></div>
                  <div><span className="text-muted-foreground">{t('spellbook.range')}: </span><span className="break-words">{formatFeetWithSquares(selectedSpell.range)}</span></div>
                  <div><span className="text-muted-foreground">{t('spellbook.duration')}: </span><span className="break-words">{selectedSpell.duration}</span></div>
                  {selectedSpell.damage && <div><span className="text-muted-foreground">{t('spellbook.damage')}: </span><span className="break-words">{selectedSpell.damage}</span></div>}
                </div>
                <p className="text-sm whitespace-pre-wrap break-words">{selectedSpell.description}</p>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AddSpellDialog open={isAddingSpell} onOpenChange={setIsAddingSpell} level={newSpellLevel} onAdd={addSpell} />

      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmDialog.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDialog.onConfirm}>{t('common.confirm')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ScrollArea>
  )
}

interface SpellRowProps {
  spell: Spell
  onClick: () => void
  onTogglePrepared: () => void
  onDelete: () => void
  isCantrip?: boolean
}

const SpellRow = memo(function SpellRow({ spell, onClick, onTogglePrepared, onDelete, isCantrip }: SpellRowProps) {
  const { t } = useI18n()
  return (
    <div className="flex items-center gap-2 rounded border bg-muted/30 px-2 py-2">
      {!isCantrip && <Checkbox checked={spell.prepared} onCheckedChange={onTogglePrepared} title={t('spellbook.prepared')} className="size-5 shrink-0" />}
      <button onClick={onClick} className="min-w-0 flex-1 text-left">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate max-w-[120px]">{spell.name}</span>
          <div className="flex shrink-0 gap-1">
            {spell.sourceOrigin === 'template' ? <Badge variant="secondary" className="h-5 px-1.5 text-xs">T</Badge> : null}
            {spell.ritual && <Badge variant="outline" className="h-5 px-1.5 text-xs">R</Badge>}
            {spell.concentration && <Badge variant="outline" className="h-5 px-1.5 text-xs">C</Badge>}
            {spell.reaction && <Badge variant="outline" className="h-5 px-1.5 text-xs"><Zap className="size-3" /></Badge>}
          </div>
        </div>
        <p className="text-xs text-muted-foreground truncate max-w-[180px] mt-0.5">{spell.castingTime} | {spell.range} | {spell.duration}</p>
      </button>
      <Button size="icon" variant="ghost" onClick={onDelete} className="size-8 shrink-0 text-destructive hover:text-destructive"><X className="size-4" /></Button>
    </div>
  )
})

interface AddSpellDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  level: number
  onAdd: (spell: Spell) => void
}

function AddSpellDialog({ open, onOpenChange, level, onAdd }: AddSpellDialogProps) {
  const { t } = useI18n()
  const [mode, setMode] = useState<'custom' | 'template'>('custom')
  const [templates, setTemplates] = useState<SpellTemplateRecord[]>([])
  const [templateQuery, setTemplateQuery] = useState('')
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false)
  const initialSpell = useCallback((): Partial<Spell> => ({
    name: '',
    level,
    ritual: false,
    concentration: false,
    reaction: false,
    castingTime: '1 action',
    range: '',
    duration: '',
    description: '',
    damage: '',
    prepared: level === 0,
  }), [level])
  const [spell, setSpell] = useState<Partial<Spell>>(initialSpell())

  const filteredTemplates = useMemo(
    () =>
      templates.filter((entry) => {
        const q = templateQuery.trim().toLowerCase()
        if (!q) return true
        return entry.name.toLowerCase().includes(q) || (entry.school ?? '').toLowerCase().includes(q)
      }),
    [templateQuery, templates]
  )

  const importTemplate = useCallback((entry: SpellTemplateRecord) => {
    onAdd({
      id: `tpl-${entry.id}-${Date.now()}`,
      name: entry.name,
      level: entry.is_cantrip ? 0 : Number(entry.spell_level || 1),
      ritual: entry.is_ritual,
      concentration: entry.is_concentration,
      reaction: entry.is_reaction,
      castingTime: entry.casting_time || '1 action',
      range: entry.range_text || '',
      duration: entry.duration_text || '',
      description: entry.description || '',
      damage: entry.dice || '',
      prepared: entry.is_cantrip,
      sourceOrigin: 'template',
      sourceSpellTemplateId: entry.id,
      templateSnapshot: {
        id: entry.id,
        name: entry.name,
        spell_level: entry.spell_level,
        school: entry.school,
        casting_time: entry.casting_time,
        range_text: entry.range_text,
        duration_text: entry.duration_text,
        components: entry.components,
        dice: entry.dice,
        description: entry.description,
        is_cantrip: entry.is_cantrip,
        is_ritual: entry.is_ritual,
        is_concentration: entry.is_concentration,
        is_reaction: entry.is_reaction,
      },
    })
  }, [onAdd])

  useEffect(() => {
    if (!open || mode !== 'template') return
    let mounted = true
    setIsLoadingTemplates(true)
    void (async () => {
      try {
        const data = await listSpellTemplates()
        if (!mounted) return
        setTemplates(data)
      } catch (error) {
        console.error('Failed to load spell templates', error)
      } finally {
        if (mounted) setIsLoadingTemplates(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [open, mode])

  const handleSubmit = () => {
    if (spell.name) {
      onAdd({ ...spell, id: Date.now().toString(), level, sourceOrigin: 'custom', sourceSpellTemplateId: null, templateSnapshot: null } as Spell)
      setSpell(initialSpell())
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{level === 0 ? t('spellbook.addCantrip') : t('spellbook.addSpell', { level })}</DialogTitle>
          <DialogDescription className="sr-only">{t('spellbook.enterSpellDetails')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Button variant={mode === 'custom' ? 'default' : 'outline'} onClick={() => setMode('custom')}>
              {t('spellbook.createCustom')}
            </Button>
            <Button variant={mode === 'template' ? 'default' : 'outline'} onClick={() => setMode('template')}>
              {t('spellbook.importTemplate')}
            </Button>
          </div>
          {mode === 'template' ? (
            <div className="space-y-2">
              <Input value={templateQuery} onChange={(e) => setTemplateQuery(e.target.value)} placeholder={t('spellbook.searchTemplates')} />
              <div className="max-h-72 space-y-2 overflow-y-auto">
                {isLoadingTemplates ? (
                  <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
                ) : filteredTemplates.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('common.empty')}</p>
                ) : (
                  filteredTemplates.map((entry) => (
                    <button
                      key={entry.id}
                      className="w-full rounded border px-3 py-2 text-left hover:bg-muted/30"
                      onClick={() => importTemplate(entry)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium">{entry.name}</span>
                        <Badge variant="outline">{t('spellbook.level', { level: entry.is_cantrip ? 0 : entry.spell_level })}</Badge>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{entry.description}</p>
                    </button>
                  ))
                )}
              </div>
            </div>
          ) : null}
          {mode === 'custom' ? (
            <>
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">{t('spellbook.name')}</label>
                <Input value={spell.name} onChange={(e) => setSpell({ ...spell, name: e.target.value })} placeholder={t('spellbook.spellName')} className="h-10" />
              </div>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm"><Checkbox checked={spell.ritual} onCheckedChange={(checked) => setSpell({ ...spell, ritual: !!checked })} />{t('spellbook.ritual')}</label>
                <label className="flex items-center gap-2 text-sm"><Checkbox checked={spell.concentration} onCheckedChange={(checked) => setSpell({ ...spell, concentration: !!checked })} />{t('spellbook.concentration')}</label>
                <label className="flex items-center gap-2 text-sm"><Checkbox checked={spell.reaction} onCheckedChange={(checked) => setSpell({ ...spell, reaction: !!checked })} />{t('spellbook.reaction')}</label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-sm text-muted-foreground">{t('spellbook.castingTime')}</label>
                  <Input value={spell.castingTime} onChange={(e) => setSpell({ ...spell, castingTime: e.target.value })} placeholder="1 action" className="h-10" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm text-muted-foreground">{t('spellbook.range')}</label>
                  <Input value={spell.range} onChange={(e) => setSpell({ ...spell, range: e.target.value })} placeholder="60 feet" className="h-10" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm text-muted-foreground">{t('spellbook.duration')}</label>
                  <Input value={spell.duration} onChange={(e) => setSpell({ ...spell, duration: e.target.value })} placeholder="1 minute" className="h-10" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm text-muted-foreground">{t('spellbook.damage')}</label>
                  <Input value={spell.damage} onChange={(e) => setSpell({ ...spell, damage: e.target.value })} placeholder="1d10 fire" className="h-10" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-sm text-muted-foreground">{t('spellbook.description')}</label>
                <Textarea value={spell.description} onChange={(e) => setSpell({ ...spell, description: e.target.value })} placeholder={t('spellbook.descriptionPlaceholder')} className="min-h-24" />
              </div>
              <Button onClick={handleSubmit} className="w-full h-10">{t('spellbook.addSpellButton')}</Button>
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
