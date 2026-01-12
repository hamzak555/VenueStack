import Link from 'next/link'
import { getTableBookingsByBusinessId, getEventsWithTableService, TableBooking } from '@/lib/db/table-bookings'
import { getBusinessBySlug } from '@/lib/db/businesses'
import { getEventById } from '@/lib/db/events'
import { Button } from '@/components/ui/button'
import { TablesEventSelector } from '@/components/business/tables-event-selector'
import { TablesPageContent } from '@/components/business/tables-page-content'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TableServiceConfig } from '@/lib/types'

// Force dynamic rendering to always show current data
export const dynamic = 'force-dynamic'

interface TablesPageProps {
  params: Promise<{
    businessSlug: string
  }>
  searchParams: Promise<{
    eventId?: string
    bookingId?: string
  }>
}

export default async function TablesPage({ params, searchParams }: TablesPageProps) {
  const { businessSlug } = await params
  const { eventId, bookingId } = await searchParams
  const business = await getBusinessBySlug(businessSlug)

  // If no eventId, show event selection
  if (!eventId) {
    const events = await getEventsWithTableService(business.id)

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Tables</h1>
            <p className="text-muted-foreground">
              Select an event to view and manage table reservations
            </p>
          </div>
        </div>

        <TablesEventSelector events={events} businessSlug={businessSlug} />
      </div>
    )
  }

  // Event selected - show table bookings
  let bookings: TableBooking[] = []
  let errorMessage = ''
  let event = null
  let sectionTableNames: Record<string, string[]> = {}
  let eventTableSections: { id: string; section_id: string; section_name: string; price: number; minimum_spend?: number }[] = []
  let closedTables: Record<string, string[]> = {} // sectionId -> closed table names
  let linkedTablePairs: { table1: { sectionId: string; tableName: string }; table2: { sectionId: string; tableName: string } }[] = []

  // Get the business's table service config
  const tableServiceConfig = business.table_service_config as TableServiceConfig | null
  const venueLayoutUrl = business.venue_layout_url

  try {
    event = await getEventById(eventId)
    bookings = await getTableBookingsByBusinessId(business.id, eventId)

    // Also fetch the event_table_sections to map section_id to business section_id
    const supabase = await createClient()
    const { data: eventSectionsData } = await supabase
      .from('event_table_sections')
      .select('id, section_id, section_name, total_tables, price, minimum_spend, closed_tables, linked_table_pairs')
      .eq('event_id', eventId)
      .order('id') // Order by ID to match API storage order

    if (eventSectionsData) {
      eventTableSections = eventSectionsData.map(es => ({
        id: es.id,
        section_id: es.section_id,
        section_name: es.section_name,
        price: es.price || 0,
        minimum_spend: es.minimum_spend || undefined
      }))

      // Build closed tables map (section_id -> closed table names)
      for (const es of eventSectionsData) {
        if (es.closed_tables && Array.isArray(es.closed_tables)) {
          closedTables[es.section_id] = es.closed_tables
        }
      }

      // Get linked table pairs from the first section (they apply to the whole event)
      const firstSection = eventSectionsData[0]
      if (firstSection?.linked_table_pairs && Array.isArray(firstSection.linked_table_pairs)) {
        linkedTablePairs = firstSection.linked_table_pairs
      }
    }

    // Build a map of section_id -> table names
    if (eventSectionsData && tableServiceConfig?.sections) {
      for (const eventSection of eventSectionsData) {
        const businessSection = tableServiceConfig.sections.find(s => s.id === eventSection.section_id)
        if (businessSection?.tableNames) {
          sectionTableNames[eventSection.id] = businessSection.tableNames
        } else {
          // Generate default names if no custom names exist
          sectionTableNames[eventSection.id] = Array.from(
            { length: eventSection.total_tables },
            (_, i) => `${i + 1}`
          )
        }
      }
    }
  } catch (error) {
    console.error('Error fetching table bookings:', error)
    errorMessage = error instanceof Error ? error.message : 'Unknown error'
  }

  // Check if layout view is available (either uploaded image, drawn layout, or multi-layout system)
  const hasLayoutImage = venueLayoutUrl ||
    tableServiceConfig?.drawnLayout?.boundary ||
    (tableServiceConfig?.layouts && tableServiceConfig.layouts.length > 0 &&
      tableServiceConfig.layouts.some(l => l.imageUrl || l.drawnLayout?.boundary))
  const hasLayout = hasLayoutImage && tableServiceConfig && tableServiceConfig.sections?.length > 0

  if (!hasLayout) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/${businessSlug}/dashboard/tables`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              All Events
            </Link>
          </Button>
        </div>

        <div className="text-center py-12">
          <h2 className="text-xl font-semibold mb-2">Table Layout Not Configured</h2>
          <p className="text-muted-foreground mb-4">
            Please configure your venue layout and table sections in settings.
          </p>
          <Button asChild>
            <Link href={`/${businessSlug}/dashboard/settings/table-service`}>
              Configure Floor Plan
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/${businessSlug}/dashboard/tables`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            All Events
          </Link>
        </Button>
      </div>

      {errorMessage && (
        <div className="bg-destructive/10 border border-destructive rounded-lg p-4">
          <p className="text-sm text-destructive">Error loading bookings: {errorMessage}</p>
        </div>
      )}

      <TablesPageContent
        eventId={eventId}
        eventTitle={event?.title || 'Table Bookings'}
        eventDate={event?.event_date}
        eventTime={event?.event_time}
        eventImage={event?.image_url}
        bookings={bookings as any}
        businessSlug={businessSlug}
        sectionTableNames={sectionTableNames}
        venueLayoutUrl={venueLayoutUrl}
        tableServiceConfig={tableServiceConfig!}
        eventTableSections={eventTableSections}
        closedTables={closedTables}
        linkedTablePairs={linkedTablePairs}
        initialBookingId={bookingId}
      />
    </div>
  )
}
