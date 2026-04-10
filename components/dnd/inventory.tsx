'use client'

import { useState, memo, useCallback, useMemo, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
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
import { Plus, X, Minus, Package, Sword, Shield, Backpack, FlaskConical, ScrollText, Gem, Boxes } from 'lucide-react'
import { Inventory as InventoryType, InventoryItem, Currency } from '@/lib/dnd-types'
import { useI18n } from '@/lib/i18n'
import { PageShell } from '@/components/app/page-shell'
import { generateClientId } from '@/lib/client-id'
import { listItemTemplates, type ItemTemplate } from '@/lib/supabase-data'
import { TemplateImportModal } from '@/components/dnd/template-import-modal'

interface InventoryProps {
  inventory: InventoryType
  onChange: (inventory: InventoryType) => void
}

const CATEGORIES = ['Weapons', 'Armor', 'Equipment', 'Consumables', 'Supplies', 'Treasure', 'Other'] as const
const CATEGORY_SET = new Set<string>(CATEGORIES)

function normalizeInventoryCategory(value: string | null | undefined): string {
  const normalized = (value ?? '').trim().toLowerCase()
  if (!normalized) return 'Other'
  if (['weapon', 'weapons'].includes(normalized)) return 'Weapons'
  if (['armor', 'armour'].includes(normalized)) return 'Armor'
  if (['equipment', 'gear'].includes(normalized)) return 'Equipment'
  if (['consumable', 'consumables', 'potion', 'potions'].includes(normalized)) return 'Consumables'
  if (['supply', 'supplies'].includes(normalized)) return 'Supplies'
  if (['treasure', 'treasures', 'loot'].includes(normalized)) return 'Treasure'
  if (CATEGORY_SET.has(value ?? '')) return value as string
  return 'Other'
}

const CATEGORY_META = {
  Weapons: { icon: Sword, labelKey: 'inventory.weapons' },
  Armor: { icon: Shield, labelKey: 'inventory.armor' },
  Equipment: { icon: Backpack, labelKey: 'inventory.equipment' },
  Consumables: { icon: FlaskConical, labelKey: 'inventory.consumables' },
  Supplies: { icon: ScrollText, labelKey: 'inventory.supplies' },
  Treasure: { icon: Gem, labelKey: 'inventory.treasure' },
  Other: { icon: Boxes, labelKey: 'inventory.other' },
} as const

export function Inventory({ inventory, onChange }: InventoryProps) {
  const { t } = useI18n()
  const [isAddingItem, setIsAddingItem] = useState(false)
  const [isImportingTemplate, setIsImportingTemplate] = useState(false)
  const [templates, setTemplates] = useState<ItemTemplate[]>([])
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false)
  const [templateLoadError, setTemplateLoadError] = useState<string | null>(null)
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null)
  const [viewingItem, setViewingItem] = useState<InventoryItem | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean
    title: string
    description: string
    onConfirm: () => void
  }>({ open: false, title: '', description: '', onConfirm: () => {} })

  const updateCurrency = useCallback((coin: keyof Currency, value: number) => {
    onChange({
      ...inventory,
      currency: {
        ...inventory.currency,
        [coin]: Math.max(0, value),
      },
    })
  }, [inventory, onChange])

  const addItem = useCallback((item: InventoryItem) => {
    onChange({
      ...inventory,
      items: [...inventory.items, item],
    })
    setIsAddingItem(false)
  }, [inventory, onChange])

  const importItemTemplate = useCallback((template: ItemTemplate, quantity: number) => {
    const normalizedCategory = normalizeInventoryCategory(template.category)
    const importedItem: InventoryItem = {
      id: generateClientId(),
      name: template.name,
      quantity: Math.max(1, quantity),
      description: template.description ?? '',
      category: normalizedCategory,
      sourceItemTemplateId: template.id,
      sourceOrigin: 'template',
      templateSnapshot: {
        id: template.id,
        name: template.name,
        description: template.description,
        category: normalizedCategory,
        rarity: template.rarity,
        weight: template.weight,
        value_text: template.value_text,
        damage_text: template.damage_text,
        damage_type: template.damage_type,
        range_text: template.range_text,
        weapon_kind: template.weapon_kind,
        source_url: template.source_url,
        requires_attunement: template.requires_attunement,
        properties: template.properties,
        tags: template.tags,
      },
    }
    onChange({
      ...inventory,
      items: [...inventory.items, importedItem],
    })
    setIsImportingTemplate(false)
  }, [inventory, onChange])

  const updateItem = useCallback((item: InventoryItem) => {
    setConfirmDialog({
      open: true,
      title: t('inventory.saveChanges'),
      description: t('inventory.saveChangesDescription', { name: item.name }),
      onConfirm: () => {
        onChange({
          ...inventory,
          items: inventory.items.map((i) => (i.id === item.id ? item : i)),
        })
        setEditingItem(null)
      },
    })
  }, [inventory, onChange, t])

  const deleteItem = useCallback((id: string, name: string) => {
    setConfirmDialog({
      open: true,
      title: t('inventory.deleteItem'),
      description: t('inventory.deleteItemDescription', { name }),
      onConfirm: () => {
        onChange({
          ...inventory,
          items: inventory.items.filter((i) => i.id !== id),
        })
      },
    })
  }, [inventory, onChange, t])

  const adjustQuantity = useCallback((id: string, amount: number) => {
    onChange({
      ...inventory,
      items: inventory.items.map((i) =>
        i.id === id ? { ...i, quantity: Math.max(0, i.quantity + amount) } : i
      ),
    })
  }, [inventory, onChange])

  const groupedItems = useMemo(() => {
    return CATEGORIES.reduce(
      (acc, category) => {
        acc[category] = inventory.items.filter((item) => item.category === category)
        return acc
      },
      {} as Record<string, InventoryItem[]>
    )
  }, [inventory.items])

  const coins = useMemo(() => [
    { key: 'cp' as keyof Currency, label: 'CP', color: 'bg-orange-600' },
    { key: 'sp' as keyof Currency, label: 'SP', color: 'bg-gray-400' },
    { key: 'ep' as keyof Currency, label: 'EP', color: 'bg-blue-300' },
    { key: 'gp' as keyof Currency, label: 'GP', color: 'bg-yellow-500' },
    { key: 'pp' as keyof Currency, label: 'PP', color: 'bg-slate-300' },
  ], [])

  const totalGP = useMemo(() => (
    inventory.currency.pp * 10 +
    inventory.currency.gp +
    inventory.currency.ep * 0.5 +
    inventory.currency.sp * 0.1 +
    inventory.currency.cp * 0.01
  ).toFixed(2), [inventory.currency])

  useEffect(() => {
    if (!isImportingTemplate || templates.length > 0) return
    let cancelled = false
    setIsLoadingTemplates(true)
    setTemplateLoadError(null)
    void listItemTemplates()
      .then((rows) => {
        if (!cancelled) setTemplates(rows)
      })
      .catch((error) => {
        if (cancelled) return
        console.error('Failed to load item templates', error)
        setTemplateLoadError(t('inventory.templateLoadFailed'))
      })
      .finally(() => {
        if (!cancelled) setIsLoadingTemplates(false)
      })
    return () => {
      cancelled = true
    }
  }, [isImportingTemplate, templates.length, t])

  return (
    <div className="h-full min-h-0 overflow-y-auto">
      <div className="px-3 py-4"><PageShell><div className="flex flex-col gap-4 pb-24">
        {/* Currency */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              {coins.map(({ key, label, color }) => (
                <div key={key} className="flex flex-1 flex-col items-center">
                  <div
                    className={`mb-1 flex size-10 items-center justify-center rounded-full ${color} text-xs font-bold text-white shadow-sm`}
                  >
                    {label}
                  </div>
                  <Input
                    type="number"
                    min={0}
                    value={inventory.currency[key]}
                    onChange={(e) => updateCurrency(key, parseInt(e.target.value) || 0)}
                    className="h-9 w-full text-center text-sm"
                  />
                </div>
              ))}
            </div>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              {t('inventory.treasureTotal')}: {totalGP} GP
            </p>
          </CardContent>
        </Card>

        {/* Add Item Buttons */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button onClick={() => setIsAddingItem(true)} className="h-10">
            <Plus className="mr-2 size-5" />
            {t('inventory.createCustomItem')}
          </Button>
          <Button variant="outline" onClick={() => setIsImportingTemplate(true)} className="h-10">
            <Package className="mr-2 size-5" />
            {t('inventory.importFromTemplate')}
          </Button>
        </div>

        {/* Item Categories */}
        {CATEGORIES.map((category) => {
          const items = groupedItems[category]
          if (items.length === 0) return null

          return (
            <Card key={category}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-[0.08em]">
                  {(() => { const Icon = CATEGORY_META[category].icon; return <Icon className="size-5" /> })()}
                  {t(CATEGORY_META[category].labelKey)}
                  <Badge variant="secondary" className="ml-auto text-xs">
                    {items.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1.5">
                  {items.map((item) => (
                    <ItemRow
                      key={item.id}
                      item={item}
                      onView={() => setViewingItem(item)}
                      onDelete={() => deleteItem(item.id, item.name)}
                      onAdjustQuantity={(amount) => adjustQuantity(item.id, amount)}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div></PageShell></div>

      {/* Add Item Dialog */}
      <ItemDialog
        open={isAddingItem}
        onOpenChange={setIsAddingItem}
        onSave={addItem}
      />

      <TemplateImportDialog
        open={isImportingTemplate}
        onOpenChange={setIsImportingTemplate}
        templates={templates}
        isLoading={isLoadingTemplates}
        loadError={templateLoadError}
        onImport={importItemTemplate}
      />

      {/* Edit Item Dialog */}
      {editingItem && (
        <ItemDialog
          open={!!editingItem}
          onOpenChange={() => setEditingItem(null)}
          item={editingItem}
          onSave={updateItem}
        />
      )}

      {viewingItem && (
        <ItemDetailDialog
          open={!!viewingItem}
          onOpenChange={() => setViewingItem(null)}
          item={viewingItem}
          onEdit={() => {
            setViewingItem(null)
            setEditingItem(viewingItem)
          }}
        />
      )}

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
    </div>
  )
}

interface ItemRowProps {
  item: InventoryItem
  onView: () => void
  onDelete: () => void
  onAdjustQuantity: (amount: number) => void
}

const ItemRow = memo(function ItemRow({ item, onView, onDelete, onAdjustQuantity }: ItemRowProps) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-background/80 px-3 py-3">
      <button
        onClick={onView}
        className="min-w-0 flex-1 text-left"
      >
        <p className="text-sm font-medium truncate max-w-[140px]">
          {item.name}
        </p>
        {item.description && (
          <p className="text-xs text-muted-foreground truncate max-w-[140px]">
            {item.description}
          </p>
        )}
      </button>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          size="icon"
          variant="ghost"
          className="size-8"
          onClick={() => onAdjustQuantity(-1)}
        >
          <Minus className="size-4" />
        </Button>
        <span className="w-6 text-center text-sm font-medium">
          {item.quantity}
        </span>
        <Button
          size="icon"
          variant="ghost"
          className="size-8"
          onClick={() => onAdjustQuantity(1)}
        >
          <Plus className="size-4" />
        </Button>
      </div>
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

interface ItemDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: InventoryItem
  onEdit: () => void
}

function ItemDetailDialog({ open, onOpenChange, item, onEdit }: ItemDetailDialogProps) {
  const { t } = useI18n()
  const snapshot = (item.templateSnapshot ?? null) as Record<string, unknown> | null
  const properties = Array.isArray(snapshot?.properties)
    ? snapshot?.properties.map((value) => String(value)).join(', ')
    : null
  const tags = Array.isArray(snapshot?.tags)
    ? snapshot?.tags.map((value) => String(value)).join(', ')
    : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('inventory.itemDetails')}</DialogTitle>
          <DialogDescription>{t('inventory.category')}: {item.category}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <div><span className="text-muted-foreground">{t('inventory.name')}:</span> {item.name}</div>
            <div><span className="text-muted-foreground">{t('inventory.quantity')}:</span> {item.quantity}</div>
            {typeof snapshot?.rarity === 'string' && snapshot.rarity ? (
              <div><span className="text-muted-foreground">{t('inventory.rarity')}:</span> {snapshot.rarity}</div>
            ) : null}
            {typeof snapshot?.weight === 'number' ? (
              <div><span className="text-muted-foreground">{t('inventory.weight')}:</span> {snapshot.weight}</div>
            ) : null}
            {typeof snapshot?.value_text === 'string' && snapshot.value_text ? (
              <div><span className="text-muted-foreground">{t('inventory.value')}:</span> {snapshot.value_text}</div>
            ) : null}
            {typeof snapshot?.damage_text === 'string' && snapshot.damage_text ? (
              <div><span className="text-muted-foreground">{t('inventory.damage')}:</span> {snapshot.damage_text}</div>
            ) : null}
            {typeof snapshot?.damage_type === 'string' && snapshot.damage_type ? (
              <div><span className="text-muted-foreground">{t('inventory.damageType')}:</span> {snapshot.damage_type}</div>
            ) : null}
            {typeof snapshot?.range_text === 'string' && snapshot.range_text ? (
              <div><span className="text-muted-foreground">{t('inventory.range')}:</span> {snapshot.range_text}</div>
            ) : null}
          </div>
          {item.description ? (
            <div className="rounded-md bg-muted/25 p-3">
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{item.description}</p>
            </div>
          ) : null}
          {properties ? (
            <p><span className="text-muted-foreground">{t('inventory.properties')}:</span> {properties}</p>
          ) : null}
          {tags ? (
            <p><span className="text-muted-foreground">{t('inventory.tags')}:</span> {tags}</p>
          ) : null}
          <Button onClick={onEdit} className="w-full h-10">{t('inventory.editAction')}</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

interface ItemDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  item?: InventoryItem
  onSave: (item: InventoryItem) => void
}

interface ItemFormState {
  name: string
  quantity: number
  description: string
  category: string
  rarity: string
  weight: string
  valueText: string
  damageText: string
  damageType: string
  rangeText: string
  propertiesText: string
  tagsText: string
}

interface TemplateImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  templates: ItemTemplate[]
  isLoading: boolean
  loadError: string | null
  onImport: (template: ItemTemplate, quantity: number) => void
}

function TemplateImportDialog({
  open,
  onOpenChange,
  templates,
  isLoading,
  loadError,
  onImport,
}: TemplateImportDialogProps) {
  const { t } = useI18n()
  const [selectedId, setSelectedId] = useState<string>('')
  const [quantity, setQuantity] = useState<number>(1)

  useEffect(() => {
    if (!open) return
    setSelectedId((current) => current || templates[0]?.id || '')
    setQuantity(1)
  }, [open, templates])

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedId) ?? null,
    [templates, selectedId]
  )

  return (
    <TemplateImportModal
      open={open}
      onOpenChange={onOpenChange}
      title={t('inventory.importFromTemplate')}
      description={t('inventory.selectTemplate')}
      searchPlaceholder={t('inventory.searchTemplates')}
      isLoading={isLoading}
      loadingText={t('common.loading')}
      emptyText={t('inventory.noTemplates')}
      errorText={loadError}
      importLabel={t('inventory.importFromTemplate')}
      items={templates}
      getItemId={(template) => template.id}
      getItemTitle={(template) => template.name}
      getItemDescription={(template) => template.description ?? ''}
      selectedId={selectedId}
      onSelectedIdChange={setSelectedId}
      onImport={() => selectedTemplate && onImport(selectedTemplate, quantity)}
      importDisabled={!selectedTemplate}
      footerContent={(
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">{t('inventory.quantity')}</label>
          <Input
            type="number"
            min={1}
            value={quantity}
            onChange={(event) => setQuantity(parseInt(event.target.value, 10) || 1)}
            className="h-10 w-20"
          />
        </div>
      )}
    />
  )
}

function ItemDialog({ open, onOpenChange, item, onSave }: ItemDialogProps) {
  const { t } = useI18n()
  const buildFormState = useCallback((current?: InventoryItem): ItemFormState => {
    const snapshot = (current?.templateSnapshot ?? null) as Record<string, unknown> | null
    const listToText = (value: unknown): string => Array.isArray(value)
      ? value.map((entry) => String(entry).trim()).filter(Boolean).join(', ')
      : ''

    return {
      name: current?.name ?? '',
      quantity: current?.quantity ?? 1,
      description: current?.description ?? '',
      category: current?.category ?? 'Equipment',
      rarity: typeof snapshot?.rarity === 'string' ? snapshot.rarity : '',
      weight: typeof snapshot?.weight === 'number' ? String(snapshot.weight) : '',
      valueText: typeof snapshot?.value_text === 'string' ? snapshot.value_text : '',
      damageText: typeof snapshot?.damage_text === 'string' ? snapshot.damage_text : '',
      damageType: typeof snapshot?.damage_type === 'string' ? snapshot.damage_type : '',
      rangeText: typeof snapshot?.range_text === 'string' ? snapshot.range_text : '',
      propertiesText: listToText(snapshot?.properties),
      tagsText: listToText(snapshot?.tags),
    }
  }, [])

  const [formData, setFormData] = useState<ItemFormState>(buildFormState(item))

  useEffect(() => {
    setFormData(buildFormState(item))
  }, [item, open, buildFormState])

  const parseCommaSeparated = useCallback((value: string): string[] => (
    value
      .split(',')
      .map((token) => token.trim())
      .filter(Boolean)
  ), [])

  const handleSubmit = () => {
    if (formData.name.trim()) {
      const parsedWeight = Number.parseFloat(formData.weight)
      const snapshot: Record<string, unknown> = {
        ...(item?.templateSnapshot && typeof item.templateSnapshot === 'object' ? item.templateSnapshot : {}),
        rarity: formData.rarity.trim() || null,
        weight: Number.isFinite(parsedWeight) ? parsedWeight : null,
        value_text: formData.valueText.trim() || null,
        damage_text: formData.damageText.trim() || null,
        damage_type: formData.damageType.trim().toLowerCase() || null,
        range_text: formData.rangeText.trim() || null,
        properties: parseCommaSeparated(formData.propertiesText),
        tags: parseCommaSeparated(formData.tagsText),
      }

      onSave({
        id: item?.id || generateClientId(),
        name: formData.name.trim(),
        quantity: formData.quantity || 1,
        description: formData.description.trim(),
        category: formData.category || 'Equipment',
        sourceItemTemplateId: item?.sourceItemTemplateId ?? null,
        sourceOrigin: item?.sourceOrigin ?? 'custom',
        templateSnapshot: snapshot,
      })
      if (!item) {
        setFormData(buildFormState())
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item ? t('inventory.editItem') : t('inventory.addItem')}</DialogTitle>
          <DialogDescription className="sr-only">{t('inventory.enterItemDetails')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-sm text-muted-foreground">{t('inventory.name')}</label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder={t('inventory.name')}
              className="h-10"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">{t('inventory.quantity')}</label>
              <Input
                type="number"
                min={0}
                value={formData.quantity}
                onChange={(e) =>
                  setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })
                }
                className="h-10"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">{t('inventory.category')}</label>
              <Select
                value={formData.category}
                onValueChange={(v) => setFormData({ ...formData, category: v })}
              >
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {t(CATEGORY_META[cat].labelKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-sm text-muted-foreground">{t('inventory.description')}</label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder={t('inventory.description') + '...'}
              className="min-h-20"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">{t('inventory.rarity')}</label>
              <Input
                value={formData.rarity}
                onChange={(e) => setFormData({ ...formData, rarity: e.target.value })}
                placeholder={t('inventory.rarity')}
                className="h-10"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">{t('inventory.weight')}</label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={formData.weight}
                onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                placeholder={t('inventory.weight')}
                className="h-10"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-sm text-muted-foreground">{t('inventory.value')}</label>
            <Input
              value={formData.valueText}
              onChange={(e) => setFormData({ ...formData, valueText: e.target.value })}
              placeholder={t('inventory.value')}
              className="h-10"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">{t('inventory.damage')}</label>
              <Input
                value={formData.damageText}
                onChange={(e) => setFormData({ ...formData, damageText: e.target.value })}
                placeholder={t('inventory.damage')}
                className="h-10"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">{t('inventory.damageType')}</label>
              <Input
                value={formData.damageType}
                onChange={(e) => setFormData({ ...formData, damageType: e.target.value })}
                placeholder={t('inventory.damageType')}
                className="h-10"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-sm text-muted-foreground">{t('inventory.range')}</label>
            <Input
              value={formData.rangeText}
              onChange={(e) => setFormData({ ...formData, rangeText: e.target.value })}
              placeholder={t('inventory.range')}
              className="h-10"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-muted-foreground">{t('inventory.properties')}</label>
            <Input
              value={formData.propertiesText}
              onChange={(e) => setFormData({ ...formData, propertiesText: e.target.value })}
              placeholder="finesse, light, thrown"
              className="h-10"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-muted-foreground">{t('inventory.tags')}</label>
            <Input
              value={formData.tagsText}
              onChange={(e) => setFormData({ ...formData, tagsText: e.target.value })}
              placeholder="weapon, martial, melee"
              className="h-10"
            />
          </div>
          <Button onClick={handleSubmit} className="w-full h-10">
            {item ? t('inventory.saveChanges') : t('inventory.addItem')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
