'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import Image from 'next/image'
import { TableSection, TablePosition, DrawnVenueLayout, VenueBoundary, VenueLine } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Circle, Square, ZoomIn, ZoomOut, X, ArrowLeftToLine, ArrowRightToLine, ArrowUpToLine, ArrowDownToLine, Plus, Minus, AlignStartVertical, AlignEndVertical, AlignCenterVertical, AlignStartHorizontal, AlignEndHorizontal, AlignCenterHorizontal, AlignHorizontalSpaceAround, AlignVerticalSpaceAround, Type, Pipette, RectangleHorizontal, Minus as LineIcon, Trash2, Move, Lock, Unlock, Crosshair } from 'lucide-react'

interface VenueLayoutEditorProps {
  layoutUrl: string | null
  sections: TableSection[]
  onUpdateSection: (sectionId: string, updates: Partial<TableSection>) => void
  onSave?: () => void
  saving?: boolean
  hasChanges?: boolean
  fontSize: number
  onFontSizeChange: (size: number) => void
  drawnLayout: DrawnVenueLayout | null
  onUpdateDrawnLayout: (layout: DrawnVenueLayout) => void
}

const SECTION_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
]

interface DragState {
  sectionId: string
  tableIndex: number
  startX: number
  startY: number
  startPosX: number
  startPosY: number
  isFromPalette: boolean
  constrainedAxis: 'x' | 'y' | null // For shift+drag constraint
  shiftHeldOnStart: boolean // Track if shift was held when drag started
  hasMoved: boolean // Track if mouse has moved significantly
  isMultiDrag: boolean // Whether we're dragging multiple selected tables
  multiDragStartPositions: { sectionId: string; tableIndex: number; x: number; y: number }[] // Starting positions of all selected tables
}

export function VenueLayoutEditor({
  layoutUrl,
  sections,
  onUpdateSection,
  onSave,
  saving,
  hasChanges = true,
  fontSize,
  onFontSizeChange,
  drawnLayout,
  onUpdateDrawnLayout,
}: VenueLayoutEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const outerContainerRef = useRef<HTMLDivElement>(null)
  const canvasContainerRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0, panX: 0, panY: 0 })
  const [dragState, setDragState] = useState<DragState | null>(null)
  const [selectedTables, setSelectedTables] = useState<{ sectionId: string; tableIndex: number }[]>([])
  const [snapGuides, setSnapGuides] = useState<{ type: 'horizontal' | 'vertical'; position: number; start: number; end: number }[]>([])
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null) // Local drag position for smooth movement
  const dragPositionRef = useRef<{ x: number; y: number } | null>(null) // Ref to always have latest drag position
  const [multiDragPositions, setMultiDragPositions] = useState<{ sectionId: string; tableIndex: number; x: number; y: number }[]>([]) // Positions for multi-drag
  const multiDragPositionsRef = useRef<{ sectionId: string; tableIndex: number; x: number; y: number }[]>([]) // Ref for multi-drag positions
  const [copyStyleMode, setCopyStyleMode] = useState(false) // Whether we're in "copy style" mode
  const [imageAspectRatio, setImageAspectRatio] = useState<number | null>(null)
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 })

  // Drawing mode state
  const [drawingMode, setDrawingMode] = useState<'none' | 'boundary' | 'line'>('none')
  const [selectedElement, setSelectedElement] = useState<{ type: 'boundary' | 'line'; id?: string; pathId?: string } | null>(null)
  const [selectedLineIds, setSelectedLineIds] = useState<string[]>([]) // For multi-selection of lines
  const [drawingBoundary, setDrawingBoundary] = useState<{ startX: number; startY: number; currentX: number; currentY: number } | null>(null)
  const [drawingLine, setDrawingLine] = useState<{ x1: number; y1: number; x2?: number; y2?: number; pathId?: string } | null>(null)
  const [draggingElement, setDraggingElement] = useState<{ type: 'boundary' | 'line'; id?: string; startX: number; startY: number; originalData: VenueBoundary | VenueLine; pathLines?: VenueLine[] } | null>(null)
  const [resizingBoundary, setResizingBoundary] = useState<{ handle: string; startX: number; startY: number; original: VenueBoundary } | null>(null)
  const [draggingLineEndpoint, setDraggingLineEndpoint] = useState<{ lineId: string; endpoint: 'start' | 'end'; startX: number; startY: number; hasMoved?: boolean } | null>(null)
  const [pendingNewLineFromEndpoint, setPendingNewLineFromEndpoint] = useState<{ x: number; y: number; sourceLineId: string; sourcePathId?: string } | null>(null)
  const justSelectedRef = useRef(false)
  const sectionsRef = useRef(sections)
  sectionsRef.current = sections // Keep ref updated

  // Load image to get its natural aspect ratio, or use default for draw mode
  useEffect(() => {
    if (layoutUrl) {
      const img = new window.Image()
      img.onload = () => {
        setImageAspectRatio(img.naturalWidth / img.naturalHeight)
      }
      img.src = layoutUrl
    } else {
      // Default 4:3 aspect ratio for draw mode
      setImageAspectRatio(4 / 3)
    }
  }, [layoutUrl])

  // Track canvas container size for table size calculations
  useEffect(() => {
    const updateSize = () => {
      if (canvasContainerRef.current) {
        const rect = canvasContainerRef.current.getBoundingClientRect()
        setCanvasSize({ width: rect.width, height: rect.height })
      }
    }

    updateSize()
    window.addEventListener('resize', updateSize)
    return () => window.removeEventListener('resize', updateSize)
  }, [imageAspectRatio])

  // Helper to check if a table is selected
  const isTableSelected = (sectionId: string, tableIndex: number) => {
    return selectedTables.some(t => t.sectionId === sectionId && t.tableIndex === tableIndex)
  }

  // Get the first selected table (for single-selection operations)
  const selectedTable = selectedTables.length > 0 ? selectedTables[0] : null

  // Helper to check if a line is selected (supports multi-selection)
  const isLineSelected = (lineId: string, pathId?: string) => {
    // Check if directly selected
    if (selectedLineIds.includes(lineId)) return true
    // Check if selected via pathId (when a connected shape is selected)
    if (pathId && selectedElement?.pathId === pathId) return true
    // Check if this specific line is the selectedElement
    if (selectedElement?.type === 'line' && selectedElement.id === lineId) return true
    return false
  }

  // Get all line IDs that should be considered selected (including connected paths)
  const getAllSelectedLineIds = (): string[] => {
    const ids = new Set<string>(selectedLineIds)
    // Add lines from selected pathId
    if (selectedElement?.type === 'line' && selectedElement.pathId) {
      drawnLayout?.lines.filter(l => l.pathId === selectedElement.pathId).forEach(l => ids.add(l.id))
    }
    // Add single selected line
    if (selectedElement?.type === 'line' && selectedElement.id) {
      ids.add(selectedElement.id)
    }
    return Array.from(ids)
  }

  // Assign colors to sections
  const getSectionColor = (sectionIndex: number) => {
    return sections[sectionIndex]?.color || SECTION_COLORS[sectionIndex % SECTION_COLORS.length]
  }

  // Check if a table has been placed on the canvas
  const isTablePlaced = (section: TableSection, tableIndex: number): boolean => {
    return section.tablePositions?.[tableIndex]?.placed === true
  }

  // Get table position (only for placed tables)
  const getTablePosition = (section: TableSection, tableIndex: number): TablePosition | null => {
    if (section.tablePositions?.[tableIndex]?.placed) {
      return section.tablePositions[tableIndex]
    }
    return null
  }

  // Helper functions for drawn layout management
  const updateBoundary = useCallback((boundary: VenueBoundary | null) => {
    onUpdateDrawnLayout({
      boundary,
      lines: drawnLayout?.lines || [],
    })
  }, [drawnLayout, onUpdateDrawnLayout])

  const addLine = useCallback((line: VenueLine) => {
    onUpdateDrawnLayout({
      boundary: drawnLayout?.boundary || null,
      lines: [...(drawnLayout?.lines || []), line],
    })
  }, [drawnLayout, onUpdateDrawnLayout])

  const updateLine = useCallback((lineId: string, updates: Partial<VenueLine>) => {
    onUpdateDrawnLayout({
      boundary: drawnLayout?.boundary || null,
      lines: (drawnLayout?.lines || []).map(l =>
        l.id === lineId ? { ...l, ...updates } : l
      ),
    })
  }, [drawnLayout, onUpdateDrawnLayout])

  // Update multiple lines at once (for moving connected shapes)
  const updateLines = useCallback((updates: { id: string; changes: Partial<VenueLine> }[]) => {
    const updateMap = new Map(updates.map(u => [u.id, u.changes]))
    onUpdateDrawnLayout({
      boundary: drawnLayout?.boundary || null,
      lines: (drawnLayout?.lines || []).map(l =>
        updateMap.has(l.id) ? { ...l, ...updateMap.get(l.id)! } : l
      ),
    })
  }, [drawnLayout, onUpdateDrawnLayout])

  const deleteLine = useCallback((lineId: string) => {
    onUpdateDrawnLayout({
      boundary: drawnLayout?.boundary || null,
      lines: (drawnLayout?.lines || []).filter(l => l.id !== lineId),
    })
  }, [drawnLayout, onUpdateDrawnLayout])

  // Delete all lines with a specific pathId (delete entire connected shape)
  const deleteLinesByPathId = useCallback((pathId: string) => {
    onUpdateDrawnLayout({
      boundary: drawnLayout?.boundary || null,
      lines: (drawnLayout?.lines || []).filter(l => l.pathId !== pathId),
    })
  }, [drawnLayout, onUpdateDrawnLayout])

  const deleteSelectedElement = useCallback(() => {
    // Handle multi-selected lines first
    if (selectedLineIds.length > 0) {
      const idsToDelete = new Set(selectedLineIds)
      onUpdateDrawnLayout({
        boundary: drawnLayout?.boundary || null,
        lines: (drawnLayout?.lines || []).filter(l => !idsToDelete.has(l.id)),
      })
      setSelectedLineIds([])
      setSelectedElement(null)
      return
    }

    if (!selectedElement) return
    if (selectedElement.type === 'boundary') {
      updateBoundary(null)
    } else if (selectedElement.type === 'line') {
      // Delete all lines in the path if there's a pathId, otherwise just the single line
      if (selectedElement.pathId) {
        deleteLinesByPathId(selectedElement.pathId)
      } else if (selectedElement.id) {
        deleteLine(selectedElement.id)
      }
    }
    setSelectedElement(null)
  }, [selectedElement, selectedLineIds, updateBoundary, deleteLine, deleteLinesByPathId, drawnLayout, onUpdateDrawnLayout])

  const toggleSelectedLock = useCallback(() => {
    if (!selectedElement) return

    if (selectedElement.type === 'boundary' && drawnLayout?.boundary) {
      onUpdateDrawnLayout({
        boundary: { ...drawnLayout.boundary, locked: !drawnLayout.boundary.locked },
        lines: drawnLayout?.lines || [],
      })
      // Deselect when locking
      if (!drawnLayout.boundary.locked) {
        setSelectedElement(null)
      }
    } else if (selectedElement.type === 'line') {
      const line = drawnLayout?.lines.find(l => l.id === selectedElement.id)
      if (line) {
        const newLockedState = !line.locked
        // Lock/unlock all lines in the path if there's a pathId
        if (selectedElement.pathId) {
          onUpdateDrawnLayout({
            boundary: drawnLayout?.boundary || null,
            lines: (drawnLayout?.lines || []).map(l =>
              l.pathId === selectedElement.pathId ? { ...l, locked: newLockedState } : l
            ),
          })
        } else if (selectedElement.id) {
          onUpdateDrawnLayout({
            boundary: drawnLayout?.boundary || null,
            lines: (drawnLayout?.lines || []).map(l =>
              l.id === selectedElement.id ? { ...l, locked: newLockedState } : l
            ),
          })
        }
        // Deselect when locking
        if (newLockedState) {
          setSelectedElement(null)
        }
      }
    }
  }, [selectedElement, drawnLayout, onUpdateDrawnLayout])

  // Check if currently selected element is locked
  const isSelectedLocked = selectedElement?.type === 'boundary'
    ? drawnLayout?.boundary?.locked
    : selectedElement?.type === 'line' && selectedElement.id
      ? drawnLayout?.lines.find(l => l.id === selectedElement.id)?.locked
      : false

  const centerSelectedElement = useCallback(() => {
    if (!selectedElement) return

    if (selectedElement.type === 'boundary' && drawnLayout?.boundary) {
      // Center boundary: x = (100 - width) / 2, y = (100 - height) / 2
      const centeredX = (100 - drawnLayout.boundary.width) / 2
      const centeredY = (100 - drawnLayout.boundary.height) / 2
      onUpdateDrawnLayout({
        boundary: { ...drawnLayout.boundary, x: centeredX, y: centeredY },
        lines: drawnLayout?.lines || [],
      })
    } else if (selectedElement.type === 'line') {
      // Get all lines to center (all in path if pathId exists)
      const linesToCenter = selectedElement.pathId
        ? drawnLayout?.lines.filter(l => l.pathId === selectedElement.pathId) || []
        : drawnLayout?.lines.filter(l => l.id === selectedElement.id) || []

      if (linesToCenter.length > 0) {
        // Calculate bounding box of all lines
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
        linesToCenter.forEach(line => {
          minX = Math.min(minX, line.x1, line.x2)
          minY = Math.min(minY, line.y1, line.y2)
          maxX = Math.max(maxX, line.x1, line.x2)
          maxY = Math.max(maxY, line.y1, line.y2)
        })

        // Calculate current center of bounding box
        const currentCenterX = (minX + maxX) / 2
        const currentCenterY = (minY + maxY) / 2
        // Calculate offset to move center to (50, 50)
        const offsetX = 50 - currentCenterX
        const offsetY = 50 - currentCenterY

        const lineIds = new Set(linesToCenter.map(l => l.id))
        // Apply offset to all lines in the path
        onUpdateDrawnLayout({
          boundary: drawnLayout?.boundary || null,
          lines: (drawnLayout?.lines || []).map(l =>
            lineIds.has(l.id)
              ? { ...l, x1: l.x1 + offsetX, y1: l.y1 + offsetY, x2: l.x2 + offsetX, y2: l.y2 + offsetY }
              : l
          ),
        })
      }
    }
  }, [selectedElement, drawnLayout, onUpdateDrawnLayout])

  // Update a single table's position
  const updateTablePosition = useCallback((sectionId: string, tableIndex: number, position: Partial<TablePosition>) => {
    const section = sections.find(s => s.id === sectionId)
    if (!section) return

    const currentPositions = [...(section.tablePositions || [])]

    // Ensure array is large enough
    while (currentPositions.length <= tableIndex) {
      currentPositions.push({
        x: 0,
        y: 0,
        width: 48, // Pixel size
        height: 48, // Pixel size
        shape: 'square',
        placed: false,
      })
    }

    currentPositions[tableIndex] = {
      ...currentPositions[tableIndex],
      ...position,
    }

    onUpdateSection(sectionId, { tablePositions: currentPositions })
  }, [sections, onUpdateSection])

  // Handle mouse down on a palette table (starting drag from palette)
  const handlePaletteMouseDown = (
    e: React.MouseEvent,
    sectionId: string,
    tableIndex: number
  ) => {
    e.preventDefault()
    e.stopPropagation()

    justSelectedRef.current = true
    setTimeout(() => { justSelectedRef.current = false }, 300)

    setSelectedTables([{ sectionId, tableIndex }])
    setDragState({
      sectionId,
      tableIndex,
      startX: e.clientX,
      startY: e.clientY,
      startPosX: 0,
      startPosY: 0,
      isFromPalette: true,
      constrainedAxis: null,
      shiftHeldOnStart: e.shiftKey,
      hasMoved: false,
      isMultiDrag: false,
      multiDragStartPositions: [],
    })
  }

  // Handle mouse down on a placed table
  const handleCanvasMouseDown = (
    e: React.MouseEvent,
    sectionId: string,
    tableIndex: number
  ) => {
    e.preventDefault()
    e.stopPropagation()

    const section = sections.find(s => s.id === sectionId)
    if (!section) return

    const pos = getTablePosition(section, tableIndex)
    if (!pos) return

    justSelectedRef.current = true
    setTimeout(() => { justSelectedRef.current = false }, 300)

    const tableRef = { sectionId, tableIndex }
    const alreadySelected = isTableSelected(sectionId, tableIndex)

    // Alt+click or copy style mode: copy style from this table to all selected tables
    if ((e.altKey || copyStyleMode) && selectedTables.length > 0 && !alreadySelected) {
      const sourceSection = sections.find(s => s.id === sectionId)
      const sourcePos = sourceSection?.tablePositions?.[tableIndex]
      if (sourcePos) {
        // Apply source table's style to all selected tables
        const updates = selectedTables.map(t => ({
          sectionId: t.sectionId,
          tableIndex: t.tableIndex,
          changes: {
            width: sourcePos.width,
            height: sourcePos.height,
            shape: sourcePos.shape,
          }
        }))
        batchUpdatePositions(updates)
      }
      setCopyStyleMode(false) // Exit copy style mode after copying
      return // Don't start dragging
    }

    // Start potential drag - we'll determine if it's a click or drag on mouseup
    // If shift+click (no drag), we'll add to selection
    // If shift+drag, we'll do constrained movement
    if (!alreadySelected && !e.shiftKey) {
      setSelectedTables([tableRef])
    }

    // Check if this is a multi-drag (dragging one of multiple selected tables)
    const isMultiDrag = alreadySelected && selectedTables.length > 1
    const multiDragStartPositions = isMultiDrag
      ? selectedTables.map(t => {
          const sec = sections.find(s => s.id === t.sectionId)
          const tPos = sec?.tablePositions?.[t.tableIndex]
          return {
            sectionId: t.sectionId,
            tableIndex: t.tableIndex,
            x: tPos?.x ?? 0,
            y: tPos?.y ?? 0,
          }
        })
      : []

    setDragState({
      sectionId,
      tableIndex,
      startX: e.clientX,
      startY: e.clientY,
      startPosX: pos.x,
      startPosY: pos.y,
      isFromPalette: false,
      constrainedAxis: null,
      shiftHeldOnStart: e.shiftKey,
      hasMoved: false,
      isMultiDrag,
      multiDragStartPositions,
    })
  }

  // Get all placed tables except the one being dragged (uses ref for performance)
  const getOtherPlacedTables = (excludeSectionId: string, excludeTableIndex: number) => {
    const tables: { pos: TablePosition; width: number; height: number }[] = []
    sectionsRef.current.forEach(section => {
      for (let i = 0; i < section.tableCount; i++) {
        if (section.id === excludeSectionId && i === excludeTableIndex) continue
        const pos = getTablePosition(section, i)
        if (pos) {
          tables.push({ pos, width: pos.width, height: pos.height })
        }
      }
    })
    return tables
  }

  // Generate alignment guides (no snapping, just visual guides)
  const getAlignmentGuides = (
    x: number,
    y: number,
    width: number,
    height: number,
    otherTables: { pos: TablePosition; width: number; height: number }[]
  ): { type: 'horizontal' | 'vertical'; position: number; start: number; end: number }[] => {
    const guides: { type: 'horizontal' | 'vertical'; position: number; start: number; end: number }[] = []

    // Current table edges and center
    const left = x
    const right = x + width
    const centerX = x + width / 2
    const top = y
    const bottom = y + height
    const centerY = y + height / 2

    // Guide threshold - how close before showing a guide
    const GUIDE_THRESHOLD = 0.5

    for (const other of otherTables) {
      const oLeft = other.pos.x
      const oRight = other.pos.x + other.width
      const oCenterX = other.pos.x + other.width / 2
      const oTop = other.pos.y
      const oBottom = other.pos.y + other.height
      const oCenterY = other.pos.y + other.height / 2

      // Vertical guides (X alignment)
      if (Math.abs(left - oLeft) < GUIDE_THRESHOLD) {
        guides.push({ type: 'vertical', position: oLeft, start: Math.min(top, oTop), end: Math.max(bottom, oBottom) })
      }
      if (Math.abs(right - oRight) < GUIDE_THRESHOLD) {
        guides.push({ type: 'vertical', position: oRight, start: Math.min(top, oTop), end: Math.max(bottom, oBottom) })
      }
      if (Math.abs(left - oRight) < GUIDE_THRESHOLD) {
        guides.push({ type: 'vertical', position: oRight, start: Math.min(top, oTop), end: Math.max(bottom, oBottom) })
      }
      if (Math.abs(right - oLeft) < GUIDE_THRESHOLD) {
        guides.push({ type: 'vertical', position: oLeft, start: Math.min(top, oTop), end: Math.max(bottom, oBottom) })
      }
      if (Math.abs(centerX - oCenterX) < GUIDE_THRESHOLD) {
        guides.push({ type: 'vertical', position: oCenterX, start: Math.min(top, oTop), end: Math.max(bottom, oBottom) })
      }

      // Horizontal guides (Y alignment)
      if (Math.abs(top - oTop) < GUIDE_THRESHOLD) {
        guides.push({ type: 'horizontal', position: oTop, start: Math.min(left, oLeft), end: Math.max(right, oRight) })
      }
      if (Math.abs(bottom - oBottom) < GUIDE_THRESHOLD) {
        guides.push({ type: 'horizontal', position: oBottom, start: Math.min(left, oLeft), end: Math.max(right, oRight) })
      }
      if (Math.abs(top - oBottom) < GUIDE_THRESHOLD) {
        guides.push({ type: 'horizontal', position: oBottom, start: Math.min(left, oLeft), end: Math.max(right, oRight) })
      }
      if (Math.abs(bottom - oTop) < GUIDE_THRESHOLD) {
        guides.push({ type: 'horizontal', position: oTop, start: Math.min(left, oLeft), end: Math.max(right, oRight) })
      }
      if (Math.abs(centerY - oCenterY) < GUIDE_THRESHOLD) {
        guides.push({ type: 'horizontal', position: oCenterY, start: Math.min(left, oLeft), end: Math.max(right, oRight) })
      }
    }

    return guides
  }

  // Handle mouse move
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragState || !canvasContainerRef.current) return

      const rect = canvasContainerRef.current.getBoundingClientRect()
      const centerX = rect.width / 2
      const centerY = rect.height / 2

      // Calculate raw delta for axis constraint detection
      const rawDeltaX = Math.abs(e.clientX - dragState.startX)
      const rawDeltaY = Math.abs(e.clientY - dragState.startY)

      // Track if mouse has moved significantly (for shift+click vs shift+drag detection)
      const hasMovedNow = rawDeltaX > 3 || rawDeltaY > 3

      // Determine axis constraint when shift is held
      let currentConstraint = dragState.constrainedAxis
      let needsStateUpdate = false
      let newDragState = { ...dragState }

      if (hasMovedNow && !dragState.hasMoved) {
        newDragState.hasMoved = true
        needsStateUpdate = true
      }

      if (e.shiftKey && !dragState.isFromPalette) {
        // Lock axis once we've moved enough (5px threshold)
        if (!currentConstraint && (rawDeltaX > 5 || rawDeltaY > 5)) {
          currentConstraint = rawDeltaX > rawDeltaY ? 'x' : 'y'
          newDragState.constrainedAxis = currentConstraint
          needsStateUpdate = true
        }
      } else if (currentConstraint) {
        // Shift released, clear constraint
        currentConstraint = null
        newDragState.constrainedAxis = null
        needsStateUpdate = true
      }

      if (needsStateUpdate) {
        setDragState(newDragState)
      }

      if (dragState.isFromPalette) {
        // Dragging from palette - calculate position relative to canvas
        const relX = e.clientX - rect.left
        const relY = e.clientY - rect.top

        // Get unscaled canvas dimensions (rect includes zoom transform)
        const unscaledWidth = rect.width / zoom
        const unscaledHeight = rect.height / zoom
        const unscaledCenterX = unscaledWidth / 2
        const unscaledCenterY = unscaledHeight / 2

        // Convert screen position to canvas position (undoing zoom transform centered on canvas)
        // Transform is: scale(zoom) with origin at center
        // To reverse: 1) translate relative to visual center, 2) account for pan, 3) divide by zoom, 4) add unscaled center
        const canvasX = (relX - centerX - pan.x) / zoom + unscaledCenterX
        const canvasY = (relY - centerY - pan.y) / zoom + unscaledCenterY

        // Calculate percentage dimensions based on 48px palette size
        const paletteSize = 48
        const widthPercent = (paletteSize / unscaledWidth) * 100
        const heightPercent = (paletteSize / unscaledHeight) * 100

        // Convert to percentage (offset by half the table size to center cursor)
        const x = Math.max(0, Math.min(100 - widthPercent, (canvasX / unscaledWidth) * 100 - widthPercent / 2))
        const y = Math.max(0, Math.min(100 - heightPercent, (canvasY / unscaledHeight) * 100 - heightPercent / 2))

        // Check if mouse is over the canvas
        if (e.clientX >= rect.left && e.clientX <= rect.right &&
            e.clientY >= rect.top && e.clientY <= rect.bottom) {

          // Update local drag position (smooth, no parent re-render)
          const newPos = { x, y }
          setDragPosition(newPos)
          dragPositionRef.current = newPos // Keep ref in sync for mouseup

          // Get alignment guides - convert pixel dimensions to percentages (use unscaled dimensions)
          const otherTables = getOtherPlacedTables(dragState.sectionId, dragState.tableIndex)
          const otherTablesPercent = otherTables.map(t => ({
            pos: t.pos,
            width: (t.width / unscaledWidth) * 100,
            height: (t.height / unscaledHeight) * 100,
          }))
          setSnapGuides(getAlignmentGuides(x, y, widthPercent, heightPercent, otherTablesPercent))
        } else {
          setSnapGuides([])
        }
      } else {
        // Handle drag on canvas - use delta
        // rect.width/height includes zoom transform, so dividing by it gives correct 1:1 cursor tracking
        const deltaX = ((e.clientX - dragState.startX) / rect.width) * 100
        const deltaY = ((e.clientY - dragState.startY) / rect.height) * 100

        // Apply axis constraint if shift is held
        let constrainedDeltaX = deltaX
        let constrainedDeltaY = deltaY
        if (currentConstraint === 'x') {
          constrainedDeltaY = 0 // Lock to horizontal
        } else if (currentConstraint === 'y') {
          constrainedDeltaX = 0 // Lock to vertical
        }

        const newX = Math.max(0, Math.min(94, dragState.startPosX + constrainedDeltaX))
        const newY = Math.max(0, Math.min(94, dragState.startPosY + constrainedDeltaY))

        // Update local drag position (smooth, no parent re-render)
        const newPos = { x: newX, y: newY }
        setDragPosition(newPos)
        dragPositionRef.current = newPos // Keep ref in sync for mouseup

        // Handle multi-drag - update positions for all selected tables
        if (dragState.isMultiDrag && dragState.multiDragStartPositions.length > 0) {
          const newMultiPositions = dragState.multiDragStartPositions.map(startPos => ({
            sectionId: startPos.sectionId,
            tableIndex: startPos.tableIndex,
            x: Math.max(0, Math.min(94, startPos.x + constrainedDeltaX)),
            y: Math.max(0, Math.min(94, startPos.y + constrainedDeltaY)),
          }))
          setMultiDragPositions(newMultiPositions)
          multiDragPositionsRef.current = newMultiPositions
        }

        // Get unscaled canvas dimensions for percentage calculations
        const unscaledWidth = rect.width / zoom
        const unscaledHeight = rect.height / zoom

        // Get current table dimensions (stored in pixels, convert to percentage for alignment)
        const section = sectionsRef.current.find(s => s.id === dragState.sectionId)
        const currentPos = section?.tablePositions?.[dragState.tableIndex]
        const widthPx = currentPos?.width || 48
        const heightPx = currentPos?.height || 48
        const widthPercent = (widthPx / unscaledWidth) * 100
        const heightPercent = (heightPx / unscaledHeight) * 100

        // Get alignment guides (only for primary dragged table)
        const otherTables = getOtherPlacedTables(dragState.sectionId, dragState.tableIndex)
        // Convert other tables' dimensions to percentages for alignment calculation
        const otherTablesPercent = otherTables.map(t => ({
          pos: t.pos,
          width: (t.width / unscaledWidth) * 100,
          height: (t.height / unscaledHeight) * 100,
        }))
        setSnapGuides(getAlignmentGuides(newX, newY, widthPercent, heightPercent, otherTablesPercent))
      }
    }

    const handleMouseUp = () => {
      if (!dragState) {
        setDragState(null)
        setDragPosition(null)
        dragPositionRef.current = null
        setSnapGuides([])
        return
      }

      // Handle shift+click (no drag) for multi-selection
      if (dragState.shiftHeldOnStart && !dragState.hasMoved && !dragState.isFromPalette) {
        const tableRef = { sectionId: dragState.sectionId, tableIndex: dragState.tableIndex }
        const alreadySelected = selectedTables.some(
          t => t.sectionId === dragState.sectionId && t.tableIndex === dragState.tableIndex
        )
        if (alreadySelected) {
          setSelectedTables(prev => prev.filter(
            t => !(t.sectionId === dragState.sectionId && t.tableIndex === dragState.tableIndex)
          ))
        } else {
          setSelectedTables(prev => [...prev, tableRef])
        }
        setDragState(null)
        setDragPosition(null)
        dragPositionRef.current = null
        setSnapGuides([])
        return
      }

      // Commit final position to parent state using ref (closure would be stale)
      const finalPosition = dragPositionRef.current
      if (finalPosition) {
        // Get container dimensions for pixel-to-percent conversion
        const rect = canvasContainerRef.current?.getBoundingClientRect()
        const containerWidth = rect?.width || 900
        const containerHeight = rect?.height || 650

        // Get table dimensions in pixels, convert to percentage for snapping
        const paletteSize = 48
        const section = sectionsRef.current.find(s => s.id === dragState.sectionId)
        const currentPos = section?.tablePositions?.[dragState.tableIndex]
        const widthPx = dragState.isFromPalette ? paletteSize : (currentPos?.width || 48)
        const heightPx = dragState.isFromPalette ? paletteSize : (currentPos?.height || 48)
        const width = (widthPx / containerWidth) * 100
        const height = (heightPx / containerHeight) * 100

        // Apply snapping if alignment guides are showing
        let snappedX = finalPosition.x
        let snappedY = finalPosition.y
        const otherTables = getOtherPlacedTables(dragState.sectionId, dragState.tableIndex)
        const SNAP_THRESHOLD = 0.5

        let snapDeltaX = 0
        let snapDeltaY = 0

        for (const other of otherTables) {
          // Convert other table dimensions from pixels to percentages
          const otherWidthPercent = (other.width / containerWidth) * 100
          const otherHeightPercent = (other.height / containerHeight) * 100

          const oLeft = other.pos.x
          const oRight = other.pos.x + otherWidthPercent
          const oCenterX = other.pos.x + otherWidthPercent / 2
          const oTop = other.pos.y
          const oBottom = other.pos.y + otherHeightPercent
          const oCenterY = other.pos.y + otherHeightPercent / 2

          // Snap X (left, right, center)
          if (Math.abs(snappedX - oLeft) < SNAP_THRESHOLD) { snapDeltaX = oLeft - snappedX; snappedX = oLeft }
          else if (Math.abs(snappedX + width - oRight) < SNAP_THRESHOLD) { snapDeltaX = oRight - width - snappedX; snappedX = oRight - width }
          else if (Math.abs(snappedX - oRight) < SNAP_THRESHOLD) { snapDeltaX = oRight - snappedX; snappedX = oRight }
          else if (Math.abs(snappedX + width - oLeft) < SNAP_THRESHOLD) { snapDeltaX = oLeft - width - snappedX; snappedX = oLeft - width }
          else if (Math.abs(snappedX + width / 2 - oCenterX) < SNAP_THRESHOLD) { snapDeltaX = oCenterX - width / 2 - snappedX; snappedX = oCenterX - width / 2 }

          // Snap Y (top, bottom, center)
          if (Math.abs(snappedY - oTop) < SNAP_THRESHOLD) { snapDeltaY = oTop - snappedY; snappedY = oTop }
          else if (Math.abs(snappedY + height - oBottom) < SNAP_THRESHOLD) { snapDeltaY = oBottom - height - snappedY; snappedY = oBottom - height }
          else if (Math.abs(snappedY - oBottom) < SNAP_THRESHOLD) { snapDeltaY = oBottom - snappedY; snappedY = oBottom }
          else if (Math.abs(snappedY + height - oTop) < SNAP_THRESHOLD) { snapDeltaY = oTop - height - snappedY; snappedY = oTop - height }
          else if (Math.abs(snappedY + height / 2 - oCenterY) < SNAP_THRESHOLD) { snapDeltaY = oCenterY - height / 2 - snappedY; snappedY = oCenterY - height / 2 }
        }

        if (dragState.isFromPalette) {
          updateTablePosition(dragState.sectionId, dragState.tableIndex, {
            x: snappedX,
            y: snappedY,
            width: 48, // Pixel size matching palette
            height: 48, // Pixel size matching palette
            shape: 'square',
            placed: true,
          })
        } else if (dragState.isMultiDrag && multiDragPositionsRef.current.length > 0) {
          // Multi-drag: update all selected tables with snap delta applied
          const updates = multiDragPositionsRef.current.map(pos => ({
            sectionId: pos.sectionId,
            tableIndex: pos.tableIndex,
            changes: {
              x: Math.max(0, Math.min(94, pos.x + snapDeltaX)),
              y: Math.max(0, Math.min(94, pos.y + snapDeltaY)),
            }
          }))
          batchUpdatePositions(updates)
        } else {
          updateTablePosition(dragState.sectionId, dragState.tableIndex, {
            x: snappedX,
            y: snappedY,
          })
        }
      }
      setDragState(null)
      setDragPosition(null)
      dragPositionRef.current = null
      setMultiDragPositions([])
      multiDragPositionsRef.current = []
      setSnapGuides([])
    }

    if (dragState) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [dragState, zoom, pan, updateTablePosition, selectedTables])

  // Handle keyboard arrow keys for precise table movement
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle arrow keys when tables are selected
      if (selectedTables.length === 0) return
      if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return

      // Don't handle if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      e.preventDefault()

      const rect = canvasContainerRef.current?.getBoundingClientRect()
      if (!rect) return

      // 1 pixel movement converted to percentage
      // Shift+Arrow moves 10 pixels at a time
      const pixelStep = e.shiftKey ? 10 : 1
      const xStep = (pixelStep / rect.width) * 100
      const yStep = (pixelStep / rect.height) * 100

      // Calculate delta based on arrow key
      let deltaX = 0
      let deltaY = 0
      switch (e.key) {
        case 'ArrowUp': deltaY = -yStep; break
        case 'ArrowDown': deltaY = yStep; break
        case 'ArrowLeft': deltaX = -xStep; break
        case 'ArrowRight': deltaX = xStep; break
      }

      // Group selected tables by section to batch updates
      const updatesBySection = new Map<string, { tableIndex: number; x: number; y: number }[]>()

      for (const selected of selectedTables) {
        const section = sections.find(s => s.id === selected.sectionId)
        if (!section) continue
        const pos = getTablePosition(section, selected.tableIndex)
        if (!pos) continue

        // Calculate percentage dimensions for bounds checking
        const widthPercent = (pos.width / rect.width) * 100
        const heightPercent = (pos.height / rect.height) * 100

        const newX = Math.max(0, Math.min(100 - widthPercent, pos.x + deltaX))
        const newY = Math.max(0, Math.min(100 - heightPercent, pos.y + deltaY))

        if (!updatesBySection.has(selected.sectionId)) {
          updatesBySection.set(selected.sectionId, [])
        }
        updatesBySection.get(selected.sectionId)!.push({ tableIndex: selected.tableIndex, x: newX, y: newY })
      }

      // Apply batched updates per section
      for (const [sectionId, updates] of updatesBySection) {
        const section = sections.find(s => s.id === sectionId)
        if (!section) continue

        const currentPositions = [...(section.tablePositions || [])]
        for (const update of updates) {
          if (currentPositions[update.tableIndex]) {
            currentPositions[update.tableIndex] = {
              ...currentPositions[update.tableIndex],
              x: update.x,
              y: update.y,
            }
          }
        }
        onUpdateSection(sectionId, { tablePositions: currentPositions })
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedTables, sections, onUpdateSection])

  // Handle keyboard shortcuts for drawn elements (Delete, Escape, Arrow keys)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      // Delete/Backspace to delete selected element
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedElement && !isSelectedLocked) {
          e.preventDefault()
          deleteSelectedElement()
        }
      }

      // Escape to cancel drawing mode and clear selection
      if (e.key === 'Escape') {
        setDrawingMode('none')
        setDrawingBoundary(null)
        setDrawingLine(null)
        setSelectedElement(null)
        setSelectedLineIds([])
      }

      // Arrow keys to move selected element
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        // Check if we have any selection to move
        const hasSelection = selectedElement || selectedLineIds.length > 0
        if (!hasSelection || isSelectedLocked) return
        e.preventDefault()

        // 1% movement (shift is used for multi-select, so no fast mode with shift)
        const step = 1
        let deltaX = 0
        let deltaY = 0

        switch (e.key) {
          case 'ArrowUp': deltaY = -step; break
          case 'ArrowDown': deltaY = step; break
          case 'ArrowLeft': deltaX = -step; break
          case 'ArrowRight': deltaX = step; break
        }

        // Handle multi-selected lines first
        if (selectedLineIds.length > 0) {
          const lineIds = new Set(selectedLineIds)
          onUpdateDrawnLayout({
            boundary: drawnLayout?.boundary || null,
            lines: (drawnLayout?.lines || []).map(l => {
              if (lineIds.has(l.id)) {
                return {
                  ...l,
                  x1: Math.max(0, Math.min(100, l.x1 + deltaX)),
                  y1: Math.max(0, Math.min(100, l.y1 + deltaY)),
                  x2: Math.max(0, Math.min(100, l.x2 + deltaX)),
                  y2: Math.max(0, Math.min(100, l.y2 + deltaY)),
                }
              }
              return l
            }),
          })
          return
        }

        if (selectedElement?.type === 'boundary' && drawnLayout?.boundary) {
          const boundary = drawnLayout.boundary
          const newX = Math.max(0, Math.min(100 - boundary.width, boundary.x + deltaX))
          const newY = Math.max(0, Math.min(100 - boundary.height, boundary.y + deltaY))
          onUpdateDrawnLayout({
            boundary: { ...boundary, x: newX, y: newY },
            lines: drawnLayout.lines || [],
          })
        } else if (selectedElement?.type === 'line') {
          // Move all lines in the path if there's a pathId
          const linesToMove = selectedElement.pathId
            ? drawnLayout?.lines.filter(l => l.pathId === selectedElement.pathId) || []
            : drawnLayout?.lines.filter(l => l.id === selectedElement.id) || []

          if (linesToMove.length > 0) {
            const lineIds = new Set(linesToMove.map(l => l.id))
            onUpdateDrawnLayout({
              boundary: drawnLayout?.boundary || null,
              lines: (drawnLayout?.lines || []).map(l => {
                if (lineIds.has(l.id)) {
                  return {
                    ...l,
                    x1: Math.max(0, Math.min(100, l.x1 + deltaX)),
                    y1: Math.max(0, Math.min(100, l.y1 + deltaY)),
                    x2: Math.max(0, Math.min(100, l.x2 + deltaX)),
                    y2: Math.max(0, Math.min(100, l.y2 + deltaY)),
                  }
                }
                return l
              }),
            })
          }
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedElement, selectedLineIds, isSelectedLocked, deleteSelectedElement, drawnLayout, onUpdateDrawnLayout])

  // Change shape of selected table
  const handleShapeChange = (shape: 'circle' | 'square') => {
    if (selectedTable) {
      updateTablePosition(selectedTable.sectionId, selectedTable.tableIndex, { shape })
    }
  }

  // Size adjustment step in pixels
  const SIZE_STEP = 8
  const MIN_SIZE = 24
  const MAX_SIZE = 200

  // Increase table size (both width and height)
  const handleIncreaseSize = () => {
    if (!selectedTable) return
    const section = sections.find(s => s.id === selectedTable.sectionId)
    if (!section) return
    const pos = getTablePosition(section, selectedTable.tableIndex)
    if (!pos) return
    updateTablePosition(selectedTable.sectionId, selectedTable.tableIndex, {
      width: Math.min(MAX_SIZE, pos.width + SIZE_STEP),
      height: Math.min(MAX_SIZE, pos.height + SIZE_STEP),
    })
  }

  // Decrease table size (both width and height)
  const handleDecreaseSize = () => {
    if (!selectedTable) return
    const section = sections.find(s => s.id === selectedTable.sectionId)
    if (!section) return
    const pos = getTablePosition(section, selectedTable.tableIndex)
    if (!pos) return
    updateTablePosition(selectedTable.sectionId, selectedTable.tableIndex, {
      width: Math.max(MIN_SIZE, pos.width - SIZE_STEP),
      height: Math.max(MIN_SIZE, pos.height - SIZE_STEP),
    })
  }

  // Increase table width
  const handleIncreaseWidth = () => {
    if (!selectedTable) return
    const section = sections.find(s => s.id === selectedTable.sectionId)
    if (!section) return
    const pos = getTablePosition(section, selectedTable.tableIndex)
    if (!pos) return
    updateTablePosition(selectedTable.sectionId, selectedTable.tableIndex, { width: Math.min(MAX_SIZE, pos.width + SIZE_STEP) })
  }

  // Decrease table width
  const handleDecreaseWidth = () => {
    if (!selectedTable) return
    const section = sections.find(s => s.id === selectedTable.sectionId)
    if (!section) return
    const pos = getTablePosition(section, selectedTable.tableIndex)
    if (!pos) return
    updateTablePosition(selectedTable.sectionId, selectedTable.tableIndex, { width: Math.max(MIN_SIZE, pos.width - SIZE_STEP) })
  }

  // Increase table height
  const handleIncreaseHeight = () => {
    if (!selectedTable) return
    const section = sections.find(s => s.id === selectedTable.sectionId)
    if (!section) return
    const pos = getTablePosition(section, selectedTable.tableIndex)
    if (!pos) return
    updateTablePosition(selectedTable.sectionId, selectedTable.tableIndex, { height: Math.min(MAX_SIZE, pos.height + SIZE_STEP) })
  }

  // Decrease table height
  const handleDecreaseHeight = () => {
    if (!selectedTable) return
    const section = sections.find(s => s.id === selectedTable.sectionId)
    if (!section) return
    const pos = getTablePosition(section, selectedTable.tableIndex)
    if (!pos) return
    updateTablePosition(selectedTable.sectionId, selectedTable.tableIndex, { height: Math.max(MIN_SIZE, pos.height - SIZE_STEP) })
  }

  // Remove table from canvas (back to palette)
  const handleRemoveFromCanvas = () => {
    if (selectedTable) {
      updateTablePosition(selectedTable.sectionId, selectedTable.tableIndex, { placed: false })
      setSelectedTables([])
    }
  }

  // Alignment functions for multiple selected tables
  const getSelectedPositions = () => {
    return selectedTables.map(t => {
      const section = sections.find(s => s.id === t.sectionId)
      if (!section) return null
      const pos = getTablePosition(section, t.tableIndex)
      return pos ? { ...t, pos } : null
    }).filter(Boolean) as { sectionId: string; tableIndex: number; pos: TablePosition }[]
  }

  // Batch update multiple tables - groups by section to avoid overwrites
  const batchUpdatePositions = (updates: { sectionId: string; tableIndex: number; changes: Partial<TablePosition> }[]) => {
    // Group updates by section
    const updatesBySection: Record<string, { tableIndex: number; changes: Partial<TablePosition> }[]> = {}
    updates.forEach(u => {
      if (!updatesBySection[u.sectionId]) {
        updatesBySection[u.sectionId] = []
      }
      updatesBySection[u.sectionId].push({ tableIndex: u.tableIndex, changes: u.changes })
    })

    // Apply all updates per section at once
    Object.entries(updatesBySection).forEach(([sectionId, sectionUpdates]) => {
      const section = sections.find(s => s.id === sectionId)
      if (!section) return

      const currentPositions = [...(section.tablePositions || [])]

      // Ensure array is large enough
      const maxIndex = Math.max(...sectionUpdates.map(u => u.tableIndex))
      while (currentPositions.length <= maxIndex) {
        currentPositions.push({
          x: 0,
          y: 0,
          width: 48, // Pixel size
          height: 48, // Pixel size
          shape: 'square',
          placed: false,
        })
      }

      // Apply all updates for this section
      sectionUpdates.forEach(({ tableIndex, changes }) => {
        currentPositions[tableIndex] = {
          ...currentPositions[tableIndex],
          ...changes,
        }
      })

      onUpdateSection(sectionId, { tablePositions: currentPositions })
    })
  }

  const handleAlignLeft = () => {
    const positions = getSelectedPositions()
    if (positions.length < 2) return
    const minX = Math.min(...positions.map(p => p.pos.x))
    batchUpdatePositions(positions.map(p => ({
      sectionId: p.sectionId,
      tableIndex: p.tableIndex,
      changes: { x: minX }
    })))
  }

  const handleAlignRight = () => {
    const positions = getSelectedPositions()
    if (positions.length < 2) return
    const rect = canvasContainerRef.current?.getBoundingClientRect()
    const containerWidth = rect?.width || 900
    // Convert pixel widths to percentages for alignment
    const positionsWithPercent = positions.map(p => ({
      ...p,
      widthPercent: (p.pos.width / containerWidth) * 100
    }))
    const maxX = Math.max(...positionsWithPercent.map(p => p.pos.x + p.widthPercent))
    batchUpdatePositions(positionsWithPercent.map(p => ({
      sectionId: p.sectionId,
      tableIndex: p.tableIndex,
      changes: { x: maxX - p.widthPercent }
    })))
  }

  const handleAlignCenterH = () => {
    const positions = getSelectedPositions()
    if (positions.length < 2) return
    const rect = canvasContainerRef.current?.getBoundingClientRect()
    const containerWidth = rect?.width || 900
    // Convert pixel widths to percentages for alignment
    const positionsWithPercent = positions.map(p => ({
      ...p,
      widthPercent: (p.pos.width / containerWidth) * 100
    }))
    const centers = positionsWithPercent.map(p => p.pos.x + p.widthPercent / 2)
    const avgCenter = centers.reduce((a, b) => a + b, 0) / centers.length
    batchUpdatePositions(positionsWithPercent.map(p => ({
      sectionId: p.sectionId,
      tableIndex: p.tableIndex,
      changes: { x: avgCenter - p.widthPercent / 2 }
    })))
  }

  const handleAlignTop = () => {
    const positions = getSelectedPositions()
    if (positions.length < 2) return
    const minY = Math.min(...positions.map(p => p.pos.y))
    batchUpdatePositions(positions.map(p => ({
      sectionId: p.sectionId,
      tableIndex: p.tableIndex,
      changes: { y: minY }
    })))
  }

  const handleAlignBottom = () => {
    const positions = getSelectedPositions()
    if (positions.length < 2) return
    const rect = canvasContainerRef.current?.getBoundingClientRect()
    const containerHeight = rect?.height || 650
    // Convert pixel heights to percentages for alignment
    const positionsWithPercent = positions.map(p => ({
      ...p,
      heightPercent: (p.pos.height / containerHeight) * 100
    }))
    const maxY = Math.max(...positionsWithPercent.map(p => p.pos.y + p.heightPercent))
    batchUpdatePositions(positionsWithPercent.map(p => ({
      sectionId: p.sectionId,
      tableIndex: p.tableIndex,
      changes: { y: maxY - p.heightPercent }
    })))
  }

  const handleAlignCenterV = () => {
    const positions = getSelectedPositions()
    if (positions.length < 2) return
    const rect = canvasContainerRef.current?.getBoundingClientRect()
    const containerHeight = rect?.height || 650
    // Convert pixel heights to percentages for alignment
    const positionsWithPercent = positions.map(p => ({
      ...p,
      heightPercent: (p.pos.height / containerHeight) * 100
    }))
    const centers = positionsWithPercent.map(p => p.pos.y + p.heightPercent / 2)
    const avgCenter = centers.reduce((a, b) => a + b, 0) / centers.length
    batchUpdatePositions(positionsWithPercent.map(p => ({
      sectionId: p.sectionId,
      tableIndex: p.tableIndex,
      changes: { y: avgCenter - p.heightPercent / 2 }
    })))
  }

  // Distribute tables evenly horizontally
  const handleDistributeHorizontal = () => {
    const positions = getSelectedPositions()
    if (positions.length < 3) return // Need at least 3 items to distribute

    // Get container dimensions to convert pixel widths to percentages
    const rect = canvasContainerRef.current?.getBoundingClientRect()
    const containerWidth = rect?.width || 900

    // Convert positions with pixel widths to percentage widths
    const positionsWithPercent = positions.map(p => ({
      ...p,
      widthPercent: (p.pos.width / containerWidth) * 100
    }))

    // Sort by x position
    const sorted = [...positionsWithPercent].sort((a, b) => a.pos.x - b.pos.x)

    // Get leftmost and rightmost positions
    const leftmost = sorted[0]
    const rightmost = sorted[sorted.length - 1]

    // Calculate total space and spacing (all in percentages)
    const totalWidth = (rightmost.pos.x + rightmost.widthPercent) - leftmost.pos.x
    const totalTableWidths = sorted.reduce((sum, p) => sum + p.widthPercent, 0)
    const totalGap = totalWidth - totalTableWidths
    const gapBetween = totalGap / (sorted.length - 1)

    // Position each table
    let currentX = leftmost.pos.x
    const updates = sorted.map((p) => {
      const newX = currentX
      currentX += p.widthPercent + gapBetween
      return {
        sectionId: p.sectionId,
        tableIndex: p.tableIndex,
        changes: { x: newX }
      }
    })

    batchUpdatePositions(updates)
  }

  // Distribute tables evenly vertically
  const handleDistributeVertical = () => {
    const positions = getSelectedPositions()
    if (positions.length < 3) return // Need at least 3 items to distribute

    // Get container dimensions to convert pixel heights to percentages
    const rect = canvasContainerRef.current?.getBoundingClientRect()
    const containerHeight = rect?.height || 650

    // Convert positions with pixel heights to percentage heights
    const positionsWithPercent = positions.map(p => ({
      ...p,
      heightPercent: (p.pos.height / containerHeight) * 100
    }))

    // Sort by y position
    const sorted = [...positionsWithPercent].sort((a, b) => a.pos.y - b.pos.y)

    // Get topmost and bottommost positions
    const topmost = sorted[0]
    const bottommost = sorted[sorted.length - 1]

    // Calculate total space and spacing (all in percentages)
    const totalHeight = (bottommost.pos.y + bottommost.heightPercent) - topmost.pos.y
    const totalTableHeights = sorted.reduce((sum, p) => sum + p.heightPercent, 0)
    const totalGap = totalHeight - totalTableHeights
    const gapBetween = totalGap / (sorted.length - 1)

    // Position each table
    let currentY = topmost.pos.y
    const updates = sorted.map((p) => {
      const newY = currentY
      currentY += p.heightPercent + gapBetween
      return {
        sectionId: p.sectionId,
        tableIndex: p.tableIndex,
        changes: { y: newY }
      }
    })

    batchUpdatePositions(updates)
  }

  // Handle zoom change - keep centered
  const handleZoomChange = (newZoom: number) => {
    setZoom(newZoom)
    // Reset pan when zooming back to 100%
    if (newZoom <= 1) {
      setPan({ x: 0, y: 0 })
    }
  }

  // Handle canvas panning
  useEffect(() => {
    const handlePanMove = (e: MouseEvent) => {
      if (!isPanning) return
      const deltaX = e.clientX - panStart.x
      const deltaY = e.clientY - panStart.y
      setPan({
        x: panStart.panX + deltaX,
        y: panStart.panY + deltaY,
      })
    }

    const handlePanEnd = () => {
      setIsPanning(false)
    }

    if (isPanning) {
      window.addEventListener('mousemove', handlePanMove)
      window.addEventListener('mouseup', handlePanEnd)
    }

    return () => {
      window.removeEventListener('mousemove', handlePanMove)
      window.removeEventListener('mouseup', handlePanEnd)
    }
  }, [isPanning, panStart])

  // Start panning when clicking on canvas background
  const handleCanvasPanStart = (e: React.MouseEvent) => {
    // Only pan if zoomed in and clicking directly on the container or image
    if (zoom <= 1) return
    const target = e.target as HTMLElement
    if (target.closest('[data-table]')) return

    setIsPanning(true)
    setPanStart({
      x: e.clientX,
      y: e.clientY,
      panX: pan.x,
      panY: pan.y,
    })
  }

  // Convert mouse event to canvas percentage coordinates
  const getCanvasCoords = (e: React.MouseEvent): { x: number; y: number } | null => {
    if (!canvasContainerRef.current) return null
    const rect = canvasContainerRef.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    return { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) }
  }

  // Handle canvas mouse down for drawing (both boundary and line)
  const handleCanvasDrawMouseDown = (e: React.MouseEvent) => {
    if (drawingMode === 'none') return
    const coords = getCanvasCoords(e)
    if (!coords) return

    if (drawingMode === 'boundary') {
      if (drawnLayout?.boundary) return // Already have a boundary
      setDrawingBoundary({ startX: coords.x, startY: coords.y, currentX: coords.x, currentY: coords.y })
    } else if (drawingMode === 'line') {
      // If continuing from a pen tool click (drawingLine already has x1,y1 set), use those as start
      if (drawingLine && drawingLine.x1 !== undefined && drawingLine.y1 !== undefined) {
        // Continue from existing start point (pen tool)
        setDrawingLine({ x1: drawingLine.x1, y1: drawingLine.y1, x2: coords.x, y2: coords.y })
      } else {
        // Start new line from click position
        setDrawingLine({ x1: coords.x, y1: coords.y, x2: coords.x, y2: coords.y })
      }
    }
  }

  // Handle drawing mouse move and element dragging
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!canvasContainerRef.current) return
      const rect = canvasContainerRef.current.getBoundingClientRect()
      const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100))
      const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100))

      // Handle boundary drawing
      if (drawingBoundary) {
        setDrawingBoundary(prev => prev ? { ...prev, currentX: x, currentY: y } : null)
      }

      // Handle line drawing (with shift for straight lines)
      if (drawingLine) {
        let endX = x
        let endY = y

        // If shift is held, constrain to straight lines (0°, 45°, 90°, 135°, 180°, etc.)
        if (e.shiftKey) {
          const dx = x - drawingLine.x1
          const dy = y - drawingLine.y1
          const distance = Math.sqrt(dx * dx + dy * dy)
          const angle = Math.atan2(dy, dx)
          // Snap to nearest 45° angle
          const snappedAngle = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4)
          endX = drawingLine.x1 + distance * Math.cos(snappedAngle)
          endY = drawingLine.y1 + distance * Math.sin(snappedAngle)
        }

        setDrawingLine(prev => prev ? { ...prev, x2: endX, y2: endY } : null)
      }

      // Handle element dragging
      if (draggingElement) {
        const deltaX = x - draggingElement.startX
        const deltaY = y - draggingElement.startY

        if (draggingElement.type === 'boundary') {
          const orig = draggingElement.originalData as VenueBoundary
          const newX = Math.max(0, Math.min(100 - orig.width, orig.x + deltaX))
          const newY = Math.max(0, Math.min(100 - orig.height, orig.y + deltaY))
          updateBoundary({ ...orig, x: newX, y: newY })
        } else if (draggingElement.type === 'line' && draggingElement.id) {
          // Move all lines in the path together
          if (draggingElement.pathLines && draggingElement.pathLines.length > 1) {
            const updates = draggingElement.pathLines.map(orig => ({
              id: orig.id,
              changes: {
                x1: Math.max(0, Math.min(100, orig.x1 + deltaX)),
                y1: Math.max(0, Math.min(100, orig.y1 + deltaY)),
                x2: Math.max(0, Math.min(100, orig.x2 + deltaX)),
                y2: Math.max(0, Math.min(100, orig.y2 + deltaY)),
              }
            }))
            updateLines(updates)
          } else {
            const orig = draggingElement.originalData as VenueLine
            const newX1 = Math.max(0, Math.min(100, orig.x1 + deltaX))
            const newY1 = Math.max(0, Math.min(100, orig.y1 + deltaY))
            const newX2 = Math.max(0, Math.min(100, orig.x2 + deltaX))
            const newY2 = Math.max(0, Math.min(100, orig.y2 + deltaY))
            updateLine(draggingElement.id, { x1: newX1, y1: newY1, x2: newX2, y2: newY2 })
          }
        }
      }

      // Handle boundary resizing
      if (resizingBoundary && drawnLayout?.boundary) {
        const deltaX = x - resizingBoundary.startX
        const deltaY = y - resizingBoundary.startY
        const orig = resizingBoundary.original
        let newBoundary = { ...orig }

        switch (resizingBoundary.handle) {
          case 'nw':
            newBoundary.x = Math.min(orig.x + orig.width - 5, orig.x + deltaX)
            newBoundary.y = Math.min(orig.y + orig.height - 5, orig.y + deltaY)
            newBoundary.width = orig.width - (newBoundary.x - orig.x)
            newBoundary.height = orig.height - (newBoundary.y - orig.y)
            break
          case 'ne':
            newBoundary.y = Math.min(orig.y + orig.height - 5, orig.y + deltaY)
            newBoundary.width = Math.max(5, orig.width + deltaX)
            newBoundary.height = orig.height - (newBoundary.y - orig.y)
            break
          case 'sw':
            newBoundary.x = Math.min(orig.x + orig.width - 5, orig.x + deltaX)
            newBoundary.width = orig.width - (newBoundary.x - orig.x)
            newBoundary.height = Math.max(5, orig.height + deltaY)
            break
          case 'se':
            newBoundary.width = Math.max(5, orig.width + deltaX)
            newBoundary.height = Math.max(5, orig.height + deltaY)
            break
          case 'n':
            newBoundary.y = Math.min(orig.y + orig.height - 5, orig.y + deltaY)
            newBoundary.height = orig.height - (newBoundary.y - orig.y)
            break
          case 's':
            newBoundary.height = Math.max(5, orig.height + deltaY)
            break
          case 'w':
            newBoundary.x = Math.min(orig.x + orig.width - 5, orig.x + deltaX)
            newBoundary.width = orig.width - (newBoundary.x - orig.x)
            break
          case 'e':
            newBoundary.width = Math.max(5, orig.width + deltaX)
            break
        }
        // Clamp to canvas bounds
        newBoundary.x = Math.max(0, newBoundary.x)
        newBoundary.y = Math.max(0, newBoundary.y)
        newBoundary.width = Math.min(100 - newBoundary.x, newBoundary.width)
        newBoundary.height = Math.min(100 - newBoundary.y, newBoundary.height)
        updateBoundary(newBoundary)
      }

      // Handle line endpoint dragging (with shift for straight lines)
      if (draggingLineEndpoint) {
        const line = drawnLayout?.lines.find(l => l.id === draggingLineEndpoint.lineId)
        if (line) {
          // Check if we've moved significantly (more than 2% from start)
          const distMoved = Math.sqrt(
            Math.pow(x - draggingLineEndpoint.startX, 2) +
            Math.pow(y - draggingLineEndpoint.startY, 2)
          )

          if (distMoved > 2) {
            // Mark as moved and clear pending new line
            if (!draggingLineEndpoint.hasMoved) {
              setDraggingLineEndpoint({ ...draggingLineEndpoint, hasMoved: true })
              setPendingNewLineFromEndpoint(null)
            }

            let newX = x
            let newY = y

            // If shift is held, constrain to straight lines from the other endpoint
            if (e.shiftKey) {
              const anchorX = draggingLineEndpoint.endpoint === 'start' ? line.x2 : line.x1
              const anchorY = draggingLineEndpoint.endpoint === 'start' ? line.y2 : line.y1
              const dx = x - anchorX
              const dy = y - anchorY
              const distance = Math.sqrt(dx * dx + dy * dy)
              const angle = Math.atan2(dy, dx)
              // Snap to nearest 45° angle
              const snappedAngle = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4)
              newX = anchorX + distance * Math.cos(snappedAngle)
              newY = anchorY + distance * Math.sin(snappedAngle)
            }

            if (draggingLineEndpoint.endpoint === 'start') {
              updateLine(draggingLineEndpoint.lineId, { x1: newX, y1: newY })
            } else {
              updateLine(draggingLineEndpoint.lineId, { x2: newX, y2: newY })
            }
          }
        }
      }
    }

    const handleMouseUp = () => {
      // Finish boundary drawing
      if (drawingBoundary) {
        const minX = Math.min(drawingBoundary.startX, drawingBoundary.currentX)
        const minY = Math.min(drawingBoundary.startY, drawingBoundary.currentY)
        const width = Math.abs(drawingBoundary.currentX - drawingBoundary.startX)
        const height = Math.abs(drawingBoundary.currentY - drawingBoundary.startY)

        if (width > 2 && height > 2) {
          updateBoundary({ x: minX, y: minY, width, height })
        }
        setDrawingBoundary(null)
        setDrawingMode('none')
      }

      // Finish line drawing
      if (drawingLine && drawingLine.x2 !== undefined && drawingLine.y2 !== undefined) {
        const length = Math.sqrt(
          Math.pow(drawingLine.x2 - drawingLine.x1, 2) +
          Math.pow(drawingLine.y2 - drawingLine.y1, 2)
        )
        // Only create line if it has some length
        if (length > 1) {
          const newLine: VenueLine = {
            id: crypto.randomUUID(),
            x1: drawingLine.x1,
            y1: drawingLine.y1,
            x2: drawingLine.x2,
            y2: drawingLine.y2,
            pathId: drawingLine.pathId, // Inherit pathId if continuing from another line
          }
          addLine(newLine)
        }
        setDrawingLine(null)
        setDrawingMode('none') // Turn off line mode after creating a line
      }

      // Check if we clicked on an endpoint without dragging - start a new line from there (pen tool behavior)
      if (draggingLineEndpoint && !draggingLineEndpoint.hasMoved && pendingNewLineFromEndpoint) {
        // Get or create pathId for the connected shape
        const sourceLine = drawnLayout?.lines.find(l => l.id === pendingNewLineFromEndpoint.sourceLineId)
        const pathId = sourceLine?.pathId || pendingNewLineFromEndpoint.sourcePathId || crypto.randomUUID()

        // If source line doesn't have a pathId yet, update it
        if (sourceLine && !sourceLine.pathId) {
          updateLine(sourceLine.id, { pathId })
        }

        // Start drawing a new line from the endpoint position with the same pathId
        setDrawingLine({
          x1: pendingNewLineFromEndpoint.x,
          y1: pendingNewLineFromEndpoint.y,
          pathId,
        })
        setDrawingMode('line')
        setSelectedElement(null)
        setPendingNewLineFromEndpoint(null)
        setDraggingLineEndpoint(null)
        return
      }

      setDraggingElement(null)
      setResizingBoundary(null)
      setDraggingLineEndpoint(null)
      setPendingNewLineFromEndpoint(null)
    }

    if (drawingBoundary || drawingLine || draggingElement || resizingBoundary || draggingLineEndpoint) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [drawingBoundary, drawingLine, draggingElement, resizingBoundary, draggingLineEndpoint, drawnLayout, updateBoundary, updateLine, updateLines, pendingNewLineFromEndpoint])

  // Check if we're in draw mode (no image uploaded)
  const isDrawMode = !layoutUrl

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-base">Layout Editor</Label>
        <div className="flex items-center gap-4">
          {/* Font Size Controls */}
          <div className="flex items-center gap-1">
            <Type className="h-4 w-4 text-muted-foreground" />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onFontSizeChange(Math.max(6, fontSize - 2))}
            >
              <Minus className="h-3 w-3" />
            </Button>
            <span className="text-sm text-muted-foreground w-10 text-center">{fontSize}px</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onFontSizeChange(Math.min(24, fontSize + 2))}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>

      <div className="flex gap-4">
        {/* Table Palette - Left Side */}
        <div className="w-48 flex-shrink-0 flex flex-col" style={{ height: '650px' }}>
          <div className="flex-1 border rounded-lg p-3 bg-muted/50 overflow-y-auto">
            <p className="text-xs font-medium text-muted-foreground mb-3">Drag tables onto layout</p>
          {sections.map((section, sectionIndex) => {
            const unplacedTables = Array.from({ length: section.tableCount })
              .map((_, i) => i)
              .filter(i => !isTablePlaced(section, i))

            if (unplacedTables.length === 0) return null

            return (
              <div key={section.id} className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: getSectionColor(sectionIndex) }}
                  />
                  <span className="text-xs font-medium truncate flex-1">
                    {section.name || `Section ${sectionIndex + 1}`}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {Array.from({ length: section.tableCount }).filter((_, i) => isTablePlaced(section, i)).length}/{section.tableCount}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {unplacedTables.map((tableIndex) => {
                    const tableName = section.tableNames?.[tableIndex] || `${tableIndex + 1}`
                    return (
                      <div
                        key={tableIndex}
                        className="w-12 h-12 bg-white border-2 border-gray-300 rounded flex items-center justify-center cursor-grab font-bold text-gray-700 hover:border-primary hover:shadow-md transition-all select-none text-xs"
                        onMouseDown={(e) => handlePaletteMouseDown(e, section.id, tableIndex)}
                      >
                        {tableName}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
          </div>

          {/* Save Button - aligned with bottom of canvas */}
          {onSave && (
            <Button onClick={onSave} disabled={saving || !hasChanges} className="mt-3 w-full">
              {saving ? 'Saving...' : 'Save Settings'}
            </Button>
          )}
        </div>

        {/* Layout Canvas */}
        <div
          ref={outerContainerRef}
          className="flex-1 relative border rounded-lg overflow-hidden bg-neutral-900 flex items-center justify-center"
          style={{
            height: '650px',
            cursor: drawingMode === 'boundary' ? 'crosshair' :
                   drawingMode === 'line' ? 'crosshair' :
                   copyStyleMode ? 'crosshair' :
                   (zoom > 1 ? (isPanning ? 'grabbing' : 'grab') : 'default'),
          }}
          onClick={(e) => {
            // Don't deselect if we just selected a table or were panning or drawing
            if (justSelectedRef.current || isPanning || drawingMode !== 'none') return
            setSelectedTables([])
            setSelectedLineIds([])
            setSelectedElement(null)
            setCopyStyleMode(false)
          }}
          onMouseDown={(e) => {
            if (drawingMode !== 'none') {
              handleCanvasDrawMouseDown(e)
            } else {
              handleCanvasPanStart(e)
            }
          }}
        >
          {/* Drawing Toolbar - Only show in draw mode */}
          {isDrawMode && (
            <div className="absolute top-3 left-3 z-50 flex items-center gap-1 bg-background/90 backdrop-blur-sm rounded-md border p-1 shadow-sm">
              <Button
                type="button"
                variant={drawingMode === 'boundary' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-8 px-3"
                onClick={(e) => {
                  e.stopPropagation()
                  if (drawnLayout?.boundary) {
                    // Already have a boundary, select it instead
                    setSelectedElement({ type: 'boundary' })
                    setDrawingMode('none')
                  } else {
                    setDrawingMode(drawingMode === 'boundary' ? 'none' : 'boundary')
                  }
                }}
                disabled={!!drawnLayout?.boundary}
                title={drawnLayout?.boundary ? 'Boundary already exists' : 'Draw venue boundary'}
              >
                <RectangleHorizontal className="h-4 w-4 mr-1" />
                Boundary
              </Button>
              <Button
                type="button"
                variant={drawingMode === 'line' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-8 px-3"
                onClick={(e) => {
                  e.stopPropagation()
                  setDrawingMode(drawingMode === 'line' ? 'none' : 'line')
                  setDrawingLine(null)
                }}
                title="Draw room divider line"
              >
                <LineIcon className="h-4 w-4 mr-1" />
                Line
              </Button>
              {selectedElement && (
                <>
                  {/* Center button - only show if not locked */}
                  {!isSelectedLocked && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 px-3"
                      onClick={(e) => {
                        e.stopPropagation()
                        centerSelectedElement()
                      }}
                      title="Center element in frame"
                    >
                      <Crosshair className="h-4 w-4 mr-1" />
                      Center
                    </Button>
                  )}
                  {/* Lock/Unlock button for selected element */}
                  <Button
                    type="button"
                    variant={isSelectedLocked ? 'secondary' : 'ghost'}
                    size="sm"
                    className="h-8 px-3"
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleSelectedLock()
                    }}
                    title={isSelectedLocked ? 'Unlock this element' : 'Lock this element'}
                  >
                    {isSelectedLocked ? (
                      <>
                        <Lock className="h-4 w-4 mr-1" />
                        Unlock
                      </>
                    ) : (
                      <>
                        <Unlock className="h-4 w-4 mr-1" />
                        Lock
                      </>
                    )}
                  </Button>
                  {/* Delete button - only show if not locked */}
                  {!isSelectedLocked && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 px-3 text-destructive hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteSelectedElement()
                      }}
                      title="Delete selected element"
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete
                    </Button>
                  )}
                </>
              )}
              {drawingMode !== 'none' && (
                <span className="text-xs text-muted-foreground px-2">
                  {drawingMode === 'boundary' ? 'Click and drag to draw boundary' :
                   'Click and drag to draw line (hold Shift for straight)'}
                </span>
              )}
            </div>
          )}
          {imageAspectRatio ? (
          <div
            ref={containerRef}
            className="relative"
            style={{
              // Container maintains image aspect ratio and fills available space
              width: '100%',
              height: '100%',
              maxWidth: `calc(650px * ${imageAspectRatio})`,
              maxHeight: '650px',
              aspectRatio: `${imageAspectRatio}`,
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: 'center center',
            }}
          >
            {/* Canvas container that matches image dimensions exactly */}
            <div
              ref={canvasContainerRef}
              className="absolute inset-0"
            >
            {/* Venue Image or Draw Canvas Background */}
            {layoutUrl ? (
              <Image
                src={layoutUrl}
                alt="Venue layout"
                fill
                className="object-fill"
                draggable={false}
              />
            ) : null}

            {/* Drawn Boundary */}
            {drawnLayout?.boundary && (
              <div
                className={`absolute border-2 ${
                  selectedElement?.type === 'boundary' ? 'border-blue-500' : drawnLayout.boundary.locked ? 'border-white/40' : 'border-white/60'
                } bg-transparent ${
                  drawingLine || drawingBoundary
                    ? 'pointer-events-none'
                    : drawnLayout.boundary.locked
                      ? 'cursor-default'
                      : 'cursor-move'
                }`}
                style={{
                  left: `${drawnLayout.boundary.x}%`,
                  top: `${drawnLayout.boundary.y}%`,
                  width: `${drawnLayout.boundary.width}%`,
                  height: `${drawnLayout.boundary.height}%`,
                }}
                onClick={(e) => {
                  e.stopPropagation()
                  setSelectedElement({ type: 'boundary' })
                  setDrawingMode('none')
                }}
                onMouseDown={(e) => {
                  if (drawnLayout.boundary?.locked) return
                  if (drawingMode !== 'none') return
                  e.stopPropagation()
                  const coords = getCanvasCoords(e)
                  if (!coords || !drawnLayout.boundary) return
                  setDraggingElement({
                    type: 'boundary',
                    startX: coords.x,
                    startY: coords.y,
                    originalData: drawnLayout.boundary,
                  })
                  setSelectedElement({ type: 'boundary' })
                }}
              >
                {/* Lock icon indicator */}
                {drawnLayout.boundary.locked && (
                  <div className="absolute top-1 right-1">
                    <Lock className="h-3 w-3 text-white/60" />
                  </div>
                )}
                {/* Resize handles for boundary */}
                {selectedElement?.type === 'boundary' && !drawnLayout.boundary.locked && (
                  <>
                    {['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map((handle) => {
                      const handleSize = 12 / zoom
                      const handleOffset = -handleSize / 2
                      return (
                        <div
                          key={handle}
                          className="absolute bg-blue-500 border border-white rounded-sm"
                          style={{
                            width: `${handleSize}px`,
                            height: `${handleSize}px`,
                            cursor: handle === 'n' || handle === 's' ? 'ns-resize' :
                                    handle === 'e' || handle === 'w' ? 'ew-resize' :
                                    handle === 'nw' || handle === 'se' ? 'nwse-resize' : 'nesw-resize',
                            ...(handle.includes('n') ? { top: `${handleOffset}px` } : {}),
                            ...(handle.includes('s') ? { bottom: `${handleOffset}px` } : {}),
                            ...(handle.includes('w') ? { left: `${handleOffset}px` } : {}),
                            ...(handle.includes('e') ? { right: `${handleOffset}px` } : {}),
                            ...(handle === 'n' || handle === 's' ? { left: '50%', transform: 'translateX(-50%)' } : {}),
                            ...(handle === 'e' || handle === 'w' ? { top: '50%', transform: 'translateY(-50%)' } : {}),
                          }}
                          onMouseDown={(e) => {
                            e.stopPropagation()
                            const coords = getCanvasCoords(e)
                            if (!coords || !drawnLayout.boundary) return
                            setResizingBoundary({
                              handle,
                              startX: coords.x,
                              startY: coords.y,
                              original: drawnLayout.boundary,
                            })
                          }}
                        />
                      )
                    })}
                  </>
                )}
              </div>
            )}

            {/* Drawing Boundary Preview */}
            {drawingBoundary && (
              <div
                className="absolute border-2 border-dashed border-blue-400 bg-blue-400/10 pointer-events-none"
                style={{
                  left: `${Math.min(drawingBoundary.startX, drawingBoundary.currentX)}%`,
                  top: `${Math.min(drawingBoundary.startY, drawingBoundary.currentY)}%`,
                  width: `${Math.abs(drawingBoundary.currentX - drawingBoundary.startX)}%`,
                  height: `${Math.abs(drawingBoundary.currentY - drawingBoundary.startY)}%`,
                }}
              />
            )}

            {/* Drawn Lines - rendered with SVG for accurate positioning */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none">
              {drawnLayout?.lines.map((line) => {
                // Check if line is selected (supports multi-selection)
                const isSelected = isLineSelected(line.id, line.pathId)
                const isLineLocked = line.locked
                return (
                  <line
                    key={line.id}
                    x1={`${line.x1}%`}
                    y1={`${line.y1}%`}
                    x2={`${line.x2}%`}
                    y2={`${line.y2}%`}
                    stroke={isSelected ? '#3b82f6' : isLineLocked ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.6)'}
                    strokeWidth="2"
                    className={drawingLine || drawingBoundary ? 'pointer-events-none' : 'pointer-events-auto'}
                    style={{ cursor: isLineLocked ? 'default' : 'move' }}
                    onClick={(e) => {
                      e.stopPropagation()
                      // Handle shift+click for multi-selection
                      if (e.shiftKey) {
                        const alreadySelected = selectedLineIds.includes(line.id)
                        if (alreadySelected) {
                          // Remove from selection
                          setSelectedLineIds(prev => prev.filter(id => id !== line.id))
                        } else {
                          // Add to selection (include connected path lines)
                          const linesToAdd = line.pathId
                            ? drawnLayout?.lines.filter(l => l.pathId === line.pathId).map(l => l.id) || [line.id]
                            : [line.id]
                          setSelectedLineIds(prev => [...new Set([...prev, ...linesToAdd])])
                        }
                      } else {
                        // Single selection - clear multi-selection
                        setSelectedLineIds([])
                        setSelectedElement({ type: 'line', id: line.id, pathId: line.pathId })
                      }
                      setDrawingMode('none')
                    }}
                    onMouseDown={(e) => {
                      if (isLineLocked) return
                      if (drawingMode !== 'none') return
                      e.stopPropagation()
                      const coords = getCanvasCoords(e as unknown as React.MouseEvent)
                      if (!coords) return

                      // Get lines to move: multi-selected lines, or path lines, or single line
                      let linesToMove: VenueLine[]
                      if (selectedLineIds.length > 0 && selectedLineIds.includes(line.id)) {
                        // Moving multi-selected lines
                        linesToMove = drawnLayout?.lines.filter(l => selectedLineIds.includes(l.id)) || [line]
                      } else if (line.pathId) {
                        // Moving connected path
                        linesToMove = drawnLayout?.lines.filter(l => l.pathId === line.pathId) || [line]
                      } else {
                        linesToMove = [line]
                      }

                      setDraggingElement({
                        type: 'line',
                        id: line.id,
                        startX: coords.x,
                        startY: coords.y,
                        originalData: line,
                        pathLines: linesToMove.map(l => ({ ...l })), // Clone to preserve original positions
                      })

                      // Only update selection if not already selected
                      if (!isSelected) {
                        setSelectedLineIds([])
                        setSelectedElement({ type: 'line', id: line.id, pathId: line.pathId })
                      }
                    }}
                  />
                )
              })}
            </svg>

            {/* Line UI overlays (lock icons, endpoint handles) */}
            {drawnLayout?.lines.map((line) => {
              // Check if line is selected (supports multi-selection)
              const isSelected = isLineSelected(line.id, line.pathId)
              const isLineLocked = line.locked

              return (
                <div key={`line-ui-${line.id}`}>
                  {/* Lock icon for locked lines */}
                  {isLineLocked && (
                    <div
                      className="absolute pointer-events-none"
                      style={{
                        left: `${(line.x1 + line.x2) / 2}%`,
                        top: `${(line.y1 + line.y2) / 2}%`,
                        transform: 'translate(-50%, -50%)',
                      }}
                    >
                      <Lock className="h-3 w-3 text-white/60" />
                    </div>
                  )}
                  {/* Endpoint handles - positioned using CSS absolute positioning for precise alignment */}
                  {isSelected && !isLineLocked && (
                    <>
                      {/* Start endpoint */}
                      <div
                        className="absolute bg-blue-500 border border-white rounded-full cursor-crosshair"
                        style={{
                          left: `${line.x1}%`,
                          top: `${line.y1}%`,
                          width: `${12 / zoom}px`,
                          height: `${12 / zoom}px`,
                          transform: 'translate(-50%, -50%)',
                          zIndex: 50,
                        }}
                        onMouseDown={(e) => {
                          e.stopPropagation()
                          const coords = getCanvasCoords(e)
                          if (!coords) return
                          // Set pending new line position (pen tool - click to extend)
                          setPendingNewLineFromEndpoint({ x: line.x1, y: line.y1, sourceLineId: line.id, sourcePathId: line.pathId })
                          setDraggingLineEndpoint({
                            lineId: line.id,
                            endpoint: 'start',
                            startX: coords.x,
                            startY: coords.y,
                            hasMoved: false,
                          })
                        }}
                      />
                      {/* End endpoint */}
                      <div
                        className="absolute bg-blue-500 border border-white rounded-full cursor-crosshair"
                        style={{
                          left: `${line.x2}%`,
                          top: `${line.y2}%`,
                          width: `${12 / zoom}px`,
                          height: `${12 / zoom}px`,
                          transform: 'translate(-50%, -50%)',
                          zIndex: 50,
                        }}
                        onMouseDown={(e) => {
                          e.stopPropagation()
                          const coords = getCanvasCoords(e)
                          if (!coords) return
                          // Set pending new line position (pen tool - click to extend)
                          setPendingNewLineFromEndpoint({ x: line.x2, y: line.y2, sourceLineId: line.id, sourcePathId: line.pathId })
                          setDraggingLineEndpoint({
                            lineId: line.id,
                            endpoint: 'end',
                            startX: coords.x,
                            startY: coords.y,
                            hasMoved: false,
                          })
                        }}
                      />
                    </>
                  )}
                </div>
              )
            })}

            {/* Drawing Line Preview */}
            {drawingLine && drawingLine.x2 !== undefined && drawingLine.y2 !== undefined && (
              <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ overflow: 'visible' }}>
                <line
                  x1={`${drawingLine.x1}%`}
                  y1={`${drawingLine.y1}%`}
                  x2={`${drawingLine.x2}%`}
                  y2={`${drawingLine.y2}%`}
                  stroke="#60a5fa"
                  strokeWidth="2"
                  strokeDasharray="4 4"
                />
              </svg>
            )}

            {/* Pen Tool Start Point Indicator - shows when waiting to draw from endpoint */}
            {drawingLine && drawingLine.x2 === undefined && drawingMode === 'line' && (
              <div
                className="absolute pointer-events-none"
                style={{
                  left: `${drawingLine.x1}%`,
                  top: `${drawingLine.y1}%`,
                  transform: 'translate(-50%, -50%)',
                  zIndex: 60,
                }}
              >
                {/* Outer pulsing ring */}
                <div
                  className="absolute rounded-full animate-pulse"
                  style={{
                    width: `${16 / zoom}px`,
                    height: `${16 / zoom}px`,
                    border: `${2 / zoom}px solid #60a5fa`,
                    transform: 'translate(-50%, -50%)',
                    left: '50%',
                    top: '50%',
                  }}
                />
                {/* Inner dot */}
                <div
                  className="absolute rounded-full bg-blue-400"
                  style={{
                    width: `${6 / zoom}px`,
                    height: `${6 / zoom}px`,
                    transform: 'translate(-50%, -50%)',
                    left: '50%',
                    top: '50%',
                  }}
                />
              </div>
            )}

            {/* Placed Table Markers */}
            {sections.map((section, sectionIndex) => (
              Array.from({ length: section.tableCount }).map((_, tableIndex) => {
                const pos = getTablePosition(section, tableIndex)

                // Check if this table is being dragged
                const isDragging = dragState?.sectionId === section.id && dragState?.tableIndex === tableIndex

                // Check if this table is part of a multi-drag
                const multiDragPos = multiDragPositions.find(
                  p => p.sectionId === section.id && p.tableIndex === tableIndex
                )
                const isPartOfMultiDrag = dragState?.isMultiDrag && multiDragPos

                // For palette drags, show table at drag position even if not placed yet
                if (!pos && !isDragging) return null
                if (!pos && isDragging && !dragPosition) return null

                // Use drag position if dragging, otherwise use stored position
                let displayX = pos?.x ?? 0
                let displayY = pos?.y ?? 0
                if (isDragging && dragPosition) {
                  displayX = dragPosition.x
                  displayY = dragPosition.y
                } else if (isPartOfMultiDrag) {
                  displayX = multiDragPos.x
                  displayY = multiDragPos.y
                }
                // Table dimensions stored as pixels, default 48px (same as palette)
                const tableWidthPx = pos?.width ?? 48
                const tableHeightPx = pos?.height ?? 48
                const displayShape = pos?.shape ?? 'square'

                const isSelected = isTableSelected(section.id, tableIndex)
                const isFirstSelected = selectedTable?.sectionId === section.id && selectedTable?.tableIndex === tableIndex
                const tableName = section.tableNames?.[tableIndex] || `${tableIndex + 1}`

                // Use tracked canvas size for percentage calculation
                const containerWidth = canvasSize.width || 900
                const containerHeight = canvasSize.height || 650

                // Table sizes are stored in pixels - use them directly
                // The container has transform: scale(zoom) so tables will scale automatically
                // Using percentages for position but pixels for size maintains table aspect ratio

                return (
                  <div
                    key={`${section.id}-${tableIndex}`}
                    data-table="true"
                    className={`absolute cursor-move flex items-center justify-center text-gray-700 font-bold select-none ${
                      isSelected ? 'z-20' : ''
                    }`}
                    style={{
                      left: `${displayX}%`,
                      top: `${displayY}%`,
                      width: `${tableWidthPx}px`,
                      height: `${tableHeightPx}px`,
                      fontSize: `${fontSize}px`,
                      backgroundColor: 'white',
                      border: isSelected ? '1.5px solid #3b82f6' : '2px solid #d1d5db',
                      borderRadius: displayShape === 'circle' ? '50%' : '4px',
                      boxShadow: isSelected ? '0 0 0 3px rgba(59, 130, 246, 0.3), 0 2px 4px rgba(0,0,0,0.2)' : '0 2px 4px rgba(0,0,0,0.2)',
                    }}
                    onMouseDown={(e) => handleCanvasMouseDown(e, section.id, tableIndex)}
                  >
                    <span className="truncate px-1">{tableName}</span>

                    {/* Floating edit buttons below selected table */}
                    {isFirstSelected && selectedTables.length === 1 && (
                      <div
                        className="absolute top-full left-1/2 mt-2 inline-flex items-center gap-1 rounded-md border bg-background p-1 shadow-md"
                        style={{ transform: `translateX(-50%) scale(${1/zoom})`, transformOrigin: 'top center' }}
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        {/* Size controls */}
                        <div className="inline-flex -space-x-px rounded-md border">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 rounded-none rounded-l-sm"
                            onClick={handleDecreaseSize}
                            title="Smaller"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 rounded-none rounded-r-sm"
                            onClick={handleIncreaseSize}
                            title="Larger"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        {/* Width controls */}
                        <div className="inline-flex -space-x-px rounded-md border">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 rounded-none rounded-l-sm"
                            onClick={handleDecreaseWidth}
                            title="Narrower"
                          >
                            <ArrowLeftToLine className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 rounded-none rounded-r-sm"
                            onClick={handleIncreaseWidth}
                            title="Wider"
                          >
                            <ArrowRightToLine className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        {/* Height controls */}
                        <div className="inline-flex -space-x-px rounded-md border">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 rounded-none rounded-l-sm"
                            onClick={handleDecreaseHeight}
                            title="Shorter"
                          >
                            <ArrowUpToLine className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 rounded-none rounded-r-sm"
                            onClick={handleIncreaseHeight}
                            title="Taller"
                          >
                            <ArrowDownToLine className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        {/* Shape controls */}
                        <div className="inline-flex -space-x-px rounded-md border">
                          <Button
                            type="button"
                            variant={displayShape === 'circle' ? 'secondary' : 'ghost'}
                            size="icon"
                            className="h-7 w-7 rounded-none rounded-l-sm"
                            onClick={() => handleShapeChange('circle')}
                            title="Circle/Oval"
                          >
                            <Circle className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant={displayShape === 'square' ? 'secondary' : 'ghost'}
                            size="icon"
                            className="h-7 w-7 rounded-none rounded-r-sm"
                            onClick={() => handleShapeChange('square')}
                            title="Square/Rectangle"
                          >
                            <Square className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        {/* Copy style button */}
                        <Button
                          type="button"
                          variant={copyStyleMode ? 'secondary' : 'ghost'}
                          size="icon"
                          className="h-7 w-7 rounded-md border"
                          onClick={() => setCopyStyleMode(!copyStyleMode)}
                          title="Copy style from another table (or Alt+click)"
                        >
                          <Pipette className="h-3.5 w-3.5" />
                        </Button>
                        {/* Remove button */}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 rounded-md border text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={handleRemoveFromCanvas}
                          title="Remove from layout"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}

                    {/* Alignment toolbar for multi-selection (only show on first selected) */}
                    {isFirstSelected && selectedTables.length > 1 && (
                      <div
                        className="absolute top-full left-1/2 mt-2 inline-flex items-center gap-1 rounded-md border bg-background p-1 shadow-md"
                        style={{ transform: `translateX(-50%) scale(${1/zoom})`, transformOrigin: 'top center' }}
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        {/* Horizontal alignment */}
                        <div className="inline-flex -space-x-px rounded-md border">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 rounded-none rounded-l-sm"
                            onClick={handleAlignLeft}
                            title="Align left"
                          >
                            <AlignStartVertical className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 rounded-none"
                            onClick={handleAlignCenterH}
                            title="Align center horizontally"
                          >
                            <AlignCenterVertical className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 rounded-none rounded-r-sm"
                            onClick={handleAlignRight}
                            title="Align right"
                          >
                            <AlignEndVertical className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        {/* Vertical alignment */}
                        <div className="inline-flex -space-x-px rounded-md border">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 rounded-none rounded-l-sm"
                            onClick={handleAlignTop}
                            title="Align top"
                          >
                            <AlignStartHorizontal className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 rounded-none"
                            onClick={handleAlignCenterV}
                            title="Align center vertically"
                          >
                            <AlignCenterHorizontal className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 rounded-none rounded-r-sm"
                            onClick={handleAlignBottom}
                            title="Align bottom"
                          >
                            <AlignEndHorizontal className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        {/* Distribute evenly (only enabled with 3+ selections) */}
                        {selectedTables.length >= 3 && (
                          <div className="inline-flex -space-x-px rounded-md border">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 rounded-none rounded-l-sm"
                              onClick={handleDistributeHorizontal}
                              title="Distribute horizontally"
                            >
                              <AlignHorizontalSpaceAround className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 rounded-none rounded-r-sm"
                              onClick={handleDistributeVertical}
                              title="Distribute vertically"
                            >
                              <AlignVerticalSpaceAround className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                        {/* Copy style button */}
                        <Button
                          type="button"
                          variant={copyStyleMode ? 'secondary' : 'ghost'}
                          size="icon"
                          className="h-7 w-7 rounded-md border"
                          onClick={() => setCopyStyleMode(!copyStyleMode)}
                          title="Copy style from another table (or Alt+click)"
                        >
                          <Pipette className="h-3.5 w-3.5" />
                        </Button>
                        <span className="text-xs text-muted-foreground px-1 whitespace-nowrap">{selectedTables.length} selected</span>
                      </div>
                    )}
                  </div>
                )
              })
            ))}

            {/* Snap Guide Lines - rendered after tables so they appear on top */}
            {snapGuides.map((guide, index) => (
              <div
                key={`guide-${index}`}
                className="absolute pointer-events-none"
                style={guide.type === 'vertical' ? {
                  left: `${guide.position}%`,
                  top: `${guide.start}%`,
                  width: '0.5px',
                  height: `${guide.end - guide.start}%`,
                  backgroundColor: '#ef4444',
                  zIndex: 100,
                } : {
                  left: `${guide.start}%`,
                  top: `${guide.position}%`,
                  width: `${guide.end - guide.start}%`,
                  height: '0.5px',
                  backgroundColor: '#ef4444',
                  zIndex: 100,
                }}
              />
            ))}
            </div>
          </div>
          ) : (
            <div className="text-muted-foreground">Loading layout...</div>
          )}

          {/* Zoom Controls - Bottom Right */}
          <div
            className="absolute bottom-3 right-3 flex items-center gap-1 bg-background/90 backdrop-blur-sm rounded-md border p-1 shadow-sm"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => handleZoomChange(Math.max(0.5, zoom - 0.25))}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground w-12 text-center">{Math.round(zoom * 100)}%</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => handleZoomChange(Math.min(2.5, zoom + 0.25))}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
