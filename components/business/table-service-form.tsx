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
import { TableSection, TableServiceConfig, DrawnVenueLayout } from '@/lib/types'
import { VenueLayoutEditor } from './venue-layout-editor'

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

  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [layoutUrl, setLayoutUrl] = useState<string | null>(venueLayoutUrl)
  const [layoutType, setLayoutType] = useState<'image' | 'pdf' | null>(
    venueLayoutUrl ? (venueLayoutUrl.toLowerCase().endsWith('.pdf') ? 'pdf' : 'image') : null
  )
  const [sections, setSections] = useState<TableSection[]>(() => {
    // Initialize sections with tableNames if not present
    const existingSections = tableServiceConfig?.sections || []
    return existingSections.map(section => ({
      ...section,
      tableNames: section.tableNames || Array.from({ length: section.tableCount }, (_, i) => `${i + 1}`)
    }))
  })
  const [fontSize, setFontSize] = useState(tableServiceConfig?.fontSize ?? 12)
  const [drawnLayout, setDrawnLayout] = useState<DrawnVenueLayout | null>(
    tableServiceConfig?.drawnLayout || null
  )

  // Track selected tables for multi-select deletion: { sectionId: Set<tableIndex> }
  const [selectedTables, setSelectedTables] = useState<Record<string, Set<number>>>({})
  const lastClickedTableRef = useRef<{ sectionId: string; index: number } | null>(null)

  // Store initial values to track changes
  const initialLayoutUrlRef = useRef<string | null>(venueLayoutUrl)
  const initialSectionsRef = useRef<string>(JSON.stringify(
    (tableServiceConfig?.sections || []).map(section => ({
      ...section,
      tableNames: section.tableNames || Array.from({ length: section.tableCount }, (_, i) => `${i + 1}`)
    }))
  ))
  const initialFontSizeRef = useRef<number>(tableServiceConfig?.fontSize ?? 12)
  const initialDrawnLayoutRef = useRef<string>(JSON.stringify(tableServiceConfig?.drawnLayout || null))
  // Counter to force hasChanges recalculation after save
  const [savedVersion, setSavedVersion] = useState(0)

  // Check if there are unsaved changes
  const hasChanges = useMemo(() => {
    const layoutChanged = layoutUrl !== initialLayoutUrlRef.current
    const sectionsChanged = JSON.stringify(sections) !== initialSectionsRef.current
    const fontSizeChanged = fontSize !== initialFontSizeRef.current
    const drawnLayoutChanged = JSON.stringify(drawnLayout) !== initialDrawnLayoutRef.current
    return layoutChanged || sectionsChanged || fontSizeChanged || drawnLayoutChanged
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutUrl, sections, fontSize, drawnLayout, savedVersion])

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
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

    setUploading(true)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('businessId', businessId)

      const response = await fetch('/api/upload/venue-layout', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to upload venue layout')
      }

      const data = await response.json()
      setLayoutUrl(data.url)
      setLayoutType(file.type === 'application/pdf' ? 'pdf' : 'image')
      toast.success('Venue layout uploaded successfully!')
    } catch (error) {
      console.error('Upload error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to upload venue layout')
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleRemoveLayout = () => {
    setLayoutUrl(null)
    setLayoutType(null)
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
    setSections(sections.map(section => {
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
    setSections(sections.map(section => {
      if (section.id !== sectionId) return section

      const currentNames = section.tableNames || generateDefaultTableNames(section.tableCount)
      const updatedNames = [...currentNames]
      updatedNames[tableIndex] = newName

      return { ...section, tableNames: updatedNames }
    }))
  }

  const addTableToSection = (sectionId: string) => {
    setSections(sections.map(section => {
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
    setSections(sections.map(section => {
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

    setSections(sections.map(section => {
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
    setSections(sections.filter(section => section.id !== id))
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

    setSaving(true)

    try {
      const response = await fetch(`/api/businesses/${businessId}/table-service`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          venue_layout_url: layoutUrl,
          table_service_config: sections.length > 0 ? { sections, fontSize, drawnLayout } : null,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save settings')
      }

      // Update initial values to reflect saved state
      initialLayoutUrlRef.current = layoutUrl
      initialSectionsRef.current = JSON.stringify(sections)
      initialFontSizeRef.current = fontSize
      initialDrawnLayoutRef.current = JSON.stringify(drawnLayout)
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
      {/* Venue Layout Upload */}
      <div className="space-y-4">
        <div className="flex items-start gap-4">
          {/* Preview */}
          <div className="flex-shrink-0">
            {layoutUrl ? (
              <div className="relative w-48 h-48 rounded-lg border bg-muted overflow-hidden group">
                {layoutType === 'pdf' ? (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-muted p-4">
                    <FileImage className="h-12 w-12 text-muted-foreground mb-2" />
                    <span className="text-xs text-muted-foreground text-center">PDF Document</span>
                    <a
                      href={layoutUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline mt-1"
                    >
                      View PDF
                    </a>
                  </div>
                ) : (
                  <Image
                    src={layoutUrl}
                    alt="Venue layout"
                    fill
                    className="object-contain p-2"
                  />
                )}
                <button
                  type="button"
                  onClick={handleRemoveLayout}
                  disabled={uploading}
                  className="absolute top-1 right-1 p-1 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="w-48 h-48 rounded-lg border-2 border-dashed bg-muted flex flex-col items-center justify-center">
                <FileImage className="h-8 w-8 text-muted-foreground mb-2" />
                <span className="text-xs text-muted-foreground">No layout uploaded</span>
              </div>
            )}
          </div>

          {/* Upload Controls */}
          <div className="flex-1 space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={handleFileSelect}
              disabled={uploading}
              className="hidden"
            />

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              <Upload className="mr-2 h-4 w-4" />
              {uploading ? 'Uploading...' : layoutUrl ? 'Change Layout' : 'Upload Layout'}
            </Button>

            <p className="text-xs text-muted-foreground">
              Accepted formats: JPEG, PNG, WebP, PDF. Max size: 10MB.
            </p>
          </div>
        </div>
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
                                    variant="destructive"
                                    size="sm"
                                    className="h-6 px-2 text-xs"
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
        {sections.length > 0 && (
          <div className="flex justify-end pt-2">
            <Button onClick={handleSave} disabled={saving || !hasChanges}>
              {saving ? 'Saving...' : 'Save Settings'}
            </Button>
          </div>
        )}
      </div>

      {/* Venue Layout Editor - show when sections exist (with image or draw mode) */}
      {sections.length > 0 && getTotalTables() > 0 && layoutType !== 'pdf' && (
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
          />
        </>
      )}
    </div>
  )
}
