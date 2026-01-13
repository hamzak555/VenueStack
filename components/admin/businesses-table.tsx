'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { BusinessDashboardLink } from '@/components/admin/business-dashboard-link'
import { Search, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, Pencil } from 'lucide-react'

const ITEMS_PER_PAGE = 10

interface Business {
  id: string
  name: string
  slug: string
  subscription_status: string | null
  created_at: string
  use_custom_fee_settings: boolean
  platform_fee_type: string | null
  flat_fee_amount: number | null
  percentage_fee: number | null
}

interface Owner {
  name: string
  email: string
  phone: string | null
}

interface GlobalSettings {
  platform_fee_type: string | null
  flat_fee_amount: number | null
  percentage_fee: number | null
}

interface BusinessesTableProps {
  businesses: Business[]
  businessOwners: Record<string, Owner[]>
  globalSettings: GlobalSettings | null
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'active', label: 'Active' },
  { value: 'trialing', label: 'Trial' },
  { value: 'past_due', label: 'Past Due' },
  { value: 'canceled', label: 'Canceled' },
  { value: 'no_subscription', label: 'No Subscription' },
]

type SortField = 'name' | 'slug' | 'status' | 'created_at'
type SortDirection = 'asc' | 'desc'

export function BusinessesTable({ businesses, businessOwners, globalSettings }: BusinessesTableProps) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [sortField, setSortField] = useState<SortField>('created_at')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  const getSubscriptionBadge = (status: string | null) => {
    switch (status) {
      case 'active':
        return { label: 'Active', variant: 'success' as const }
      case 'trialing':
        return { label: 'Trial', variant: 'warning' as const }
      case 'past_due':
        return { label: 'Past Due', variant: 'destructive' as const }
      case 'canceled':
        return { label: 'Canceled', variant: 'destructive' as const }
      default:
        return { label: 'No Subscription', variant: 'purple' as const }
    }
  }

  const getFeeConfig = (business: Business) => {
    if (business.use_custom_fee_settings && business.platform_fee_type) {
      return {
        type: business.platform_fee_type,
        flat: business.flat_fee_amount,
        percentage: business.percentage_fee,
        isCustom: true
      }
    }
    return {
      type: globalSettings?.platform_fee_type || 'higher_of_both',
      flat: globalSettings?.flat_fee_amount || 0,
      percentage: globalSettings?.percentage_fee || 0,
      isCustom: false
    }
  }

  const filteredAndSortedBusinesses = useMemo(() => {
    const filtered = businesses.filter((business) => {
      // Search filter
      const searchLower = search.toLowerCase()
      const owners = businessOwners[business.id] || []
      const matchesSearch = search === '' ||
        business.name.toLowerCase().includes(searchLower) ||
        business.slug.toLowerCase().includes(searchLower) ||
        owners.some(owner =>
          owner.name?.toLowerCase().includes(searchLower) ||
          owner.email?.toLowerCase().includes(searchLower) ||
          owner.phone?.toLowerCase().includes(searchLower)
        )

      // Status filter
      const matchesStatus = statusFilter === 'all' ||
        (statusFilter === 'no_subscription' && !business.subscription_status) ||
        business.subscription_status === statusFilter

      return matchesSearch && matchesStatus
    })

    // Sort
    return filtered.sort((a, b) => {
      let comparison = 0
      switch (sortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name)
          break
        case 'slug':
          comparison = a.slug.localeCompare(b.slug)
          break
        case 'status':
          const statusA = a.subscription_status || 'zzz'
          const statusB = b.subscription_status || 'zzz'
          comparison = statusA.localeCompare(statusB)
          break
        case 'created_at':
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          break
      }
      return sortDirection === 'asc' ? comparison : -comparison
    })
  }, [businesses, businessOwners, search, statusFilter, sortField, sortDirection])

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedBusinesses.length / ITEMS_PER_PAGE)
  const paginatedBusinesses = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
    return filteredAndSortedBusinesses.slice(startIndex, startIndex + ITEMS_PER_PAGE)
  }, [filteredAndSortedBusinesses, currentPage])

  // Reset to page 1 when filters change
  const handleSearchChange = (value: string) => {
    setSearch(value)
    setCurrentPage(1)
  }

  const handleStatusChange = (value: string) => {
    setStatusFilter(value)
    setCurrentPage(1)
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
    setCurrentPage(1)
  }

  const SortableHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <TableHead>
      <button
        onClick={() => handleSort(field)}
        className="flex items-center gap-1 hover:text-foreground transition-colors"
      >
        {children}
        {sortField === field ? (
          sortDirection === 'asc' ? (
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowDown className="h-3 w-3" />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-50" />
        )}
      </button>
    </TableHead>
  )

  return (
    <div className="space-y-4">
      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, slug, contact..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={handleStatusChange}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {filteredAndSortedBusinesses.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            No businesses match your search criteria
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHeader field="name">Name</SortableHeader>
                <SortableHeader field="slug">Slug (URL)</SortableHeader>
                <TableHead>Owners</TableHead>
                <TableHead>Fee Type</TableHead>
                <TableHead>Fee Amount</TableHead>
                <SortableHeader field="status">Status</SortableHeader>
                <SortableHeader field="created_at">Created</SortableHeader>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedBusinesses.map((business) => {
                const feeConfig = getFeeConfig(business)
                const owners = businessOwners[business.id] || []
                return (
                  <TableRow key={business.id}>
                    <TableCell className="font-medium">{business.name}</TableCell>
                    <TableCell>
                      <Link
                        href={`/${business.slug}`}
                        target="_blank"
                        className="text-primary hover:underline"
                      >
                        /{business.slug}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">
                      {owners.length === 0 ? (
                        <span className="text-muted-foreground">-</span>
                      ) : (
                        <TooltipProvider>
                          <div className="flex flex-wrap gap-1">
                            {owners.map((owner, index) => (
                              <Tooltip key={index}>
                                <TooltipTrigger asChild>
                                  <span className="font-medium cursor-default hover:text-primary transition-colors">
                                    {owner.name}{index < owners.length - 1 ? ',' : ''}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-xs">
                                  <div className="space-y-1">
                                    <p className="font-medium">{owner.name}</p>
                                    <p className="text-xs">{owner.email}</p>
                                    {owner.phone && <p className="text-xs">{owner.phone}</p>}
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            ))}
                          </div>
                        </TooltipProvider>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="flex flex-col gap-1">
                        <span className="capitalize">
                          {feeConfig.type?.replace(/_/g, ' ') || 'N/A'}
                        </span>
                        {feeConfig.isCustom && (
                          <Badge variant="outline" className="w-fit text-xs">
                            Custom
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {feeConfig.type === 'flat' && (
                        <span>${feeConfig.flat?.toFixed(2)}</span>
                      )}
                      {feeConfig.type === 'percentage' && (
                        <span>{feeConfig.percentage}%</span>
                      )}
                      {feeConfig.type === 'higher_of_both' && (
                        <div className="flex flex-col">
                          <span>${feeConfig.flat?.toFixed(2)} / {feeConfig.percentage}%</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const badge = getSubscriptionBadge(business.subscription_status)
                        return (
                          <Badge variant={badge.variant}>
                            {badge.label}
                          </Badge>
                        )
                      })()}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(business.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        <BusinessDashboardLink businessId={business.id} businessSlug={business.slug} />
                        <Button variant="ghost" size="icon" asChild title="Edit">
                          <Link href={`/admin/businesses/${business.id}`}>
                            <Pencil className="h-4 w-4" />
                          </Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Results count and Pagination */}
      {filteredAndSortedBusinesses.length > 0 && (
        <div className="flex items-center justify-between pt-4">
          <p className="text-sm text-muted-foreground">
            Showing {paginatedBusinesses.length} of {filteredAndSortedBusinesses.length} result{filteredAndSortedBusinesses.length !== 1 ? 's' : ''}
            {filteredAndSortedBusinesses.length !== businesses.length && ` (${businesses.length} total)`}
          </p>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
