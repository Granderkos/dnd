'use client'

import { useState, useEffect, useRef, memo, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ZoomIn, ZoomOut, Maximize2, Minimize2, RotateCcw, MapIcon } from 'lucide-react'
import { MapSettings } from '@/lib/dnd-types'
import { getActiveMap } from '@/lib/supabase-data'
import type { StoredMap } from '@/lib/supabase-data'
import { useI18n } from '@/lib/i18n'

interface PlayerMapViewerProps {
  settings: MapSettings
  onSettingsChange: (settings: MapSettings) => void
}

export const PlayerMapViewer = memo(function PlayerMapViewer({ settings, onSettingsChange }: PlayerMapViewerProps) {
  const { t } = useI18n()
  const [activeMap, setActiveMap] = useState<StoredMap | null>(null)
  const [isLoadingMap, setIsLoadingMap] = useState(true)
  const [isPseudoFullscreen, setIsPseudoFullscreen] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isMapFocused, setIsMapFocused] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)
  const lastPos = useRef({ x: 0, y: 0 })
  const pinchStartDistance = useRef(0)
  const pinchStartZoom = useRef(1)
  const isFetchingMap = useRef(false)
  const latestSettingsRef = useRef(settings)

  useEffect(() => {
    latestSettingsRef.current = settings
  }, [settings])

  useEffect(() => {
    const loadActiveMap = async () => {
      if (document.visibilityState === 'hidden') return
      if (isFetchingMap.current) return
      isFetchingMap.current = true
      try {
        const map = await getActiveMap()
        setActiveMap((prev) => {
          const next = map ?? null
          if (!prev && !next) return prev
          if (prev && next && prev.id === next.id && prev.imageData === next.imageData && prev.name === next.name) return prev
          return next
        })
      } catch (e) {
        console.error('Failed to load active map', e)
      } finally {
        isFetchingMap.current = false
        setIsLoadingMap(false)
      }
    }
    void loadActiveMap()
    const interval = setInterval(() => void loadActiveMap(), 12000)
    return () => clearInterval(interval)
  }, [])

  const applyZoomAt = useCallback((requestedZoom: number, clientX: number, clientY: number) => {
    const viewport = viewportRef.current
    if (!viewport) return
    const rect = viewport.getBoundingClientRect()
    const focusX = clientX - rect.left - (rect.width / 2)
    const focusY = clientY - rect.top - (rect.height / 2)
    const nextZoom = Math.max(0.25, Math.min(4, requestedZoom))
    const ratio = nextZoom / settings.zoom
    onSettingsChange({
      ...settings,
      zoom: nextZoom,
      panX: focusX - ((focusX - settings.panX) * ratio),
      panY: focusY - ((focusY - settings.panY) * ratio),
    })
  }, [settings, onSettingsChange])
  const handleZoom = useCallback((delta: number) => {
    const viewport = viewportRef.current
    if (!viewport) return
    const rect = viewport.getBoundingClientRect()
    applyZoomAt(settings.zoom + delta, rect.left + (rect.width / 2), rect.top + (rect.height / 2))
  }, [settings.zoom, applyZoomAt])
  const handleReset = useCallback(() => onSettingsChange({ ...settings, zoom: 1, panX: 0, panY: 0 }), [settings, onSettingsChange])
  const handleMouseDown = useCallback((e: React.MouseEvent) => { isDragging.current = true; lastPos.current = { x: e.clientX, y: e.clientY } }, [])
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current) return
    const dx = e.clientX - lastPos.current.x
    const dy = e.clientY - lastPos.current.y
    lastPos.current = { x: e.clientX, y: e.clientY }
    onSettingsChange({ ...settings, panX: settings.panX + dx, panY: settings.panY + dy })
  }, [settings, onSettingsChange])
  const handleMouseUp = useCallback(() => { isDragging.current = false }, [])
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const a = e.touches[0]
      const b = e.touches[1]
      pinchStartDistance.current = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
      pinchStartZoom.current = settings.zoom
      isDragging.current = false
      return
    }
    if (e.touches.length === 1) {
      isDragging.current = true
      lastPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    }
  }, [settings.zoom])
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.cancelable) e.preventDefault()
    if (e.touches.length === 2) {
      const a = e.touches[0]
      const b = e.touches[1]
      const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
      if (pinchStartDistance.current > 0) {
        const nextZoom = pinchStartZoom.current * (distance / pinchStartDistance.current)
        const centerX = (a.clientX + b.clientX) / 2
        const centerY = (a.clientY + b.clientY) / 2
        applyZoomAt(nextZoom, centerX, centerY)
      }
      return
    }
    if (!isDragging.current || e.touches.length !== 1) return
    const dx = e.touches[0].clientX - lastPos.current.x
    const dy = e.touches[0].clientY - lastPos.current.y
    lastPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    onSettingsChange({ ...settings, panX: settings.panX + dx, panY: settings.panY + dy })
  }, [settings, onSettingsChange, applyZoomAt])
  const handleTouchEnd = useCallback(() => {
    isDragging.current = false
    pinchStartDistance.current = 0
  }, [])
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement && containerRef.current?.requestFullscreen) {
      setIsFullscreen(true)
      void containerRef.current.requestFullscreen()
    } else {
      if (document.fullscreenElement) {
        setIsFullscreen(false)
        void document.exitFullscreen()
      } else {
        setIsPseudoFullscreen((prev) => !prev)
      }
    }
  }, [])

  useEffect(() => {
    const handleFullscreenChange = () => {
      const active = !!document.fullscreenElement
      setIsFullscreen(active)
      if (active) setIsPseudoFullscreen(false)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  useEffect(() => {
    const shouldLock = isPseudoFullscreen || isFullscreen || isMapFocused
    if (!shouldLock) return
    const originalOverflow = document.body.style.overflow
    const originalTouchAction = document.body.style.touchAction
    document.body.style.overflow = 'hidden'
    document.body.style.touchAction = 'none'
    return () => {
      document.body.style.overflow = originalOverflow
      document.body.style.touchAction = originalTouchAction
    }
  }, [isPseudoFullscreen, isFullscreen, isMapFocused])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleNativeWheel = (event: WheelEvent) => {
      event.preventDefault()
      const current = latestSettingsRef.current
      if (event.ctrlKey || event.metaKey) {
        applyZoomAt(current.zoom + (event.deltaY > 0 ? -0.1 : 0.1), event.clientX, event.clientY)
        return
      }
      onSettingsChange({
        ...current,
        panX: current.panX - event.deltaX,
        panY: current.panY - event.deltaY,
      })
    }

    container.addEventListener('wheel', handleNativeWheel, { passive: false })
    return () => {
      container.removeEventListener('wheel', handleNativeWheel)
    }
  }, [applyZoomAt, onSettingsChange])

  if (!activeMap) {
    return (
      <ScrollArea className="h-full">
        <div className="flex flex-col items-center justify-center h-full min-h-[400px] p-4">
          <MapIcon className="size-16 text-muted-foreground mb-4" />
          {isLoadingMap ? (
            <p className="text-muted-foreground text-center">{t('map.loading')}</p>
          ) : (
            <>
              <p className="text-muted-foreground text-center">{t('map.noMapSelected')}</p>
              <p className="text-sm text-muted-foreground text-center mt-2">{t('map.waitForDm')}</p>
            </>
          )}
        </div>
      </ScrollArea>
    )
  }

  return (
    <div
      ref={containerRef}
      className={`${isPseudoFullscreen ? 'fixed inset-0 z-50 h-dvh' : 'h-full'} flex flex-col bg-background`}
      onMouseEnter={() => setIsMapFocused(true)}
      onMouseLeave={() => {
        handleMouseUp()
        setIsMapFocused(false)
      }}
    >
      <div className="flex items-center justify-between p-2 border-b bg-card">
        <span className="text-sm font-medium truncate max-w-[150px]">{activeMap.name}</span>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" className="size-8" onClick={() => handleZoom(-0.25)}><ZoomOut className="size-4" /></Button>
          <span className="text-xs w-12 text-center">{Math.round(settings.zoom * 100)}%</span>
          <Button size="icon" variant="ghost" className="size-8" onClick={() => handleZoom(0.25)}><ZoomIn className="size-4" /></Button>
          <Button size="icon" variant="ghost" className="size-8" onClick={handleReset}><RotateCcw className="size-4" /></Button>
          <Button size="icon" variant="ghost" className="size-8" onClick={toggleFullscreen}>
            {isPseudoFullscreen || isFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          </Button>
        </div>
      </div>
      <div
        ref={viewportRef}
        className="flex-1 overflow-hidden cursor-grab active:cursor-grabbing select-none"
        style={{ touchAction: 'none', overscrollBehavior: 'contain' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="w-full h-full flex items-center justify-center" style={{ transform: `translate(${settings.panX}px, ${settings.panY}px) scale(${settings.zoom})`, transformOrigin: 'center' }}>
          <img src={activeMap.imageData} alt={activeMap.name} className="max-w-none" draggable={false} />
        </div>
      </div>
    </div>
  )
})
