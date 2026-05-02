'use client'

import { useState, useEffect, useRef, memo, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { ZoomIn, ZoomOut, Maximize2, Minimize2, RotateCcw, Upload, Trash2, Eye, MapIcon, Check, X, Tv } from 'lucide-react'
import { createMap, deleteMap, loadMaps, setActiveMap as setActiveMapRemote, updateMapGridSettings } from '@/lib/supabase-data'
import type { StoredMap } from '@/lib/supabase-data'
import { useAuth } from '@/lib/auth-context'
import { useI18n } from '@/lib/i18n'

interface MapViewSettings {
  zoom: number
  panX: number
  panY: number
  gridEnabled: boolean
  gridSize: number
  gridOpacity: number
}

const defaultViewSettings: MapViewSettings = {
  zoom: 1,
  panX: 0,
  panY: 0,
  gridEnabled: false,
  gridSize: 50,
  gridOpacity: 0.3,
}

let cachedMaps: StoredMap[] | null = null

export const DMMapManager = memo(function DMMapManager() {
  const { user } = useAuth()
  const { t } = useI18n()
  const [maps, setMaps] = useState<StoredMap[]>([])
  const [activeMapId, setActiveMapId] = useState<string | null>(null)
  const [viewingMap, setViewingMap] = useState<StoredMap | null>(null)
  const [viewSettings, setViewSettings] = useState<MapViewSettings>(defaultViewSettings)
  const [isPseudoFullscreen, setIsPseudoFullscreen] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isMapFocused, setIsMapFocused] = useState(false)
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [deleteConfirmMap, setDeleteConfirmMap] = useState<StoredMap | null>(null)
  const [newMapName, setNewMapName] = useState('')
  const [newMapFile, setNewMapFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [tvPreviewKey, setTvPreviewKey] = useState(0)
  const [tvGridEnabled, setTvGridEnabled] = useState(false)
  const [tvGridSize, setTvGridSize] = useState(50)
  const [tvGridSizeInput, setTvGridSizeInput] = useState('50')
  const [tvGridOpacity, setTvGridOpacity] = useState(0.3)
  const gridSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tvGridSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const isDragging = useRef(false)
  const lastPos = useRef({ x: 0, y: 0 })
  const pinchStartDistance = useRef(0)
  const pinchStartZoom = useRef(1)

  const refreshMaps = useCallback(async (force = false) => {
    if (!force && cachedMaps) {
      setMaps(cachedMaps)
      const cachedActive = cachedMaps.find((m) => m.isActive)
      setActiveMapId(cachedActive?.id ?? null)
      return
    }
    try {
      const dbMaps = await loadMaps()
      cachedMaps = dbMaps
      setMaps(dbMaps)
      const currentActive = dbMaps.find((m) => m.isActive)
      setActiveMapId(currentActive?.id ?? null)
    } catch (e) {
      console.error('Failed to load maps', e)
    }
  }, [])

  useEffect(() => {
    void refreshMaps()
  }, [refreshMaps])
  const activeMap = maps.find((m) => m.id === activeMapId) ?? null
  useEffect(() => {
    if (!activeMap) return
    setTvGridEnabled(activeMap.gridEnabled ?? false)
    setTvGridSize(activeMap.gridSize ?? 50)
    setTvGridSizeInput(String(activeMap.gridSize ?? 50))
    setTvGridOpacity(activeMap.gridOpacity ?? 0.3)
  }, [activeMap?.id, activeMap?.gridEnabled, activeMap?.gridSize, activeMap?.gridOpacity])

  const persistTvGrid = useCallback((next: { gridEnabled: boolean; gridSize: number; gridOpacity: number }) => {
    if (!activeMapId) return
    if (tvGridSaveTimeoutRef.current) clearTimeout(tvGridSaveTimeoutRef.current)
    tvGridSaveTimeoutRef.current = setTimeout(() => {
      void (async () => {
        await updateMapGridSettings(activeMapId, next)
        await refreshMaps(true)
        setTvPreviewKey((prev) => prev + 1)
      })()
    }, 120)
  }, [activeMapId, refreshMaps])

  const commitTvGridSize = useCallback(() => {
    const parsed = Number.parseInt(tvGridSizeInput, 10)
    const next = Math.max(10, Math.min(200, Number.isFinite(parsed) ? parsed : tvGridSize))
    setTvGridSize(next)
    setTvGridSizeInput(String(next))
    persistTvGrid({ gridEnabled: tvGridEnabled, gridSize: next, gridOpacity: tvGridOpacity })
  }, [persistTvGrid, tvGridEnabled, tvGridOpacity, tvGridSize, tvGridSizeInput])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const allowedTypes = new Set(['image/webp', 'image/jpeg'])
      if (!allowedTypes.has(file.type)) {
        if (fileInputRef.current) fileInputRef.current.value = ''
        return
      }
      setNewMapFile(file)
      if (!newMapName) setNewMapName(file.name.replace(/\.[^/.]+$/, ''))
    }
  }, [newMapName])

  const handleUpload = useCallback(async () => {
    if (!newMapFile || !newMapName.trim() || !user?.id) return
    setIsUploading(true)
    try {
      const reader = new FileReader()
      reader.onload = async (e) => {
        try {
          const imageData = e.target?.result as string
          await createMap(user.id, { name: newMapName.trim(), imageData, gridEnabled: false, gridSize: 50, gridOpacity: 0.3 })
          await refreshMaps(true)
          setNewMapName('')
          setNewMapFile(null)
          setUploadDialogOpen(false)
          if (fileInputRef.current) fileInputRef.current.value = ''
        } catch (err) {
          console.error('Failed to upload map', err)
        } finally {
          setIsUploading(false)
        }
      }
      reader.readAsDataURL(newMapFile)
    } catch (e) {
      console.error('Failed to upload map', e)
      setIsUploading(false)
    }
  }, [newMapFile, newMapName, refreshMaps, user?.id])

  const handleDelete = useCallback(async (map: StoredMap) => {
    try {
      await deleteMap(map.id)
      await refreshMaps(true)
      if (activeMapId === map.id) setActiveMapId(null)
      if (viewingMap?.id === map.id) setViewingMap(null)
      setDeleteConfirmMap(null)
    } catch (e) {
      console.error('Failed to delete map', e)
    }
  }, [activeMapId, refreshMaps, viewingMap])

  const setActiveMap = useCallback(async (mapId: string | null) => {
    try {
      await setActiveMapRemote(mapId)
      setActiveMapId(mapId)
      await refreshMaps(true)
    } catch (e) {
      console.error('Failed to set active map', e)
    }
  }, [refreshMaps])

  const handleViewMap = useCallback((map: StoredMap) => {
    setViewingMap(map)
    setViewSettings({
      ...defaultViewSettings,
      gridEnabled: map.gridEnabled ?? false,
      gridSize: map.gridSize ?? 50,
      gridOpacity: map.gridOpacity ?? 0.3,
    })
  }, [])

  const applyZoomAt = useCallback((requestedZoom: number, clientX: number, clientY: number) => {
    const viewport = viewportRef.current
    if (!viewport) return
    const rect = viewport.getBoundingClientRect()
    const focusX = clientX - rect.left - (rect.width / 2)
    const focusY = clientY - rect.top - (rect.height / 2)
    setViewSettings((prev) => {
      const nextZoom = Math.max(0.1, Math.min(5, requestedZoom))
      const ratio = nextZoom / prev.zoom
      return {
        ...prev,
        zoom: nextZoom,
        panX: focusX - ((focusX - prev.panX) * ratio),
        panY: focusY - ((focusY - prev.panY) * ratio),
      }
    })
  }, [])
  const handleZoom = useCallback((delta: number) => {
    const viewport = viewportRef.current
    if (!viewport) return
    const rect = viewport.getBoundingClientRect()
    applyZoomAt(viewSettings.zoom + delta, rect.left + (rect.width / 2), rect.top + (rect.height / 2))
  }, [viewSettings.zoom, applyZoomAt])
  const handleReset = useCallback(() => setViewSettings((prev) => ({ ...prev, zoom: 1, panX: 0, panY: 0 })), [])
  const handleMouseDown = useCallback((e: React.MouseEvent) => { isDragging.current = true; lastPos.current = { x: e.clientX, y: e.clientY } }, [])
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current) return
    const dx = e.clientX - lastPos.current.x
    const dy = e.clientY - lastPos.current.y
    lastPos.current = { x: e.clientX, y: e.clientY }
    setViewSettings((prev) => ({ ...prev, panX: prev.panX + dx, panY: prev.panY + dy }))
  }, [])
  const handleMouseUp = useCallback(() => { isDragging.current = false }, [])
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const a = e.touches[0]
      const b = e.touches[1]
      pinchStartDistance.current = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
      pinchStartZoom.current = viewSettings.zoom
      isDragging.current = false
      return
    }
    if (e.touches.length === 1) {
      isDragging.current = true
      lastPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    }
  }, [viewSettings.zoom])
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
    setViewSettings((prev) => ({ ...prev, panX: prev.panX + dx, panY: prev.panY + dy }))
  }, [applyZoomAt])
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
    const shouldLock = viewingMap && (isPseudoFullscreen || isFullscreen || isMapFocused)
    if (!shouldLock) return
    const originalOverflow = document.body.style.overflow
    const originalTouchAction = document.body.style.touchAction
    document.body.style.overflow = 'hidden'
    document.body.style.touchAction = 'none'
    return () => {
      document.body.style.overflow = originalOverflow
      document.body.style.touchAction = originalTouchAction
    }
  }, [isPseudoFullscreen, isFullscreen, isMapFocused, viewingMap])

  useEffect(() => {
    const container = containerRef.current
    if (!container || !viewingMap) return

    const handleNativeWheel = (event: WheelEvent) => {
      event.preventDefault()
      if (event.ctrlKey || event.metaKey) {
        applyZoomAt(viewSettings.zoom + (event.deltaY > 0 ? -0.1 : 0.1), event.clientX, event.clientY)
        return
      }
      setViewSettings((prev) => ({ ...prev, panX: prev.panX - event.deltaX, panY: prev.panY - event.deltaY }))
    }

    container.addEventListener('wheel', handleNativeWheel, { passive: false })
    return () => {
      container.removeEventListener('wheel', handleNativeWheel)
    }
  }, [applyZoomAt, viewSettings.zoom, viewingMap])

  useEffect(() => {
    if (!viewingMap) return
    if (gridSaveTimeoutRef.current) clearTimeout(gridSaveTimeoutRef.current)
    gridSaveTimeoutRef.current = setTimeout(() => {
      void (async () => {
        try {
          const updatedMap = await updateMapGridSettings(viewingMap.id, {
            gridEnabled: viewSettings.gridEnabled,
            gridSize: viewSettings.gridSize,
            gridOpacity: viewSettings.gridOpacity,
          })
          setViewingMap(updatedMap)
          setMaps((prev) => prev.map((map) => (map.id === updatedMap.id ? updatedMap : map)))
          if (cachedMaps) {
            cachedMaps = cachedMaps.map((map) => (map.id === updatedMap.id ? updatedMap : map))
          }
        } catch (error) {
          console.error('Failed to persist map grid settings', error)
        }
      })()
    }, 200)
    return () => {
      if (gridSaveTimeoutRef.current) clearTimeout(gridSaveTimeoutRef.current)
    }
  }, [viewSettings.gridEnabled, viewSettings.gridOpacity, viewSettings.gridSize, viewingMap])

  if (viewingMap) {
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
        <div className="flex flex-wrap items-center gap-2 p-2 border-b bg-card">
          <Button variant="ghost" size="sm" onClick={() => setViewingMap(null)}><X className="size-4 mr-1" />{t('common.close')}</Button>
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" className="size-8" onClick={() => handleZoom(-0.25)}><ZoomOut className="size-4" /></Button>
            <span className="text-xs w-12 text-center">{Math.round(viewSettings.zoom * 100)}%</span>
            <Button size="icon" variant="ghost" className="size-8" onClick={() => handleZoom(0.25)}><ZoomIn className="size-4" /></Button>
            <Button size="icon" variant="ghost" className="size-8" onClick={handleReset}><RotateCcw className="size-4" /></Button>
            <Button size="icon" variant="ghost" className="size-8" onClick={toggleFullscreen}>
              {isPseudoFullscreen || isFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
            </Button>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <Switch checked={viewSettings.gridEnabled} onCheckedChange={(checked) => setViewSettings((prev) => ({ ...prev, gridEnabled: checked }))} />
            <Label className="text-xs">{t('map.grid')}</Label>
            {viewSettings.gridEnabled && (
              <>
                <Input type="number" value={viewSettings.gridSize} onChange={(e) => setViewSettings((prev) => ({ ...prev, gridSize: parseInt(e.target.value) || 50 }))} className="w-16 h-7 text-xs" min={10} max={200} />
                <Slider value={[viewSettings.gridOpacity * 100]} onValueChange={([v]) => setViewSettings((prev) => ({ ...prev, gridOpacity: v / 100 }))} min={10} max={100} className="w-20" />
              </>
            )}
          </div>
        </div>
        <div
          ref={viewportRef}
          className="flex-1 overflow-hidden cursor-grab active:cursor-grabbing select-none relative"
          style={{ touchAction: 'none', overscrollBehavior: 'contain' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="w-full h-full flex items-center justify-center" style={{ transform: `translate(${viewSettings.panX}px, ${viewSettings.panY}px) scale(${viewSettings.zoom})`, transformOrigin: 'center' }}>
            <div className="relative">
              <img src={viewingMap.imageData} alt={viewingMap.name} className="max-w-none" draggable={false} loading="lazy" />
              {viewSettings.gridEnabled && (
                <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: `linear-gradient(to right, rgba(255,255,255,${viewSettings.gridOpacity}) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,${viewSettings.gridOpacity}) 1px, transparent 1px)`, backgroundSize: `${viewSettings.gridSize}px ${viewSettings.gridSize}px` }} />
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto p-3 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t('nav.maps')}</h2>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" asChild>
              <a href="/tv-map" target="_blank" rel="noreferrer">
                <Tv className="size-4 mr-1" />TV Mode
              </a>
            </Button>
            <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
              <DialogTrigger asChild><Button size="sm"><Upload className="size-4 mr-1" />{t('map.upload')}</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{t('map.uploadNewMap')}</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2"><Label>Map Name</Label><Input value={newMapName} onChange={(e) => setNewMapName(e.target.value)} placeholder="Enter map name" /></div>
                  <div className="space-y-2"><Label>Image File (WebP/JPG)</Label><Input ref={fileInputRef} type="file" accept=".webp,.jpg,.jpeg,image/webp,image/jpeg" onChange={handleFileSelect} /></div>
                  <Button onClick={() => void handleUpload()} disabled={!newMapFile || !newMapName.trim() || isUploading} className="w-full">{isUploading ? 'Uploading...' : 'Upload Map'}</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
        <Card>
          <CardContent className="py-3 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">TV Control</p>
                <p className="text-xs text-muted-foreground">Control what the public TV screen shows without touching the TV page.</p>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" asChild>
                  <a href="/tv-map" target="_blank" rel="noreferrer"><Tv className="size-4 mr-1" />Open TV Display</a>
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setTvPreviewKey((prev) => prev + 1)}>Refresh Preview</Button>
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              Active map: <span className="font-medium text-foreground">{activeMap?.name ?? 'None'}</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-center">
              <Label className="text-xs text-muted-foreground">Grid on active map</Label>
              <Switch
                checked={tvGridEnabled}
                disabled={!activeMapId}
                onCheckedChange={(checked) => {
                  if (!activeMapId) return
                  setTvGridEnabled(checked)
                  persistTvGrid({ gridEnabled: checked, gridSize: tvGridSize, gridOpacity: tvGridOpacity })
                }}
              />
            </div>
            {activeMapId ? (
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="text-xs text-muted-foreground">Grid size
                  <Input
                    type="number"
                    min={10}
                    max={200}
                    value={tvGridSizeInput}
                    onChange={(e) => {
                      setTvGridSizeInput(e.target.value)
                    }}
                    onBlur={commitTvGridSize}
                    onKeyDown={(e) => { if (e.key === 'Enter') commitTvGridSize() }}
                  />
                </label>
                <label className="text-xs text-muted-foreground">Grid opacity
                  <Slider
                    value={[Math.round(tvGridOpacity * 100)]}
                    onValueChange={([v]) => {
                      const next = Math.max(0.1, Math.min(1, v / 100))
                      setTvGridOpacity(next)
                      persistTvGrid({ gridEnabled: tvGridEnabled, gridSize: tvGridSize, gridOpacity: next })
                    }}
                    min={10}
                    max={100}
                  />
                </label>
              </div>
            ) : null}
            <div className="rounded-md border overflow-hidden bg-black">
              <iframe key={tvPreviewKey} src={`/tv-map?preview=${tvPreviewKey}`} title="TV Preview" className="h-64 w-full" />
            </div>
          </CardContent>
        </Card>
        {maps.length === 0 ? (
          <Card><CardContent className="py-8 text-center"><MapIcon className="size-12 text-muted-foreground mx-auto mb-3" /><p className="text-muted-foreground">{t('map.noMapsYet')}</p><p className="text-sm text-muted-foreground mt-1">{t('map.uploadToStart')}</p></CardContent></Card>
        ) : (
          <div className="space-y-2">
            {maps.map((map) => (
              <Card key={map.id} className={activeMapId === map.id ? 'ring-2 ring-primary' : ''}>
                <CardContent className="py-3">
                  <div className="flex items-center gap-3">
                    <div className="size-12 rounded bg-muted overflow-hidden shrink-0">{map.imageData ? <img src={map.imageData} alt={map.name} className="size-full object-cover" loading="lazy" /> : null}</div>
                    <div className="flex-1 min-w-0"><p className="font-medium truncate">{map.name}</p><p className="text-xs text-muted-foreground">{new Date(map.createdAt).toLocaleDateString()}</p></div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button size="icon" variant={activeMapId === map.id ? 'default' : 'outline'} className="size-8" onClick={() => void setActiveMap(activeMapId === map.id ? null : map.id)} title={activeMapId === map.id ? t('map.activeForPlayers') : t('map.setActiveForPlayers')}><Check className="size-4" /></Button>
                      <Button size="icon" variant="ghost" className="size-8" onClick={() => handleViewMap(map)} title={t('map.viewMap')}><Eye className="size-4" /></Button>
                      <Button size="icon" variant="ghost" className="size-8 text-destructive hover:text-destructive" onClick={() => setDeleteConfirmMap(map)} title={t('map.deleteMap')}><Trash2 className="size-4" /></Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        {activeMapId && <p className="text-xs text-muted-foreground text-center">{t('map.activeVisibleToPlayers')}</p>}
        <AlertDialog open={!!deleteConfirmMap} onOpenChange={() => setDeleteConfirmMap(null)}>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>{t('map.deleteMap')}</AlertDialogTitle><AlertDialogDescription>{t('map.deleteMapDescription', { name: deleteConfirmMap?.name || '' })}</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel><AlertDialogAction onClick={() => deleteConfirmMap && void handleDelete(deleteConfirmMap)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{t('common.delete')}</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
    </div>
  )
})
