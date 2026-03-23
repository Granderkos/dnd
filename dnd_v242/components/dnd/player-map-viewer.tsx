'use client'

import { useState, useEffect, useRef, memo, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ZoomIn, ZoomOut, Maximize2, RotateCcw, MapIcon } from 'lucide-react'
import { MapSettings } from '@/lib/dnd-types'
import { getActiveMap } from '@/lib/supabase-data'
import type { StoredMap } from '@/lib/supabase-data'

interface PlayerMapViewerProps {
  settings: MapSettings
  onSettingsChange: (settings: MapSettings) => void
}

export const PlayerMapViewer = memo(function PlayerMapViewer({ settings, onSettingsChange }: PlayerMapViewerProps) {
  const [activeMap, setActiveMap] = useState<StoredMap | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)
  const lastPos = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const loadActiveMap = async () => {
      try {
        const map = await getActiveMap()
        if (map) setActiveMap(map)
        else setActiveMap(null)
      } catch (e) {
        console.error('Failed to load active map', e)
      }
    }
    void loadActiveMap()
    const interval = setInterval(() => void loadActiveMap(), 5000)
    return () => clearInterval(interval)
  }, [])

  const handleZoom = useCallback((delta: number) => onSettingsChange({ ...settings, zoom: Math.max(0.25, Math.min(4, settings.zoom + delta)) }), [settings, onSettingsChange])
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
  const handleTouchStart = useCallback((e: React.TouchEvent) => { if (e.touches.length === 1) { isDragging.current = true; lastPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY } } }, [])
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging.current || e.touches.length !== 1) return
    const dx = e.touches[0].clientX - lastPos.current.x
    const dy = e.touches[0].clientY - lastPos.current.y
    lastPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    onSettingsChange({ ...settings, panX: settings.panX + dx, panY: settings.panY + dy })
  }, [settings, onSettingsChange])
  const handleTouchEnd = useCallback(() => { isDragging.current = false }, [])
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }, [])

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  if (!activeMap) {
    return (
      <ScrollArea className="h-full">
        <div className="flex flex-col items-center justify-center h-full min-h-[400px] p-4">
          <MapIcon className="size-16 text-muted-foreground mb-4" />
          <p className="text-muted-foreground text-center">No map selected by DM</p>
          <p className="text-sm text-muted-foreground text-center mt-2">Wait for the DM to select a map</p>
        </div>
      </ScrollArea>
    )
  }

  return (
    <div ref={containerRef} className="h-full flex flex-col bg-background">
      <div className="flex items-center justify-between p-2 border-b bg-card">
        <span className="text-sm font-medium truncate max-w-[150px]">{activeMap.name}</span>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" className="size-8" onClick={() => handleZoom(-0.25)}><ZoomOut className="size-4" /></Button>
          <span className="text-xs w-12 text-center">{Math.round(settings.zoom * 100)}%</span>
          <Button size="icon" variant="ghost" className="size-8" onClick={() => handleZoom(0.25)}><ZoomIn className="size-4" /></Button>
          <Button size="icon" variant="ghost" className="size-8" onClick={handleReset}><RotateCcw className="size-4" /></Button>
          <Button size="icon" variant="ghost" className="size-8" onClick={toggleFullscreen}><Maximize2 className="size-4" /></Button>
        </div>
      </div>
      <div className="flex-1 overflow-hidden cursor-grab active:cursor-grabbing select-none" onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
        <div className="w-full h-full flex items-center justify-center" style={{ transform: `translate(${settings.panX}px, ${settings.panY}px) scale(${settings.zoom})`, transformOrigin: 'center' }}>
          <img src={activeMap.imageData} alt={activeMap.name} className="max-w-none" draggable={false} />
        </div>
      </div>
    </div>
  )
})
