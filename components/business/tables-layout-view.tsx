'use client'

import { useState, useRef, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { TableSection, TableServiceConfig, DrawnVenueLayout } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { UserCheck, Eye, Phone, Mail, Search, User, ZoomIn, ZoomOut, Plus, Lock, Unlock, Link2, Unlink, StickyNote, CheckCircle, ArrowUpDown, ChevronDown, MoreVertical, Info } from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/utils/currency'
import { BookingNotesModal } from './booking-notes-modal'
import { BookingDetailsModal } from './booking-details-modal'
import { ServerAssignmentModal } from './server-assignment-modal'
import { isServerRole, canAccessSection, type BusinessRole } from '@/lib/auth/roles'

interface BookingNote {
  id: string
  content: string
  created_by_name: string
  created_by_email: string
  created_at: string
}

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
  status: 'reserved' | 'confirmed' | 'cancelled' | 'arrived' | 'seated' | 'completed'
  created_at: string
  event_title: string
  event_date: string
  section_name: string
  section_id: string
  notes?: BookingNote[]
}

interface LinkedTablePair {
  table1: { sectionId: string; tableName: string }
  table2: { sectionId: string; tableName: string }
}

interface ServerAssignment {
  tableName: string
  serverUserIds: string[]
}

interface TablesLayoutViewProps {
  eventId: string
  bookings: TableBooking[]
  businessSlug: string
  businessId: string
  venueLayoutUrl: string | null
  tableServiceConfig: TableServiceConfig
  sectionTableNames: Record<string, string[]>
  eventTableSections: { id: string; section_id: string; price: number; minimum_spend?: number }[]
  closedTables: Record<string, string[]>
  linkedTablePairs: LinkedTablePair[]
  onEmptyTableClick?: (sectionId: string, tableName: string) => void
  initialBookingId?: string
  selectedLayoutId?: string | null
  userRole?: BusinessRole
  serverAssignedTables?: Record<string, string[]>
  allServerAssignments?: Record<string, ServerAssignment[]>
}

export function TablesLayoutView({
  eventId,
  bookings,
  businessSlug,
  businessId,
  venueLayoutUrl,
  tableServiceConfig,
  sectionTableNames,
  eventTableSections,
  closedTables,
  linkedTablePairs,
  onEmptyTableClick,
  initialBookingId,
  selectedLayoutId: selectedLayoutIdProp,
  userRole,
  serverAssignedTables,
  allServerAssignments,
}: TablesLayoutViewProps) {
  const isServer = userRole ? isServerRole(userRole) : false
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasContainerRef = useRef<HTMLDivElement>(null)
  const tableRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const [imageAspectRatio, setImageAspectRatio] = useState<number | null>(null)
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 })
  const [zoom, setZoom] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('tables-layout-zoom')
      if (saved) {
        const parsed = parseFloat(saved)
        if (!isNaN(parsed) && parsed >= 0.5 && parsed <= 2.5) {
          return parsed
        }
      }
    }
    return 1.75 // Default zoom
  })
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0, panX: 0, panY: 0 })
  const [selectedTable, setSelectedTable] = useState<{ sectionId: string; tableIndex: number; tableName: string } | null>(null)
  const [markingArrived, setMarkingArrived] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortOption, setSortOption] = useState<'name' | 'table' | 'status' | 'recent'>('recent')
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null)
  const [draggingBooking, setDraggingBooking] = useState<TableBooking | null>(null)
  const [dragOverTable, setDragOverTable] = useState<{ sectionId: string; tableName: string } | null>(null)
  const [assigningTable, setAssigningTable] = useState(false)
  const [linkingMode, setLinkingMode] = useState<{ sectionId: string; tableName: string } | null>(null)
  const [isClosingTable, setIsClosingTable] = useState(false)
  const [isLinkingTable, setIsLinkingTable] = useState(false)
  const [notesModalBooking, setNotesModalBooking] = useState<TableBooking | null>(null)
  const [detailsModalBooking, setDetailsModalBooking] = useState<TableBooking | null>(null)
  const [serverAssignmentModal, setServerAssignmentModal] = useState<{ sectionId: string; tableName: string } | null>(null)
  const [serverUsers, setServerUsers] = useState<{ id: string; name: string }[]>([])
  const [unseatedOpen, setUnseatedOpen] = useState(true)
  const [seatedOpen, setSeatedOpen] = useState(true)
  const [completedOpen, setCompletedOpen] = useState(false)
  const [cancelledOpen, setCancelledOpen] = useState(false)
  const [initialBookingHandled, setInitialBookingHandled] = useState(false)

  // Check if user can manage servers (owner/manager only)
  const canManageServers = userRole ? canAccessSection(userRole, 'users') : false
  const [completionModalBooking, setCompletionModalBooking] = useState<TableBooking | null>(null)

  // Fetch server users for display
  useEffect(() => {
    if (businessId && canManageServers) {
      fetch(`/api/business/${businessId}/users?role=server`)
        .then(res => res.ok ? res.json() : [])
        .then(data => setServerUsers(Array.isArray(data) ? data : []))
        .catch(() => setServerUsers([]))
    }
  }, [businessId, canManageServers])

  // Get server names by IDs
  const getServerNames = (serverIds: string[]): string[] => {
    return serverIds
      .map(id => serverUsers.find(u => u.id === id)?.name)
      .filter((name): name is string => !!name)
  }

  // Auto-open booking details modal if initialBookingId is provided (only once)
  useEffect(() => {
    if (initialBookingId && !initialBookingHandled) {
      const booking = bookings.find(b => b.id === initialBookingId)
      if (booking) {
        setDetailsModalBooking(booking)
        setSelectedBookingId(booking.id)
        setInitialBookingHandled(true)
      }
    }
  }, [initialBookingId, bookings, initialBookingHandled])

  const sections = tableServiceConfig?.sections || []
  const fontSize = tableServiceConfig?.fontSize ?? 12
  const layouts = tableServiceConfig?.layouts || []

  // Multi-layout support: use prop or fallback to first layout
  const selectedLayoutId = selectedLayoutIdProp || layouts[0]?.id || null

  // Get current layout info
  const selectedLayout = layouts.find(l => l.id === selectedLayoutId) || layouts[0] || null
  const currentLayoutUrl = selectedLayout?.imageUrl || venueLayoutUrl
  const currentDrawnLayout = selectedLayout?.drawnLayout || tableServiceConfig?.drawnLayout

  // Check if a table is on the current layout (for multi-layout filtering)
  const isTableOnCurrentLayout = (section: TableSection, tableIndex: number): boolean => {
    const pos = section.tablePositions?.[tableIndex]
    if (!pos?.placed) return false
    // If no multi-layout support, show all placed tables
    if (!selectedLayoutId || layouts.length === 0) return true
    // Check if table's layoutId matches the selected layout
    return pos.layoutId === selectedLayoutId
  }

  // Check if a table is accessible to the current server
  const isTableAccessibleToServer = (sectionId: string, tableName: string): boolean => {
    if (!isServer || !serverAssignedTables) return true
    const assignedTables = serverAssignedTables[sectionId]
    return assignedTables?.includes(tableName) ?? false
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

  // Track canvas container size for table size calculations (same as editor)
  // We need to divide by zoom since getBoundingClientRect returns scaled dimensions
  useEffect(() => {
    const updateSize = () => {
      if (canvasContainerRef.current) {
        const rect = canvasContainerRef.current.getBoundingClientRect()
        // Divide by zoom to get the unscaled dimensions
        setCanvasSize({ width: rect.width / zoom, height: rect.height / zoom })
      }
    }

    updateSize()
    window.addEventListener('resize', updateSize)
    return () => window.removeEventListener('resize', updateSize)
  }, [imageAspectRatio, zoom])

  // Handle zoom change - reset pan when zooming back to 100%
  const handleZoomChange = (newZoom: number) => {
    setZoom(newZoom)
    localStorage.setItem('tables-layout-zoom', newZoom.toString())
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

  // Create a map of event_table_section_id -> business section_id
  const eventToBusinessSectionMap = useMemo(() => {
    const map: Record<string, string> = {}
    for (const es of eventTableSections) {
      map[es.id] = es.section_id
    }
    return map
  }, [eventTableSections])

  // Create a map of business section_id -> price
  const sectionPriceMap = useMemo(() => {
    const map: Record<string, number> = {}
    for (const es of eventTableSections) {
      map[es.section_id] = es.price
    }
    return map
  }, [eventTableSections])

  // Create a map of business section_id -> minimum_spend
  const sectionMinimumSpendMap = useMemo(() => {
    const map: Record<string, number> = {}
    for (const es of eventTableSections) {
      if (es.minimum_spend) {
        map[es.section_id] = es.minimum_spend
      }
    }
    return map
  }, [eventTableSections])

  // Create a map of tableName -> booking for quick lookup
  // Exclude cancelled and completed bookings so their tables show as available
  const bookingsByTable = useMemo(() => {
    const map: Record<string, TableBooking> = {}
    for (const booking of bookings) {
      if (booking.table_number && booking.status !== 'cancelled' && booking.status !== 'completed') {
        const businessSectionId = eventToBusinessSectionMap[booking.event_table_section_id]
        const key = `${businessSectionId}-${booking.table_number}`
        map[key] = booking
      }
    }
    return map
  }, [bookings, eventToBusinessSectionMap])

  // Filter and sort bookings for the cards list
  // Exclude only cancelled bookings - show completed reservations
  // For servers: only show bookings for their assigned tables
  const filteredBookings = useMemo(() => {
    let filtered = [...bookings]

    // For servers: filter to only show bookings for their assigned tables (exclude cancelled)
    if (isServer && serverAssignedTables) {
      filtered = filtered.filter(b => {
        // Servers don't see cancelled bookings
        if (b.status === 'cancelled') return false
        if (!b.table_number) return false
        // Get the business section ID from the event table section
        const businessSectionId = eventToBusinessSectionMap[b.event_table_section_id]
        if (!businessSectionId) return false
        const assignedTables = serverAssignedTables[businessSectionId]
        return assignedTables?.includes(b.table_number) ?? false
      })
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(b =>
        b.customer_name.toLowerCase().includes(query) ||
        b.customer_email.toLowerCase().includes(query) ||
        b.section_name.toLowerCase().includes(query) ||
        (b.table_number && b.table_number.toLowerCase().includes(query))
      )
    }

    // Sort based on selected option
    // Completed reservations show at the bottom when sorting by status
    const statusOrder: Record<string, number> = { seated: 0, arrived: 1, confirmed: 2, reserved: 3, completed: 4, cancelled: 5 }
    return [...filtered].sort((a, b) => {
      switch (sortOption) {
        case 'name':
          return a.customer_name.localeCompare(b.customer_name)
        case 'table':
          const tableA = a.table_number || 'zzz'
          const tableB = b.table_number || 'zzz'
          return tableA.localeCompare(tableB, undefined, { numeric: true })
        case 'status':
          return (statusOrder[a.status] ?? 5) - (statusOrder[b.status] ?? 5)
        case 'recent':
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      }
    })
  }, [bookings, searchQuery, sortOption, isServer, serverAssignedTables, eventToBusinessSectionMap])

  // Group bookings into Unseated, Seated, Completed, and Cancelled categories
  const groupedBookings = useMemo(() => {
    const unseated: TableBooking[] = []
    const seated: TableBooking[] = []
    const completed: TableBooking[] = []
    const cancelled: TableBooking[] = []

    for (const booking of filteredBookings) {
      if (booking.status === 'cancelled') {
        cancelled.push(booking)
      } else if (booking.status === 'completed') {
        completed.push(booking)
      } else if (booking.status === 'seated' || booking.status === 'arrived') {
        seated.push(booking)
      } else {
        // reserved, confirmed
        unseated.push(booking)
      }
    }

    return { unseated, seated, completed, cancelled }
  }, [filteredBookings])

  // Get table position from the business config
  const getTablePosition = (section: TableSection, tableIndex: number) => {
    if (section.tablePositions?.[tableIndex]?.placed) {
      return section.tablePositions[tableIndex]
    }
    return null
  }

  // Get booking for a specific table
  const getBookingForTable = (sectionId: string, tableName: string): TableBooking | null => {
    const key = `${sectionId}-${tableName}`
    return bookingsByTable[key] || null
  }

  // Check if a table is closed
  const isTableClosed = (sectionId: string, tableName: string): boolean => {
    return closedTables[sectionId]?.includes(tableName) || false
  }

  // Get all linked tables for a given table
  const getLinkedTables = (sectionId: string, tableName: string): { sectionId: string; tableName: string }[] => {
    const linked: { sectionId: string; tableName: string }[] = []
    for (const pair of linkedTablePairs) {
      if (pair.table1.sectionId === sectionId && pair.table1.tableName === tableName) {
        linked.push(pair.table2)
      }
      if (pair.table2.sectionId === sectionId && pair.table2.tableName === tableName) {
        linked.push(pair.table1)
      }
    }
    return linked
  }

  // Get current server IDs assigned to a table
  const getAssignedServerIds = (sectionId: string, tableName: string): string[] => {
    if (!allServerAssignments) return []
    const sectionAssignments = allServerAssignments[sectionId]
    if (!sectionAssignments) return []
    const assignment = sectionAssignments.find(a => a.tableName === tableName)
    return assignment?.serverUserIds || []
  }

  // Handle closing/opening a table
  const handleToggleClose = async (sectionId: string, tableName: string, currentlyClosed: boolean) => {
    setIsClosingTable(true)
    try {
      // Send business section ID - the API will find the event section
      const response = await fetch(`/api/events/${eventId}/tables/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectionId, // Business section ID
          tableName,
          closed: !currentlyClosed,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update table')
      }

      toast.success(currentlyClosed ? 'Table opened' : 'Table closed')
      setSelectedTable(null)
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update table')
    } finally {
      setIsClosingTable(false)
    }
  }

  // Handle linking tables
  const handleLinkTable = async (targetSectionId: string, targetTableName: string) => {
    if (!linkingMode) return

    setIsLinkingTable(true)
    try {
      // Send business section IDs (not event section IDs) so they match what we use for positioning
      const response = await fetch(`/api/events/${eventId}/tables/link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectionId: linkingMode.sectionId, // Business section ID
          tableName: linkingMode.tableName,
          linkToSectionId: targetSectionId, // Business section ID
          linkToTableName: targetTableName,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to link tables')
      }

      toast.success(`Linked ${linkingMode.tableName} to ${targetTableName}`)
      setLinkingMode(null)
      setSelectedTable(null)
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to link tables')
    } finally {
      setIsLinkingTable(false)
    }
  }

  // Handle unlinking a table
  const handleUnlinkTable = async (sectionId: string, tableName: string) => {
    setIsLinkingTable(true)
    try {
      // Send business section ID directly
      const response = await fetch(`/api/events/${eventId}/tables/link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectionId, // Business section ID
          tableName,
          unlink: true,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to unlink table')
      }

      toast.success('Table unlinked')
      setSelectedTable(null)
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to unlink table')
    } finally {
      setIsLinkingTable(false)
    }
  }

  // Get color based on booking status
  const getTableColor = (booking: TableBooking | null, isClosed: boolean = false) => {
    if (isClosed) return { bg: '#374151', border: '#4b5563', text: '#9ca3af' }
    if (!booking) return { bg: '#ffffff', border: '#d1d5db', text: '#374151' }
    switch (booking.status) {
      case 'completed':
        return { bg: '#10b981', border: '#059669', text: '#ffffff' } // Emerald for completed
      case 'seated':
        return { bg: '#14b8a6', border: '#0d9488', text: '#ffffff' } // Teal for seated
      case 'arrived':
        return { bg: '#22c55e', border: '#16a34a', text: '#ffffff' }
      case 'confirmed':
        return { bg: '#f59e0b', border: '#d97706', text: '#ffffff' }
      case 'reserved':
        return { bg: '#3b82f6', border: '#2563eb', text: '#ffffff' }
      default:
        return { bg: '#ffffff', border: '#d1d5db', text: '#374151' }
    }
  }

  const handleMarkArrived = async (bookingId: string) => {
    setMarkingArrived(bookingId)
    try {
      const response = await fetch(`/api/table-bookings/${bookingId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'arrived' }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to mark as arrived')
      }

      toast.success('Marked as arrived')
      setSelectedTable(null)
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to mark as arrived')
    } finally {
      setMarkingArrived(null)
    }
  }

  const handleUndoArrived = async (bookingId: string) => {
    setMarkingArrived(bookingId)
    try {
      // Change the status back to seated (keep the table)
      const response = await fetch(`/api/table-bookings/${bookingId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'seated' }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update status')
      }

      toast.success('Reverted to seated')
      setSelectedTable(null)
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to unarrive')
    } finally {
      setMarkingArrived(null)
    }
  }

  const handleMarkSeated = async (bookingId: string) => {
    setMarkingArrived(bookingId)
    try {
      const response = await fetch(`/api/table-bookings/${bookingId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'seated' }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to mark as seated')
      }

      toast.success('Marked as seated')
      setSelectedTable(null)
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to mark as seated')
    } finally {
      setMarkingArrived(null)
    }
  }

  const handleUndoSeated = async (bookingId: string) => {
    setMarkingArrived(bookingId)
    try {
      // First, remove the table assignment
      const assignResponse = await fetch(`/api/table-bookings/${bookingId}/assign-table`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableName: null }),
      })

      if (!assignResponse.ok) {
        const data = await assignResponse.json()
        throw new Error(data.error || 'Failed to remove table assignment')
      }

      // Then, change the status back to confirmed
      const statusResponse = await fetch(`/api/table-bookings/${bookingId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'confirmed' }),
      })

      if (!statusResponse.ok) {
        const data = await statusResponse.json()
        throw new Error(data.error || 'Failed to update status')
      }

      toast.success('Unseated and removed from table')
      setSelectedTable(null)
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to unseat')
    } finally {
      setMarkingArrived(null)
    }
  }

  const handleReopen = async (bookingId: string) => {
    setMarkingArrived(bookingId)
    try {
      const response = await fetch(`/api/table-bookings/${bookingId}/reopen`, {
        method: 'POST',
        credentials: 'include',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to reopen reservation')
      }

      toast.success('Reservation reopened')
      setSelectedTable(null)
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to reopen')
    } finally {
      setMarkingArrived(null)
    }
  }

  const handleCancel = async (bookingId: string) => {
    setMarkingArrived(bookingId)
    try {
      const response = await fetch(`/api/table-bookings/${bookingId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: 'cancelled' }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to cancel reservation')
      }

      toast.success('Reservation cancelled')
      setSelectedTable(null)
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to cancel')
    } finally {
      setMarkingArrived(null)
    }
  }

  const handleTableClick = (e: React.MouseEvent, sectionId: string, tableIndex: number, tableName: string, hasBooking: boolean) => {
    e.stopPropagation()

    // If table is empty and double-clicked or we have an onEmptyTableClick handler
    // For now, single click selects, and the popup shows "Add Reservation" for empty tables
    if (selectedTable?.sectionId === sectionId && selectedTable?.tableIndex === tableIndex) {
      // If clicking again on same empty table, open the new reservation modal
      if (!hasBooking && onEmptyTableClick) {
        // Find the event table section ID from the business section ID
        const eventSection = eventTableSections.find(es => es.section_id === sectionId)
        if (eventSection) {
          onEmptyTableClick(eventSection.id, tableName)
          setSelectedTable(null)
          return
        }
      }
      setSelectedTable(null)
    } else {
      setSelectedTable({ sectionId, tableIndex, tableName })
    }
  }

  const handleBookingCardClick = (booking: TableBooking) => {
    setSelectedBookingId(booking.id)

    // For completed reservations, open details modal directly since they're not on a table
    if (booking.status === 'completed') {
      setDetailsModalBooking(booking)
      return
    }

    if (booking.table_number) {
      const businessSectionId = eventToBusinessSectionMap[booking.event_table_section_id]
      const section = sections.find(s => s.id === businessSectionId)
      if (section) {
        const tableIndex = section.tableNames?.findIndex(name => name === booking.table_number) ?? -1
        if (tableIndex >= 0) {
          setSelectedTable({ sectionId: businessSectionId, tableIndex, tableName: booking.table_number })

          // Scroll to the table element
          const tableKey = `${businessSectionId}-${tableIndex}`
          setTimeout(() => {
            const tableElement = tableRefs.current[tableKey]
            if (tableElement) {
              tableElement.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })
            }
          }, 50)
        }
      }
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'purple'
      case 'seated': return 'teal'
      case 'arrived': return 'success'
      case 'confirmed': return 'warning'
      case 'reserved': return 'secondary'
      case 'cancelled': return 'destructive'
      default: return 'secondary'
    }
  }

  const businessToEventSectionMap = useMemo(() => {
    const map: Record<string, string> = {}
    for (const es of eventTableSections) {
      map[es.section_id] = es.id
    }
    return map
  }, [eventTableSections])

  const handleAssignTable = async (bookingId: string, tableName: string, newSectionId?: string) => {
    setAssigningTable(true)
    try {
      const response = await fetch(`/api/table-bookings/${bookingId}/assign-table`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableName, newSectionId }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to assign table')
      }

      toast.success(`Seated at table ${tableName}`)
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to assign table')
    } finally {
      setAssigningTable(false)
      setDraggingBooking(null)
      setDragOverTable(null)
    }
  }

  const handleDragStart = (e: React.DragEvent, booking: TableBooking) => {
    setDraggingBooking(booking)
    setSelectedTable(null)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', booking.id)

    // Create custom drag image with proper rounded corners and background
    const target = e.currentTarget as HTMLElement
    const clone = target.cloneNode(true) as HTMLElement
    const computedStyle = window.getComputedStyle(target)

    clone.style.position = 'absolute'
    clone.style.top = '-9999px'
    clone.style.left = '-9999px'
    clone.style.width = `${target.offsetWidth}px`
    clone.style.background = '#1c1c1c' // Dark background for dark mode
    clone.style.borderRadius = computedStyle.borderRadius || '8px'
    clone.style.overflow = 'hidden'
    clone.style.border = computedStyle.border
    clone.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)'
    document.body.appendChild(clone)
    e.dataTransfer.setDragImage(clone, target.offsetWidth / 2, 20)

    // Clean up clone after a short delay
    requestAnimationFrame(() => {
      document.body.removeChild(clone)
    })
  }

  const handleDragEnd = () => {
    setDraggingBooking(null)
    setDragOverTable(null)
  }

  const canDropOnTable = (sectionId: string, tableName: string): boolean => {
    if (!draggingBooking) return false
    const eventSectionId = businessToEventSectionMap[sectionId]
    if (!eventSectionId) return false
    // Can't drop on closed tables
    if (isTableClosed(sectionId, tableName)) return false
    // Allow dropping on any section, not just the same one
    const existingBooking = getBookingForTable(sectionId, tableName)
    if (existingBooking && existingBooking.id !== draggingBooking.id) return false
    return true
  }

  const handleTableDragOver = (e: React.DragEvent, sectionId: string, tableName: string) => {
    if (!canDropOnTable(sectionId, tableName)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverTable({ sectionId, tableName })
  }

  const handleTableDragLeave = () => {
    setDragOverTable(null)
  }

  const handleTableDrop = (e: React.DragEvent, sectionId: string, tableName: string) => {
    e.preventDefault()
    if (!draggingBooking || !canDropOnTable(sectionId, tableName)) return
    // Get the event section ID for the target section
    const newEventSectionId = businessToEventSectionMap[sectionId]
    // Only pass newSectionId if it's different from the current section
    const newSectionId = newEventSectionId !== draggingBooking.event_table_section_id ? newEventSectionId : undefined
    handleAssignTable(draggingBooking.id, tableName, newSectionId)
  }

  return (
    <div className="flex flex-col-reverse lg:flex-row gap-4 lg:gap-6 lg:h-[calc(100vh-180px)] lg:min-h-[600px]">
      {/* Reservations List - Below on mobile, Left on desktop */}
      <div className="w-full lg:w-[340px] flex-shrink-0 flex flex-col bg-background border rounded-xl overflow-hidden h-[40vh] lg:h-auto">
        <div className="p-4 border-b bg-muted/30">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-lg">Reservations</h2>
            <Select value={sortOption} onValueChange={(value: 'name' | 'table' | 'status' | 'recent') => setSortOption(value)}>
              <SelectTrigger className="w-[130px] h-8 text-xs">
                <ArrowUpDown className="h-3 w-3 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Recent</SelectItem>
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="table">Table</SelectItem>
                <SelectItem value="status">Status</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, table..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-background"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {filteredBookings.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <User className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p>{searchQuery ? 'No matching reservations' : 'No reservations yet'}</p>
            </div>
          ) : (
            <>
              {/* Unseated Section */}
              <Collapsible open={unseatedOpen} onOpenChange={setUnseatedOpen}>
                <CollapsibleTrigger className="flex items-center justify-between w-full px-2 py-1.5 rounded-md bg-muted/50 hover:bg-muted/70 transition-colors">
                  <div className="flex items-center gap-2">
                    <ChevronDown className={`h-4 w-4 transition-transform ${unseatedOpen ? '' : '-rotate-90'}`} />
                    <span className="font-medium text-sm">Unseated</span>
                    <Badge variant="warning" className="text-xs h-5 px-1.5">{groupedBookings.unseated.length}</Badge>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-2 mt-2">
                  {groupedBookings.unseated.map(booking => (
                    <Card
                      key={booking.id}
                      draggable={!isServer}
                      onDragStart={(e) => !isServer && handleDragStart(e, booking)}
                      onDragEnd={handleDragEnd}
                      className={`cursor-pointer transition-all hover:shadow-md hover:border-primary/30 ${
                        selectedBookingId === booking.id ? 'ring-2 ring-primary border-primary shadow-md' : ''
                      } ${draggingBooking?.id === booking.id ? 'opacity-50 scale-[0.98]' : ''}`}
                      onClick={() => handleBookingCardClick(booking)}
                    >
                      <CardContent className="px-3 py-1.5">
                        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground mb-1">
                          <span>
                            {booking.table_number ? 'Table' : booking.requested_table_number ? 'Requested' : 'Table'}{' '}
                            <span className={`font-medium ${booking.requested_table_number && !booking.table_number ? 'text-amber-500' : 'text-foreground'}`}>
                              {booking.table_number || booking.requested_table_number || '—'}
                            </span>
                          </span>
                          {(() => {
                            const businessSectionId = eventToBusinessSectionMap[booking.event_table_section_id]
                            const minimumSpend = businessSectionId ? sectionMinimumSpendMap[businessSectionId] : 0
                            return (
                              <div className="flex items-center gap-2">
                                {booking.amount != null && booking.amount > 0 && (
                                  <span className="font-medium text-green-500">Deposit {formatCurrency(booking.amount, false)}</span>
                                )}
                                {minimumSpend > 0 && (
                                  <span className="text-amber-500 whitespace-nowrap">Min ${Math.round(minimumSpend)}</span>
                                )}
                              </div>
                            )
                          })()}
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium truncate">{booking.customer_name}</p>
                            <p className="text-xs text-muted-foreground truncate">{booking.section_name}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant={getStatusColor(booking.status)} className="text-xs">
                              {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                            </Badge>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                                <DropdownMenuItem onClick={() => setDetailsModalBooking(booking)}>
                                  View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setNotesModalBooking(booking)}>
                                  <span className="flex items-center gap-2">
                                    Add Notes
                                    {booking.notes && booking.notes.length > 0 && (
                                      <span className="inline-flex items-center justify-center h-5 min-w-5 px-1 text-[10px] font-medium bg-green-500 text-white rounded-full">
                                        {booking.notes.length}
                                      </span>
                                    )}
                                  </span>
                                </DropdownMenuItem>
                                {!isServer && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() => handleCancel(booking.id)}
                                      className="text-destructive focus:text-destructive"
                                    >
                                      Cancel Reservation
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {groupedBookings.unseated.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-2">No unseated reservations</p>
                  )}
                </CollapsibleContent>
              </Collapsible>

              {/* Seated Section */}
              <Collapsible open={seatedOpen} onOpenChange={setSeatedOpen}>
                <CollapsibleTrigger className="flex items-center justify-between w-full px-2 py-1.5 rounded-md bg-muted/50 hover:bg-muted/70 transition-colors">
                  <div className="flex items-center gap-2">
                    <ChevronDown className={`h-4 w-4 transition-transform ${seatedOpen ? '' : '-rotate-90'}`} />
                    <span className="font-medium text-sm">Seated</span>
                    <Badge variant="teal" className="text-xs h-5 px-1.5">{groupedBookings.seated.length}</Badge>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-2 mt-2">
                  {groupedBookings.seated.map(booking => (
                    <Card
                      key={booking.id}
                      draggable={!isServer}
                      onDragStart={(e) => !isServer && handleDragStart(e, booking)}
                      onDragEnd={handleDragEnd}
                      className={`cursor-pointer transition-all hover:shadow-md hover:border-primary/30 ${
                        selectedBookingId === booking.id ? 'ring-2 ring-primary border-primary shadow-md' : ''
                      } ${draggingBooking?.id === booking.id ? 'opacity-50 scale-[0.98]' : ''}`}
                      onClick={() => handleBookingCardClick(booking)}
                    >
                      <CardContent className="px-3 py-1.5">
                        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground mb-1">
                          <span>
                            Table{' '}
                            <span className="font-medium text-foreground">
                              {booking.table_number || '—'}
                            </span>
                          </span>
                          {(() => {
                            const businessSectionId = eventToBusinessSectionMap[booking.event_table_section_id]
                            const minimumSpend = businessSectionId ? sectionMinimumSpendMap[businessSectionId] : 0
                            return (
                              <div className="flex items-center gap-2">
                                {booking.amount != null && booking.amount > 0 && (
                                  <span className="font-medium text-green-500">Deposit {formatCurrency(booking.amount, false)}</span>
                                )}
                                {minimumSpend > 0 && (
                                  <span className="text-amber-500 whitespace-nowrap">Min ${Math.round(minimumSpend)}</span>
                                )}
                              </div>
                            )
                          })()}
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium truncate">{booking.customer_name}</p>
                            <p className="text-xs text-muted-foreground truncate">{booking.section_name}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant={getStatusColor(booking.status)} className="text-xs">
                              {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                            </Badge>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                                <DropdownMenuItem onClick={() => setDetailsModalBooking(booking)}>
                                  View Details
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                {booking.status === 'seated' && (
                                  <>
                                    <DropdownMenuItem onClick={() => handleUndoSeated(booking.id)}>
                                      Unseat
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleMarkArrived(booking.id)}>
                                      Arrive
                                    </DropdownMenuItem>
                                  </>
                                )}
                                {booking.status === 'arrived' && (
                                  <>
                                    <DropdownMenuItem onClick={() => handleUndoArrived(booking.id)}>
                                      Unarrive
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => setCompletionModalBooking(booking)}>
                                      Complete
                                    </DropdownMenuItem>
                                  </>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => setNotesModalBooking(booking)}>
                                  <span className="flex items-center gap-2">
                                    Add Notes
                                    {booking.notes && booking.notes.length > 0 && (
                                      <span className="inline-flex items-center justify-center h-5 min-w-5 px-1 text-[10px] font-medium bg-green-500 text-white rounded-full">
                                        {booking.notes.length}
                                      </span>
                                    )}
                                  </span>
                                </DropdownMenuItem>
                                {canManageServers && booking.table_number && (
                                  <DropdownMenuItem onClick={() => {
                                    const businessSectionId = eventToBusinessSectionMap[booking.event_table_section_id]
                                    if (businessSectionId) {
                                      setServerAssignmentModal({ sectionId: businessSectionId, tableName: booking.table_number! })
                                    }
                                  }}>
                                    Assign Server
                                  </DropdownMenuItem>
                                )}
                                {!isServer && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() => handleCancel(booking.id)}
                                      className="text-destructive focus:text-destructive"
                                    >
                                      Cancel Reservation
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {groupedBookings.seated.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-2">No seated reservations</p>
                  )}
                </CollapsibleContent>
              </Collapsible>

              {/* Completed Section */}
              <Collapsible open={completedOpen} onOpenChange={setCompletedOpen}>
                <CollapsibleTrigger className="flex items-center justify-between w-full px-2 py-1.5 rounded-md bg-muted/50 hover:bg-muted/70 transition-colors">
                  <div className="flex items-center gap-2">
                    <ChevronDown className={`h-4 w-4 transition-transform ${completedOpen ? '' : '-rotate-90'}`} />
                    <span className="font-medium text-sm">Completed</span>
                    <Badge variant="purple" className="text-xs h-5 px-1.5">{groupedBookings.completed.length}</Badge>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-2 mt-2">
                  {groupedBookings.completed.map(booking => (
                    <Card
                      key={booking.id}
                      className={`cursor-pointer transition-all hover:shadow-md hover:border-primary/30 opacity-60 bg-muted/30 ${
                        selectedBookingId === booking.id ? 'ring-2 ring-primary border-primary shadow-md' : ''
                      }`}
                      onClick={() => handleBookingCardClick(booking)}
                    >
                      <CardContent className="px-3 py-1.5">
                        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground mb-1">
                          <span>
                            Was Table{' '}
                            <span className="font-medium text-foreground">
                              {booking.completed_table_number || booking.table_number || '—'}
                            </span>
                          </span>
                          {booking.amount != null && booking.amount > 0 && (
                            <span className="font-medium text-green-500">Deposit {formatCurrency(booking.amount, false)}</span>
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium truncate">{booking.customer_name}</p>
                            <p className="text-xs text-muted-foreground truncate">{booking.section_name}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant="purple" className="text-xs">
                              Completed
                            </Badge>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                                <DropdownMenuItem onClick={() => setDetailsModalBooking(booking)}>
                                  View Details
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleReopen(booking.id)}>
                                  Reopen
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => setNotesModalBooking(booking)}>
                                  <span className="flex items-center gap-2">
                                    Add Notes
                                    {booking.notes && booking.notes.length > 0 && (
                                      <span className="inline-flex items-center justify-center h-5 min-w-5 px-1 text-[10px] font-medium bg-green-500 text-white rounded-full">
                                        {booking.notes.length}
                                      </span>
                                    )}
                                  </span>
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {groupedBookings.completed.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-2">No completed reservations</p>
                  )}
                </CollapsibleContent>
              </Collapsible>

              {/* Cancelled Section */}
              <Collapsible open={cancelledOpen} onOpenChange={setCancelledOpen}>
                <CollapsibleTrigger className="flex items-center justify-between w-full px-2 py-1.5 rounded-md bg-muted/50 hover:bg-muted/70 transition-colors">
                  <div className="flex items-center gap-2">
                    <ChevronDown className={`h-4 w-4 transition-transform ${cancelledOpen ? '' : '-rotate-90'}`} />
                    <span className="font-medium text-sm">Cancelled</span>
                    <Badge variant="destructive" className="text-xs h-5 px-1.5">{groupedBookings.cancelled.length}</Badge>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-2 mt-2">
                  {groupedBookings.cancelled.map(booking => (
                    <Card
                      key={booking.id}
                      className="cursor-pointer transition-all hover:shadow-md hover:border-primary/30 opacity-60"
                      onClick={() => setDetailsModalBooking(booking)}
                    >
                      <CardContent className="px-3 py-1.5">
                        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground mb-1">
                          <span>
                            Table{' '}
                            <span className="font-medium text-foreground">
                              {booking.table_number || '—'}
                            </span>
                          </span>
                          {booking.amount != null && booking.amount > 0 && (
                            <span className="font-medium text-muted-foreground">Deposit {formatCurrency(booking.amount, false)}</span>
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium truncate">{booking.customer_name}</p>
                            <p className="text-xs text-muted-foreground truncate">{booking.section_name}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant="destructive" className="text-xs">
                              Cancelled
                            </Badge>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                                <DropdownMenuItem onClick={() => setDetailsModalBooking(booking)}>
                                  View Details
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleReopen(booking.id)}>
                                  Reopen
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => setNotesModalBooking(booking)}>
                                  <span className="flex items-center gap-2">
                                    Add Notes
                                    {booking.notes && booking.notes.length > 0 && (
                                      <span className="inline-flex items-center justify-center h-5 min-w-5 px-1 text-[10px] font-medium bg-green-500 text-white rounded-full">
                                        {booking.notes.length}
                                      </span>
                                    )}
                                  </span>
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {groupedBookings.cancelled.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-2">No cancelled reservations</p>
                  )}
                </CollapsibleContent>
              </Collapsible>
            </>
          )}
        </div>
      </div>

      {/* Layout Map - Above on mobile, Right on desktop */}
      <div
        className="relative border rounded-lg bg-neutral-900 flex flex-col h-[65vh] lg:h-auto lg:flex-1"
      >
        {/* Scrollable content area */}
        <div className="absolute inset-0 overflow-auto">
          <div
            className="min-h-full relative flex items-start justify-center pt-6"
            style={{
              cursor: linkingMode ? 'crosshair' : (zoom > 1 ? (isPanning ? 'grabbing' : 'grab') : 'default'),
            }}
            onClick={() => {
              if (isPanning) return
              if (linkingMode) {
                setLinkingMode(null)
              } else {
                setSelectedTable(null)
              }
            }}
            onMouseDown={handleCanvasPanStart}
          >
        {imageAspectRatio ? (
          <div
            ref={containerRef}
            className="relative"
            style={{
              width: '100%',
              height: '100%',
              maxWidth: `calc(650px * ${imageAspectRatio})`,
              maxHeight: '650px',
              aspectRatio: `${imageAspectRatio}`,
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: 'top center',
              marginBottom: '24px',
            }}
          >
            {/* Canvas container that matches image dimensions exactly */}
            <div
              ref={canvasContainerRef}
              className="absolute inset-0"
            >
            {/* Venue Image */}
            {currentLayoutUrl && (
              <Image
                src={currentLayoutUrl}
                alt="Venue layout"
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

            {/* Linked Table Lines - behind tables */}
            <svg className="absolute inset-0 pointer-events-none" style={{ width: '100%', height: '100%', zIndex: 5 }}>
              {linkedTablePairs.map((pair, pairIndex) => {
                // Find the positions of both tables
                const section1 = sections.find(s => s.id === pair.table1.sectionId)
                const section2 = sections.find(s => s.id === pair.table2.sectionId)
                if (!section1 || !section2) return null

                const tableIndex1 = section1.tableNames?.findIndex(n => n === pair.table1.tableName) ?? -1
                const tableIndex2 = section2.tableNames?.findIndex(n => n === pair.table2.tableName) ?? -1
                if (tableIndex1 < 0 || tableIndex2 < 0) return null

                const pos1 = getTablePosition(section1, tableIndex1)
                const pos2 = getTablePosition(section2, tableIndex2)
                if (!pos1 || !pos2) return null

                // Use fixed reference size matching the editor (900x650)
                const referenceWidth = 900
                const referenceHeight = 650

                // Calculate center points of each table in percentages
                const x1 = pos1.x + (pos1.width / referenceWidth * 100) / 2
                const y1 = pos1.y + (pos1.height / referenceHeight * 100) / 2
                const x2 = pos2.x + (pos2.width / referenceWidth * 100) / 2
                const y2 = pos2.y + (pos2.height / referenceHeight * 100) / 2

                return (
                  <line
                    key={`link-${pairIndex}`}
                    x1={`${x1}%`}
                    y1={`${y1}%`}
                    x2={`${x2}%`}
                    y2={`${y2}%`}
                    stroke="#8b5cf6"
                    strokeWidth="2"
                  />
                )
              })}
            </svg>

            {/* Table Markers */}
            {sections.map((section) => (
              Array.from({ length: section.tableCount }).map((_, tableIndex) => {
                const pos = getTablePosition(section, tableIndex)
                if (!pos) return null

                // Filter by layout - only show tables on current layout
                if (!isTableOnCurrentLayout(section, tableIndex)) return null

                const tableName = section.tableNames?.[tableIndex] || `${tableIndex + 1}`

                // For servers: only show tables they are assigned to
                if (!isTableAccessibleToServer(section.id, tableName)) return null

                const booking = getBookingForTable(section.id, tableName)
                const isClosed = isTableClosed(section.id, tableName)
                const linkedTables = getLinkedTables(section.id, tableName)
                const colors = getTableColor(booking, isClosed)
                const isSelected = selectedTable?.sectionId === section.id && selectedTable?.tableIndex === tableIndex
                const isLinkTarget = linkingMode && !isClosed && (linkingMode.sectionId !== section.id || linkingMode.tableName !== tableName)
                const isDragOver = dragOverTable?.sectionId === section.id && dragOverTable?.tableName === tableName
                const canDrop = draggingBooking ? canDropOnTable(section.id, tableName) : false

                // Table sizes are stored in pixels - use them directly to maintain aspect ratio
                let borderStyle = isSelected ? '2px solid #3b82f6' : `2px solid ${colors.border}`
                if (isDragOver && canDrop) {
                  borderStyle = '3px dashed #22c55e'
                } else if (draggingBooking && canDrop) {
                  borderStyle = '2px dashed #22c55e'
                } else if (linkingMode && isLinkTarget) {
                  borderStyle = '2px dashed #8b5cf6'
                } else if (linkedTables.length > 0) {
                  borderStyle = `2px solid #8b5cf6`
                }

                return (
                  <div
                    key={`${section.id}-${tableIndex}`}
                    ref={(el) => { tableRefs.current[`${section.id}-${tableIndex}`] = el }}
                    data-table="true"
                    draggable={!isServer && !!booking}
                    onDragStart={(e) => !isServer && booking && handleDragStart(e, booking)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => handleTableDragOver(e, section.id, tableName)}
                    onDragLeave={handleTableDragLeave}
                    onDrop={(e) => handleTableDrop(e, section.id, tableName)}
                    className={`absolute flex items-center justify-center font-bold select-none transition-all ${
                      isSelected ? 'z-20' : 'z-10'
                    } cursor-pointer ${isDragOver && canDrop ? 'scale-110' : ''} ${
                      draggingBooking && !canDrop ? 'opacity-40' : ''
                    }`}
                    style={{
                      left: `${pos.x}%`,
                      top: `${pos.y}%`,
                      width: `${pos.width}px`,
                      height: `${pos.height}px`,
                      fontSize: `${fontSize}px`,
                      backgroundColor: isDragOver && canDrop ? '#dcfce7' : colors.bg,
                      color: isDragOver && canDrop ? '#166534' : colors.text,
                      border: borderStyle,
                      borderRadius: pos.shape === 'circle' ? '50%' : '6px',
                      boxShadow: isSelected
                        ? '0 0 0 3px rgba(59, 130, 246, 0.4), 0 4px 12px rgba(0,0,0,0.15)'
                        : '0 2px 4px rgba(0,0,0,0.1)',
                    }}
                    onClick={(e) => {
                      if (linkingMode && isLinkTarget) {
                        e.stopPropagation()
                        handleLinkTable(section.id, tableName)
                      } else {
                        handleTableClick(e, section.id, tableIndex, tableName, !!booking)
                      }
                    }}
                  >
                    <span className="truncate px-1">{tableName}</span>

                    {isSelected && (
                      <div
                        className="absolute top-full left-1/2 mt-2 bg-background border rounded-xl shadow-xl p-4 min-w-[220px] z-30"
                        style={{ transform: `translateX(-50%) scale(${1/zoom})`, transformOrigin: 'top center' }}
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        {booking ? (
                          <div className="space-y-3">
                            <div>
                              <p className="text-xs text-muted-foreground mb-0.5">{section.name}</p>
                              <p className="text-base font-normal">{booking.customer_name}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant={getStatusColor(booking.status)}>
                                  {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                                </Badge>
                                {booking.amount != null && booking.amount > 0 && (
                                  <div className="flex flex-col items-center leading-none">
                                    <span className="text-[10px] text-muted-foreground">Deposit</span>
                                    <span className="text-xs font-medium text-green-500">{formatCurrency(booking.amount, false)}</span>
                                  </div>
                                )}
                                {sectionMinimumSpendMap[section.id] > 0 && (
                                  <div className="flex flex-col items-center leading-none">
                                    <span className="text-[10px] text-muted-foreground">Min</span>
                                    <span className="text-xs font-medium text-amber-500">{formatCurrency(sectionMinimumSpendMap[section.id], false)}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="space-y-1.5 text-sm text-muted-foreground font-normal">
                              <div className="flex items-center gap-2">
                                <Mail className="h-3.5 w-3.5" />
                                <span className="truncate font-normal">{booking.customer_email}</span>
                              </div>
                              {booking.customer_phone && (
                                <div className="flex items-center gap-2">
                                  <Phone className="h-3.5 w-3.5" />
                                  <span className="font-normal">{booking.customer_phone}</span>
                                </div>
                              )}
                              {(() => {
                                const assignedServerIds = getAssignedServerIds(section.id, tableName)
                                const serverNames = getServerNames(assignedServerIds)
                                if (serverNames.length > 0) {
                                  return (
                                    <div className="flex items-center gap-2">
                                      <User className="h-3.5 w-3.5" />
                                      <span className="font-normal">{serverNames.join(', ')}</span>
                                    </div>
                                  )
                                }
                                return null
                              })()}
                            </div>
                            {linkedTables.length > 0 && (
                              <div className="flex items-center justify-between py-2 border-t text-xs">
                                <div className="flex items-center gap-1 text-purple-600">
                                  <Link2 className="h-3 w-3" />
                                  <span>Linked to {linkedTables.map(t => t.tableName).join(', ')}</span>
                                </div>
                                {!isServer && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 w-6 p-0"
                                    onClick={() => handleUnlinkTable(section.id, tableName)}
                                    disabled={isLinkingTable}
                                    title="Unlink all"
                                  >
                                    <Unlink className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                              </div>
                            )}
                            <div className="flex flex-col gap-2 pt-3 border-t">
                              {booking.status === 'arrived' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="w-full border border-purple-500 bg-purple-500/10 text-purple-700 dark:text-purple-400 dark:bg-purple-500/20 hover:bg-purple-500/20 dark:hover:bg-purple-500/30"
                                  onClick={() => {
                                    setCompletionModalBooking(booking)
                                    setSelectedTable(null)
                                  }}
                                >
                                  <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
                                  Complete
                                </Button>
                              )}
                              {booking.status === 'seated' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="w-full border border-green-500 bg-green-500/10 text-green-700 dark:text-green-400 dark:bg-green-500/20 hover:bg-green-500/20 dark:hover:bg-green-500/30"
                                  onClick={() => handleMarkArrived(booking.id)}
                                  disabled={markingArrived === booking.id}
                                >
                                  <UserCheck className="mr-1.5 h-3.5 w-3.5" />
                                  {markingArrived === booking.id ? 'Updating...' : 'Arrive'}
                                </Button>
                              )}
                              <div className="flex items-center gap-2">
                              {booking.status === 'completed' ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="flex-1 border border-purple-500 bg-purple-500/10 text-purple-700 dark:text-purple-400 dark:bg-purple-500/20"
                                  disabled
                                >
                                  <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
                                  Completed
                                </Button>
                              ) : booking.status === 'arrived' ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="flex-1 border border-teal-500 bg-teal-500/10 text-teal-700 dark:text-teal-400 dark:bg-teal-500/20 hover:bg-teal-500/20 dark:hover:bg-teal-500/30"
                                  onClick={() => handleUndoArrived(booking.id)}
                                  disabled={markingArrived === booking.id}
                                >
                                  {markingArrived === booking.id ? 'Updating...' : 'Unarrive'}
                                </Button>
                              ) : booking.status === 'seated' ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="flex-1 border border-yellow-500 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 dark:bg-yellow-500/20 hover:bg-yellow-500/20 dark:hover:bg-yellow-500/30"
                                  onClick={() => handleUndoSeated(booking.id)}
                                  disabled={markingArrived === booking.id}
                                >
                                  {markingArrived === booking.id ? 'Updating...' : 'Unseat'}
                                </Button>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="flex-1 border border-green-500 bg-green-500/10 text-green-700 dark:text-green-400 dark:bg-green-500/20 hover:bg-green-500/20 dark:hover:bg-green-500/30"
                                  onClick={() => handleMarkArrived(booking.id)}
                                  disabled={markingArrived === booking.id}
                                >
                                  <UserCheck className="mr-1.5 h-3.5 w-3.5" />
                                  {markingArrived === booking.id ? 'Marking...' : 'Mark Arrived'}
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setNotesModalBooking(booking)
                                  setSelectedTable(null)
                                }}
                                className={`relative ${booking.notes && booking.notes.length > 0 ? 'border-green-500 bg-green-500/10 hover:bg-green-500/20' : ''}`}
                                title={booking.notes && booking.notes.length > 0 ? `${booking.notes.length} note${booking.notes.length > 1 ? 's' : ''}` : 'Add note'}
                              >
                                <StickyNote className={`h-3.5 w-3.5 ${booking.notes && booking.notes.length > 0 ? 'text-green-500' : ''}`} />
                                {booking.notes && booking.notes.length > 0 && (
                                  <span className="absolute -top-1.5 -right-1.5 h-4 w-4 bg-green-500 text-white text-[8px] rounded-full flex items-center justify-center">
                                    {booking.notes.length}
                                  </span>
                                )}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setDetailsModalBooking(booking)
                                  setSelectedTable(null)
                                }}
                                title="View details"
                              >
                                <Info className="h-3.5 w-3.5" />
                              </Button>
                              {canManageServers && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setServerAssignmentModal({ sectionId: section.id, tableName })
                                    setSelectedTable(null)
                                  }}
                                  title="Assign server"
                                >
                                  <User className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          </div>
                          </div>
                        ) : (
                          <div className="text-center py-2">
                            <p className="text-xs text-muted-foreground mb-0.5">{section.name}</p>
                            <p className="font-medium text-base mb-1 text-white">Table {tableName}</p>
                            <div className="flex flex-col items-center gap-1 mb-3">
                              <div className="flex items-center gap-2">
                                {isClosed ? (
                                  <span className="text-sm text-white/70">Closed</span>
                                ) : sectionPriceMap[section.id] > 0 ? (
                                  <span className="text-sm text-white/70">
                                    Deposit <span className="font-medium text-green-500">{formatCurrency(sectionPriceMap[section.id], false)}</span>
                                  </span>
                                ) : (
                                  <span className="text-sm text-white/70">Available</span>
                                )}
                              </div>
                              {!isClosed && sectionMinimumSpendMap[section.id] > 0 && (
                                <span className="text-sm text-white/70">
                                  Min <span className="font-medium text-amber-500">{formatCurrency(sectionMinimumSpendMap[section.id], false)}</span>
                                </span>
                              )}
                              {(() => {
                                const assignedServerIds = getAssignedServerIds(section.id, tableName)
                                const serverNames = getServerNames(assignedServerIds)
                                if (serverNames.length > 0) {
                                  return (
                                    <div className="flex items-center gap-1.5 text-sm text-white/70">
                                      <User className="h-3.5 w-3.5" />
                                      <span>{serverNames.join(', ')}</span>
                                    </div>
                                  )
                                }
                                return null
                              })()}
                            </div>
                            {linkedTables.length > 0 && (
                              <div className="flex items-center justify-center gap-1 mb-3 text-xs text-purple-600">
                                <Link2 className="h-3 w-3" />
                                <span>Linked to {linkedTables.map(t => t.tableName).join(', ')}</span>
                              </div>
                            )}
                            <div className="space-y-2">
                              {!isClosed && !isServer && onEmptyTableClick && (
                                <Button
                                  size="sm"
                                  className="w-full"
                                  onClick={() => {
                                    const eventSection = eventTableSections.find(es => es.section_id === section.id)
                                    if (eventSection) {
                                      onEmptyTableClick(eventSection.id, tableName)
                                      setSelectedTable(null)
                                    }
                                  }}
                                >
                                  <Plus className="h-4 w-4 mr-2" />
                                  Add Reservation
                                </Button>
                              )}
                              {!isServer && (
                                <div className="flex gap-2 justify-center">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 w-8 p-0"
                                    onClick={() => handleToggleClose(section.id, tableName, isClosed)}
                                    disabled={isClosingTable}
                                    title={isClosed ? 'Open table' : 'Close table'}
                                  >
                                    {isClosed ? (
                                      <Unlock className="h-4 w-4 text-white" />
                                    ) : (
                                      <Lock className="h-4 w-4 text-white" />
                                    )}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 w-8 p-0"
                                    onClick={() => {
                                      setLinkingMode({ sectionId: section.id, tableName })
                                      setSelectedTable(null)
                                    }}
                                    disabled={isClosed}
                                    title="Link to another table"
                                  >
                                    <Link2 className="h-4 w-4 text-white" />
                                  </Button>
                                  {linkedTables.length > 0 && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-8 w-8 p-0"
                                      onClick={() => handleUnlinkTable(section.id, tableName)}
                                      disabled={isLinkingTable}
                                      title="Unlink all"
                                    >
                                      <Unlink className="h-4 w-4 text-white" />
                                    </Button>
                                  )}
                                  {canManageServers && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-8 w-8 p-0"
                                      onClick={() => {
                                        setServerAssignmentModal({ sectionId: section.id, tableName })
                                        setSelectedTable(null)
                                      }}
                                      title="Assign server"
                                    >
                                      <User className="h-4 w-4 text-white" />
                                    </Button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })
            ))}
            </div>
          </div>
        ) : (
          <div className="text-muted-foreground">Loading layout...</div>
        )}
          </div>
        </div>

        {/* Zoom Controls - Bottom Right */}
        <div
          className="absolute bottom-3 right-3 flex items-center gap-1 bg-background/90 backdrop-blur-sm rounded-md border p-1 shadow-sm z-50"
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

      {/* Notes Modal */}
      <BookingNotesModal
        open={!!notesModalBooking}
        onOpenChange={(open) => !open && setNotesModalBooking(null)}
        bookingId={notesModalBooking?.id || ''}
        customerName={notesModalBooking?.customer_name || ''}
        tableName={notesModalBooking?.table_number || undefined}
        onNoteAdded={() => router.refresh()}
      />

      {/* Completion Modal */}
      <BookingNotesModal
        open={!!completionModalBooking}
        onOpenChange={(open) => !open && setCompletionModalBooking(null)}
        bookingId={completionModalBooking?.id || ''}
        customerName={completionModalBooking?.customer_name || ''}
        tableName={completionModalBooking?.table_number || undefined}
        mode="complete"
        onComplete={() => {
          setCompletionModalBooking(null)
          router.refresh()
        }}
      />

      {/* Booking Details Modal */}
      <BookingDetailsModal
        open={!!detailsModalBooking}
        onOpenChange={(open) => !open && setDetailsModalBooking(null)}
        bookingId={detailsModalBooking?.id || ''}
        onStatusChange={() => router.refresh()}
        userRole={userRole}
      />

      {/* Server Assignment Modal */}
      <ServerAssignmentModal
        open={!!serverAssignmentModal}
        onOpenChange={(open) => !open && setServerAssignmentModal(null)}
        eventId={eventId}
        sectionId={serverAssignmentModal?.sectionId || ''}
        tableName={serverAssignmentModal?.tableName || ''}
        currentAssignedServerIds={serverAssignmentModal ? getAssignedServerIds(serverAssignmentModal.sectionId, serverAssignmentModal.tableName) : []}
        businessId={businessId}
        onAssignmentChange={() => router.refresh()}
      />
    </div>
  )
}
