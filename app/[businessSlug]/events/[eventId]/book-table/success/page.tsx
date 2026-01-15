'use client'

import { useEffect, useState, use } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Armchair, Loader2, Calendar } from 'lucide-react'

export default function TableBookingSuccessPage({ params }: { params: Promise<{ businessSlug: string; eventId: string }> }) {
  const resolvedParams = use(params)
  const searchParams = useSearchParams()
  const paymentIntent = searchParams.get('payment_intent')
  const orderId = searchParams.get('orderId')

  const [isVerifying, setIsVerifying] = useState(true)
  const [bookingDetails, setBookingDetails] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [imageGlowColors, setImageGlowColors] = useState<string[]>([
    'rgba(255, 255, 255, 0.1)',
    'rgba(200, 200, 200, 0.1)',
    'rgba(150, 150, 150, 0.1)'
  ])

  useEffect(() => {
    if (paymentIntent) {
      verifyPayment()
    } else if (orderId) {
      // Free booking - fetch details directly
      fetchFreeBookingDetails()
    } else {
      setError('No booking information provided')
      setIsVerifying(false)
    }
  }, [paymentIntent, orderId])

  useEffect(() => {
    if (!bookingDetails?.eventImageUrl) return

    const img = document.createElement('img')
    img.crossOrigin = 'Anonymous'
    img.src = bookingDetails.eventImageUrl

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        canvas.width = img.width
        canvas.height = img.height
        ctx.drawImage(img, 0, 0)

        const sampleSize = 60
        const colors: string[] = []

        const samplePoints = [
          { x: img.width / 2, y: img.height / 2 },
          { x: img.width / 4, y: img.height / 4 },
          { x: (3 * img.width) / 4, y: img.height / 4 },
          { x: img.width / 2, y: (3 * img.height) / 4 }
        ]

        for (const point of samplePoints) {
          const imageData = ctx.getImageData(
            Math.max(0, point.x - sampleSize / 2),
            Math.max(0, point.y - sampleSize / 2),
            sampleSize,
            sampleSize
          )

          let r = 0, g = 0, b = 0
          const pixels = imageData.data.length / 4

          for (let i = 0; i < imageData.data.length; i += 4) {
            r += imageData.data[i]
            g += imageData.data[i + 1]
            b += imageData.data[i + 2]
          }

          r = Math.floor(r / pixels)
          g = Math.floor(g / pixels)
          b = Math.floor(b / pixels)

          colors.push(`rgba(${r}, ${g}, ${b}, 0.6)`)
        }

        setImageGlowColors(colors)
      } catch (error) {
        console.error('Error extracting image colors:', error)
      }
    }
  }, [bookingDetails?.eventImageUrl])

  const verifyPayment = async () => {
    try {
      const response = await fetch(`/api/checkout/verify-payment-intent?payment_intent=${paymentIntent}`)
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to verify payment')
      }
      const data = await response.json()
      setBookingDetails(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsVerifying(false)
    }
  }

  const fetchFreeBookingDetails = async () => {
    try {
      const response = await fetch(`/api/checkout/get-table-booking?orderId=${orderId}`)
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to fetch booking details')
      }
      const data = await response.json()
      setBookingDetails(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsVerifying(false)
    }
  }

  const addToCalendar = () => {
    if (!bookingDetails || !bookingDetails.eventDate) return

    const formatICSDate = (date: string, time?: string) => {
      const d = new Date(date)
      if (time) {
        const [hours, minutes] = time.split(':')
        d.setHours(parseInt(hours), parseInt(minutes), 0, 0)
      }
      return d.toISOString().replace(/[-:.]/g, '').slice(0, -1) + 'Z'
    }

    const startDate = formatICSDate(bookingDetails.eventDate, bookingDetails.eventTime)

    const endDateTime = new Date(bookingDetails.eventDate)
    if (bookingDetails.eventTime) {
      const [hours, minutes] = bookingDetails.eventTime.split(':')
      endDateTime.setHours(parseInt(hours) + 2, parseInt(minutes), 0, 0)
    } else {
      endDateTime.setHours(endDateTime.getHours() + 2)
    }
    const endDate = formatICSDate(endDateTime.toISOString())

    const tableInfo = bookingDetails.tableNumbers
      ? `Tables ${bookingDetails.tableNumbers.map((n: number) => `#${n}`).join(', ')}`
      : `Table #${bookingDetails.tableNumber}`

    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//VenueStack//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${bookingDetails.paymentIntentId || bookingDetails.orderId}@venuestack.io`,
      `DTSTAMP:${formatICSDate(new Date().toISOString())}`,
      `DTSTART:${startDate}`,
      `DTEND:${endDate}`,
      `SUMMARY:Table Reservation - ${bookingDetails.eventTitle}`,
      `DESCRIPTION:${tableInfo} - ${bookingDetails.sectionName}`,
    ]

    if (bookingDetails.eventLocation) {
      lines.push(`LOCATION:${bookingDetails.eventLocation}`)
    }

    lines.push('STATUS:CONFIRMED')
    lines.push('END:VEVENT')
    lines.push('END:VCALENDAR')

    const icsContent = lines.join('\r\n')

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `table-${bookingDetails.eventTitle.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.ics`
    link.style.display = 'none'
    document.body.appendChild(link)
    link.click()

    setTimeout(() => {
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    }, 100)
  }

  if (isVerifying) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center space-y-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-lg text-center">
                {paymentIntent ? 'Verifying your payment...' : 'Loading your reservation...'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error || !bookingDetails) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">Reservation Error</CardTitle>
            <CardDescription>
              {error || 'We could not load your reservation details. Please contact support.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href={`/${resolvedParams.businessSlug}`}>
                Return to Events
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <div className="relative w-full max-w-3xl">
        {bookingDetails.eventImageUrl && (
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200%] h-[500px] blur-[120px] pointer-events-none z-0"
            style={{
              background: `
                radial-gradient(ellipse 80% 70% at 30% 30%, ${imageGlowColors[1]}, transparent 60%),
                radial-gradient(ellipse 80% 70% at 70% 30%, ${imageGlowColors[2]}, transparent 60%),
                radial-gradient(ellipse 100% 80% at 50% 60%, ${imageGlowColors[3] || imageGlowColors[0]}, transparent 70%),
                radial-gradient(ellipse at center, ${imageGlowColors[0]}, transparent 50%)
              `
            }}
          />
        )}
        <Card className="w-full relative z-10 bg-card/90 backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center gap-6">
              {bookingDetails.eventImageUrl && (
                <div className="relative w-32 h-32 flex-shrink-0 rounded-lg overflow-hidden">
                  <Image
                    src={bookingDetails.eventImageUrl}
                    alt={bookingDetails.eventTitle}
                    fill
                    className="object-cover"
                  />
                </div>
              )}
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <div className={`rounded-full p-2 ${bookingDetails.amount > 0 ? 'bg-green-100 dark:bg-green-900/20' : 'bg-amber-100 dark:bg-amber-900/20'}`}>
                    <Armchair className={`h-6 w-6 ${bookingDetails.amount > 0 ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`} />
                  </div>
                  <CardTitle className="text-2xl">
                    {bookingDetails.amount > 0
                      ? ((bookingDetails.totalTables || 1) > 1 ? 'Tables Reserved!' : 'Table Reserved!')
                      : 'Request Submitted!'}
                  </CardTitle>
                </div>
                <CardDescription>
                  {bookingDetails.amount > 0
                    ? ((bookingDetails.totalTables || 1) > 1
                        ? `Your ${bookingDetails.totalTables} tables have been successfully reserved`
                        : 'Your table has been successfully reserved')
                    : 'Your reservation request has been submitted for review'}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-muted rounded-lg p-6 space-y-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Event</span>
                <span className="font-medium">{bookingDetails.eventTitle}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tables</span>
                <span className="font-medium">{bookingDetails.sectionName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total</span>
                <span className="font-medium">
                  {bookingDetails.amount > 0 ? `$${bookingDetails.amount.toFixed(2)}` : 'No Deposit Required'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Customer</span>
                <span className="font-medium">{bookingDetails.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Email</span>
                <span className="font-medium">{bookingDetails.customerEmail}</span>
              </div>
            </div>

            <div className={`rounded-lg p-4 ${bookingDetails.amount > 0 ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' : 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800'}`}>
              <p className={`text-sm ${bookingDetails.amount > 0 ? 'text-green-900 dark:text-green-100' : 'text-amber-900 dark:text-amber-100'}`}>
                {bookingDetails.amount > 0
                  ? <>A confirmation email with your table reservation details will be sent to <strong>{bookingDetails.customerEmail}</strong> shortly.</>
                  : <>Your request is pending approval. You&apos;ll receive a confirmation email at <strong>{bookingDetails.customerEmail}</strong> once the venue reviews your request.</>
                }
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <Button onClick={addToCalendar} variant="outline" className="flex-1">
                <Calendar className="mr-2 h-4 w-4" />
                Add to Calendar
              </Button>
              <Button asChild className="flex-1">
                <Link href={`/${resolvedParams.businessSlug}`}>
                  View More Events
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
