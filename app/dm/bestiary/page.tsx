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

export default function DmBestiaryPage() {
  const { t } = useI18n()
  const [monsters, setMonsters] = useState<CompendiumEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const rows = await listCreatures()
        if (!active) return
        const filtered = rows
          .filter((row) => row.type === 'creature' && row.subtype === 'monster')
          .sort((a, b) => a.name.localeCompare(b.name))
        setMonsters(filtered)
      } catch (error) {
        console.error('Failed to load bestiary monsters', error)
        if (active) setMonsters([])
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
    return <div className="flex min-h-dvh items-center justify-center text-muted-foreground">{t('common.loading')}</div>
  }

  return (
    <main className="min-h-dvh bg-background">
      <section className="mx-auto flex h-dvh max-w-4xl flex-col gap-3 p-4">
        <h1 className="text-xl font-bold uppercase tracking-[0.08em] text-primary">{t('nav.bestiary')}</h1>

        {monsterCards.length === 0 ? (
          <div className="rounded-lg border p-4 text-muted-foreground">No monsters available.</div>
        ) : (
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
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
      </section>
    </main>
  )
}
