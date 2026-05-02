'use client'

import { useState, memo, useCallback, useMemo, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
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
import { Plus, X, Minus, Package, Sword, Shield, Backpack, FlaskConical, ScrollText, Gem, Boxes } from 'lucide-react'
import { Inventory as InventoryType, InventoryItem, Currency } from '@/lib/dnd-types'
import { useI18n } from '@/lib/i18n'
import { PageShell } from '@/components/app/page-shell'

interface InventoryProps {
  inventory: InventoryType
  onChange: (inventory: InventoryType) => void
}

const CATEGORIES = ['Weapons', 'Armor', 'Equipment', 'Consumables', 'Supplies', 'Treasure', 'Other'] as const

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
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null)
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

  const updateItem = useCallback((item: InventoryItem) => {
    setConfirmDialog({
      open: true,
      title: 'Save Changes',
      description: `Save changes to "${item.name}"?`,
      onConfirm: () => {
        onChange({
          ...inventory,
          items: inventory.items.map((i) => (i.id === item.id ? item : i)),
        })
        setEditingItem(null)
      },
    })
  }, [inventory, onChange])

  const deleteItem = useCallback((id: string, name: string) => {
    setConfirmDialog({
      open: true,
      title: 'Delete Item',
      description: `Delete "${name}"?`,
      onConfirm: () => {
        onChange({
          ...inventory,
          items: inventory.items.filter((i) => i.id !== id),
        })
      },
    })
  }, [inventory, onChange])

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

  return (
    <ScrollArea className="h-[calc(100vh-4rem)]">
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

        {/* Add Item Button */}
        <Button onClick={() => setIsAddingItem(true)} className="w-full h-10">
          <Plus className="mr-2 size-5" />
          {t('inventory.addItem')}
        </Button>

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
                      onEdit={() => setEditingItem(item)}
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

      {/* Edit Item Dialog */}
      {editingItem && (
        <ItemDialog
          open={!!editingItem}
          onOpenChange={() => setEditingItem(null)}
          item={editingItem}
          onSave={updateItem}
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
    </ScrollArea>
  )
}

interface ItemRowProps {
  item: InventoryItem
  onEdit: () => void
  onDelete: () => void
  onAdjustQuantity: (amount: number) => void
}

const ItemRow = memo(function ItemRow({ item, onEdit, onDelete, onAdjustQuantity }: ItemRowProps) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-background/80 px-3 py-3">
      <button
        onClick={onEdit}
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

interface ItemDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  item?: InventoryItem
  onSave: (item: InventoryItem) => void
}

function ItemDialog({ open, onOpenChange, item, onSave }: ItemDialogProps) {
  const { t } = useI18n()
  const [formData, setFormData] = useState<Partial<InventoryItem>>(
    item || {
      name: '',
      quantity: 1,
      description: '',
      category: 'Equipment',
    }
  )

  useEffect(() => {
    setFormData(item || {
      name: '',
      quantity: 1,
      description: '',
      category: 'Equipment',
    })
  }, [item, open])

  const handleSubmit = () => {
    if (formData.name) {
      onSave({
        id: item?.id || Date.now().toString(),
        name: formData.name,
        quantity: formData.quantity || 1,
        description: formData.description || '',
        category: formData.category || 'Equipment',
      })
      if (!item) {
        setFormData({
          name: '',
          quantity: 1,
          description: '',
          category: 'Equipment',
        })
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item ? t('inventory.editItem') : t('inventory.addItem')}</DialogTitle>
          <DialogDescription className="sr-only">Enter item details</DialogDescription>
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
          <Button onClick={handleSubmit} className="w-full h-10">
            {item ? t('inventory.saveChanges') : t('inventory.addItem')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
