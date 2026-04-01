'use client'

import { useEffect, useMemo, useState } from 'react'
import { MonsterCard } from '@/components/dm/MonsterCard'
import { addCompendiumMonsterToActiveFight, listCreatures } from '@/lib/supabase-v3'
import type { CompendiumEntry } from '@/lib/v3-types'
import { useI18n } from '@/lib/i18n'
import { useAuth } from '@/lib/auth-context'

function numberFromData(data: Record<string, unknown>, key: string, fallback = 0) {
  const value = data[key]
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : fallback
  }
  return fallback
}

function formatError(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'object' && error !== null) {
    const message = 'message' in error && typeof (error as { message?: unknown }).message === 'string'
      ? (error as { message: string }).message
      : null
    const details = 'details' in error && typeof (error as { details?: unknown }).details === 'string'
      ? (error as { details: string }).details
      : null
    return [message, details].filter(Boolean).join(' — ') || fallback
  }
  return fallback
}

let cachedMonsters: CompendiumEntry[] | null = null

export function DmBestiaryPanel({ onMonsterAdded }: { onMonsterAdded?: () => void }) {
  const { t } = useI18n()
  const { user } = useAuth()
  const [monsters, setMonsters] = useState<CompendiumEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [pendingEntryIds, setPendingEntryIds] = useState<string[]>([])
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionSuccess, setActionSuccess] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    const load = async () => {
      if (cachedMonsters) {
        setMonsters(cachedMonsters)
        setIsLoading(false)
        return
      }
      try {
        setLoadError(null)
        const rows = await listCreatures()
        if (!active) return
        cachedMonsters = rows
        setMonsters(rows)
      } catch (error) {
        console.error('Failed to load bestiary monsters', error)
        if (!active) return
        const message = formatError(error, t('common.unknownError'))
        setLoadError(message)
        setMonsters([])
      } finally {
        if (active) setIsLoading(false)
      }
    }

    void load()
    return () => {
      active = false
    }
  }, [])

  const monsterCards = useMemo(() => {
    return monsters.map((monster) => {
      const data = (monster.data ?? {}) as Record<string, unknown>
      return {
        entry: monster,
        id: monster.id,
        name: monster.name,
        hp: numberFromData(data, 'hp', 0),
        ac: numberFromData(data, 'ac', 0),
        initiativeBonus: numberFromData(data, 'initiative_bonus', 0),
      }
    })
  }, [monsters])

  if (isLoading) {
    return <div className="flex h-full items-center justify-center text-muted-foreground">{t('common.loading')}</div>
  }

  const handleAddToFight = async (monster: CompendiumEntry) => {
    if (!user?.id) {
      setActionError(t('bestiary.mustBeLoggedIn'))
      setActionSuccess(null)
      return
    }
    if (pendingEntryIds.includes(monster.id)) return

    setPendingEntryIds((prev) => [...prev, monster.id])
    setActionError(null)
    setActionSuccess(null)
    try {
      const { entity } = await addCompendiumMonsterToActiveFight(user.id, monster)
      setActionSuccess(t('bestiary.addSuccess', { name: monster.name, initiative: `${entity.initiative ?? '—'}` }))
      onMonsterAdded?.()
    } catch (error) {
      console.error('Failed to add monster to fight', error)
      const message = formatError(error, t('common.unknownError'))
      setActionError(t('bestiary.addError', { name: monster.name, message }))
    } finally {
      setPendingEntryIds((prev) => prev.filter((id) => id !== monster.id))
    }
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto p-3">
      {loadError ? (
        <div className="mb-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {t('bestiary.loadError', { message: loadError })}
        </div>
      ) : null}
      {actionSuccess ? (
        <div className="mb-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-700">
          {actionSuccess}
        </div>
      ) : null}
      {actionError ? (
        <div className="mb-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {actionError}
        </div>
      ) : null}

      {monsterCards.length === 0 ? (
        <div className="rounded-lg border p-4 text-muted-foreground">{t('bestiary.empty')}</div>
      ) : (
        <div className="space-y-3">
          {monsterCards.map((monster) => (
            <MonsterCard
              key={monster.id}
              isAdding={pendingEntryIds.includes(monster.id)}
              name={monster.name}
              hp={monster.hp}
              ac={monster.ac}
              initiativeBonus={monster.initiativeBonus}
              addToFightLabel={t('bestiary.addToFight')}
              onAddToFight={() => void handleAddToFight(monster.entry)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
