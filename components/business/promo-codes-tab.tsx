'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { PromoCode } from '@/lib/db/promo-codes'
import { Pencil } from 'lucide-react'

interface PromoCodesTabProps {
  eventId: string
  businessId: string
  businessSlug: string
  isRecurringEvent?: boolean
}

export default function PromoCodesTab({ eventId, businessId, businessSlug }: PromoCodesTabProps) {
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchPromoCodes()
  }, [eventId])

  const fetchPromoCodes = async () => {
    try {
      const response = await fetch(`/api/events/${eventId}/promo-codes`)
      if (response.ok) {
        const data = await response.json()
        setPromoCodes(data)
      }
    } catch (error) {
      console.error('Error fetching promo codes:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const getUsageText = (promoCode: PromoCode) => {
    if (promoCode.max_uses === null) {
      return `${promoCode.current_uses} / Unlimited`
    }
    return `${promoCode.current_uses} / ${promoCode.max_uses}`
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Promo Codes</CardTitle>
            <CardDescription>
              Create discount codes for this event
            </CardDescription>
          </div>
          <Button asChild>
            <Link href={`/${businessSlug}/dashboard/events/${eventId}/promo/new`}>
              Create Promo Code
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Loading promo codes...
          </p>
        ) : promoCodes.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No promo codes created yet. Create promo codes to offer discounts to your customers.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead>Usage</TableHead>
                <TableHead>Valid Period</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {promoCodes.map((promoCode) => (
                <TableRow key={promoCode.id}>
                  <TableCell className="font-medium font-mono">
                    {promoCode.code}
                  </TableCell>
                  <TableCell>
                    {promoCode.discount_type === 'percentage'
                      ? `${promoCode.discount_value}%`
                      : `$${promoCode.discount_value.toFixed(2)}`}
                  </TableCell>
                  <TableCell>{getUsageText(promoCode)}</TableCell>
                  <TableCell className="text-sm">
                    {formatDate(promoCode.valid_from)} - {formatDate(promoCode.valid_until)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={promoCode.is_active ? 'success' : 'secondary'}>
                      {promoCode.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      asChild
                    >
                      <Link href={`/${businessSlug}/dashboard/events/${eventId}/promo/${promoCode.id}/edit`}>
                        <Pencil className="h-4 w-4" />
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
