'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Plus, Pencil } from 'lucide-react'
import { TablesLayoutView } from './tables-layout-view'
import { NewReservationModal } from './new-reservation-modal'
import { TableServiceConfig } from '@/lib/types'
import { parseLocalDate } from '@/lib/utils'

interface TableBooking {
  id: string
  event_id: string
  event_table_section_id: string
  table_number: string | null
  completed_table_number?: string | null
  customer_name: string
  customer_email: string
  customer_phone: string | null
  amount: number | null
  status: 'reserved' | 'confirmed' | 'cancelled' | 'arrived' | 'seated' | 'completed'
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

interface TablesPageContentProps {
  eventId: string
  eventTitle: string
  eventDate?: string
  eventTime?: string | null
  eventImage?: string | null
  bookings: TableBooking[]
  businessSlug: string
  sectionTableNames: Record<string, string[]>
  venueLayoutUrl: string | null
  tableServiceConfig: TableServiceConfig
  eventTableSections: { id: string; section_id: string; section_name: string; price: number; minimum_spend?: number }[]
  closedTables: Record<string, string[]>
  linkedTablePairs: LinkedTablePair[]
  initialBookingId?: string
}

export function TablesPageContent({
  eventId,
  eventTitle,
  eventDate,
  eventTime,
  eventImage,
  bookings,
  businessSlug,
  sectionTableNames,
  venueLayoutUrl,
  tableServiceConfig,
  eventTableSections,
  closedTables,
  linkedTablePairs,
  initialBookingId,
}: TablesPageContentProps) {
  const [showNewReservationModal, setShowNewReservationModal] = useState(false)
  const [preSelectedSection, setPreSelectedSection] = useState<string | undefined>()
  const [preSelectedTable, setPreSelectedTable] = useState<string | undefined>()

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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {eventImage && (
            <div className="relative h-16 w-16 rounded-lg overflow-hidden flex-shrink-0">
              <Image
                src={eventImage}
                alt={eventTitle}
                fill
                className="object-cover"
              />
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">{eventTitle}</h1>
              <Link
                href={`/${businessSlug}/dashboard/events/${eventId}`}
                className="text-muted-foreground hover:text-foreground transition-colors"
                title="Edit event"
              >
                <Pencil className="h-4 w-4" />
              </Link>
            </div>
            {eventDate && (
              <p className="text-sm text-muted-foreground">
                {formattedDate}{eventTime && ` at ${formatTimeTo12Hour(eventTime)}`}
              </p>
            )}
          </div>
        </div>
        <Button onClick={handleNewReservationClick}>
          <Plus className="h-4 w-4 mr-2" />
          New Reservation
        </Button>
      </div>

      {/* Layout View */}
      <TablesLayoutView
        eventId={eventId}
        bookings={bookings}
        businessSlug={businessSlug}
        venueLayoutUrl={venueLayoutUrl}
        tableServiceConfig={tableServiceConfig}
        sectionTableNames={sectionTableNames}
        eventTableSections={eventTableSections}
        closedTables={closedTables}
        linkedTablePairs={linkedTablePairs}
        onEmptyTableClick={handleEmptyTableClick}
        initialBookingId={initialBookingId}
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
