import { Suspense } from 'react'
import { TvMapMode } from '@/components/dnd/tv-map-mode'

export default function TvMapPage() {
  return (
    <Suspense fallback={<div className="flex h-dvh items-center justify-center bg-background text-muted-foreground">Loading TV map…</div>}>
      <TvMapMode />
    </Suspense>
  )
}
