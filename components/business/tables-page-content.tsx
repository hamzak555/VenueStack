'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Plus, Pencil, ExternalLink } from 'lucide-react'
import { TablesLayoutView } from './tables-layout-view'
import { NewReservationModal } from './new-reservation-modal'
import { TableServiceConfig, VenueLayout } from '@/lib/types'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { parseLocalDate } from '@/lib/utils'
import { isServerRole, type BusinessRole } from '@/lib/auth/roles'
import { useRealtimeBookings } from '@/lib/hooks/use-realtime-bookings'

interface TableBooking {
  id: string
  event_id: string
  event_table_section_id: string
  table_number: string | null
  completed_table_number?: string | null
  requested_table_number?: string | null
  customer_name: string
  customer_email: string
  customer_phone: string | null
  amount: number | null
  status: 'requested' | 'approved' | 'confirmed' | 'cancelled' | 'arrived' | 'seated' | 'completed'
  created_at: string
  event_title: string
  event_date: string
  section_name: string
  section_id: string
}

interface LinkedTablePair {
  table1: { sectionId: string; tableName: string }
  table2: { sectionId: string; tableName: string }
}

interface ServerAssignment {
  tableName: string
  serverUserIds: string[]
}

interface TablesPageContentProps {
  eventId: string
  eventTitle: string
  eventDate?: string
  eventTime?: string | null
  eventImage?: string | null
  bookings: TableBooking[]
  businessSlug: string
  businessId: string
  sectionTableNames: Record<string, string[]>
  venueLayoutUrl: string | null
  tableServiceConfig: TableServiceConfig
  eventTableSections: { id: string; section_id: string; section_name: string; price: number; minimum_spend?: number }[]
  closedTables: Record<string, string[]>
  linkedTablePairs: LinkedTablePair[]
  initialBookingId?: string
  userRole?: BusinessRole
  serverAssignedTables?: Record<string, string[]>
  allServerAssignments?: Record<string, ServerAssignment[]>
}

export function TablesPageContent({
  eventId,
  eventTitle,
  eventDate,
  eventTime,
  eventImage,
  bookings,
  businessSlug,
  businessId,
  sectionTableNames,
  venueLayoutUrl,
  tableServiceConfig,
  eventTableSections,
  closedTables,
  linkedTablePairs,
  initialBookingId,
  userRole,
  serverAssignedTables,
  allServerAssignments,
}: TablesPageContentProps) {
  const isServer = userRole ? isServerRole(userRole) : false
  const [showNewReservationModal, setShowNewReservationModal] = useState(false)
  const [preSelectedSection, setPreSelectedSection] = useState<string | undefined>()
  const [preSelectedTable, setPreSelectedTable] = useState<string | undefined>()

  // Subscribe to realtime updates for this event's bookings
  useRealtimeBookings({ eventId })

  // Multi-layout support
  const layouts = tableServiceConfig?.layouts || []
  const LAYOUT_STORAGE_KEY = `tables_selected_layout_${businessSlug}`

  const [selectedLayoutId, setSelectedLayoutId] = useState<string | null>(() => {
    if (layouts.length === 0) return null

    // Check localStorage for previously selected layout
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(LAYOUT_STORAGE_KEY)
      // Verify the stored layout still exists
      if (stored && layouts.some(l => l.id === stored)) {
        return stored
      }
    }

    // Fall back to active/default layout
    return tableServiceConfig?.activeLayoutId || layouts.find(l => l.isDefault)?.id || layouts[0]?.id || null
  })

  // Persist selected layout to localStorage
  useEffect(() => {
    if (selectedLayoutId) {
      localStorage.setItem(LAYOUT_STORAGE_KEY, selectedLayoutId)
    }
  }, [selectedLayoutId, LAYOUT_STORAGE_KEY])

  const formattedDate = eventDate ? parseLocalDate(eventDate).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }) : ''

  const formatTimeTo12Hour = (time: string): string => {
    const [hours, minutes] = time.split(':').map(Number)
    const period = hours >= 12 ? 'PM' : 'AM'
    const displayHours = hours % 12 || 12
    return `${displayHours}:${minutes.toString().padStart(2, '0')}${period}`
  }

  // Handle opening modal from layout view with pre-selected table
  const handleEmptyTableClick = (sectionId: string, tableName: string) => {
    setPreSelectedSection(sectionId)
    setPreSelectedTable(tableName)
    setShowNewReservationModal(true)
  }

  // Handle opening modal from button (no pre-selection)
  const handleNewReservationClick = () => {
    setPreSelectedSection(undefined)
    setPreSelectedTable(undefined)
    setShowNewReservationModal(true)
  }

  // Get existing bookings for the modal
  const existingBookings = bookings
    .filter(b => b.status !== 'cancelled')
    .map(b => ({
      event_table_section_id: b.event_table_section_id,
      table_number: b.table_number,
    }))

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3 min-w-0">
          {eventImage && (
            <div className="relative h-10 w-10 lg:h-16 lg:w-16 rounded-lg overflow-hidden flex-shrink-0">
              <Image
                src={eventImage}
                alt={eventTitle}
                fill
                className="object-cover"
              />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-base lg:text-2xl font-bold tracking-tight truncate">{eventTitle}</h1>
              {!isServer && (
                <Link
                  href={`/${businessSlug}/dashboard/events/${eventId}`}
                  className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                  title="Edit event"
                >
                  <Pencil className="h-4 w-4" />
                </Link>
              )}
              <Link
                href={`/${businessSlug}/events/${eventId}/checkout?mode=tables`}
                target="_blank"
                className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                title="View checkout page"
              >
                <ExternalLink className="h-4 w-4" />
              </Link>
            </div>
            {eventDate && (
              <p className="text-xs lg:text-sm text-muted-foreground truncate">
                {formattedDate}{eventTime && ` at ${formatTimeTo12Hour(eventTime)}`}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 lg:gap-3">
          {layouts.length > 1 && (
            <Select value={selectedLayoutId || ''} onValueChange={setSelectedLayoutId}>
              <SelectTrigger className="w-[140px] lg:w-[180px]">
                <SelectValue placeholder="Select room" />
              </SelectTrigger>
              <SelectContent>
                {layouts.map((layout) => (
                  <SelectItem key={layout.id} value={layout.id}>
                    {layout.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {!isServer && (
            <Button onClick={handleNewReservationClick} size="sm" className="lg:size-default">
              <Plus className="h-4 w-4 lg:mr-2" />
              <span className="hidden lg:inline">New Reservation</span>
            </Button>
          )}
        </div>
      </div>

      {/* Layout View */}
      <TablesLayoutView
        eventId={eventId}
        bookings={bookings}
        businessSlug={businessSlug}
        businessId={businessId}
        venueLayoutUrl={venueLayoutUrl}
        tableServiceConfig={tableServiceConfig}
        sectionTableNames={sectionTableNames}
        eventTableSections={eventTableSections}
        closedTables={closedTables}
        linkedTablePairs={linkedTablePairs}
        onEmptyTableClick={handleEmptyTableClick}
        initialBookingId={initialBookingId}
        selectedLayoutId={selectedLayoutId}
        userRole={userRole}
        serverAssignedTables={serverAssignedTables}
        allServerAssignments={allServerAssignments}
      />

      {/* New Reservation Modal */}
      <NewReservationModal
        open={showNewReservationModal}
        onOpenChange={setShowNewReservationModal}
        eventId={eventId}
        eventTableSections={eventTableSections}
        sectionTableNames={sectionTableNames}
        preSelectedSection={preSelectedSection}
        preSelectedTable={preSelectedTable}
        existingBookings={existingBookings}
        closedTables={closedTables}
      />
    </div>
  )
}
