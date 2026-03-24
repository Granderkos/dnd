'use client'

import { useState, memo, useCallback, useMemo } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
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
import { X, FileText, Scroll, Users, Swords, BookOpen, ArrowLeft } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { PageShell } from '@/components/app/page-shell'

export interface Note {
  id: string
  title: string
  content: string
  category: string
  createdAt: number
  updatedAt: number
}

interface NotesProps {
  notes: Note[]
  onChange: (notes: Note[]) => void
}

const NOTE_CATEGORIES = [
  { id: 'session', labelKey: 'notes.session', icon: FileText },
  { id: 'quest', labelKey: 'notes.quest', icon: Scroll },
  { id: 'npc', labelKey: 'notes.npcs', icon: Users },
  { id: 'combat', labelKey: 'notes.combat', icon: Swords },
  { id: 'general', labelKey: 'notes.general', icon: BookOpen },
] as const

export function Notes({ notes, onChange }: NotesProps) {
  const { t } = useI18n()
  const [selectedNote, setSelectedNote] = useState<Note | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean
    title: string
    description: string
    onConfirm: () => void
  }>({ open: false, title: '', description: '', onConfirm: () => {} })

  const addNote = useCallback((category: string) => {
    const newNote: Note = {
      id: Date.now().toString(),
      title: t('notes.newNote'),
      content: '',
      category,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    onChange([newNote, ...notes])
    setSelectedNote(newNote)
  }, [notes, onChange, t])

  const updateNote = useCallback((note: Note) => {
    const updatedNote = { ...note, updatedAt: Date.now() }
    onChange(notes.map((n) => (n.id === note.id ? updatedNote : n)))
    setSelectedNote(updatedNote)
  }, [notes, onChange])

  const deleteNote = useCallback((id: string, title: string) => {
    setConfirmDialog({
      open: true,
      title: t('notes.deleteTitle'),
      description: t('notes.deleteDescription', { title }),
      onConfirm: () => {
        onChange(notes.filter((n) => n.id !== id))
        if (selectedNote?.id === id) {
          setSelectedNote(null)
        }
      },
    })
  }, [notes, onChange, selectedNote, t])

  const sortedNotes = useMemo(() => {
    const filteredNotes = selectedCategory === 'all'
      ? notes
      : notes.filter((n) => n.category === selectedCategory)
    return [...filteredNotes].sort((a, b) => b.updatedAt - a.updatedAt)
  }, [notes, selectedCategory])

  if (selectedNote) {
    return (
      <ScrollArea className="h-[calc(100vh-4rem)]">
        <div className="px-3 py-4 pb-24">
          <PageShell>
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setSelectedNote(null)}
                    className="shrink-0 size-9"
                  >
                    <ArrowLeft className="size-5" />
                  </Button>
                  <Input
                    value={selectedNote.title}
                    onChange={(e) => updateNote({ ...selectedNote, title: e.target.value })}
                    className="h-10 min-w-0 flex-1 text-base font-semibold"
                    placeholder={t('notes.titlePlaceholder')}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => deleteNote(selectedNote.id, selectedNote.title)}
                    className="size-9 shrink-0 text-destructive hover:text-destructive"
                  >
                    <X className="size-5" />
                  </Button>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{t(NOTE_CATEGORIES.find((c) => c.id === selectedNote.category)?.labelKey ?? 'notes.general')}</span>
                  <span>|</span>
                  <span>{new Date(selectedNote.updatedAt).toLocaleString()}</span>
                </div>
              </CardHeader>
              <CardContent className="pb-3">
                <Textarea
                  value={selectedNote.content}
                  onChange={(e) => updateNote({ ...selectedNote, content: e.target.value })}
                  placeholder={t('notes.contentPlaceholder')}
                  className="min-h-[55vh] resize-none overflow-y-auto overscroll-contain text-sm scrollbar-hidden"
                />
              </CardContent>
            </Card>
          </PageShell>
        </div>

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

  return (
    <ScrollArea className="h-[calc(100vh-4rem)]">
      <div className="px-3 py-4">
        <PageShell>
          <div className="-mx-1 overflow-x-auto px-1 scrollbar-hidden"><div className="flex w-max gap-2">
              <Button
                size="sm"
                variant={selectedCategory === 'all' ? 'default' : 'outline'}
                onClick={() => setSelectedCategory('all')}
                className="h-8 shrink-0 px-3 text-xs"
              >
                {t('common.all')}
              </Button>
              {NOTE_CATEGORIES.map(({ id, labelKey }) => (
                <Button
                  key={id}
                  size="sm"
                  variant={selectedCategory === id ? 'default' : 'outline'}
                  onClick={() => setSelectedCategory(id)}
                  className="h-8 shrink-0 px-3 text-xs"
                >
                  {t(labelKey)}
                </Button>
              ))}
            </div></div>

          <Card className="mt-4">
            <CardContent className="pb-3 pt-3">
              <div className="-mx-1 overflow-x-auto px-1 scrollbar-hidden"><div className="flex w-max gap-2">
                {NOTE_CATEGORIES.map(({ id, icon: Icon, labelKey }) => (
                  <Button
                    key={id}
                    size="sm"
                    variant="outline"
                    onClick={() => addNote(id)}
                    className="h-10 gap-1.5"
                    title={t(labelKey)}
                  >
                    <Icon className="size-5" />
                    <span className="hidden sm:inline text-sm">{t(labelKey)}</span>
                  </Button>
                ))}
              </div></div>
            </CardContent>
          </Card>

          <div className="mt-4 space-y-3">
            {sortedNotes.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <FileText className="mx-auto mb-2 size-10 opacity-50" />
                  <p className="text-sm">{t('notes.noNotes')}</p>
                </CardContent>
              </Card>
            ) : (
              sortedNotes.map((note) => (
                <NoteCard
                  key={note.id}
                  note={note}
                  onSelect={() => setSelectedNote(note)}
                  onDelete={() => deleteNote(note.id, note.title)}
                />
              ))
            )}
          </div>
        </PageShell>
      </div>

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

interface NoteCardProps {
  note: Note
  onSelect: () => void
  onDelete: () => void
}

const NoteCard = memo(function NoteCard({ note, onSelect, onDelete }: NoteCardProps) {
  const { t } = useI18n()
  const category = NOTE_CATEGORIES.find((c) => c.id === note.category)
  const Icon = category?.icon || FileText

  return (
    <Card>
      <CardContent className="flex items-start gap-3 py-3">
        <button className="flex min-w-0 flex-1 items-start gap-3 text-left" onClick={onSelect}>
          <Icon className="mt-0.5 size-6 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="max-w-[200px] truncate text-sm font-medium">{note.title}</p>
            <p className="max-w-[200px] truncate text-sm text-muted-foreground">{note.content || t('notes.emptyNote')}</p>
            <p className="mt-1 text-xs text-muted-foreground">{new Date(note.updatedAt).toLocaleDateString()}</p>
          </div>
        </button>
        <Button
          size="icon"
          variant="ghost"
          onClick={onDelete}
          className="size-9 shrink-0 text-destructive hover:text-destructive"
        >
          <X className="size-5" />
        </Button>
      </CardContent>
    </Card>
  )
})
