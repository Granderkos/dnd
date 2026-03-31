'use client'

import { useEffect, useMemo, useState } from 'react'
import { MonsterCard } from '@/components/dm/MonsterCard'
import { listCreatures } from '@/lib/supabase-v3'
import type { CompendiumEntry } from '@/lib/v3-types'
import { useI18n } from '@/lib/i18n'

function numberFromData(data: Record<string, unknown>, key: string, fallback = 0) {
  const value = data[key]
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : fallback
  }
  return fallback
}

export function DmBestiaryPanel() {
  const { t } = useI18n()
  const [monsters, setMonsters] = useState<CompendiumEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        setLoadError(null)
        const rows = await listCreatures()
        if (!active) return
        setMonsters(rows)
      } catch (error) {
        console.error('Failed to load bestiary monsters', error)
        if (!active) return
        const message = error instanceof Error ? error.message : 'Unknown error'
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

  return (
    <div className="h-full min-h-0 overflow-y-auto p-3">
      {loadError ? (
        <div className="mb-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          Failed to load monsters: {loadError}
        </div>
      ) : null}

      {monsterCards.length === 0 ? (
        <div className="rounded-lg border p-4 text-muted-foreground">No monsters available.</div>
      ) : (
        <div className="space-y-3">
          {monsterCards.map((monster) => (
            <MonsterCard
              key={monster.id}
              name={monster.name}
              hp={monster.hp}
              ac={monster.ac}
              initiativeBonus={monster.initiativeBonus}
              addToFightLabel={t('bestiary.addToFight')}
            />
          ))}
        </div>
      )}
    </div>
  )
}
