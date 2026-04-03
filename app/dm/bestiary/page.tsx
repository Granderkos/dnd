'use client'

import { DmBestiaryPanel } from '@/components/dm/DmBestiaryPanel'
import { useI18n } from '@/lib/i18n'

export default function DmBestiaryPage() {
  const { t } = useI18n()

  return (
    <main className="min-h-dvh bg-background">
      <section className="mx-auto flex h-dvh max-w-4xl flex-col gap-3 p-4">
        <h1 className="text-xl font-bold uppercase tracking-[0.08em] text-primary">{t('nav.bestiary')}</h1>
        <DmBestiaryPanel />
      </section>
    </main>
  )
}
