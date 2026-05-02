'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import {
  Upload,
  ZoomIn,
  ZoomOut,
  Maximize,
  Grid3X3,
  RotateCcw,
  Move,
} from 'lucide-react'
import { MapSettings } from '@/lib/dnd-types'

interface MapViewerProps {
  settings: MapSettings
  onSettingsChange: (settings: MapSettings) => void
}

export function MapViewer({ settings, onSettingsChange }: MapViewerProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [isFullscreen, setIsFullscreen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const url = URL.createObjectURL(file)
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        setImageDimensions({ width: img.width, height: img.height })
        setImageUrl(url)
        // Reset pan and zoom
        onSettingsChange({ ...settings, zoom: 1, panX: 0, panY: 0 })
      }
      img.src = url
    }
  }

  const handleZoom = (delta: number) => {
    const newZoom = Math.max(0.1, Math.min(5, settings.zoom + delta))
    onSettingsChange({ ...settings, zoom: newZoom })
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsDragging(true)
      setDragStart({ x: e.clientX - settings.panX, y: e.clientY - settings.panY })
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      onSettingsChange({
        ...settings,
        panX: e.clientX - dragStart.x,
        panY: e.clientY - dragStart.y,
      })
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.1 : 0.1
    handleZoom(delta)
  }

  const resetView = () => {
    onSettingsChange({ ...settings, zoom: 1, panX: 0, panY: 0 })
  }

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }, [])

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  // Grid overlay component
  const GridOverlay = () => {
    if (!settings.gridEnabled || !imageDimensions.width) return null

    const gridLines = []
    const gridSizePx = settings.gridSize * settings.zoom

    // Calculate visible area
    const containerWidth = containerRef.current?.clientWidth || 800
    const containerHeight = containerRef.current?.clientHeight || 600

    // Vertical lines
    const startX = settings.panX % gridSizePx
    for (let x = startX; x < containerWidth; x += gridSizePx) {
      gridLines.push(
        <line
          key={`v-${x}`}
          x1={x}
          y1={0}
          x2={x}
          y2={containerHeight}
          stroke="rgba(255,255,255,0.5)"
          strokeWidth={1}
        />
      )
    }

    // Horizontal lines
    const startY = settings.panY % gridSizePx
    for (let y = startY; y < containerHeight; y += gridSizePx) {
      gridLines.push(
        <line
          key={`h-${y}`}
          x1={0}
          y1={y}
          x2={containerWidth}
          y2={y}
          stroke="rgba(255,255,255,0.5)"
          strokeWidth={1}
        />
      )
    }

    return (
      <svg
        className="pointer-events-none absolute inset-0"
        style={{ opacity: settings.gridOpacity }}
      >
        {gridLines}
      </svg>
    )
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col gap-3 p-3 lg:flex-row">
      {/* Controls Panel */}
      <Card className={`shrink-0 lg:w-72 ${isFullscreen ? 'hidden' : ''}`}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Grid3X3 className="size-4" />
            Map Viewer
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Upload & Quick Controls - Mobile Row */}
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="mr-1 size-3" />
              Upload
            </Button>
            <Button size="sm" variant="outline" onClick={resetView}>
              <RotateCcw className="size-3" />
            </Button>
            <Button size="sm" variant="outline" onClick={toggleFullscreen}>
              <Maximize className="size-3" />
            </Button>
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground w-10">{(settings.zoom * 100).toFixed(0)}%</span>
            <Button size="icon" variant="outline" className="size-7" onClick={() => handleZoom(-0.25)}>
              <ZoomOut className="size-3" />
            </Button>
            <Slider
              value={[settings.zoom]}
              min={0.1}
              max={5}
              step={0.1}
              onValueChange={([v]) => onSettingsChange({ ...settings, zoom: v })}
              className="flex-1"
            />
            <Button size="icon" variant="outline" className="size-7" onClick={() => handleZoom(0.25)}>
              <ZoomIn className="size-3" />
            </Button>
          </div>

          {/* Grid Toggle */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Switch
                checked={settings.gridEnabled}
                onCheckedChange={(checked) =>
                  onSettingsChange({ ...settings, gridEnabled: checked })
                }
              />
              <span className="text-xs">Grid</span>
            </div>
            {settings.gridEnabled && (
              <>
                <div className="flex flex-1 items-center gap-1">
                  <span className="text-[10px] text-muted-foreground">{settings.gridSize}px</span>
                  <Slider
                    value={[settings.gridSize]}
                    min={20}
                    max={100}
                    step={5}
                    onValueChange={([v]) => onSettingsChange({ ...settings, gridSize: v })}
                    className="flex-1"
                  />
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Map View */}
      <Card
        ref={containerRef}
        className={`relative flex-1 overflow-hidden ${isFullscreen ? 'rounded-none' : ''}`}
      >
        <div
          className="absolute inset-0 cursor-grab bg-slate-900 active:cursor-grabbing"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
        >
          {imageUrl ? (
            <>
              <img
                src={imageUrl}
                alt="Battle map"
                className="absolute origin-top-left select-none"
                style={{
                  transform: `translate(${settings.panX}px, ${settings.panY}px) scale(${settings.zoom})`,
                  maxWidth: 'none',
                }}
                draggable={false}
              />
              <GridOverlay />
            </>
          ) : (
            <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
              <Upload className="mb-4 size-16 opacity-50" />
              <p className="text-lg font-medium">No map loaded</p>
              <p className="text-sm">Upload an image to display your battle map</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="mr-2 size-4" />
                Upload Map
              </Button>
            </div>
          )}

          {/* Fullscreen Controls Overlay */}
          {isFullscreen && (
            <div className="absolute right-4 top-4 flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => handleZoom(-0.25)}>
                <ZoomOut className="size-4" />
              </Button>
              <Button size="sm" variant="secondary" onClick={() => handleZoom(0.25)}>
                <ZoomIn className="size-4" />
              </Button>
              <Button
                size="sm"
                variant={settings.gridEnabled ? 'default' : 'secondary'}
                onClick={() =>
                  onSettingsChange({ ...settings, gridEnabled: !settings.gridEnabled })
                }
              >
                <Grid3X3 className="size-4" />
              </Button>
              <Button size="sm" variant="secondary" onClick={resetView}>
                <RotateCcw className="size-4" />
              </Button>
              <Button size="sm" variant="destructive" onClick={toggleFullscreen}>
                Exit
              </Button>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
