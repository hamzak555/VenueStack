'use client'

import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import { TableServiceConfig, TableSection, DrawnVenueLayout, VenueLayout } from '@/lib/types'

export interface TableSectionInfo {
  id: string
  section_id: string
  section_name: string
  price: number
  available_tables: number
  closed_tables?: string[]
  linked_table_pairs?: { table1: { sectionId: string; tableName: string }; table2: { sectionId: string; tableName: string } }[]
}

interface BookedTable {
  section_id: string
  table_number: string
}

interface InteractiveTableMapProps {
  venueLayoutUrl: string | null
  tableServiceConfig: TableServiceConfig
  tableSections: TableSectionInfo[]
  bookedTables?: BookedTable[]
  hoveredSectionId?: string | null
  onHoverChange?: (sectionId: string | null) => void
  showLegend?: boolean
  selectedLayoutId?: string | null
}

export function InteractiveTableMap({
  venueLayoutUrl,
  tableServiceConfig,
  tableSections,
  bookedTables = [],
  hoveredSectionId: externalHoveredSectionId,
  onHoverChange,
  showLegend = false,
  selectedLayoutId: selectedLayoutIdProp,
}: InteractiveTableMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [imageAspectRatio, setImageAspectRatio] = useState<number | null>(null)
  const [internalHoveredSectionId, setInternalHoveredSectionId] = useState<string | null>(null)

  // Use external hover state if provided, otherwise use internal
  const hoveredSectionId = externalHoveredSectionId !== undefined ? externalHoveredSectionId : internalHoveredSectionId
  const setHoveredSectionId = (id: string | null) => {
    if (onHoverChange) {
      onHoverChange(id)
    } else {
      setInternalHoveredSectionId(id)
    }
  }

  const sections = tableServiceConfig?.sections || []
  const layouts = tableServiceConfig?.layouts || []

  // Multi-layout support: determine selected layout
  const selectedLayoutId = selectedLayoutIdProp || layouts[0]?.id || null
  const selectedLayout = layouts.find(l => l.id === selectedLayoutId) || layouts[0] || null
  const currentLayoutUrl = selectedLayout?.imageUrl || venueLayoutUrl
  const currentDrawnLayout = selectedLayout?.drawnLayout || tableServiceConfig?.drawnLayout

  // Check if a table is on the current layout
  const isTableOnCurrentLayout = (section: TableSection, tableIndex: number): boolean => {
    const pos = section.tablePositions?.[tableIndex]
    if (!pos?.placed) return false
    // If no multi-layout support, show all placed tables
    if (!selectedLayoutId || layouts.length === 0) return true
    // Check if table's layoutId matches the selected layout
    return pos.layoutId === selectedLayoutId
  }

  // Create a map of section_id -> section info for quick lookup
  const sectionInfoMap: Record<string, TableSectionInfo> = {}
  for (const section of tableSections) {
    sectionInfoMap[section.section_id] = section
  }

  // Build a set of all linked tables for quick lookup
  const linkedTablesSet = new Set<string>()
  for (const section of tableSections) {
    if (section.linked_table_pairs) {
      for (const pair of section.linked_table_pairs) {
        linkedTablesSet.add(`${pair.table1.sectionId}-${pair.table1.tableName}`)
        linkedTablesSet.add(`${pair.table2.sectionId}-${pair.table2.tableName}`)
      }
    }
  }

  // Check if a table is unavailable (closed, booked, or linked)
  const isTableUnavailable = (sectionId: string, tableName: string): boolean => {
    const sectionInfo = sectionInfoMap[sectionId]

    // Check if closed
    if (sectionInfo?.closed_tables?.includes(tableName)) {
      return true
    }

    // Check if booked
    if (bookedTables.some(b => b.section_id === sectionId && b.table_number === tableName)) {
      return true
    }

    // Check if linked
    if (linkedTablesSet.has(`${sectionId}-${tableName}`)) {
      return true
    }

    return false
  }

  // Calculate actual available tables for a section
  const getActualAvailableTables = (sectionId: string): number => {
    const section = sections.find(s => s.id === sectionId)
    const sectionInfo = sectionInfoMap[sectionId]
    if (!section || !sectionInfo) return 0

    let available = 0
    for (let i = 0; i < section.tableCount; i++) {
      const tableName = section.tableNames?.[i] || `${i + 1}`
      if (!isTableUnavailable(sectionId, tableName)) {
        available++
      }
    }
    return available
  }

  // Load image to get its natural aspect ratio, or use default for drawn layout
  useEffect(() => {
    if (currentLayoutUrl) {
      const img = new window.Image()
      img.onload = () => {
        setImageAspectRatio(img.naturalWidth / img.naturalHeight)
      }
      img.src = currentLayoutUrl
    } else {
      // Default 4:3 aspect ratio for drawn layout mode
      setImageAspectRatio(4 / 3)
    }
  }, [currentLayoutUrl])

  // Get table position from the business config
  const getTablePosition = (section: TableSection, tableIndex: number) => {
    if (section.tablePositions?.[tableIndex]?.placed) {
      return section.tablePositions[tableIndex]
    }
    return null
  }

  // Get the hovered section info
  const hoveredSection = hoveredSectionId ? sections.find(s => s.id === hoveredSectionId) : null
  const hoveredSectionInfo = hoveredSectionId ? sectionInfoMap[hoveredSectionId] : null

  const fontSize = tableServiceConfig?.fontSize ?? 12

  return (
    <div className="relative w-full flex justify-center">
      {imageAspectRatio ? (
        <div
          ref={containerRef}
          className="relative"
          style={{
            width: '100%',
            maxWidth: `calc(650px * ${imageAspectRatio})`,
            maxHeight: '650px',
            aspectRatio: `${imageAspectRatio}`,
          }}
        >
          {/* Venue Image */}
          {currentLayoutUrl && (
            <Image
              src={currentLayoutUrl}
              alt="Venue table layout"
              fill
              className="object-fill"
              draggable={false}
            />
          )}

          {/* Drawn Boundary */}
          {currentDrawnLayout?.boundary && (
            <div
              className="absolute border-2 border-white/60 bg-transparent pointer-events-none"
              style={{
                left: `${currentDrawnLayout.boundary.x}%`,
                top: `${currentDrawnLayout.boundary.y}%`,
                width: `${currentDrawnLayout.boundary.width}%`,
                height: `${currentDrawnLayout.boundary.height}%`,
              }}
            />
          )}

          {/* Drawn Lines */}
          {currentDrawnLayout?.lines.map((line) => {
            const length = Math.sqrt(Math.pow(line.x2 - line.x1, 2) + Math.pow(line.y2 - line.y1, 2))
            const angle = Math.atan2(line.y2 - line.y1, line.x2 - line.x1) * (180 / Math.PI)
            return (
              <div
                key={line.id}
                className="absolute origin-left bg-white/60 pointer-events-none"
                style={{
                  left: `${line.x1}%`,
                  top: `${line.y1}%`,
                  width: `${length}%`,
                  height: '2px',
                  transform: `rotate(${angle}deg)`,
                }}
              />
            )
          })}

          {/* Table Markers - no text, just colored circles/squares */}
          {sections.map((section) => (
            Array.from({ length: section.tableCount }).map((_, tableIndex) => {
              const pos = getTablePosition(section, tableIndex)
              if (!pos) return null

              // Filter by layout - only show tables on current layout
              if (!isTableOnCurrentLayout(section, tableIndex)) return null

              const tableName = section.tableNames?.[tableIndex] || `${tableIndex + 1}`
              const isHovered = hoveredSectionId === section.id
              const sectionColor = section.color || '#3b82f6'
              const unavailable = isTableUnavailable(section.id, tableName)

              // Determine colors based on hover and availability
              let bgColor = '#ffffff'
              let borderColor = '#d1d5db'
              if (isHovered) {
                if (unavailable) {
                  bgColor = '#9ca3af'
                  borderColor = '#6b7280'
                } else {
                  bgColor = sectionColor
                  borderColor = sectionColor
                }
              }

              return (
                <div
                  key={`${section.id}-${tableIndex}`}
                  className={`absolute transition-all ${
                    isHovered ? 'z-20' : 'z-10'
                  }`}
                  style={{
                    left: `${pos.x}%`,
                    top: `${pos.y}%`,
                    width: `${pos.width}px`,
                    height: `${pos.height}px`,
                    backgroundColor: bgColor,
                    border: `2px solid ${borderColor}`,
                    borderRadius: pos.shape === 'circle' ? '50%' : '6px',
                    boxShadow: isHovered
                      ? `0 0 12px ${sectionColor}40, 0 4px 12px rgba(0,0,0,0.2)`
                      : '0 2px 4px rgba(0,0,0,0.1)',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={() => setHoveredSectionId(section.id)}
                  onMouseLeave={() => setHoveredSectionId(null)}
                />
              )
            })
          ))}

          {/* Section Info Tooltip - shows when hovering over any table in the section */}
          {hoveredSection && hoveredSectionInfo && (() => {
            const actualAvailable = getActualAvailableTables(hoveredSection.id)
            return (
              <div
                className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-background/95 backdrop-blur-sm border rounded-xl shadow-xl px-5 py-3 z-30 pointer-events-none"
              >
                <div className="text-center">
                  <p className="font-semibold text-base">{hoveredSectionInfo.section_name}</p>
                  <p className="text-xl font-bold text-primary mt-1">
                    ${hoveredSectionInfo.price.toFixed(2)}
                  </p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {actualAvailable} {actualAvailable === 1 ? 'table' : 'tables'} available
                  </p>
                </div>
              </div>
            )
          })()}

          {/* Legend - only show if showLegend prop is true */}
          {showLegend && (
            <div className="absolute top-3 right-3 bg-background/90 backdrop-blur-sm border rounded-lg p-3 shadow-sm">
              <p className="text-xs font-medium text-muted-foreground mb-2">Sections</p>
              <div className="space-y-1.5">
                {sections.map((section) => {
                  const info = sectionInfoMap[section.id]
                  if (!info) return null
                  const sectionColor = section.color || '#3b82f6'
                  return (
                    <div
                      key={section.id}
                      className={`flex items-center gap-2 text-xs cursor-pointer rounded px-1.5 py-1 -mx-1.5 transition-colors ${
                        hoveredSectionId === section.id ? 'bg-muted' : ''
                      }`}
                      onMouseEnter={() => setHoveredSectionId(section.id)}
                      onMouseLeave={() => setHoveredSectionId(null)}
                    >
                      <div
                        className="w-3 h-3 rounded-sm flex-shrink-0"
                        style={{ backgroundColor: sectionColor }}
                      />
                      <span className="font-medium">{section.name}</span>
                      <span className="text-muted-foreground ml-auto">${info.price.toFixed(0)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-center h-[400px] text-muted-foreground">
          Loading layout...
        </div>
      )}
    </div>
  )
}
