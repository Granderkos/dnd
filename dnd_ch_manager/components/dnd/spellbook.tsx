'use client'

import { useState, memo, useCallback, useMemo } from 'react'
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
import { useI18n } from '@/lib/i18n'
import {
  Spellbook as SpellbookType,
  Spell,
  AbilityName,
  calculateModifier,
  formatModifier,
  formatFeetWithSquares,
} from '@/lib/dnd-types'

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

  const spellcastingMod = useMemo(() => 
    calculateModifier(abilityScores[spellbook.spellcastingAbility].value),
    [abilityScores, spellbook.spellcastingAbility]
  )
  const calculatedDC = 8 + proficiencyBonus + spellcastingMod
  const calculatedAttack = proficiencyBonus + spellcastingMod

  const updateSpellcastingAbility = useCallback((ability: AbilityName) => {
    onChange({ ...spellbook, spellcastingAbility: ability })
  }, [spellbook, onChange])

  const toggleSlot = useCallback((level: number, index: number) => {
    const currentSlots = spellbook.slots[level]
    const newExpended = index < currentSlots.expended
      ? index
      : index + 1
    onChange({
      ...spellbook,
      slots: {
        ...spellbook.slots,
        [level]: { ...currentSlots, expended: Math.min(newExpended, currentSlots.total) },
      },
    })
  }, [spellbook, onChange])

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
      title: currentlyPrepared ? t('spells.actions.unprepareTitle') : t('spells.actions.prepareTitle'),
      description: currentlyPrepared ? t('spells.actions.unprepareDescription', { name: spellName }) : t('spells.actions.prepareDescription', { name: spellName }),
      onConfirm: () => {
        if (isCantrip) {
          const newCantrips = spellbook.cantrips.map((s) =>
            s.id === spellId ? { ...s, prepared: !s.prepared } : s
          )
          onChange({ ...spellbook, cantrips: newCantrips })
        } else {
          const newSpells = spellbook.spells.map((s) =>
            s.id === spellId ? { ...s, prepared: !s.prepared } : s
          )
          onChange({ ...spellbook, spells: newSpells })
        }
      },
    })
  }, [spellbook, onChange])

  const deleteSpell = useCallback((spellId: string, spellName: string, isCantrip: boolean) => {
    setConfirmDialog({
      open: true,
      title: t('spells.actions.deleteTitle'),
      description: t('spells.actions.deleteDescription', { name: spellName }),
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
    if (spell.level === 0) {
      onChange({ ...spellbook, cantrips: [...spellbook.cantrips, spell] })
    } else {
      onChange({ ...spellbook, spells: [...spellbook.spells, spell] })
    }
    setIsAddingSpell(false)
  }, [spellbook, onChange])

  const getSpellsByLevel = useCallback((level: number) => {
    return spellbook.spells.filter((s) => s.level === level)
  }, [spellbook.spells])

  return (
    <ScrollArea className="h-[calc(100vh-4rem)]">
      <div className="flex flex-col gap-3 p-3">
        {/* Spellcasting Info - Unified sizes */}
        <Card>
          <CardContent className="pt-4">
            <div className="grid grid-cols-3 gap-2">
              <div className="flex flex-col items-center justify-center rounded-lg border bg-muted/30 p-3">
                <span className="text-xs text-muted-foreground">{t('spells.ability')}</span>
                <Select
                  value={spellbook.spellcastingAbility}
                  onValueChange={(v) => updateSpellcastingAbility(v as AbilityName)}
                >
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
                <span className="text-xs text-muted-foreground">{t('spells.spellDc')}</span>
                <span className="mt-1 text-2xl font-bold">{calculatedDC}</span>
              </div>
              <div className="flex flex-col items-center justify-center rounded-lg border bg-muted/30 p-3">
                <span className="text-xs text-muted-foreground">{t('spells.attack')}</span>
                <span className="mt-1 text-2xl font-bold">{formatModifier(calculatedAttack)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cantrips */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-[0.08em]">
                <span className="flex size-6 items-center justify-center rounded bg-muted text-xs font-bold">0</span>
                {t('spells.cantrips')}
              </CardTitle>
              <Button
                size="sm"
                variant="outline"
                className="h-8"
                onClick={() => {
                  setNewSpellLevel(0)
                  setIsAddingSpell(true)
                }}
              >
                <Plus className="size-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {spellbook.cantrips.map((spell) => (
                <SpellRow
                  key={spell.id}
                  spell={spell}
                  onClick={() => setSelectedSpell(spell)}
                  onTogglePrepared={() => toggleSpellPrepared(spell.id, spell.name, true, spell.prepared)}
                  onDelete={() => deleteSpell(spell.id, spell.name, true)}
                  isCantrip
                />
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Spell Levels 1-9 */}
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((level) => {
          const slots = spellbook.slots[level]
          const spells = getSpellsByLevel(level)
          if (slots.total === 0 && spells.length === 0) return null

          return (
            <Card key={level}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-[0.08em]">
                    <span className="flex size-6 items-center justify-center rounded bg-muted text-xs font-bold">
                      {level}
                    </span>
                    {t('spells.level', { level })}
                  </CardTitle>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8"
                    onClick={() => {
                      setNewSpellLevel(level)
                      setIsAddingSpell(true)
                    }}
                  >
                    <Plus className="size-4" />
                  </Button>
                </div>
                {/* Spell Slots - WRAPPING properly */}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">{t('spells.slots')}:</span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {Array.from({ length: slots.total }).map((_, i) => (
                      <button
                        key={i}
                        onClick={() => toggleSlot(level, i)}
                        className={`size-5 rounded-full border-2 transition-colors ${
                          i < slots.expended
                            ? 'border-muted-foreground bg-muted-foreground'
                            : 'border-primary bg-transparent hover:bg-primary/20'
                        }`}
                      />
                    ))}
                  </div>
                  <div className="ml-auto flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-6"
                      onClick={() => updateSlotTotal(level, slots.total - 1)}
                    >
                      -
                    </Button>
                    <span className="w-5 text-center text-xs">{slots.total}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-6"
                      onClick={() => updateSlotTotal(level, slots.total + 1)}
                    >
                      +
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-1.5">
                  {spells.map((spell) => (
                    <SpellRow
                      key={spell.id}
                      spell={spell}
                      onClick={() => setSelectedSpell(spell)}
                      onTogglePrepared={() => toggleSpellPrepared(spell.id, spell.name, false, spell.prepared)}
                      onDelete={() => deleteSpell(spell.id, spell.name, false)}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          )
        })}

        {/* Add empty spell level cards */}
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((level) => {
          const slots = spellbook.slots[level]
          const spells = getSpellsByLevel(level)
          if (slots.total > 0 || spells.length > 0) return null

          return (
            <Card key={level} className="opacity-50 transition-opacity hover:opacity-100">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-[0.08em]">
                    <span className="flex size-6 items-center justify-center rounded bg-muted text-xs font-bold">
                      {level}
                    </span>
                    {t('spells.level', { level })}
                  </CardTitle>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8"
                    onClick={() => {
                      setNewSpellLevel(level)
                      setIsAddingSpell(true)
                    }}
                  >
                    <Plus className="size-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-center text-sm text-muted-foreground">{t('spells.noSpells')}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Spell Detail Dialog */}
      <Dialog open={!!selectedSpell} onOpenChange={() => setSelectedSpell(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          {selectedSpell && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <span className="truncate">{selectedSpell.name}</span>
                  {selectedSpell.level > 0 && (
                    <Badge variant="secondary" className="shrink-0">{t('spells.level', { level: selectedSpell.level })}</Badge>
                  )}
                </DialogTitle>
                <DialogDescription className="sr-only">{t('spells.dialog.details')}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {selectedSpell.ritual && (
                    <Badge variant="outline" className="gap-1">
                      <BookOpen className="size-3" /> {t('spells.fields.ritual')}
                    </Badge>
                  )}
                  {selectedSpell.concentration && (
                    <Badge variant="outline" className="gap-1">
                      <Eye className="size-3" /> {t('spells.fields.concentration')}
                    </Badge>
                  )}
                  {selectedSpell.reaction && (
                    <Badge variant="outline" className="gap-1">
                      <Zap className="size-3" /> {t('spells.fields.reaction')}
                    </Badge>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">{t('spells.fields.castingTime')}: </span>
                    <span className="break-words">{selectedSpell.castingTime}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t('spells.fields.range')}: </span>
                    <span className="break-words">{formatFeetWithSquares(selectedSpell.range)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t('spells.fields.duration')}: </span>
                    <span className="break-words">{selectedSpell.duration}</span>
                  </div>
                  {selectedSpell.damage && (
                    <div>
                      <span className="text-muted-foreground">{t('spells.fields.damage')}: </span>
                      <span className="break-words">{selectedSpell.damage}</span>
                    </div>
                  )}
                </div>
                <p className="text-sm whitespace-pre-wrap break-words">
                  {selectedSpell.description}
                </p>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Spell Dialog */}
      <AddSpellDialog
        open={isAddingSpell}
        onOpenChange={setIsAddingSpell}
        level={newSpellLevel}
        onAdd={addSpell}
      />

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog.description}
            </AlertDialogDescription>
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
      {!isCantrip && (
        <Checkbox
          checked={spell.prepared}
          onCheckedChange={onTogglePrepared}
          title={t('spells.prepared')}
          className="size-5 shrink-0"
        />
      )}
      <button
        onClick={onClick}
        className="min-w-0 flex-1 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate max-w-[120px]">{spell.name}</span>
          <div className="flex shrink-0 gap-1">
            {spell.ritual && (
              <Badge variant="outline" className="h-5 px-1.5 text-xs">
                R
              </Badge>
            )}
            {spell.concentration && (
              <Badge variant="outline" className="h-5 px-1.5 text-xs">
                C
              </Badge>
            )}
            {spell.reaction && (
              <Badge variant="outline" className="h-5 px-1.5 text-xs">
                <Zap className="size-3" />
              </Badge>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground truncate max-w-[180px] mt-0.5">
          {spell.castingTime} | {spell.range} | {spell.duration}
        </p>
      </button>
      <Button
        size="icon"
        variant="ghost"
        onClick={onDelete}
        className="size-8 shrink-0 text-destructive hover:text-destructive"
      >
        <X className="size-4" />
      </Button>
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
  const [spell, setSpell] = useState<Partial<Spell>>({
    name: '',
    level,
    ritual: false,
    concentration: false,
    reaction: false,
    castingTime: '',
    range: '',
    duration: '',
    description: '',
    damage: '',
    prepared: level === 0,
  })

  const handleSubmit = () => {
    if (spell.name) {
      onAdd({
        ...spell,
        id: Date.now().toString(),
        level,
      } as Spell)
      setSpell({
        name: '',
        level,
        ritual: false,
        concentration: false,
        reaction: false,
        castingTime: '',
        range: '',
        duration: '',
        description: '',
        damage: '',
        prepared: level === 0,
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{level === 0 ? t('spells.dialog.addCantrip') : t('spells.dialog.addLevelSpell', { level })}</DialogTitle>
          <DialogDescription className="sr-only">{t('spells.dialog.enterDetails')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-sm text-muted-foreground">{t('spells.fields.name')}</label>
            <Input
              value={spell.name}
              onChange={(e) => setSpell({ ...spell, name: e.target.value })}
              placeholder={t('spells.fields.namePlaceholder')}
              className="h-10"
            />
          </div>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={spell.ritual}
                onCheckedChange={(checked) => setSpell({ ...spell, ritual: !!checked })}
              />
              {t('spells.fields.ritual')}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={spell.concentration}
                onCheckedChange={(checked) => setSpell({ ...spell, concentration: !!checked })}
              />
              {t('spells.fields.concentration')}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={spell.reaction}
                onCheckedChange={(checked) => setSpell({ ...spell, reaction: !!checked })}
              />
              {t('spells.fields.reaction')}
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">{t('spells.fields.castingTime')}</label>
              <Input
                value={spell.castingTime}
                onChange={(e) => setSpell({ ...spell, castingTime: e.target.value })}
                placeholder={t('spells.fields.castingTimePlaceholder')}
                className="h-10"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">{t('spells.fields.range')}</label>
              <Input
                value={spell.range}
                onChange={(e) => setSpell({ ...spell, range: e.target.value })}
                placeholder={t('spells.fields.rangePlaceholder')}
                className="h-10"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">{t('spells.fields.duration')}</label>
              <Input
                value={spell.duration}
                onChange={(e) => setSpell({ ...spell, duration: e.target.value })}
                placeholder={t('spells.fields.durationPlaceholder')}
                className="h-10"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">{t('spells.fields.damage')}</label>
              <Input
                value={spell.damage}
                onChange={(e) => setSpell({ ...spell, damage: e.target.value })}
                placeholder={t('spells.fields.damagePlaceholder')}
                className="h-10"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-sm text-muted-foreground">{t('spells.fields.description')}</label>
            <Textarea
              value={spell.description}
              onChange={(e) => setSpell({ ...spell, description: e.target.value })}
              placeholder={t('spells.fields.descriptionPlaceholder')}
              className="min-h-24"
            />
          </div>
          <Button onClick={handleSubmit} className="w-full h-10">
            {t('spells.actions.addSpell')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
