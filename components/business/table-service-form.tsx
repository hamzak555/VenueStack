'use client'

import { useState, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
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
import { Upload, X, FileImage, FilePlus, Trash2, Plus, GripVertical, Check } from 'lucide-react'
import Image from 'next/image'
import { toast } from 'sonner'
import { TableSection, TableServiceConfig, DrawnVenueLayout, VenueLayout } from '@/lib/types'
import { VenueLayoutEditor } from './venue-layout-editor'

// Migration helper: convert legacy single layout to multi-layout format
function migrateToMultiLayout(
  venueLayoutUrl: string | null,
  config: TableServiceConfig | null
): { layouts: VenueLayout[]; sections: TableSection[]; activeLayoutId: string | null } {
  // Already has layouts - return as-is
  if (config?.layouts && config.layouts.length > 0) {
    return {
      layouts: config.layouts,
      sections: config.sections || [],
      activeLayoutId: config.activeLayoutId || config.layouts[0]?.id || null,
    }
  }

  // No config or no layout - return empty
  if (!config && !venueLayoutUrl) {
    return { layouts: [], sections: [], activeLayoutId: null }
  }

  // Migrate from legacy format
  const defaultLayoutId = crypto.randomUUID()
  const defaultLayout: VenueLayout = {
    id: defaultLayoutId,
    label: 'Main Floor',
    imageUrl: venueLayoutUrl,
    drawnLayout: config?.drawnLayout,
    order: 0,
    isDefault: true,
  }

  // Assign all placed tables to the default layout
  const migratedSections = (config?.sections || []).map(section => ({
    ...section,
    tableNames: section.tableNames || Array.from({ length: section.tableCount }, (_, i) => `${i + 1}`),
    tablePositions: section.tablePositions?.map(pos => ({
      ...pos,
      layoutId: pos.placed ? defaultLayoutId : undefined,
    })),
  }))

  return {
    layouts: venueLayoutUrl || config?.drawnLayout ? [defaultLayout] : [],
    sections: migratedSections,
    activeLayoutId: venueLayoutUrl || config?.drawnLayout ? defaultLayoutId : null,
  }
}

interface TableServiceFormProps {
  businessId: string
  businessSlug: string
  venueLayoutUrl: string | null
  tableServiceConfig: TableServiceConfig | null
}

export function TableServiceForm({
  businessId,
  businessSlug,
  venueLayoutUrl,
  tableServiceConfig,
}: TableServiceFormProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const layoutFileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  // Migrate legacy data to multi-layout format
  const migratedData = useMemo(
    () => migrateToMultiLayout(venueLayoutUrl, tableServiceConfig),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [] // Only run on initial mount
  )

  const [uploading, setUploading] = useState(false)
  const [uploadingLayoutId, setUploadingLayoutId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [layouts, setLayouts] = useState<VenueLayout[]>(migratedData.layouts)
  const [selectedLayoutId, setSelectedLayoutId] = useState<string | null>(migratedData.activeLayoutId)
  const [sections, setSections] = useState<TableSection[]>(migratedData.sections)
  const [fontSize, setFontSize] = useState(tableServiceConfig?.fontSize ?? 12)

  // Get current layout info for backward compatibility
  const selectedLayout = layouts.find(l => l.id === selectedLayoutId) || layouts[0] || null
  const layoutUrl = selectedLayout?.imageUrl || null
  const layoutType: 'image' | 'pdf' | null = layoutUrl
    ? (layoutUrl.toLowerCase().endsWith('.pdf') ? 'pdf' : 'image')
    : null
  const drawnLayout = selectedLayout?.drawnLayout || null

  // Track selected tables for multi-select deletion: { sectionId: Set<tableIndex> }
  const [selectedTables, setSelectedTables] = useState<Record<string, Set<number>>>({})
  const lastClickedTableRef = useRef<{ sectionId: string; index: number } | null>(null)

  // Store initial values to track changes
  const initialLayoutsRef = useRef<string>(JSON.stringify(migratedData.layouts))
  const initialSectionsRef = useRef<string>(JSON.stringify(migratedData.sections))
  const initialFontSizeRef = useRef<number>(tableServiceConfig?.fontSize ?? 12)
  // Counter to force hasChanges recalculation after save
  const [savedVersion, setSavedVersion] = useState(0)

  // Check if there are unsaved changes
  const hasChanges = useMemo(() => {
    const layoutsChanged = JSON.stringify(layouts) !== initialLayoutsRef.current
    const sectionsChanged = JSON.stringify(sections) !== initialSectionsRef.current
    const fontSizeChanged = fontSize !== initialFontSizeRef.current
    return layoutsChanged || sectionsChanged || fontSizeChanged
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layouts, sections, fontSize, savedVersion])

  const handleLayoutFileSelect = async (e: React.ChangeEvent<HTMLInputElement>, layoutId: string) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
    if (!validTypes.includes(file.type)) {
      toast.error('Please select a JPEG, PNG, WebP, or PDF file')
      return
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB')
      return
    }

    setUploadingLayoutId(layoutId)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('businessId', businessId)
      formData.append('layoutId', layoutId)

      const response = await fetch('/api/upload/venue-layout', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to upload venue layout')
      }

      const data = await response.json()
      updateLayout(layoutId, { imageUrl: data.url })
      toast.success('Layout image uploaded successfully!')
    } catch (error) {
      console.error('Upload error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to upload venue layout')
    } finally {
      setUploadingLayoutId(null)
      const inputRef = layoutFileInputRefs.current[layoutId]
      if (inputRef) {
        inputRef.value = ''
      }
    }
  }

  // Layout management functions
  const addLayout = () => {
    const newLayout: VenueLayout = {
      id: crypto.randomUUID(),
      label: `Layout ${layouts.length + 1}`,
      imageUrl: null,
      order: layouts.length,
      isDefault: layouts.length === 0,
    }
    setLayouts([...layouts, newLayout])
    setSelectedLayoutId(newLayout.id)
  }

  const updateLayout = (id: string, updates: Partial<VenueLayout>) => {
    setLayouts(layouts.map(l => l.id === id ? { ...l, ...updates } : l))
  }

  const removeLayout = (id: string) => {
    // Remove layout
    const updatedLayouts = layouts.filter(l => l.id !== id)
    setLayouts(updatedLayouts)

    // Unassign tables from this layout
    setSections(prev => prev.map(section => ({
      ...section,
      tablePositions: section.tablePositions?.map(pos =>
        pos.layoutId === id ? { ...pos, layoutId: undefined, placed: false } : pos
      ),
    })))

    // Update selected layout if needed
    if (selectedLayoutId === id) {
      setSelectedLayoutId(updatedLayouts[0]?.id || null)
    }
  }

  const removeLayoutImage = (layoutId: string) => {
    updateLayout(layoutId, { imageUrl: null })
  }

  const setDrawnLayout = (newDrawnLayout: DrawnVenueLayout | null) => {
    if (selectedLayoutId) {
      updateLayout(selectedLayoutId, { drawnLayout: newDrawnLayout || undefined })
    }
  }

  const generateDefaultTableNames = (count: number, sectionName?: string): string[] => {
    return Array.from({ length: count }, (_, i) => `${i + 1}`)
  }

  const addSection = () => {
    const newSection: TableSection = {
      id: crypto.randomUUID(),
      name: '',
      tableCount: 1,
      capacity: undefined,
      tableNames: ['1'],
    }
    setSections([...sections, newSection])
  }

  const updateSection = (id: string, updates: Partial<TableSection>) => {
    setSections(prev => prev.map(section => {
      if (section.id !== id) return section

      const updatedSection = { ...section, ...updates }

      // If tableCount changed, adjust tableNames array
      if (updates.tableCount !== undefined && updates.tableCount !== section.tableCount) {
        const currentNames = section.tableNames || generateDefaultTableNames(section.tableCount)
        const newCount = updates.tableCount

        if (newCount > currentNames.length) {
          // Add new tables with default names
          const additionalNames = Array.from(
            { length: newCount - currentNames.length },
            (_, i) => `${currentNames.length + i + 1}`
          )
          updatedSection.tableNames = [...currentNames, ...additionalNames]
        } else if (newCount < currentNames.length) {
          // Remove excess tables
          updatedSection.tableNames = currentNames.slice(0, newCount)
        }
      }

      return updatedSection
    }))
  }

  const updateTableName = (sectionId: string, tableIndex: number, newName: string) => {
    setSections(prev => prev.map(section => {
      if (section.id !== sectionId) return section

      const currentNames = section.tableNames || generateDefaultTableNames(section.tableCount)
      const updatedNames = [...currentNames]
      updatedNames[tableIndex] = newName

      return { ...section, tableNames: updatedNames }
    }))
  }

  const addTableToSection = (sectionId: string) => {
    setSections(prev => prev.map(section => {
      if (section.id !== sectionId) return section

      const currentNames = section.tableNames || generateDefaultTableNames(section.tableCount)
      const newTableName = `${section.tableCount + 1}`

      return {
        ...section,
        tableCount: section.tableCount + 1,
        tableNames: [...currentNames, newTableName],
      }
    }))
  }

  const deleteTableFromSection = (sectionId: string, tableIndex: number) => {
    setSections(prev => prev.map(section => {
      if (section.id !== sectionId) return section
      if (section.tableCount <= 1) return section // Keep at least 1 table

      const currentNames = section.tableNames || generateDefaultTableNames(section.tableCount)
      const updatedNames = currentNames.filter((_, i) => i !== tableIndex)

      // Also remove table position if exists
      const updatedPositions = section.tablePositions?.filter((_, i) => i !== tableIndex)

      return {
        ...section,
        tableCount: section.tableCount - 1,
        tableNames: updatedNames,
        tablePositions: updatedPositions,
      }
    }))

    // Clear selection for this table
    setSelectedTables(prev => {
      const newSelected = { ...prev }
      if (newSelected[sectionId]) {
        const newSet = new Set(newSelected[sectionId])
        newSet.delete(tableIndex)
        // Adjust indices for tables after the deleted one
        const adjustedSet = new Set<number>()
        newSet.forEach(idx => {
          if (idx > tableIndex) {
            adjustedSet.add(idx - 1)
          } else {
            adjustedSet.add(idx)
          }
        })
        newSelected[sectionId] = adjustedSet
      }
      return newSelected
    })
  }

  const deleteSelectedTables = (sectionId: string) => {
    const selected = selectedTables[sectionId]
    if (!selected || selected.size === 0) return

    setSections(prev => prev.map(section => {
      if (section.id !== sectionId) return section

      const currentNames = section.tableNames || generateDefaultTableNames(section.tableCount)
      const indicesToDelete = Array.from(selected).sort((a, b) => b - a) // Sort descending to delete from end

      // Keep at least 1 table
      if (currentNames.length - indicesToDelete.length < 1) {
        toast.error('Section must have at least 1 table')
        return section
      }

      let updatedNames = [...currentNames]
      let updatedPositions = section.tablePositions ? [...section.tablePositions] : undefined

      indicesToDelete.forEach(idx => {
        updatedNames.splice(idx, 1)
        if (updatedPositions) {
          updatedPositions.splice(idx, 1)
        }
      })

      return {
        ...section,
        tableCount: updatedNames.length,
        tableNames: updatedNames,
        tablePositions: updatedPositions,
      }
    }))

    // Clear selection
    setSelectedTables(prev => {
      const newSelected = { ...prev }
      delete newSelected[sectionId]
      return newSelected
    })
  }

  const handleTableClick = (sectionId: string, tableIndex: number, event: React.MouseEvent) => {
    if (event.shiftKey && lastClickedTableRef.current?.sectionId === sectionId) {
      // Shift+click: select range
      const start = Math.min(lastClickedTableRef.current.index, tableIndex)
      const end = Math.max(lastClickedTableRef.current.index, tableIndex)

      setSelectedTables(prev => {
        const newSelected = { ...prev }
        const currentSet = new Set(newSelected[sectionId] || [])
        for (let i = start; i <= end; i++) {
          currentSet.add(i)
        }
        newSelected[sectionId] = currentSet
        return newSelected
      })
    } else {
      // Normal click: toggle single selection
      setSelectedTables(prev => {
        const newSelected = { ...prev }
        const currentSet = new Set(newSelected[sectionId] || [])

        if (currentSet.has(tableIndex)) {
          currentSet.delete(tableIndex)
        } else {
          currentSet.add(tableIndex)
        }

        if (currentSet.size === 0) {
          delete newSelected[sectionId]
        } else {
          newSelected[sectionId] = currentSet
        }
        return newSelected
      })
      lastClickedTableRef.current = { sectionId, index: tableIndex }
    }
  }

  const isTableSelected = (sectionId: string, tableIndex: number): boolean => {
    return selectedTables[sectionId]?.has(tableIndex) || false
  }

  const getSelectedCount = (sectionId: string): number => {
    return selectedTables[sectionId]?.size || 0
  }

  const clearSelection = (sectionId: string) => {
    setSelectedTables(prev => {
      const newSelected = { ...prev }
      delete newSelected[sectionId]
      return newSelected
    })
  }

  const removeSection = (id: string) => {
    setSections(prev => prev.filter(section => section.id !== id))
    // Clear any selections for this section
    setSelectedTables(prev => {
      const newSelected = { ...prev }
      delete newSelected[id]
      return newSelected
    })
  }

  const handleSave = async () => {
    // Validate sections
    for (const section of sections) {
      if (!section.name.trim()) {
        toast.error('All sections must have a name')
        return
      }
      if (section.tableCount < 1) {
        toast.error('Each section must have at least 1 table')
        return
      }
    }

    // Validate layouts
    for (const layout of layouts) {
      if (!layout.label.trim()) {
        toast.error('All layouts must have a label')
        return
      }
    }

    setSaving(true)

    try {
      // Build config with layouts
      const config: TableServiceConfig | null = (sections.length > 0 || layouts.length > 0) ? {
        sections,
        fontSize,
        layouts,
        activeLayoutId: selectedLayoutId || undefined,
      } : null

      const response = await fetch(`/api/businesses/${businessId}/table-service`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          venue_layout_url: layouts[0]?.imageUrl || null, // Keep legacy field for backward compatibility
          table_service_config: config,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save settings')
      }

      // Update initial values to reflect saved state
      initialLayoutsRef.current = JSON.stringify(layouts)
      initialSectionsRef.current = JSON.stringify(sections)
      initialFontSizeRef.current = fontSize
      setSavedVersion(v => v + 1) // Force hasChanges recalculation

      toast.success('Table service settings saved!')
      router.refresh()
    } catch (error) {
      console.error('Save error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const getTotalTables = () => {
    return sections.reduce((total, section) => total + section.tableCount, 0)
  }

  return (
    <div className="space-y-8">
      {/* Venue Layouts */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-base">Venue Layouts</Label>
            <p className="text-sm text-muted-foreground">
              Add floor plans for different areas of your venue (e.g., Main Room, VIP Lounge, Rooftop)
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addLayout}>
            <Plus className="mr-2 h-4 w-4" />
            Add Layout
          </Button>
        </div>

        {layouts.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-8">
              <FileImage className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground mb-4">No layouts added yet</p>
              <Button type="button" variant="outline" size="sm" onClick={addLayout}>
                <Plus className="mr-2 h-4 w-4" />
                Add Your First Layout
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {layouts.map((layout, index) => {
              const isUploading = uploadingLayoutId === layout.id
              const isPdf = layout.imageUrl?.toLowerCase().endsWith('.pdf')
              return (
                <Card
                  key={layout.id}
                  className="relative"
                >
                  <CardContent className="p-4 space-y-3">
                    {/* Hidden file input */}
                    <input
                      ref={(el) => { layoutFileInputRefs.current[layout.id] = el }}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,application/pdf"
                      onChange={(e) => handleLayoutFileSelect(e, layout.id)}
                      disabled={isUploading}
                      className="hidden"
                    />

                    {/* Layout Image Preview - clickable to upload */}
                    <div
                      className={`relative w-full h-32 rounded-lg border-2 border-dashed bg-muted overflow-hidden group cursor-pointer transition-colors hover:border-primary hover:bg-muted/80 ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}
                      onClick={() => layoutFileInputRefs.current[layout.id]?.click()}
                    >
                      {layout.imageUrl ? (
                        isPdf ? (
                          <div className="w-full h-full flex flex-col items-center justify-center bg-muted p-4">
                            <FileImage className="h-8 w-8 text-muted-foreground mb-1" />
                            <span className="text-xs text-muted-foreground">PDF</span>
                            <span className="text-xs text-primary mt-1">Click to change</span>
                          </div>
                        ) : (
                          <>
                            <Image
                              src={layout.imageUrl}
                              alt={layout.label}
                              fill
                              className="object-contain p-2"
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                              <span className="text-white text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                                Click to change
                              </span>
                            </div>
                          </>
                        )
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center">
                          <Upload className="h-6 w-6 text-muted-foreground mb-1" />
                          <span className="text-xs text-muted-foreground">
                            {isUploading ? 'Uploading...' : 'Click to upload'}
                          </span>
                        </div>
                      )}
                      {layout.imageUrl && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            removeLayoutImage(layout.id)
                          }}
                          disabled={isUploading}
                          className="absolute top-1 right-1 p-1 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>

                    {/* Layout Label and Delete */}
                    <div className="flex items-center gap-2">
                      <Input
                        value={layout.label}
                        onChange={(e) => updateLayout(layout.id, { label: e.target.value })}
                        placeholder="Layout name"
                        className="text-sm flex-1"
                      />
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Layout</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete &quot;{layout.label}&quot;?
                              Tables placed on this layout will become unassigned.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => removeLayout(layout.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}

        {layouts.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Accepted formats: JPEG, PNG, WebP, PDF. Max size: 10MB per image.
          </p>
        )}

        {/* Save Button for Venue Layouts */}
        <Button
          type="button"
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className="w-full sm:w-auto"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>

      <Separator />

      {/* Table Sections */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-base">Table Sections</Label>
            <p className="text-sm text-muted-foreground">
              Define sections in your venue and the number of tables in each section
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addSection}>
            <Plus className="mr-2 h-4 w-4" />
            Add Section
          </Button>
        </div>

        {sections.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-8">
              <FilePlus className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground mb-4">No sections defined yet</p>
              <Button type="button" variant="outline" size="sm" onClick={addSection}>
                <Plus className="mr-2 h-4 w-4" />
                Add Your First Section
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {sections.map((section, index) => (
              <Card key={section.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                      <CardTitle className="text-sm font-medium">
                        Section {index + 1}
                      </CardTitle>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Section</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete {section.name ? `"${section.name}"` : 'this section'}?
                            This will remove all {section.tableCount} table{section.tableCount !== 1 ? 's' : ''} in this section.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => removeSection(section.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor={`section-name-${section.id}`}>Section Name</Label>
                      <Input
                        id={`section-name-${section.id}`}
                        placeholder="e.g., Main Floor, VIP Area, Patio"
                        value={section.name}
                        onChange={(e) => updateSection(section.id, { name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`capacity-${section.id}`}>Capacity per Table</Label>
                      <Input
                        id={`capacity-${section.id}`}
                        type="number"
                        min="1"
                        max="99"
                        placeholder="Optional"
                        value={section.capacity || ''}
                        onChange={(e) => updateSection(section.id, { capacity: e.target.value ? parseInt(e.target.value) : undefined })}
                      />
                    </div>
                  </div>
                  {section.tableCount > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Label className="text-xs text-muted-foreground">
                            Tables ({section.tableCount})
                          </Label>
                          <span className="text-xs text-muted-foreground">
                            Click to select, Shift+click for range
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {getSelectedCount(section.id) > 0 && (
                            <>
                              <span className="text-xs text-muted-foreground">
                                {getSelectedCount(section.id)} selected
                              </span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-xs"
                                onClick={() => clearSelection(section.id)}
                              >
                                Clear
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    type="button"
                                    size="sm"
                                    className="h-6 px-2 text-xs bg-red-500/20 text-red-500 border border-red-500 hover:bg-red-500/30"
                                  >
                                    <Trash2 className="h-3 w-3 mr-1" />
                                    Delete
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete {getSelectedCount(section.id)} Table{getSelectedCount(section.id) !== 1 ? 's' : ''}?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will remove the selected table{getSelectedCount(section.id) !== 1 ? 's' : ''} from this section.
                                      Any reservations assigned to {getSelectedCount(section.id) !== 1 ? 'these tables' : 'this table'} will become unassigned.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => deleteSelectedTables(section.id)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </>
                          )}
                          {section.capacity && (
                            <span className="text-xs text-muted-foreground">
                              {section.capacity} people per table
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 items-center">
                        {(section.tableNames || generateDefaultTableNames(section.tableCount)).map((tableName, index) => {
                          const isSelected = isTableSelected(section.id, index)
                          return (
                            <div
                              key={index}
                              className={`relative group ${isSelected ? 'ring-2 ring-primary ring-offset-1 rounded-md' : ''}`}
                            >
                              {/* Selection checkbox */}
                              <button
                                type="button"
                                onClick={(e) => handleTableClick(section.id, index, e)}
                                className={`absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full border-2 flex items-center justify-center z-10 transition-colors ${
                                  isSelected
                                    ? 'bg-primary border-primary'
                                    : 'bg-background border-muted-foreground/30 opacity-0 group-hover:opacity-100'
                                }`}
                                title={`${isSelected ? 'Deselect' : 'Select'} table (Shift+click for range)`}
                              >
                                {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                              </button>
                              <Input
                                value={tableName}
                                onChange={(e) => updateTableName(section.id, index, e.target.value)}
                                className={`w-16 h-10 text-center text-sm font-medium px-1 ${isSelected ? 'bg-primary/10' : ''}`}
                                placeholder={`${index + 1}`}
                                title={`Table ${index + 1}`}
                              />
                            </div>
                          )
                        })}
                        {/* Add table button */}
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="w-10 h-10 border-dashed"
                          onClick={() => addTableToSection(section.id)}
                          title="Add table"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {sections.length > 0 && (
          <div className="flex items-center justify-between text-sm text-muted-foreground bg-muted p-3 rounded-lg">
            <span>Total Sections: {sections.length}</span>
            <span>Total Tables: {getTotalTables()}</span>
          </div>
        )}

        {/* Save Button for Table Sections */}
        {(sections.length > 0 || layouts.length > 0) && (
          <div className="flex justify-end pt-2">
            <Button onClick={handleSave} disabled={saving || !hasChanges}>
              {saving ? 'Saving...' : 'Save Settings'}
            </Button>
          </div>
        )}
      </div>

      {/* Venue Layout Editor - show when sections and layouts exist */}
      {sections.length > 0 && getTotalTables() > 0 && layouts.length > 0 && layoutType !== 'pdf' && (
        <>
          <Separator />
          <VenueLayoutEditor
            layoutUrl={layoutUrl}
            sections={sections}
            onUpdateSection={updateSection}
            onSave={handleSave}
            saving={saving}
            hasChanges={hasChanges}
            fontSize={fontSize}
            onFontSizeChange={setFontSize}
            drawnLayout={drawnLayout}
            onUpdateDrawnLayout={setDrawnLayout}
            layouts={layouts}
            selectedLayoutId={selectedLayoutId}
            onLayoutChange={setSelectedLayoutId}
          />
        </>
      )}
    </div>
  )
}
