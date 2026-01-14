'use client'

import { useState } from 'react'
import { Customer } from '@/lib/db/customers'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Download, Search, ArrowUpDown, ArrowUp, ArrowDown, Star, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils/currency'
import { CustomerDetailPanel } from './customer-detail-panel'

interface CustomersTableProps {
  customers: Customer[]
  businessSlug: string
  title?: string
}

type SortColumn = 'name' | 'email' | 'phone' | 'total_reservations' | 'total_tickets' | 'total_spent' | 'average_rating' | 'last_purchase'
type SortDirection = 'asc' | 'desc'

const ITEMS_PER_PAGE = 25

export function CustomersTable({ customers, businessSlug, title }: CustomersTableProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [sortColumn, setSortColumn] = useState<SortColumn>('total_spent')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [selectedCustomerIdentifier, setSelectedCustomerIdentifier] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)

  // Filter customers based on search term
  const filteredCustomers = customers.filter((customer) => {
    const searchLower = searchTerm.toLowerCase()
    return (
      customer.name.toLowerCase().includes(searchLower) ||
      customer.email?.toLowerCase().includes(searchLower) ||
      customer.phone?.includes(searchTerm)
    )
  })

  // Sort customers
  const sortedCustomers = [...filteredCustomers].sort((a, b) => {
    let aValue: string | number = a[sortColumn] ?? ''
    let bValue: string | number = b[sortColumn] ?? ''

    // Handle date comparisons
    if (sortColumn === 'last_purchase') {
      aValue = new Date(aValue as string).getTime()
      bValue = new Date(bValue as string).getTime()
    }

    // Handle string comparisons (case-insensitive)
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      aValue = aValue.toLowerCase()
      bValue = bValue.toLowerCase()
    }

    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1
    return 0
  })

  // Pagination
  const totalPages = Math.ceil(sortedCustomers.length / ITEMS_PER_PAGE)
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const paginatedCustomers = sortedCustomers.slice(startIndex, startIndex + ITEMS_PER_PAGE)

  // Reset to page 1 when search changes
  const handleSearch = (value: string) => {
    setSearchTerm(value)
    setCurrentPage(1)
  }

  // Toggle sort
  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDirection('asc')
    }
    setCurrentPage(1)
  }

  // Render sort icon
  const renderSortIcon = (column: SortColumn) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="h-4 w-4 ml-1 opacity-50" />
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="h-4 w-4 ml-1" />
    ) : (
      <ArrowDown className="h-4 w-4 ml-1" />
    )
  }

  // Export to CSV
  const exportToCSV = () => {
    // Create CSV header
    const headers = ['Name', 'Email', 'Phone', 'Reservations', 'Tickets', 'Total Spent', 'Rating', 'Customer Since', 'Last Purchase']

    // Create CSV rows
    const rows = sortedCustomers.map(customer => [
      customer.name,
      customer.email || '',
      customer.phone || '',
      customer.total_reservations.toString(),
      customer.total_tickets.toString(),
      customer.total_spent.toFixed(2),
      customer.average_rating?.toFixed(1) || '',
      new Date(customer.first_purchase).toLocaleDateString(),
      new Date(customer.last_purchase).toLocaleDateString(),
    ])

    // Combine headers and rows
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(field => `"${field}"`).join(','))
    ].join('\n')

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)

    link.setAttribute('href', url)
    link.setAttribute('download', `customers-${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'

    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  if (customers.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No customers found. Customers will appear here after their first purchase.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        {title && (
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        )}
        <div className="flex items-center gap-4">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search customers..."
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button onClick={exportToCSV} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <button
                  onClick={() => handleSort('name')}
                  className="flex items-center hover:text-foreground transition-colors"
                >
                  Name
                  {renderSortIcon('name')}
                </button>
              </TableHead>
              <TableHead>
                <button
                  onClick={() => handleSort('email')}
                  className="flex items-center hover:text-foreground transition-colors"
                >
                  Email
                  {renderSortIcon('email')}
                </button>
              </TableHead>
              <TableHead>
                <button
                  onClick={() => handleSort('phone')}
                  className="flex items-center hover:text-foreground transition-colors"
                >
                  Phone
                  {renderSortIcon('phone')}
                </button>
              </TableHead>
              <TableHead className="text-right">
                <button
                  onClick={() => handleSort('total_reservations')}
                  className="flex items-center justify-end w-full hover:text-foreground transition-colors"
                >
                  Reservations
                  {renderSortIcon('total_reservations')}
                </button>
              </TableHead>
              <TableHead className="text-right">
                <button
                  onClick={() => handleSort('total_tickets')}
                  className="flex items-center justify-end w-full hover:text-foreground transition-colors"
                >
                  Tickets
                  {renderSortIcon('total_tickets')}
                </button>
              </TableHead>
              <TableHead className="text-right">
                <button
                  onClick={() => handleSort('total_spent')}
                  className="flex items-center justify-end w-full hover:text-foreground transition-colors"
                >
                  Total Spent
                  {renderSortIcon('total_spent')}
                </button>
              </TableHead>
              <TableHead>
                <button
                  onClick={() => handleSort('average_rating')}
                  className="flex items-center hover:text-foreground transition-colors"
                >
                  Rating
                  {renderSortIcon('average_rating')}
                </button>
              </TableHead>
              <TableHead>
                <button
                  onClick={() => handleSort('last_purchase')}
                  className="flex items-center hover:text-foreground transition-colors"
                >
                  Last Purchase
                  {renderSortIcon('last_purchase')}
                </button>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedCustomers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  No customers match your search.
                </TableCell>
              </TableRow>
            ) : (
              paginatedCustomers.map((customer) => (
                <TableRow
                  key={customer.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => {
                    // Use phone as primary identifier, email as fallback
                    const identifier = customer.phone || customer.email
                    if (identifier) setSelectedCustomerIdentifier(identifier)
                  }}
                >
                  <TableCell className="font-medium">{customer.name}</TableCell>
                  <TableCell>
                    {customer.email ? (
                      <div className="flex items-center gap-1">
                        <span className="truncate max-w-[180px]">{customer.email}</span>
                        {customer.emails.length > 1 && (
                          <span className="text-xs text-muted-foreground">+{customer.emails.length - 1}</span>
                        )}
                      </div>
                    ) : '-'}
                  </TableCell>
                  <TableCell>
                    {customer.phone || '-'}
                  </TableCell>
                  <TableCell className="text-right">{customer.total_reservations}</TableCell>
                  <TableCell className="text-right">{customer.total_tickets}</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(customer.total_spent, false)}
                  </TableCell>
                  <TableCell>
                    {customer.average_rating ? (
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            strokeWidth={1.5}
                            className={cn(
                              'h-3 w-3',
                              star <= Math.round(customer.average_rating!)
                                ? 'text-yellow-400 fill-yellow-900'
                                : 'text-muted-foreground/30'
                            )}
                          />
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {new Date(customer.last_purchase).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Showing {startIndex + 1}-{Math.min(startIndex + ITEMS_PER_PAGE, sortedCustomers.length)} of {sortedCustomers.length} customers
          {searchTerm && ` (filtered from ${customers.length})`}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(page => {
                  // Show first, last, current, and pages around current
                  if (page === 1 || page === totalPages) return true
                  if (Math.abs(page - currentPage) <= 1) return true
                  return false
                })
                .map((page, index, array) => {
                  // Add ellipsis where there are gaps
                  const prevPage = array[index - 1]
                  const showEllipsis = prevPage && page - prevPage > 1

                  return (
                    <span key={page} className="flex items-center">
                      {showEllipsis && <span className="px-2 text-muted-foreground">...</span>}
                      <Button
                        variant={currentPage === page ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setCurrentPage(page)}
                        className="w-8"
                      >
                        {page}
                      </Button>
                    </span>
                  )
                })}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Customer Detail Panel */}
      <CustomerDetailPanel
        open={!!selectedCustomerIdentifier}
        onOpenChange={(open) => !open && setSelectedCustomerIdentifier(null)}
        customerIdentifier={selectedCustomerIdentifier}
        businessSlug={businessSlug}
      />
    </div>
  )
}
