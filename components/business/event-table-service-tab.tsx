'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Loader2, AlertCircle, Wine } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

interface BusinessSection {
  id: string
  name: string
  tableCount: number
  capacity?: number
}

interface EventTableSection {
  id?: string
  section_id: string
  section_name: string
  price: number
  minimum_spend?: number
  total_tables: number
  available_tables: number
  capacity?: number
  max_per_customer?: number
  is_enabled: boolean
}

interface EventTableServiceTabProps {
  eventId: string
  businessSlug: string
  businessId: string
  isRecurringEvent?: boolean
}

export default function EventTableServiceTab({ eventId, businessSlug, businessId, isRecurringEvent }: EventTableServiceTabProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [tableServiceEnabled, setTableServiceEnabled] = useState(false)
  const [businessSections, setBusinessSections] = useState<BusinessSection[]>([])
  const [eventSections, setEventSections] = useState<EventTableSection[]>([])
  const [hasBusinessConfig, setHasBusinessConfig] = useState(false)
  const [propagateToSeries, setPropagateToSeries] = useState(true)

  useEffect(() => {
    fetchData()
  }, [eventId, businessId])

  const fetchData = async () => {
    try {
      setIsLoading(true)

      let fetchedBusinessSections: BusinessSection[] = []
      let fetchedEventSections: EventTableSection[] = []

      // Fetch business table service config
      const businessResponse = await fetch(`/api/businesses/${businessId}/table-service`)
      if (businessResponse.ok) {
        const businessData = await businessResponse.json()
        if (businessData.table_service_config?.sections) {
          fetchedBusinessSections = businessData.table_service_config.sections
          setBusinessSections(fetchedBusinessSections)
          setHasBusinessConfig(fetchedBusinessSections.length > 0)
        }
      }

      // Fetch event table service settings
      const eventResponse = await fetch(`/api/events/${eventId}/table-service`)
      if (eventResponse.ok) {
        const eventData = await eventResponse.json()
        setTableServiceEnabled(eventData.table_service_enabled || false)
        fetchedEventSections = eventData.sections || []
      }

      // Sync event sections with business sections
      if (fetchedBusinessSections.length > 0) {
        if (fetchedEventSections.length === 0) {
          // Initialize from business sections
          const initialSections = fetchedBusinessSections.map(section => ({
            section_id: section.id,
            section_name: section.name,
            price: 0,
            total_tables: section.tableCount,
            available_tables: section.tableCount,
            capacity: section.capacity,
            is_enabled: false,
          }))
          setEventSections(initialSections)
        } else {
          // Find and add missing sections
          const existingSectionIds = fetchedEventSections.map(es => es.section_id)
          const missingSections = fetchedBusinessSections.filter(bs => !existingSectionIds.includes(bs.id))

          // Update existing sections and add new ones
          const updatedSections = fetchedEventSections.map(eventSection => {
            const businessSection = fetchedBusinessSections.find(bs => bs.id === eventSection.section_id)
            if (businessSection) {
              return {
                ...eventSection,
                section_name: businessSection.name,
                capacity: businessSection.capacity,
                total_tables: businessSection.tableCount,
                available_tables: Math.min(eventSection.available_tables, businessSection.tableCount),
              }
            }
            return eventSection
          })

          const newSections = missingSections.map(section => ({
            section_id: section.id,
            section_name: section.name,
            price: 0,
            total_tables: section.tableCount,
            available_tables: section.tableCount,
            capacity: section.capacity,
            is_enabled: false,
          }))

          setEventSections([...updatedSections, ...newSections])
        }
      } else {
        setEventSections(fetchedEventSections)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error('Failed to load table service settings')
    } finally {
      setIsLoading(false)
    }
  }

  // Sync event sections with business sections whenever either changes
  // This adds missing sections and updates existing ones
  useEffect(() => {
    if (businessSections.length > 0 && !isLoading) {
      setEventSections(prev => {
        // If no existing sections, initialize from business sections
        if (prev.length === 0) {
          return businessSections.map(section => ({
            section_id: section.id,
            section_name: section.name,
            price: 0,
            total_tables: section.tableCount,
            available_tables: section.tableCount,
            capacity: section.capacity,
            is_enabled: false,
          }))
        }

        // Find sections that exist in business config but not in event sections
        const existingSectionIds = prev.map(es => es.section_id)
        const missingSections = businessSections.filter(bs => !existingSectionIds.includes(bs.id))

        // If no missing sections and no updates needed, return previous state unchanged
        const needsUpdate = missingSections.length > 0 || prev.some(es => {
          const bs = businessSections.find(b => b.id === es.section_id)
          return bs && (
            bs.capacity !== es.capacity ||
            bs.tableCount !== es.total_tables ||
            bs.name !== es.section_name
          )
        })

        if (!needsUpdate) {
          return prev
        }

        // Update existing sections with latest business config data
        const updated = prev.map(eventSection => {
          const businessSection = businessSections.find(bs => bs.id === eventSection.section_id)
          if (businessSection) {
            return {
              ...eventSection,
              section_name: businessSection.name,
              capacity: businessSection.capacity,
              total_tables: businessSection.tableCount,
              available_tables: Math.min(eventSection.available_tables, businessSection.tableCount),
            }
          }
          return eventSection
        })

        // Add new sections from business config
        const newSections = missingSections.map(section => ({
          section_id: section.id,
          section_name: section.name,
          price: 0,
          total_tables: section.tableCount,
          available_tables: section.tableCount,
          capacity: section.capacity,
          is_enabled: false,
        }))

        return [...updated, ...newSections]
      })
    }
  }, [businessSections, isLoading])

  const updateSection = (sectionId: string, updates: Partial<EventTableSection>) => {
    setEventSections(prev =>
      prev.map(section =>
        section.section_id === sectionId ? { ...section, ...updates } : section
      )
    )
  }

  const handleSave = async () => {
    setIsSaving(true)

    try {
      const response = await fetch(`/api/events/${eventId}/table-service`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table_service_enabled: tableServiceEnabled,
          sections: eventSections,
          propagateToSeries: isRecurringEvent && propagateToSeries,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save settings')
      }

      if (isRecurringEvent && propagateToSeries) {
        toast.success('Table service settings saved to all events!')
      } else {
        toast.success('Table service settings saved!')
      }
      router.refresh()
    } catch (error) {
      console.error('Save error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to save settings')
    } finally {
      setIsSaving(false)
    }
  }

  const getEnabledSectionsCount = () => {
    return eventSections.filter(s => s.is_enabled).length
  }

  const getTotalEnabledTables = () => {
    return eventSections
      .filter(s => s.is_enabled)
      .reduce((sum, s) => sum + s.total_tables, 0)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!hasBusinessConfig) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">Table Service Not Configured</h3>
          <p className="text-sm text-muted-foreground text-center mb-4 max-w-md">
            You need to set up your venue sections and tables in Table Service Settings before you can enable table service for events.
          </p>
          <Button asChild>
            <Link href={`/${businessSlug}/dashboard/settings/table-service`}>
              <Wine className="mr-2 h-4 w-4" />
              Configure Table Service
            </Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Table Service</CardTitle>
              <CardDescription>
                Enable table reservations for this event and set pricing for each section
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="table-service-toggle" className="text-sm">
                {tableServiceEnabled ? 'Enabled' : 'Disabled'}
              </Label>
              <Switch
                id="table-service-toggle"
                checked={tableServiceEnabled}
                onCheckedChange={setTableServiceEnabled}
              />
            </div>
          </div>
        </CardHeader>

        {tableServiceEnabled && (
          <CardContent className="space-y-6">
            {/* Summary */}
            <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
              <div>
                <p className="text-sm text-muted-foreground">Enabled Sections</p>
                <p className="text-2xl font-bold">{getEnabledSectionsCount()}</p>
              </div>
              <div className="h-8 w-px bg-border" />
              <div>
                <p className="text-sm text-muted-foreground">Total Tables</p>
                <p className="text-2xl font-bold">{getTotalEnabledTables()}</p>
              </div>
            </div>

            {/* Sections */}
            <div className="space-y-4">
              <Label className="text-base">Section Pricing</Label>
              <p className="text-sm text-muted-foreground">
                Enable sections and set the price per table for this event
              </p>

              {eventSections.map((section) => (
                <Card key={section.section_id} className={!section.is_enabled ? 'opacity-60' : ''}>
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4 flex-1">
                        <Switch
                          checked={section.is_enabled}
                          onCheckedChange={(checked) =>
                            updateSection(section.section_id, { is_enabled: checked })
                          }
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">{section.section_name}</h4>
                            <Badge variant="secondary" className="text-xs">
                              {section.total_tables} tables
                            </Badge>
                          </div>
                          {section.is_enabled && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {section.available_tables} of {section.total_tables} available
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <Label htmlFor={`price-${section.section_id}`} className="text-sm whitespace-nowrap">
                            Deposit
                          </Label>
                          <div className="relative w-28">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                              $
                            </span>
                            <Input
                              id={`price-${section.section_id}`}
                              type="number"
                              min="0"
                              step="0.01"
                              value={section.price}
                              onChange={(e) =>
                                updateSection(section.section_id, {
                                  price: parseFloat(e.target.value) || 0,
                                })
                              }
                              className="pl-7"
                              disabled={!section.is_enabled}
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Label htmlFor={`min-spend-${section.section_id}`} className="text-sm whitespace-nowrap">
                            Min Spend
                          </Label>
                          <div className="relative w-28">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                              $
                            </span>
                            <Input
                              id={`min-spend-${section.section_id}`}
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="None"
                              value={section.minimum_spend || ''}
                              onChange={(e) =>
                                updateSection(section.section_id, {
                                  minimum_spend: e.target.value ? parseFloat(e.target.value) : undefined,
                                })
                              }
                              className="pl-7"
                              disabled={!section.is_enabled}
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Label htmlFor={`limit-${section.section_id}`} className="text-sm whitespace-nowrap">
                            Limit
                          </Label>
                          <Input
                            id={`limit-${section.section_id}`}
                            type="number"
                            min="0"
                            max={section.total_tables}
                            placeholder="No limit"
                            value={section.max_per_customer || ''}
                            onChange={(e) =>
                              updateSection(section.section_id, {
                                max_per_customer: e.target.value ? parseInt(e.target.value) : undefined,
                              })
                            }
                            className="w-24"
                            disabled={!section.is_enabled}
                          />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Propagate to Series Option */}
      {isRecurringEvent && (
        <div className="p-4 bg-muted/50 rounded-lg border">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="propagate_to_series"
              checked={propagateToSeries}
              onChange={(e) => setPropagateToSeries(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor="propagate_to_series" className="cursor-pointer font-medium">
              Apply to all events in series
            </Label>
          </div>
        </div>
      )}

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Settings'
          )}
        </Button>
      </div>
    </div>
  )
}
