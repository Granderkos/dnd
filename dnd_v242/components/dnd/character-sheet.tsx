'use client'

import { useState, useRef, memo, useCallback, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
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
import { Plus, X, Minus, Heart, Shield, Zap, Footprints, User, Camera } from 'lucide-react'
import {
  Character,
  AbilityName,
  Attack,
  calculateModifier,
  formatModifier,
} from '@/lib/dnd-types'
import { useI18n } from '@/lib/i18n'
import { PageShell } from '@/components/app/page-shell'
import {
  listBackgroundTemplates,
  listClassTemplates,
  listRaceTemplates,
  type BackgroundTemplate,
  type ClassTemplate,
  type RaceTemplate,
} from '@/lib/supabase-data'

// Debounced input for better typing performance - uses uncontrolled input with ref
interface DebouncedInputProps extends Omit<React.ComponentProps<typeof Input>, 'onChange' | 'defaultValue'> {
  value: string | number
  onChange: (value: string) => void
  debounceMs?: number
}

const DebouncedInput = memo(function DebouncedInput({ 
  value, 
  onChange, 
  debounceMs = 200, 
  ...props 
}: DebouncedInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onChangeRef = useRef(onChange)
  const isTypingRef = useRef(false)
  
  // Keep onChange ref updated without causing re-renders
  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])
  
  // Only sync value from parent when NOT actively typing
  useEffect(() => {
    if (inputRef.current && !isTypingRef.current) {
      inputRef.current.value = String(value)
    }
  }, [value])
  
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    isTypingRef.current = true
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    
    timeoutRef.current = setTimeout(() => {
      onChangeRef.current(newValue)
      isTypingRef.current = false
    }, debounceMs)
  }, [debounceMs])
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])
  
  return <Input ref={inputRef} defaultValue={String(value)} onChange={handleChange} {...props} />
})

// Debounced textarea for better typing performance
interface DebouncedTextareaProps extends Omit<React.ComponentProps<typeof Textarea>, 'onChange' | 'defaultValue'> {
  value: string
  onChange: (value: string) => void
  debounceMs?: number
}

const DebouncedTextarea = memo(function DebouncedTextarea({ 
  value, 
  onChange, 
  debounceMs = 200, 
  ...props 
}: DebouncedTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onChangeRef = useRef(onChange)
  const isTypingRef = useRef(false)
  
  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])
  
  useEffect(() => {
    if (textareaRef.current && !isTypingRef.current) {
      textareaRef.current.value = value
    }
  }, [value])
  
  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value
    isTypingRef.current = true
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    
    timeoutRef.current = setTimeout(() => {
      onChangeRef.current(newValue)
      isTypingRef.current = false
    }, debounceMs)
  }, [debounceMs])
  
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])
  
  return <Textarea ref={textareaRef} defaultValue={value} onChange={handleChange} {...props} />
})

// Memoized AttackRow component
interface AttackRowProps {
  attack: Attack
  onUpdate: (id: string, field: keyof Attack, value: string) => void
  onRemove: (id: string, name: string) => void
}

const AttackRow = memo(function AttackRow({ attack, onUpdate, onRemove }: AttackRowProps) {
  const { t } = useI18n()
  return (
    <div className="flex items-start gap-2 rounded-lg border border-border bg-background/80 p-3">
      <div className="min-w-0 flex-1 space-y-1">
        <DebouncedInput
          value={attack.name}
          onChange={(value) => onUpdate(attack.id, 'name', value)}
          className="h-8 text-sm font-medium"
          placeholder={t('character.attackNamePlaceholder')}
        />
        <div className="flex gap-1">
          <DebouncedInput
            value={attack.attackBonus}
            onChange={(value) => onUpdate(attack.id, 'attackBonus', value)}
            className="h-7 w-14 text-center text-xs"
            placeholder={t('character.attackBonusPlaceholder')}
          />
          <DebouncedInput
            value={attack.damage}
            onChange={(value) => onUpdate(attack.id, 'damage', value)}
            className="h-7 flex-1 text-xs"
            placeholder={t('character.attackDamagePlaceholder')}
          />
          <DebouncedInput
            value={attack.damageType}
            onChange={(value) => onUpdate(attack.id, 'damageType', value)}
            className="h-7 flex-1 text-xs"
            placeholder={t('character.attackTypePlaceholder')}
          />
        </div>
      </div>
      <Button
        size="icon"
        variant="ghost"
        onClick={() => onRemove(attack.id, attack.name)}
        className="size-8 shrink-0 text-destructive hover:text-destructive"
      >
        <X className="size-4" />
      </Button>
    </div>
  )
})

interface CharacterSheetProps {
  character: Character
  onChange: (character: Character) => void
}

export function CharacterSheet({ character, onChange }: CharacterSheetProps) {
  const { t, language } = useI18n()
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean
    title: string
    description: string
    onConfirm: () => void
  }>({ open: false, title: '', description: '', onConfirm: () => {} })
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [classTemplates, setClassTemplates] = useState<ClassTemplate[]>([])
  const [raceTemplates, setRaceTemplates] = useState<RaceTemplate[]>([])
  const [backgroundTemplates, setBackgroundTemplates] = useState<BackgroundTemplate[]>([])
  const [creationMode, setCreationMode] = useState<'custom' | 'template' | null>(null)
  const [guidedClassTemplateId, setGuidedClassTemplateId] = useState('')
  const [guidedRaceTemplateId, setGuidedRaceTemplateId] = useState('')
  const [guidedBackgroundTemplateId, setGuidedBackgroundTemplateId] = useState('')

  const deriveRaceFeatures = useCallback((template: RaceTemplate): string => {
    if (Array.isArray(template.traits)) {
      return (template.traits as unknown[]).map((value) => String(value)).join('\n')
    }
    return template.short_description ?? ''
  }, [])

  const deriveClassFeatures = useCallback((template: ClassTemplate): string => {
    return template.feature_summary ?? ''
  }, [])

  const deriveBackgroundFeatures = useCallback((template: BackgroundTemplate): string => {
    return template.feature_summary ?? template.short_description ?? ''
  }, [])

  const composeTemplateProficienciesAndLanguages = useCallback((params: {
    classTemplate?: ClassTemplate | null
    raceTemplate?: RaceTemplate | null
    backgroundTemplate?: BackgroundTemplate | null
  }): string => {
    const sections: string[] = []
    if (params.classTemplate) {
      const classParts = [
        params.classTemplate.saving_throw_proficiencies ? `Saving Throws: ${params.classTemplate.saving_throw_proficiencies}` : '',
        params.classTemplate.armor_proficiencies ? `Armor: ${params.classTemplate.armor_proficiencies}` : '',
        params.classTemplate.weapon_proficiencies ? `Weapons: ${params.classTemplate.weapon_proficiencies}` : '',
        params.classTemplate.tool_proficiencies ? `Tools: ${params.classTemplate.tool_proficiencies}` : '',
      ].filter(Boolean)
      if (classParts.length > 0) sections.push(`Class\n${classParts.join('\n')}`)
    }
    if (params.raceTemplate?.languages) {
      sections.push(`Race\nLanguages: ${params.raceTemplate.languages}`)
    }
    if (params.backgroundTemplate) {
      const backgroundParts = [
        params.backgroundTemplate.skill_proficiencies ? `Skills: ${params.backgroundTemplate.skill_proficiencies}` : '',
        params.backgroundTemplate.tool_proficiencies ? `Tools: ${params.backgroundTemplate.tool_proficiencies}` : '',
        params.backgroundTemplate.language_proficiencies ? `Languages: ${params.backgroundTemplate.language_proficiencies}` : '',
      ].filter(Boolean)
      if (backgroundParts.length > 0) sections.push(`Background\n${backgroundParts.join('\n')}`)
    }
    return sections.join('\n\n')
  }, [])

  const shouldApplyPrefill = useCallback((currentValue: string, previousPrefill: string, nextPrefill: string): boolean => {
    const current = currentValue.trim()
    if (!nextPrefill.trim()) return false
    if (!current) return true
    return current === previousPrefill.trim()
  }, [])

  const parseAbilityNames = useCallback((value: string | null | undefined): AbilityName[] => {
    if (!value) return []
    const normalized = value.toUpperCase()
    const found: AbilityName[] = []
    ;(['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] as AbilityName[]).forEach((ability) => {
      if (normalized.includes(ability)) found.push(ability)
    })
    return found
  }, [])

  const applyClassDerivedAutomation = useCallback((baseCharacter: Character, template: ClassTemplate): Character => {
    const saveProficiencies = new Set(parseAbilityNames(template.saving_throw_proficiencies))
    const nextAbilities = { ...baseCharacter.abilities }
    ;(['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] as AbilityName[]).forEach((ability) => {
      nextAbilities[ability] = { ...nextAbilities[ability], proficient: saveProficiencies.has(ability) }
    })
    const level = Math.max(1, Number(baseCharacter.info.level) || 1)
    return {
      ...baseCharacter,
      abilities: nextAbilities,
      proficiencyBonus: Math.floor((level - 1) / 4) + 2,
      combat: {
        ...baseCharacter.combat,
        hitDice: `${level}${template.hit_die}`,
      },
    }
  }, [parseAbilityNames])

  const isNewCharacter = !character.info.name.trim()
    && !character.info.class.trim()
    && !character.info.race.trim()
    && !character.info.background.trim()
    && !character.info.sourceClassTemplateId
    && !character.info.sourceRaceTemplateId
    && !character.info.sourceBackgroundTemplateId

  const updateInfo = useCallback((field: keyof Character['info'], value: string | number) => {
    onChange({
      ...character,
      info: { ...character.info, [field]: value },
    })
  }, [character, onChange])

  useEffect(() => {
    let active = true
    void Promise.all([
      listClassTemplates(),
      listRaceTemplates(),
      listBackgroundTemplates(),
    ]).then(([classes, races, backgrounds]) => {
      if (!active) return
      setClassTemplates(classes)
      setRaceTemplates(races)
      setBackgroundTemplates(backgrounds)
    }).catch((error) => {
      console.error('[character:templates] load failed', error)
      if (!active) return
      setClassTemplates([])
      setRaceTemplates([])
      setBackgroundTemplates([])
    })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!isNewCharacter && creationMode === null) {
      setCreationMode('custom')
    }
  }, [creationMode, isNewCharacter])

  useEffect(() => {
    const level = Math.max(1, Number(character.info.level) || 1)
    const derivedProficiencyBonus = Math.floor((level - 1) / 4) + 2
    if (character.proficiencyBonus === derivedProficiencyBonus) return
    onChange({ ...character, proficiencyBonus: derivedProficiencyBonus })
  }, [character, onChange])

  const applyClassTemplate = useCallback((templateId: string) => {
    const template = classTemplates.find((row) => row.id === templateId)
    if (!template) return
    const previousTemplate = (character.info.classTemplateSnapshot ?? null) as ClassTemplate | null
    const previousClassPrefill = previousTemplate ? deriveClassFeatures(previousTemplate) : ''
    const nextClassPrefill = deriveClassFeatures(template)
    const previousLanguagesPrefill = composeTemplateProficienciesAndLanguages({
      classTemplate: previousTemplate,
      raceTemplate: (character.info.raceTemplateSnapshot ?? null) as RaceTemplate | null,
      backgroundTemplate: (character.info.backgroundTemplateSnapshot ?? null) as BackgroundTemplate | null,
    })
    const nextLanguagesPrefill = composeTemplateProficienciesAndLanguages({
      classTemplate: template,
      raceTemplate: (character.info.raceTemplateSnapshot ?? null) as RaceTemplate | null,
      backgroundTemplate: (character.info.backgroundTemplateSnapshot ?? null) as BackgroundTemplate | null,
    })
    const nextCharacter: Character = {
      ...character,
      info: {
        ...character.info,
        class: template.name,
        sourceClassTemplateId: template.id,
        classSourceOrigin: 'template',
        classTemplateSnapshot: template as unknown as Record<string, unknown>,
      },
      classFeatures: shouldApplyPrefill(character.classFeatures, previousClassPrefill, nextClassPrefill)
        ? nextClassPrefill
        : character.classFeatures,
      languages: shouldApplyPrefill(character.languages, previousLanguagesPrefill, nextLanguagesPrefill)
        ? nextLanguagesPrefill
        : character.languages,
    }
    onChange(applyClassDerivedAutomation(nextCharacter, template))
  }, [applyClassDerivedAutomation, character, classTemplates, composeTemplateProficienciesAndLanguages, deriveClassFeatures, onChange, shouldApplyPrefill])

  const applyRaceTemplate = useCallback((templateId: string) => {
    const template = raceTemplates.find((row) => row.id === templateId)
    if (!template) return
    const previousTemplate = (character.info.raceTemplateSnapshot ?? null) as RaceTemplate | null
    const previousRacePrefill = previousTemplate ? deriveRaceFeatures(previousTemplate) : ''
    const nextRacePrefill = deriveRaceFeatures(template)
    const previousLanguagesPrefill = composeTemplateProficienciesAndLanguages({
      classTemplate: (character.info.classTemplateSnapshot ?? null) as ClassTemplate | null,
      raceTemplate: previousTemplate,
      backgroundTemplate: (character.info.backgroundTemplateSnapshot ?? null) as BackgroundTemplate | null,
    })
    const nextLanguagesPrefill = composeTemplateProficienciesAndLanguages({
      classTemplate: (character.info.classTemplateSnapshot ?? null) as ClassTemplate | null,
      raceTemplate: template,
      backgroundTemplate: (character.info.backgroundTemplateSnapshot ?? null) as BackgroundTemplate | null,
    })
    onChange({
      ...character,
      info: {
        ...character.info,
        race: template.name,
        sourceRaceTemplateId: template.id,
        raceSourceOrigin: 'template',
        raceTemplateSnapshot: template as unknown as Record<string, unknown>,
      },
      raceFeatures: shouldApplyPrefill(character.raceFeatures, previousRacePrefill, nextRacePrefill)
        ? nextRacePrefill
        : character.raceFeatures,
      languages: shouldApplyPrefill(character.languages, previousLanguagesPrefill, nextLanguagesPrefill)
        ? nextLanguagesPrefill
        : character.languages,
    })
  }, [character, composeTemplateProficienciesAndLanguages, deriveRaceFeatures, onChange, raceTemplates, shouldApplyPrefill])

  const applyBackgroundTemplate = useCallback((templateId: string) => {
    const template = backgroundTemplates.find((row) => row.id === templateId)
    if (!template) return
    const previousTemplate = (character.info.backgroundTemplateSnapshot ?? null) as BackgroundTemplate | null
    const previousBackgroundPrefill = previousTemplate ? deriveBackgroundFeatures(previousTemplate) : ''
    const nextBackgroundPrefill = deriveBackgroundFeatures(template)
    const previousLanguagesPrefill = composeTemplateProficienciesAndLanguages({
      classTemplate: (character.info.classTemplateSnapshot ?? null) as ClassTemplate | null,
      raceTemplate: (character.info.raceTemplateSnapshot ?? null) as RaceTemplate | null,
      backgroundTemplate: previousTemplate,
    })
    const nextLanguagesPrefill = composeTemplateProficienciesAndLanguages({
      classTemplate: (character.info.classTemplateSnapshot ?? null) as ClassTemplate | null,
      raceTemplate: (character.info.raceTemplateSnapshot ?? null) as RaceTemplate | null,
      backgroundTemplate: template,
    })
    onChange({
      ...character,
      info: {
        ...character.info,
        background: template.name,
        sourceBackgroundTemplateId: template.id,
        backgroundSourceOrigin: 'template',
        backgroundTemplateSnapshot: template as unknown as Record<string, unknown>,
      },
      backgroundFeatures: shouldApplyPrefill(character.backgroundFeatures, previousBackgroundPrefill, nextBackgroundPrefill)
        ? nextBackgroundPrefill
        : character.backgroundFeatures,
      languages: shouldApplyPrefill(character.languages, previousLanguagesPrefill, nextLanguagesPrefill)
        ? nextLanguagesPrefill
        : character.languages,
    })
  }, [backgroundTemplates, character, composeTemplateProficienciesAndLanguages, deriveBackgroundFeatures, onChange, shouldApplyPrefill])

  const updateAbility = useCallback((ability: AbilityName, value: number) => {
    onChange({
      ...character,
      abilities: {
        ...character.abilities,
        [ability]: { ...character.abilities[ability], value },
      },
    })
  }, [character, onChange])

  const toggleSaveProficiency = useCallback((ability: AbilityName) => {
    setConfirmDialog({
      open: true,
      title: t('character.toggleSaveTitle'),
      description: t('character.toggleSaveDescription', { action: character.abilities[ability].proficient ? 'remove' : 'add', ability }),
      onConfirm: () => {
        onChange({
          ...character,
          abilities: {
            ...character.abilities,
            [ability]: {
              ...character.abilities[ability],
              proficient: !character.abilities[ability].proficient,
            },
          },
        })
      },
    })
  }, [character, onChange])

  const toggleSkillProficiency = useCallback((index: number) => {
    const skill = character.skills[index]
    setConfirmDialog({
      open: true,
      title: t('character.toggleSkillTitle'),
      description: t('character.toggleSkillDescription', { action: skill.proficient ? 'remove' : 'add', skill: skill.name }),
      onConfirm: () => {
        const newSkills = [...character.skills]
        newSkills[index] = { ...newSkills[index], proficient: !newSkills[index].proficient }
        onChange({ ...character, skills: newSkills })
      },
    })
  }, [character, onChange])

  const updateCombat = useCallback((field: keyof Character['combat'], value: number | string) => {
    onChange({
      ...character,
      combat: { ...character.combat, [field]: value },
    })
  }, [character, onChange])

  const adjustHp = useCallback((amount: number) => {
    const newHp = Math.max(0, Math.min(character.combat.maxHp, character.combat.currentHp + amount))
    onChange({
      ...character,
      combat: { ...character.combat, currentHp: newHp },
    })
  }, [character, onChange])

  const toggleDeathSave = useCallback((type: 'successes' | 'failures', index: number) => {
    const newDeathSaves = { ...character.combat.deathSaves }
    const currentCount = newDeathSaves[type].filter(Boolean).length
    
    if (index < currentCount) {
      newDeathSaves[type] = [
        index > 0,
        index > 1,
        index > 2,
      ] as [boolean, boolean, boolean]
    } else {
      newDeathSaves[type] = [
        true,
        index >= 1,
        index >= 2,
      ] as [boolean, boolean, boolean]
    }
    
    onChange({
      ...character,
      combat: { ...character.combat, deathSaves: newDeathSaves },
    })
  }, [character, onChange])

  const addAttack = useCallback(() => {
    const newAttack: Attack = {
      id: Date.now().toString(),
      name: 'New Attack',
      damage: '1d6',
      damageType: 'slashing',
      attackBonus: '+0',
    }
    onChange({ ...character, attacks: [...character.attacks, newAttack] })
  }, [character, onChange])

  const updateAttack = useCallback((id: string, field: keyof Attack, value: string) => {
    const newAttacks = character.attacks.map((a) =>
      a.id === id ? { ...a, [field]: value } : a
    )
    onChange({ ...character, attacks: newAttacks })
  }, [character, onChange])

  const removeAttack = useCallback((id: string, name: string) => {
    setConfirmDialog({
      open: true,
      title: t('character.deleteAttackTitle'),
      description: t('character.deleteAttackDescription', { name }),
      onConfirm: () => {
        onChange({ ...character, attacks: character.attacks.filter((a) => a.id !== id) })
      },
    })
  }, [character, onChange])

  const createPreviewDataUrl = useCallback(async (file: File): Promise<string> => {
    const imageBitmap = await createImageBitmap(file)
    const previewSize = 256
    const canvas = document.createElement('canvas')
    canvas.width = previewSize
    canvas.height = previewSize
    const ctx = canvas.getContext('2d')
    if (!ctx) return ''

    const sourceSize = Math.min(imageBitmap.width, imageBitmap.height)
    const sourceX = Math.floor((imageBitmap.width - sourceSize) / 2)
    const sourceY = Math.floor((imageBitmap.height - sourceSize) / 2)
    ctx.drawImage(imageBitmap, sourceX, sourceY, sourceSize, sourceSize, 0, 0, previewSize, previewSize)
    return canvas.toDataURL('image/webp', 0.92)
  }, [])

  const handlePortraitUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = async () => {
        const originalDataUrl = reader.result as string
        const previewDataUrl = await createPreviewDataUrl(file)
        onChange({
          ...character,
          info: {
            ...character.info,
            portraitUrl: previewDataUrl || originalDataUrl,
            portraitOriginalUrl: originalDataUrl,
          },
        })
      }
      reader.readAsDataURL(file)
    }
  }, [character, createPreviewDataUrl, onChange])

  const abilities: AbilityName[] = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']
  const speedInSquares = Math.floor(character.combat.speed / 5)
  const initiativeModifier = calculateModifier(character.abilities.DEX.value)
  const initiativeRoll = character.combat.initiativeRoll ?? 0
  const initiativeTotal = initiativeModifier + initiativeRoll
  // Compatibility aliases during rollout to avoid ReferenceError from stale refs.
  const derivedInitiativeBase = initiativeModifier
  const derivedInitiativeRoll = initiativeRoll
  const derivedInitiativeTotal = initiativeTotal
  const speedValueText = language === 'cs'
    ? `${(character.combat.speed * 0.3048).toFixed(1)} m (${speedInSquares} polí)`
    : `${character.combat.speed} ft (${speedInSquares} sq)`
  return (
    <div className="h-full min-h-0 overflow-y-auto">
      <div className="px-3 py-4">
        <PageShell>
          <div className="space-y-4 pb-24">
        {isNewCharacter && creationMode === null ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t('character.creationModeTitle')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">{t('character.creationModeDescription')}</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Button onClick={() => setCreationMode('custom')}>{t('character.creationCustom')}</Button>
                <Button variant="outline" onClick={() => setCreationMode('template')}>{t('character.creationTemplate')}</Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {isNewCharacter && creationMode === 'template' ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t('character.templateSetupTitle')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs uppercase text-muted-foreground">{t('character.classTemplate')}</label>
                <select className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={guidedClassTemplateId} onChange={(e) => setGuidedClassTemplateId(e.target.value)}>
                  <option value="">{t('character.selectTemplate')}</option>
                  {classTemplates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs uppercase text-muted-foreground">{t('character.raceTemplate')}</label>
                <select className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={guidedRaceTemplateId} onChange={(e) => setGuidedRaceTemplateId(e.target.value)}>
                  <option value="">{t('character.selectTemplate')}</option>
                  {raceTemplates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs uppercase text-muted-foreground">{t('character.backgroundTemplate')}</label>
                <select className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={guidedBackgroundTemplateId} onChange={(e) => setGuidedBackgroundTemplateId(e.target.value)}>
                  <option value="">{t('character.selectTemplate')}</option>
                  {backgroundTemplates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
                </select>
              </div>
              <Button
                className="w-full"
                disabled={!guidedClassTemplateId || !guidedRaceTemplateId || !guidedBackgroundTemplateId}
                onClick={() => {
                  const classTemplate = classTemplates.find((template) => template.id === guidedClassTemplateId)
                  const raceTemplate = raceTemplates.find((template) => template.id === guidedRaceTemplateId)
                  const backgroundTemplate = backgroundTemplates.find((template) => template.id === guidedBackgroundTemplateId)
                  if (!classTemplate || !raceTemplate || !backgroundTemplate) return
                  const nextCharacter: Character = {
                    ...character,
                    info: {
                      ...character.info,
                      class: classTemplate.name,
                      race: raceTemplate.name,
                      background: backgroundTemplate.name,
                      sourceClassTemplateId: classTemplate.id,
                      sourceRaceTemplateId: raceTemplate.id,
                      sourceBackgroundTemplateId: backgroundTemplate.id,
                      classSourceOrigin: 'template',
                      raceSourceOrigin: 'template',
                      backgroundSourceOrigin: 'template',
                      classTemplateSnapshot: classTemplate as unknown as Record<string, unknown>,
                      raceTemplateSnapshot: raceTemplate as unknown as Record<string, unknown>,
                      backgroundTemplateSnapshot: backgroundTemplate as unknown as Record<string, unknown>,
                    },
                    classFeatures: deriveClassFeatures(classTemplate),
                    raceFeatures: deriveRaceFeatures(raceTemplate),
                    backgroundFeatures: deriveBackgroundFeatures(backgroundTemplate),
                    languages: composeTemplateProficienciesAndLanguages({ classTemplate, raceTemplate, backgroundTemplate }),
                  }
                  onChange(applyClassDerivedAutomation(nextCharacter, classTemplate))
                  setCreationMode('custom')
                }}
              >
                {t('character.templateConfirmCreate')}
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {/* Character Info - Portrait ABOVE inputs */}
        <Card>
          <CardContent className="pt-4">
            {/* Portrait - BIGGER and centered at top */}
            <div className="flex justify-center mb-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePortraitUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex size-48 items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/30 bg-muted/30 transition-colors hover:border-primary hover:bg-muted/50"
              >
                {character.info.portraitUrl ? (
                  <img
                    src={character.info.portraitUrl}
                    alt="Character portrait"
                    className="size-full rounded-xl object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <User className="size-14" />
                    <Camera className="size-6" />
                  </div>
                )}
              </button>
            </div>
            
            {/* Character name - smaller */}
            <DebouncedInput
              value={character.info.name}
              onChange={(value) => updateInfo('name', value)}
              className="mb-3 h-10 text-base font-bold text-center"
              placeholder={t('character.name')}
            />
            
            {/* Character details grid */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs uppercase text-muted-foreground">{t('character.class')}</label>
                <DebouncedInput
                  value={character.info.class}
                  onChange={(value) => updateInfo('class', value)}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs uppercase text-muted-foreground">{t('character.level')}</label>
                <DebouncedInput
                  type="number"
                  min={1}
                  max={20}
                  value={character.info.level}
                  onChange={(value) => updateInfo('level', parseInt(value) || 1)}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs uppercase text-muted-foreground">{t('character.subclass')}</label>
                <DebouncedInput
                  value={character.info.subclass}
                  onChange={(value) => updateInfo('subclass', value)}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs uppercase text-muted-foreground">{t('character.race')}</label>
                <DebouncedInput
                  value={character.info.race}
                  onChange={(value) => updateInfo('race', value)}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs uppercase text-muted-foreground">{t('character.background')}</label>
                <DebouncedInput
                  value={character.info.background}
                  onChange={(value) => updateInfo('background', value)}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs uppercase text-muted-foreground">{t('character.alignment')}</label>
                <DebouncedInput
                  value={character.info.alignment}
                  onChange={(value) => updateInfo('alignment', value)}
                  className="h-9 text-sm"
                />
              </div>
            </div>

            <div className="mt-3 space-y-2 rounded-md border border-border bg-muted/20 p-2">
              <p className="text-xs uppercase text-muted-foreground">{t('character.templateSources')}</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">{t('character.classTemplate')}</label>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                    value={character.info.sourceClassTemplateId ?? ''}
                    onChange={(e) => applyClassTemplate(e.target.value)}
                  >
                    <option value="">{t('character.selectTemplate')}</option>
                    {classTemplates.map((template) => (
                      <option key={template.id} value={template.id}>{template.name}</option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => onChange({ ...character, info: { ...character.info, sourceClassTemplateId: null, classSourceOrigin: 'custom', classTemplateSnapshot: null } })}
                  >
                    {t('character.useCustom')}
                  </Button>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">{t('character.raceTemplate')}</label>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                    value={character.info.sourceRaceTemplateId ?? ''}
                    onChange={(e) => applyRaceTemplate(e.target.value)}
                  >
                    <option value="">{t('character.selectTemplate')}</option>
                    {raceTemplates.map((template) => (
                      <option key={template.id} value={template.id}>{template.name}</option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => onChange({ ...character, info: { ...character.info, sourceRaceTemplateId: null, raceSourceOrigin: 'custom', raceTemplateSnapshot: null } })}
                  >
                    {t('character.useCustom')}
                  </Button>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">{t('character.backgroundTemplate')}</label>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                    value={character.info.sourceBackgroundTemplateId ?? ''}
                    onChange={(e) => applyBackgroundTemplate(e.target.value)}
                  >
                    <option value="">{t('character.selectTemplate')}</option>
                    {backgroundTemplates.map((template) => (
                      <option key={template.id} value={template.id}>{template.name}</option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => onChange({ ...character, info: { ...character.info, sourceBackgroundTemplateId: null, backgroundSourceOrigin: 'custom', backgroundTemplateSnapshot: null } })}
                  >
                    {t('character.useCustom')}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

          {/* Ability Scores, Saves & Skills */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('character.abilitiesSection')}</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Proficiency Bonus */}
            <div className="mb-3 flex flex-wrap items-center justify-center gap-2 rounded border bg-primary/10 p-2 text-center">
              <span className="text-sm font-medium">{t('character.proficiencyBonus')}</span>
              <Input
                type="number"
                min={1}
                max={10}
                value={character.proficiencyBonus}
                readOnly
                className="h-8 w-14 text-center font-bold"
              />
            </div>

            {/* Ability Scores Grid */}
            <div className="grid grid-cols-3 gap-2 justify-items-center sm:grid-cols-6">
              {abilities.map((ability) => {
                const score = character.abilities[ability].value
                const mod = calculateModifier(score)
                const proficient = character.abilities[ability].proficient
                const saveTotal = proficient ? mod + character.proficiencyBonus : mod
                
                return (
                  <div
                    key={ability}
                    className="flex w-[104px] md:w-[120px] flex-col items-center rounded border bg-muted/30 p-1.5 text-center md:p-2"
                  >
                    <span className="text-xs font-medium text-muted-foreground">{ability}</span>
                    <span className="text-xl font-bold md:text-2xl">{formatModifier(mod)}</span>
                    <Input
                      type="number"
                      min={1}
                      max={30}
                      value={score}
                      onChange={(e) => updateAbility(ability, parseInt(e.target.value) || 10)}
                      className="h-7 w-12 md:h-8 md:w-14 text-center text-sm font-semibold [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                    <div className="mt-1.5 flex items-center gap-1 border-t pt-1.5">
                      <Checkbox
                        checked={proficient}
                        onCheckedChange={() => toggleSaveProficiency(ability)}
                        className="size-4"
                      />
                      <span className="text-xs font-mono font-medium">{formatModifier(saveTotal)}</span>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Skills List */}
            <div className="mt-3 border-t pt-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">{t('character.skills')}</span>
                <span className="rounded bg-muted px-2 py-1 text-xs">
                  {t('character.passivePerception', { value: 10 + calculateModifier(character.abilities.WIS.value) +
                    (character.skills.find((s) => s.name === 'Perception')?.proficient
                      ? character.proficiencyBonus
                      : 0) })}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-y-1.5 sm:grid-cols-2 sm:gap-x-4">
                {character.skills.map((skill, index) => {
                  const abilityMod = calculateModifier(character.abilities[skill.ability].value)
                  const total = skill.proficient
                    ? abilityMod + character.proficiencyBonus
                    : abilityMod
                  return (
                    <div key={skill.name} className="flex items-center gap-2 py-0.5">
                      <Checkbox
                        checked={skill.proficient}
                        onCheckedChange={() => toggleSkillProficiency(index)}
                        className="size-5"
                      />
                      <span className="w-10 text-center font-mono text-sm font-medium">
                        {formatModifier(total)}
                      </span>
                      <span className="text-sm">
                        {skill.name}
                        <span className="text-muted-foreground"> ({skill.ability})</span>
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </CardContent>
        </Card>

          {/* Combat Section */}
        <Card>
          <CardContent className="pt-4">
            {/* AC, Initiative, Speed row */}
            <div className="grid grid-cols-3 gap-2">
              <div className="flex flex-col items-center rounded-lg border border-border bg-background/80 p-3">
                <Shield className="mb-1 size-5 text-muted-foreground" />
                <span className="text-xs uppercase text-muted-foreground">{t('character.combat.ac')}</span>
                <Input
                  type="number"
                  value={character.combat.armorClass}
                  onChange={(e) => updateCombat('armorClass', parseInt(e.target.value) || 10)}
                  className="mt-1 h-10 w-full text-center text-xl font-bold"
                />
              </div>
              <div className="flex flex-col items-center rounded-lg border border-border bg-background/80 p-3">
                <Zap className="mb-1 size-5 text-muted-foreground" />
                <span className="text-xs uppercase text-muted-foreground">{t('character.combat.init')}</span>
                <Input
                  type="text"
                  inputMode="text"
                  pattern="[+-]?[0-9]*"
                  value={String(initiativeTotal)}
                  readOnly
                  className="mt-1 h-10 w-full text-center text-xl font-bold"
                />
                <span className="mt-1 text-[10px] text-muted-foreground">base {formatModifier(derivedInitiativeBase)} + roll {derivedInitiativeRoll}</span>
              </div>
              <div className="flex flex-col items-center rounded-lg border border-border bg-background/80 p-3">
                <Footprints className="mb-1 size-5 text-muted-foreground" />
                <span className="text-xs uppercase text-muted-foreground">{t('character.combat.speed')}</span>
                <div className="mt-1 w-full">
                  <Input
                    type="number"
                    step={5}
                    value={character.combat.speed}
                    onChange={(e) => updateCombat('speed', parseInt(e.target.value) || 30)}
                    className="h-10 w-full text-center text-xl font-bold"
                  />
                </div>
                <span className="mt-1 text-xs text-muted-foreground">{speedValueText}</span>
              </div>
            </div>

            {/* HP Section */}
            <div className="mt-3 rounded-lg border border-border bg-background/70 p-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:items-end">
                <div className="order-2 flex w-full flex-col items-center justify-end sm:order-1">
                  <span className="text-xs uppercase text-muted-foreground">{t('character.combat.max')}</span>
                  <Input
                    type="number"
                    value={character.combat.maxHp}
                    onChange={(e) => updateCombat('maxHp', parseInt(e.target.value) || 1)}
                    className="h-9 w-full max-w-20 text-center text-base font-semibold [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none sm:max-w-24"
                  />
                </div>
                <div className="order-1 col-span-2 flex w-full flex-col items-center justify-end sm:order-2 sm:col-span-1">
                  <Heart className="mb-1 size-6 text-red-500" />
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="outline"
                      className="size-10"
                      onClick={() => adjustHp(-1)}
                    >
                      <Minus className="size-5" />
                    </Button>
                    <Input
                      type="number"
                      value={character.combat.currentHp}
                      onChange={(e) => updateCombat('currentHp', parseInt(e.target.value) || 0)}
                      className="h-12 w-20 text-center text-2xl font-bold [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                    <Button
                      size="icon"
                      variant="outline"
                      className="size-10"
                      onClick={() => adjustHp(1)}
                    >
                      <Plus className="size-5" />
                    </Button>
                  </div>
                </div>
                <div className="order-3 flex w-full flex-col items-center justify-end">
                  <span className="text-xs uppercase text-muted-foreground">{t('character.combat.temp')}</span>
                    <Input
                      type="number"
                      min={0}
                      value={character.combat.tempHp}
                      onChange={(e) => updateCombat('tempHp', parseInt(e.target.value) || 0)}
                      className="h-9 w-full max-w-20 text-center text-base font-semibold [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none sm:max-w-24"
                    />
                </div>
              </div>

              {/* Hit Dice & Death Saves */}
              <div className="mt-3 flex items-center justify-between border-t pt-3">
                <div className="flex flex-col items-center gap-1">
                  <span className="text-xs uppercase text-muted-foreground">{t('character.combat.hitDice')}</span>
                  <DebouncedInput
                    value={character.combat.hitDice}
                    onChange={(value) => updateCombat('hitDice', value)}
                    className="h-8 w-20 text-sm text-center"
                  />
                </div>
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs uppercase text-muted-foreground">{t('character.combat.successes')}</span>
                    <div className="flex items-center gap-2">
                      {[0, 1, 2].map((i) => (
                        <button
                          key={`success-${i}`}
                          onClick={() => toggleDeathSave('successes', i)}
                          className={`size-5 rounded-full border-2 transition-colors ${
                            character.combat.deathSaves.successes[i]
                              ? 'border-green-500 bg-green-500'
                              : 'border-muted-foreground hover:bg-green-500/20'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs uppercase text-muted-foreground">{t('character.combat.failures')}</span>
                    <div className="flex items-center gap-2">
                      {[0, 1, 2].map((i) => (
                        <button
                          key={`failure-${i}`}
                          onClick={() => toggleDeathSave('failures', i)}
                          className={`size-5 rounded-full border-2 transition-colors ${
                            character.combat.deathSaves.failures[i]
                              ? 'border-red-500 bg-red-500'
                              : 'border-muted-foreground hover:bg-red-500/20'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

          {/* Attacks */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{t('character.combat.actions')}</CardTitle>
              <Button size="sm" variant="outline" onClick={addAttack} className="h-8">
                <Plus className="size-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {character.attacks.map((attack) => (
                <AttackRow 
                  key={attack.id} 
                  attack={attack} 
                  onUpdate={updateAttack} 
                  onRemove={removeAttack} 
                />
              ))}
            </div>
          </CardContent>
        </Card>

          {/* Features & Traits */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('character.combat.featuresTraits')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">{t('character.combat.raceFeatures')}</p>
                <DebouncedTextarea
                  value={character.raceFeatures}
                  onChange={(value) => onChange({ ...character, raceFeatures: value })}
                  placeholder={t('character.combat.raceFeatures')}
                  className="min-h-20 resize-none text-sm scrollbar-hidden break-words overflow-wrap-anywhere"
                  style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">{t('character.combat.classFeatures')}</p>
                <DebouncedTextarea
                  value={character.classFeatures}
                  onChange={(value) => onChange({ ...character, classFeatures: value })}
                  placeholder={t('character.combat.classFeatures')}
                  className="min-h-20 resize-none text-sm scrollbar-hidden break-words overflow-wrap-anywhere"
                  style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">{t('character.combat.backgroundFeatures')}</p>
                <DebouncedTextarea
                  value={character.backgroundFeatures}
                  onChange={(value) => onChange({ ...character, backgroundFeatures: value })}
                  placeholder={t('character.combat.backgroundFeatures')}
                  className="min-h-20 resize-none text-sm scrollbar-hidden break-words overflow-wrap-anywhere"
                  style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

          {/* Proficiencies & Languages */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('character.proficienciesLanguages')}</CardTitle>
          </CardHeader>
          <CardContent>
            <DebouncedTextarea
              value={character.languages}
              onChange={(value) => onChange({ ...character, languages: value })}
              placeholder={t('character.proficienciesLanguages')}
              className="min-h-24 resize-none text-sm scrollbar-hidden break-words overflow-wrap-anywhere"
              style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}
            />
          </CardContent>
        </Card>
          </div>
        </PageShell>
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmDialog.title}</AlertDialogTitle>
            <AlertDialogDescription style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
              {confirmDialog.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDialog.onConfirm}>{t('common.confirm')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
