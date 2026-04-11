'use client'

import { useEffect, useMemo, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface TemplateImportModalProps<T> {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  searchPlaceholder: string
  isLoading: boolean
  loadingText: string
  emptyText: string
  errorText?: string | null
  importLabel: string
  items: T[]
  getItemId: (item: T) => string
  getItemTitle: (item: T) => string
  getItemDescription?: (item: T) => string | null
  getItemGroupLabel?: (item: T) => string
  groupOrder?: string[]
  categoryFilters?: Array<{ label: string; value: string }>
  allCategoryFilterValue?: string
  selectedId: string
  onSelectedIdChange: (id: string) => void
  onImport: () => void
  importDisabled?: boolean
  footerContent?: React.ReactNode
}

export function TemplateImportModal<T>({
  open,
  onOpenChange,
  title,
  description,
  searchPlaceholder,
  isLoading,
  loadingText,
  emptyText,
  errorText,
  importLabel,
  items,
  getItemId,
  getItemTitle,
  getItemDescription,
  getItemGroupLabel,
  groupOrder,
  categoryFilters,
  allCategoryFilterValue = 'all',
  selectedId,
  onSelectedIdChange,
  onImport,
  importDisabled,
  footerContent,
}: TemplateImportModalProps<T>) {
  const [query, setQuery] = useState('')
  const [activeCategoryFilter, setActiveCategoryFilter] = useState(allCategoryFilterValue)

  useEffect(() => {
    if (!open) {
      setQuery('')
      setActiveCategoryFilter(allCategoryFilterValue)
    }
  }, [allCategoryFilterValue, open])

  const categoryFilteredItems = useMemo(() => {
    if (!getItemGroupLabel || activeCategoryFilter === allCategoryFilterValue) return items
    return items.filter((item) => getItemGroupLabel(item) === activeCategoryFilter)
  }, [activeCategoryFilter, allCategoryFilterValue, getItemGroupLabel, items])

  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return categoryFilteredItems
    return categoryFilteredItems.filter((item) => {
      const titleText = getItemTitle(item).toLowerCase()
      const descriptionText = (getItemDescription?.(item) ?? '').toLowerCase()
      return titleText.includes(normalized) || descriptionText.includes(normalized)
    })
  }, [categoryFilteredItems, getItemDescription, getItemTitle, query])

  useEffect(() => {
    if (!filteredItems.length) return
    const hasSelected = filteredItems.some((item) => getItemId(item) === selectedId)
    if (!hasSelected) onSelectedIdChange(getItemId(filteredItems[0]))
  }, [filteredItems, getItemId, onSelectedIdChange, selectedId])

  const groupedItems = useMemo(() => {
    if (!getItemGroupLabel || activeCategoryFilter !== allCategoryFilterValue) return null
    const groups = new Map<string, T[]>()
    for (const item of filteredItems) {
      const label = getItemGroupLabel(item)
      const current = groups.get(label)
      if (current) current.push(item)
      else groups.set(label, [item])
    }
    const labels = groupOrder?.length
      ? groupOrder.filter((label) => groups.has(label))
      : Array.from(groups.keys())
    return labels.map((label) => ({ label, items: groups.get(label) ?? [] }))
  }, [activeCategoryFilter, allCategoryFilterValue, filteredItems, getItemGroupLabel, groupOrder])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex w-[calc(100vw-1rem)] max-w-2xl flex-col overflow-hidden p-0 sm:w-[95vw] max-h-[calc(100dvh-1rem)] sm:max-h-[85vh]">
        <DialogHeader className="shrink-0 border-b px-4 py-3">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 py-3">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={searchPlaceholder}
            className="h-10 shrink-0"
          />
          {categoryFilters?.length ? (
            <div className="-mx-1 overflow-hidden">
              <div className="flex w-full gap-2 overflow-x-auto px-1 pb-2 touch-pan-x sm:flex-wrap sm:overflow-visible">
                {categoryFilters.map((filter) => {
                  const isActive = filter.value === activeCategoryFilter
                  return (
                    <Button
                      key={filter.value}
                      type="button"
                      size="sm"
                      variant={isActive ? 'default' : 'outline'}
                      className="h-8 shrink-0 rounded-full px-3 text-xs"
                      onClick={() => setActiveCategoryFilter(filter.value)}
                    >
                      {filter.label}
                    </Button>
                  )
                })}
              </div>
            </div>
          ) : null}

          {errorText ? (
            <p className="text-sm text-destructive">{errorText}</p>
          ) : isLoading ? (
            <p className="text-sm text-muted-foreground">{loadingText}</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">{emptyText}</p>
          ) : filteredItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">{emptyText}</p>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto rounded-md border border-border">
              <div className="space-y-3 p-2">
                {(groupedItems ?? [{ label: '', items: filteredItems }]).map((group) => (
                  <div key={group.label || 'ungrouped'} className="overflow-hidden rounded-md border border-border/70 bg-background shadow-sm">
                    {group.label ? (
                      <div className="border-b border-border/60 bg-primary/10 px-3 py-2 text-xs font-bold uppercase tracking-[0.08em] text-foreground/90">
                        {group.label}
                      </div>
                    ) : null}
                    <div className="divide-y">
                      {group.items.map((item) => {
                        const id = getItemId(item)
                        const isSelected = id === selectedId
                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() => onSelectedIdChange(id)}
                            className={`w-full px-3 py-2 text-left transition-colors ${isSelected ? 'bg-primary/10' : 'hover:bg-muted/40'}`}
                          >
                            <p className="text-sm font-medium">{getItemTitle(item)}</p>
                            {getItemDescription ? (
                              <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{getItemDescription(item)}</p>
                            ) : null}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="shrink-0 border-t bg-background px-4 py-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="w-full sm:w-auto">{footerContent}</div>
            <Button className="h-10 w-full sm:w-auto" onClick={onImport} disabled={importDisabled}>{importLabel}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
