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
  { id: 'session', label: 'Session', icon: FileText },
  { id: 'quest', label: 'Quest', icon: Scroll },
  { id: 'npc', label: 'NPCs', icon: Users },
  { id: 'combat', label: 'Combat', icon: Swords },
  { id: 'general', label: 'General', icon: BookOpen },
]

export function Notes({ notes, onChange }: NotesProps) {
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
      title: 'New Note',
      content: '',
      category,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    onChange([newNote, ...notes])
    setSelectedNote(newNote)
  }, [notes, onChange])

  const updateNote = useCallback((note: Note) => {
    const updatedNote = { ...note, updatedAt: Date.now() }
    onChange(notes.map((n) => (n.id === note.id ? updatedNote : n)))
    setSelectedNote(updatedNote)
  }, [notes, onChange])

  const deleteNote = useCallback((id: string, title: string) => {
    setConfirmDialog({
      open: true,
      title: 'Delete Note',
      description: `Delete "${title}"?`,
      onConfirm: () => {
        onChange(notes.filter((n) => n.id !== id))
        if (selectedNote?.id === id) {
          setSelectedNote(null)
        }
      },
    })
  }, [notes, onChange, selectedNote])

  const sortedNotes = useMemo(() => {
    const filteredNotes = selectedCategory === 'all'
      ? notes
      : notes.filter((n) => n.category === selectedCategory)
    return [...filteredNotes].sort((a, b) => b.updatedAt - a.updatedAt)
  }, [notes, selectedCategory])

  // Mobile: Show either list or editor
  if (selectedNote) {
    return (
      <div className="flex h-[calc(100vh-4rem)] flex-col p-3">
        <Card className="flex flex-1 flex-col">
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
                onChange={(e) =>
                  updateNote({ ...selectedNote, title: e.target.value })
                }
                className="h-10 flex-1 min-w-0 text-base font-semibold"
                placeholder="Note title"
              />
              <Button
                size="icon"
                variant="ghost"
                onClick={() => deleteNote(selectedNote.id, selectedNote.title)}
                className="shrink-0 size-9 text-destructive hover:text-destructive"
              >
                <X className="size-5" />
              </Button>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>
                {NOTE_CATEGORIES.find((c) => c.id === selectedNote.category)?.label}
              </span>
              <span>|</span>
              <span>
                {new Date(selectedNote.updatedAt).toLocaleString()}
              </span>
            </div>
          </CardHeader>
          <CardContent className="flex-1 pb-3">
            <Textarea
              value={selectedNote.content}
              onChange={(e) =>
                updateNote({ ...selectedNote, content: e.target.value })
              }
              placeholder="Write your notes here..."
              className="h-full min-h-[200px] resize-none text-sm"
            />
          </CardContent>
        </Card>

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
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDialog.onConfirm}>Confirm</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    )
  }

  return (
    <ScrollArea className="h-[calc(100vh-4rem)]">
      <div className="flex flex-col gap-3 p-3">
        {/* Category Filter - Single scrollable row */}
        <div className="overflow-x-auto pb-1 -mx-3 px-3">
          <div className="flex gap-1.5 w-max">
            <Button
              size="sm"
              variant={selectedCategory === 'all' ? 'default' : 'outline'}
              onClick={() => setSelectedCategory('all')}
              className="h-8 px-3 text-xs shrink-0"
            >
              All
            </Button>
            {NOTE_CATEGORIES.map(({ id, label }) => (
              <Button
                key={id}
                size="sm"
                variant={selectedCategory === id ? 'default' : 'outline'}
                onClick={() => setSelectedCategory(id)}
                className="h-8 px-3 text-xs shrink-0"
              >
                {label}
              </Button>
            ))}
          </div>
        </div>

        {/* Add Note Buttons */}
        <Card>
          <CardContent className="pt-3 pb-3">
            <div className="flex justify-center gap-2">
              {NOTE_CATEGORIES.map(({ id, icon: Icon, label }) => (
                <Button
                  key={id}
                  size="sm"
                  variant="outline"
                  onClick={() => addNote(id)}
                  className="flex-1 gap-1.5 h-10"
                >
                  <Icon className="size-5" />
                  <span className="hidden sm:inline text-sm">{label}</span>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Notes List */}
        {sortedNotes.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <FileText className="mx-auto mb-2 size-10 opacity-50" />
              <p className="text-sm">No notes yet</p>
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
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDialog.onConfirm}>Confirm</AlertDialogAction>
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
  const category = NOTE_CATEGORIES.find((c) => c.id === note.category)
  const Icon = category?.icon || FileText
  
  return (
    <Card>
      <CardContent className="flex items-start gap-3 py-3">
        <button
          className="min-w-0 flex-1 text-left flex items-start gap-3"
          onClick={onSelect}
        >
          <Icon className="mt-0.5 size-6 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate max-w-[200px]">
              {note.title}
            </p>
            <p className="text-sm text-muted-foreground truncate max-w-[200px]">
              {note.content || 'Empty note'}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {new Date(note.updatedAt).toLocaleDateString()}
            </p>
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
