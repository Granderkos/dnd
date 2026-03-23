'use client'

import { useState, useEffect, useRef, memo, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { ZoomIn, ZoomOut, Maximize2, RotateCcw, Upload, Trash2, Eye, MapIcon, Check, X } from 'lucide-react'
import { createMap, deleteMap, loadMaps, setActiveMap as setActiveMapRemote } from '@/lib/supabase-data'
import type { StoredMap } from '@/lib/supabase-data'
import { useAuth } from '@/lib/auth-context'

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

export const DMMapManager = memo(function DMMapManager() {
  const { user } = useAuth()
  const [maps, setMaps] = useState<StoredMap[]>([])
  const [activeMapId, setActiveMapId] = useState<string | null>(null)
  const [viewingMap, setViewingMap] = useState<StoredMap | null>(null)
  const [viewSettings, setViewSettings] = useState<MapViewSettings>(defaultViewSettings)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [deleteConfirmMap, setDeleteConfirmMap] = useState<StoredMap | null>(null)
  const [newMapName, setNewMapName] = useState('')
  const [newMapFile, setNewMapFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const isDragging = useRef(false)
  const lastPos = useRef({ x: 0, y: 0 })

  const refreshMaps = useCallback(async () => {
    try {
      const dbMaps = await loadMaps()
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

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
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
          await refreshMaps()
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
      await refreshMaps()
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
      await refreshMaps()
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

  const handleZoom = useCallback((delta: number) => setViewSettings((prev) => ({ ...prev, zoom: Math.max(0.1, Math.min(5, prev.zoom + delta)) })), [])
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
  const handleTouchStart = useCallback((e: React.TouchEvent) => { if (e.touches.length === 1) { isDragging.current = true; lastPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY } } }, [])
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging.current || e.touches.length !== 1) return
    const dx = e.touches[0].clientX - lastPos.current.x
    const dy = e.touches[0].clientY - lastPos.current.y
    lastPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    setViewSettings((prev) => ({ ...prev, panX: prev.panX + dx, panY: prev.panY + dy }))
  }, [])
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

  if (viewingMap) {
    return (
      <div ref={containerRef} className="h-full flex flex-col bg-background">
        <div className="flex flex-wrap items-center gap-2 p-2 border-b bg-card">
          <Button variant="ghost" size="sm" onClick={() => setViewingMap(null)}><X className="size-4 mr-1" />Close</Button>
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" className="size-8" onClick={() => handleZoom(-0.25)}><ZoomOut className="size-4" /></Button>
            <span className="text-xs w-12 text-center">{Math.round(viewSettings.zoom * 100)}%</span>
            <Button size="icon" variant="ghost" className="size-8" onClick={() => handleZoom(0.25)}><ZoomIn className="size-4" /></Button>
            <Button size="icon" variant="ghost" className="size-8" onClick={handleReset}><RotateCcw className="size-4" /></Button>
            <Button size="icon" variant="ghost" className="size-8" onClick={toggleFullscreen}><Maximize2 className="size-4" /></Button>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <Switch checked={viewSettings.gridEnabled} onCheckedChange={(checked) => setViewSettings((prev) => ({ ...prev, gridEnabled: checked }))} />
            <Label className="text-xs">Grid</Label>
            {viewSettings.gridEnabled && (
              <>
                <Input type="number" value={viewSettings.gridSize} onChange={(e) => setViewSettings((prev) => ({ ...prev, gridSize: parseInt(e.target.value) || 50 }))} className="w-16 h-7 text-xs" min={10} max={200} />
                <Slider value={[viewSettings.gridOpacity * 100]} onValueChange={([v]) => setViewSettings((prev) => ({ ...prev, gridOpacity: v / 100 }))} min={10} max={100} className="w-20" />
              </>
            )}
          </div>
        </div>
        <div className="flex-1 overflow-hidden cursor-grab active:cursor-grabbing select-none relative" onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
          <div className="w-full h-full flex items-center justify-center" style={{ transform: `translate(${viewSettings.panX}px, ${viewSettings.panY}px) scale(${viewSettings.zoom})`, transformOrigin: 'center' }}>
            <div className="relative">
              <img src={viewingMap.imageData} alt={viewingMap.name} className="max-w-none" draggable={false} />
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
    <ScrollArea className="h-full">
      <div className="p-3 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Maps</h2>
          <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
            <DialogTrigger asChild><Button size="sm"><Upload className="size-4 mr-1" />Upload</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Upload New Map</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2"><Label>Map Name</Label><Input value={newMapName} onChange={(e) => setNewMapName(e.target.value)} placeholder="Enter map name" /></div>
                <div className="space-y-2"><Label>Image File</Label><Input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} /></div>
                <Button onClick={() => void handleUpload()} disabled={!newMapFile || !newMapName.trim() || isUploading} className="w-full">{isUploading ? 'Uploading...' : 'Upload Map'}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        {maps.length === 0 ? (
          <Card><CardContent className="py-8 text-center"><MapIcon className="size-12 text-muted-foreground mx-auto mb-3" /><p className="text-muted-foreground">No maps uploaded yet</p><p className="text-sm text-muted-foreground mt-1">Upload a map to get started</p></CardContent></Card>
        ) : (
          <div className="space-y-2">
            {maps.map((map) => (
              <Card key={map.id} className={activeMapId === map.id ? 'ring-2 ring-primary' : ''}>
                <CardContent className="py-3">
                  <div className="flex items-center gap-3">
                    <div className="size-12 rounded bg-muted overflow-hidden shrink-0">{map.imageData ? <img src={map.imageData} alt={map.name} className="size-full object-cover" /> : null}</div>
                    <div className="flex-1 min-w-0"><p className="font-medium truncate">{map.name}</p><p className="text-xs text-muted-foreground">{new Date(map.createdAt).toLocaleDateString()}</p></div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button size="icon" variant={activeMapId === map.id ? 'default' : 'outline'} className="size-8" onClick={() => void setActiveMap(activeMapId === map.id ? null : map.id)} title={activeMapId === map.id ? 'Active for players' : 'Set active for players'}><Check className="size-4" /></Button>
                      <Button size="icon" variant="ghost" className="size-8" onClick={() => handleViewMap(map)} title="View map"><Eye className="size-4" /></Button>
                      <Button size="icon" variant="ghost" className="size-8 text-destructive hover:text-destructive" onClick={() => setDeleteConfirmMap(map)} title="Delete map"><Trash2 className="size-4" /></Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        {activeMapId && <p className="text-xs text-muted-foreground text-center">Active map is visible to all players</p>}
      </div>
      <AlertDialog open={!!deleteConfirmMap} onOpenChange={() => setDeleteConfirmMap(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete Map</AlertDialogTitle><AlertDialogDescription>Are you sure you want to delete "{deleteConfirmMap?.name}"? This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => deleteConfirmMap && void handleDelete(deleteConfirmMap)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ScrollArea>
  )
})
