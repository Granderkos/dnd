'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { createItemTemplate, grantGoldToCharacter, grantItemTemplateToCharacter, listItemTemplates, type CreateItemTemplateInput, type ItemTemplate } from '@/lib/supabase-data'
import { useAuth } from '@/lib/auth-context'

type ItemTypeOption = 'Weapons' | 'Armor' | 'Equipment' | 'Consumables' | 'Tools' | 'Treasure' | 'Other'
type LootTier = 'common' | 'uncommon' | 'rare' | 'epic'

const ITEM_TYPES: ItemTypeOption[] = ['Weapons', 'Armor', 'Equipment', 'Consumables', 'Tools', 'Treasure', 'Other']

function mapTypeToKind(type: ItemTypeOption) {
  if (type === 'Weapons') return { category: 'Weapons', item_kind: 'weapon' }
  if (type === 'Armor') return { category: 'Armor', item_kind: 'armor' }
  if (type === 'Equipment') return { category: 'Equipment', item_kind: 'gear' }
  if (type === 'Consumables') return { category: 'Consumables', item_kind: 'consumable' }
  if (type === 'Tools') return { category: 'Tools', item_kind: 'tool' }
  if (type === 'Treasure') return { category: 'Treasure', item_kind: 'treasure' }
  return { category: 'Other', item_kind: 'other' }
}

export function DmItemTemplatePanel({ players }: { players: Array<{ characterId: string; characterName: string; username: string }> }) {
  const { user } = useAuth()
  const [templates, setTemplates] = useState<ItemTemplate[]>([])
  const [name, setName] = useState('')
  const [itemType, setItemType] = useState<ItemTypeOption>('Equipment')
  const [description, setDescription] = useState('')
  const [rarity, setRarity] = useState('')
  const [weight, setWeight] = useState('')
  const [valueText, setValueText] = useState('')
  const [damageText, setDamageText] = useState('')
  const [acBase, setAcBase] = useState('')
  const [chargesMax, setChargesMax] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [selectedGiveCharacterId, setSelectedGiveCharacterId] = useState('')
  const [grantQuantity, setGrantQuantity] = useState('1')
  const [grantMessage, setGrantMessage] = useState<string | null>(null)
  const [isGranting, setIsGranting] = useState(false)
  const [lootTier, setLootTier] = useState<LootTier>('common')
  const [goldMin, setGoldMin] = useState('5')
  const [goldMax, setGoldMax] = useState('25')
  const [lootItemCount, setLootItemCount] = useState('2')
  const [generatedLoot, setGeneratedLoot] = useState<{ gold: number; items: Array<{ template: ItemTemplate; quantity: number }> } | null>(null)
  const [isGivingGenerated, setIsGivingGenerated] = useState(false)
  const [generatedMessage, setGeneratedMessage] = useState<string | null>(null)
  const [selectedLootCharacterId, setSelectedLootCharacterId] = useState('')
  const selectedType = useMemo(() => mapTypeToKind(itemType), [itemType])

  useEffect(() => {
    void (async () => {
      try {
        const rows = await listItemTemplates()
        setTemplates(rows)
      } catch (error) {
        console.error('Failed to load item templates', error)
      }
    })()
  }, [])

  const handleCreate = async () => {
    if (!user?.id || !name.trim() || isSaving) return
    setIsSaving(true)
    setSaveMessage(null)
    const payload: CreateItemTemplateInput = {
      name: name.trim(),
      description: description.trim() || null,
      category: selectedType.category,
      item_kind: selectedType.item_kind,
      item_subtype: selectedType.item_kind,
      rarity: rarity.trim() || null,
      weight: weight ? Number.parseFloat(weight) : null,
      value_text: valueText.trim() || null,
      damage_text: itemType === 'Weapons' ? (damageText.trim() || null) : null,
      ac_base: itemType === 'Armor' ? (acBase ? Number.parseInt(acBase, 10) : null) : null,
      charges_max: itemType === 'Consumables' ? (chargesMax ? Number.parseInt(chargesMax, 10) : null) : null,
      charges_current: itemType === 'Consumables' ? (chargesMax ? Number.parseInt(chargesMax, 10) : null) : null,
      usage_type: itemType === 'Consumables' ? 'charge' : null,
      tags: ['custom', selectedType.item_kind],
      properties: [],
    }
    try {
      const created = await createItemTemplate(user.id, payload)
      setSaveMessage(`Created template: ${created.name}`)
      setTemplates((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
      setName('')
      setDescription('')
      setRarity('')
      setWeight('')
      setValueText('')
      setDamageText('')
      setAcBase('')
      setChargesMax('')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create template.'
      setSaveMessage(message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleGrant = async () => {
    if (!selectedTemplateId || !selectedGiveCharacterId || isGranting) return
    const template = templates.find((row) => row.id === selectedTemplateId)
    if (!template) return
    setIsGranting(true)
    setGrantMessage(null)
    try {
      await grantItemTemplateToCharacter(selectedGiveCharacterId, template, Number.parseInt(grantQuantity, 10) || 1)
      const target = players.find((player) => player.characterId === selectedGiveCharacterId)
      setGrantMessage(`Granted ${template.name}${target ? ` to ${target.characterName}` : ''}.`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to grant item.'
      setGrantMessage(message)
    } finally {
      setIsGranting(false)
    }
  }

  const pickRandom = <T,>(rows: T[]) => rows[Math.floor(Math.random() * rows.length)]

  const templateMatchesTier = (template: ItemTemplate) => {
    const rarity = (template.rarity ?? '').toLowerCase().trim()
    if (lootTier === 'epic') return true
    if (lootTier === 'rare') return ['rare', 'uncommon', 'common', ''].includes(rarity)
    if (lootTier === 'uncommon') return ['uncommon', 'common', ''].includes(rarity)
    return ['common', ''].includes(rarity)
  }

  const handleGenerateLoot = () => {
    const candidateTemplates = templates.filter(templateMatchesTier)
    const count = Math.max(0, Math.min(10, Number.parseInt(lootItemCount, 10) || 0))
    const minGold = Math.max(0, Number.parseInt(goldMin, 10) || 0)
    const maxGold = Math.max(minGold, Number.parseInt(goldMax, 10) || minGold)
    const gold = Math.floor(Math.random() * (maxGold - minGold + 1)) + minGold
    const items: Array<{ template: ItemTemplate; quantity: number }> = []
    for (let index = 0; index < count; index += 1) {
      if (candidateTemplates.length === 0) break
      const template = pickRandom(candidateTemplates)
      const quantity = (template.category ?? '').toLowerCase() === 'consumables' ? Math.floor(Math.random() * 3) + 1 : 1
      items.push({ template, quantity })
    }
    setGeneratedLoot({ gold, items })
    setGeneratedMessage(null)
  }

  const handleGiveGeneratedLoot = async () => {
    if (!generatedLoot || !selectedLootCharacterId || isGivingGenerated) return
    setIsGivingGenerated(true)
    setGeneratedMessage(null)
    try {
      for (const reward of generatedLoot.items) {
        await grantItemTemplateToCharacter(selectedLootCharacterId, reward.template, reward.quantity)
      }
      if (generatedLoot.gold > 0) {
        await grantGoldToCharacter(selectedLootCharacterId, generatedLoot.gold)
      }
      const target = players.find((player) => player.characterId === selectedLootCharacterId)
      setGeneratedMessage(`Generated loot delivered${target ? ` to ${target.characterName}` : ''}${generatedLoot.gold > 0 ? `, including ${generatedLoot.gold} gp` : ''}.`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to deliver generated loot.'
      setGeneratedMessage(message)
    } finally {
      setIsGivingGenerated(false)
    }
  }

  return (
    <Card>
      <CardContent className="space-y-3 py-4">
        <div className="text-sm font-semibold uppercase tracking-wide text-primary">Custom Item Template</div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Item name" />
          <select className="h-9 rounded-md border border-border bg-background px-2 text-sm" value={itemType} onChange={(e) => setItemType(e.target.value as ItemTypeOption)}>
            {ITEM_TYPES.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
          <Input value={rarity} onChange={(e) => setRarity(e.target.value)} placeholder="Rarity (optional)" />
          <Input value={valueText} onChange={(e) => setValueText(e.target.value)} placeholder="Value (e.g. 25 gp)" />
          <Input value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="Weight (optional)" inputMode="decimal" />
          {itemType === 'Weapons' ? <Input value={damageText} onChange={(e) => setDamageText(e.target.value)} placeholder="Damage (e.g. 1d8 slashing)" /> : null}
          {itemType === 'Armor' ? <Input value={acBase} onChange={(e) => setAcBase(e.target.value)} placeholder="Base AC" inputMode="numeric" /> : null}
          {itemType === 'Consumables' ? <Input value={chargesMax} onChange={(e) => setChargesMax(e.target.value)} placeholder="Charges" inputMode="numeric" /> : null}
        </div>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" className="min-h-[96px]" />
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">{saveMessage ?? 'Saved templates become reusable in item import flows.'}</p>
          <Button onClick={() => void handleCreate()} disabled={!name.trim() || isSaving}>{isSaving ? 'Saving…' : 'Create Template'}</Button>
        </div>
        <div className="h-px bg-border" />
        <div className="space-y-3 rounded-lg border border-border/70 bg-muted/20 p-3">
          <div className="text-sm font-semibold uppercase tracking-wide text-primary">Loot Generator (MVP)</div>
          <p className="text-xs text-muted-foreground">Generate random item rewards and optional gold for a selected player.</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="space-y-1 text-xs">
              <span className="font-medium text-foreground">Rarity tier</span>
              <select className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm" value={lootTier} onChange={(e) => setLootTier(e.target.value as LootTier)}>
                <option value="common">Common</option>
                <option value="uncommon">Uncommon</option>
                <option value="rare">Rare</option>
                <option value="epic">Epic / Any</option>
              </select>
              <span className="block text-[11px] text-muted-foreground">Filters eligible templates by rarity.</span>
            </label>
            <label className="space-y-1 text-xs">
              <span className="font-medium text-foreground">Minimum gold (gp)</span>
              <Input value={goldMin} onChange={(e) => setGoldMin(e.target.value)} inputMode="numeric" placeholder="e.g. 5" />
              <span className="block text-[11px] text-muted-foreground">Lowest possible gold roll.</span>
            </label>
            <label className="space-y-1 text-xs">
              <span className="font-medium text-foreground">Maximum gold (gp)</span>
              <Input value={goldMax} onChange={(e) => setGoldMax(e.target.value)} inputMode="numeric" placeholder="e.g. 25" />
              <span className="block text-[11px] text-muted-foreground">Highest possible gold roll.</span>
            </label>
            <label className="space-y-1 text-xs">
              <span className="font-medium text-foreground">Number of item rewards</span>
              <Input value={lootItemCount} onChange={(e) => setLootItemCount(e.target.value)} inputMode="numeric" placeholder="e.g. 2" />
              <span className="block text-[11px] text-muted-foreground">How many item templates to draw.</span>
            </label>
          </div>
          <label className="space-y-1 text-xs">
            <span className="font-medium text-foreground">Loot delivery target</span>
            <select className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm" value={selectedLootCharacterId} onChange={(e) => setSelectedLootCharacterId(e.target.value)}>
              <option value="">Select player</option>
              {players.map((player) => (
                <option key={`loot-${player.characterId}`} value={player.characterId}>{player.characterName} ({player.username})</option>
              ))}
            </select>
            <span className="block text-[11px] text-muted-foreground">Generated items and gold will be delivered to this player.</span>
          </label>
          <div className="flex justify-end">
            <Button variant="outline" onClick={handleGenerateLoot}>Generate Loot</Button>
          </div>
          {generatedLoot ? (
            <div className="rounded-md border border-border/70 bg-muted/30 p-3 text-sm">
              <div className="font-semibold">Review Result</div>
              <div className="text-xs text-muted-foreground">Gold: {generatedLoot.gold} gp</div>
              {generatedLoot.items.length === 0 ? (
                <div className="mt-1 text-xs text-muted-foreground">No item templates matched this tier/filter.</div>
              ) : (
                <ul className="mt-1 space-y-1 text-xs">
                  {generatedLoot.items.map((reward, index) => (
                    <li key={`${reward.template.id}-${index}`}>• {reward.template.name} ×{reward.quantity}</li>
                  ))}
                </ul>
              )}
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{generatedMessage ?? 'Review before assigning to a player.'}</span>
                <Button size="sm" onClick={() => void handleGiveGeneratedLoot()} disabled={!selectedLootCharacterId || isGivingGenerated}>
                  {isGivingGenerated ? 'Giving…' : 'Give Generated Loot'}
                </Button>
              </div>
            </div>
          ) : null}
        </div>
        <div className="h-px bg-border" />
        <div className="space-y-3 rounded-lg border border-border/70 bg-muted/20 p-3">
          <div className="text-sm font-semibold uppercase tracking-wide text-primary">Give Item to Player</div>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="space-y-1 text-xs">
              <span className="font-medium text-foreground">Item template</span>
              <select className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm" value={selectedTemplateId} onChange={(e) => setSelectedTemplateId(e.target.value)}>
                <option value="">Select template</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>{template.name} ({template.category ?? 'Other'})</option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-xs">
              <span className="font-medium text-foreground">Give Item target</span>
              <select className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm" value={selectedGiveCharacterId} onChange={(e) => setSelectedGiveCharacterId(e.target.value)}>
                <option value="">Select player</option>
                {players.map((player) => (
                  <option key={`give-${player.characterId}`} value={player.characterId}>{player.characterName} ({player.username})</option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-xs">
              <span className="font-medium text-foreground">Quantity</span>
              <Input value={grantQuantity} onChange={(e) => setGrantQuantity(e.target.value)} inputMode="numeric" placeholder="e.g. 1" />
            </label>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">{grantMessage ?? 'Delivered items appear as normal inventory entries for the target character.'}</p>
            <Button onClick={() => void handleGrant()} disabled={!selectedTemplateId || !selectedGiveCharacterId || isGranting}>{isGranting ? 'Giving…' : 'Give Item'}</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
