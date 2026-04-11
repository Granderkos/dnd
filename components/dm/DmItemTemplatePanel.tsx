'use client'

import { useMemo, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { createItemTemplate, type CreateItemTemplateInput } from '@/lib/supabase-data'
import { useAuth } from '@/lib/auth-context'

type ItemTypeOption = 'Weapons' | 'Armor' | 'Equipment' | 'Consumables' | 'Tools' | 'Treasure' | 'Other'

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

export function DmItemTemplatePanel() {
  const { user } = useAuth()
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
  const selectedType = useMemo(() => mapTypeToKind(itemType), [itemType])

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
      </CardContent>
    </Card>
  )
}
