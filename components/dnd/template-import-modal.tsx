'use client'

import { useMemo, useState } from 'react'
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
  selectedId,
  onSelectedIdChange,
  onImport,
  importDisabled,
  footerContent,
}: TemplateImportModalProps<T>) {
  const [query, setQuery] = useState('')

  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return items
    return items.filter((item) => {
      const titleText = getItemTitle(item).toLowerCase()
      const descriptionText = (getItemDescription?.(item) ?? '').toLowerCase()
      return titleText.includes(normalized) || descriptionText.includes(normalized)
    })
  }, [getItemDescription, getItemTitle, items, query])

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
              <div className="divide-y">
                {filteredItems.map((item) => {
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
