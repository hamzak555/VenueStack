'use client'

import { useEffect, useState, use } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Ticket, Loader2, Calendar, FileText } from 'lucide-react'
import { PurchaseCompleteScripts } from '@/components/purchase-complete-scripts'

export default function SuccessPage({ params }: { params: Promise<{ businessSlug: string; eventId: string }> }) {
  const resolvedParams = use(params)
  const searchParams = useSearchParams()
  const paymentIntent = searchParams.get('payment_intent')
  const paymentIntentClientSecret = searchParams.get('payment_intent_client_secret')
  const orderId = searchParams.get('orderId')

  const [isVerifying, setIsVerifying] = useState(true)
  const [orderDetails, setOrderDetails] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [purchaseCompleteScripts, setPurchaseCompleteScripts] = useState<string | null>(null)
  const [imageGlowColors, setImageGlowColors] = useState<string[]>([
    'rgba(255, 255, 255, 0.1)',
    'rgba(200, 200, 200, 0.1)',
    'rgba(150, 150, 150, 0.1)'
  ])
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false)

  useEffect(() => {
    // Fetch business purchase complete scripts
    const fetchBusinessScripts = async () => {
      try {
        const response = await fetch(`/api/businesses/slug/${resolvedParams.businessSlug}`)
        if (response.ok) {
          const business = await response.json()
          if (business.purchase_complete_scripts) {
            setPurchaseCompleteScripts(business.purchase_complete_scripts)
          }
        }
      } catch (err) {
        console.error('Failed to fetch business scripts:', err)
      }
    }
    fetchBusinessScripts()

    if (paymentIntent) {
      verifyPayment()
    } else if (orderId) {
      fetchOrderDetails()
    } else {
      setError('No payment information provided')
      setIsVerifying(false)
    }
  }, [paymentIntent, orderId, resolvedParams.businessSlug])

  // Extract multiple dominant colors from image for multi-color glow effect
  useEffect(() => {
    if (!orderDetails?.eventImageUrl) return

    const img = document.createElement('img')
    img.crossOrigin = 'Anonymous'
    img.src = orderDetails.eventImageUrl

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

        // Sample from 4 different areas: center, top-left, top-right, bottom
        const samplePoints = [
          { x: img.width / 2, y: img.height / 2 },      // center
          { x: img.width / 4, y: img.height / 4 },      // top-left
          { x: (3 * img.width) / 4, y: img.height / 4 }, // top-right
          { x: img.width / 2, y: (3 * img.height) / 4 }  // bottom
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
  }, [orderDetails?.eventImageUrl])

  const verifyPayment = async () => {
    try {
      const response = await fetch(`/api/checkout/verify-payment-intent?payment_intent=${paymentIntent}`)
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to verify payment')
      }
      const data = await response.json()
      setOrderDetails(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsVerifying(false)
    }
  }

  const fetchOrderDetails = async () => {
    try {
      const response = await fetch(`/api/orders/${orderId}`)
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to fetch order details')
      }
      const data = await response.json()
      setOrderDetails(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsVerifying(false)
    }
  }

  const viewTickets = async () => {
    if (!orderDetails) return

    setIsGeneratingPDF(true)
    try {
      const response = await fetch('/api/tickets/generate-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderId: orderDetails.orderId,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to generate ticket PDF')
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `tickets-${orderDetails.eventTitle.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.pdf`
      link.style.display = 'none'
      document.body.appendChild(link)
      link.click()

      setTimeout(() => {
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
      }, 100)
    } catch (error) {
      console.error('Error generating PDF:', error)
      alert('Failed to generate ticket PDF. Please try again.')
    } finally {
      setIsGeneratingPDF(false)
    }
  }

  const addToCalendar = () => {
    if (!orderDetails || !orderDetails.eventDate) return

    // Format date and time for .ics file
    const formatICSDate = (date: string, time?: string) => {
      const d = new Date(date)
      if (time) {
        const [hours, minutes] = time.split(':')
        d.setHours(parseInt(hours), parseInt(minutes), 0, 0)
      }
      return d.toISOString().replace(/[-:.]/g, '').slice(0, -1) + 'Z'
    }

    const startDate = formatICSDate(orderDetails.eventDate, orderDetails.eventTime)

    // End date is 2 hours after start by default
    const endDateTime = new Date(orderDetails.eventDate)
    if (orderDetails.eventTime) {
      const [hours, minutes] = orderDetails.eventTime.split(':')
      endDateTime.setHours(parseInt(hours) + 2, parseInt(minutes), 0, 0)
    } else {
      endDateTime.setHours(endDateTime.getHours() + 2)
    }
    const endDate = formatICSDate(endDateTime.toISOString())

    // Create properly formatted .ics file content with CRLF line endings
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Ticketing Platform//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${orderDetails.paymentIntentId}@ticketing-platform.com`,
      `DTSTAMP:${formatICSDate(new Date().toISOString())}`,
      `DTSTART:${startDate}`,
      `DTEND:${endDate}`,
      `SUMMARY:${orderDetails.eventTitle}`,
      `DESCRIPTION:You have ${orderDetails.quantity} ticket${orderDetails.quantity > 1 ? 's' : ''} for this event.`,
    ]

    if (orderDetails.eventLocation) {
      lines.push(`LOCATION:${orderDetails.eventLocation}`)
    }

    lines.push('STATUS:CONFIRMED')
    lines.push('END:VEVENT')
    lines.push('END:VCALENDAR')

    const icsContent = lines.join('\r\n')

    // Create and download the .ics file
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${orderDetails.eventTitle.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.ics`
    link.style.display = 'none'
    document.body.appendChild(link)
    link.click()

    // Cleanup
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
              <p className="text-lg text-center">Verifying your payment...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error || !orderDetails) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">Payment Verification Failed</CardTitle>
            <CardDescription>
              {error || 'We could not verify your payment. Please contact support.'}
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
      {/* Purchase Complete Scripts - runs conversion tracking */}
      <PurchaseCompleteScripts
        scripts={purchaseCompleteScripts}
        orderDetails={{
          amount: orderDetails.amount,
          quantity: orderDetails.quantity,
          orderId: orderDetails.orderId,
          eventTitle: orderDetails.eventTitle,
          customerEmail: orderDetails.customerEmail,
        }}
      />
      <div className="relative w-full max-w-3xl">
        {orderDetails.eventImageUrl && (
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
            {orderDetails.eventImageUrl && (
              <div className="relative w-32 h-32 flex-shrink-0 rounded-lg overflow-hidden">
                <Image
                  src={orderDetails.eventImageUrl}
                  alt={orderDetails.eventTitle}
                  fill
                  className="object-cover"
                />
              </div>
            )}
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <div className="rounded-full bg-green-100 dark:bg-green-900/20 p-2">
                  <Ticket className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <CardTitle className="text-2xl">
                  {orderDetails.amount > 0 ? 'Payment Successful!' : 'Order Confirmed!'}
                </CardTitle>
              </div>
              <CardDescription>
                {orderDetails.amount > 0
                  ? 'Your tickets have been purchased successfully'
                  : 'Your free tickets have been reserved successfully'
                }
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-muted rounded-lg p-6 space-y-4">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Event</span>
              <span className="font-medium">{orderDetails.eventTitle}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Quantity</span>
              <span className="font-medium">{orderDetails.quantity} {orderDetails.quantity === 1 ? 'ticket' : 'tickets'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total</span>
              <span className="font-medium">
                {orderDetails.amount > 0 ? `$${orderDetails.amount.toFixed(2)}` : 'Free'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Customer</span>
              <span className="font-medium">{orderDetails.customerName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Email</span>
              <span className="font-medium">{orderDetails.customerEmail}</span>
            </div>
          </div>

          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <p className="text-sm text-green-900 dark:text-green-100">
              A confirmation email with your ticket{orderDetails.quantity > 1 ? 's' : ''} will be sent to <strong>{orderDetails.customerEmail}</strong> shortly.
              Please check your inbox and spam folder.
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <Button onClick={viewTickets} disabled={isGeneratingPDF} className="w-full">
              {isGeneratingPDF ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating PDF...
                </>
              ) : (
                <>
                  <FileText className="mr-2 h-4 w-4" />
                  View Tickets
                </>
              )}
            </Button>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button onClick={addToCalendar} variant="outline" className="flex-1">
                <Calendar className="mr-2 h-4 w-4" />
                Add to Calendar
              </Button>
              <Button asChild variant="outline" className="flex-1 bg-white dark:bg-white text-black hover:bg-gray-100 dark:hover:bg-gray-100 hover:text-black dark:hover:text-black">
                <Link href={`/${resolvedParams.businessSlug}`}>
                  View More Events
                </Link>
              </Button>
            </div>
          </div>
        </CardContent>
        </Card>
      </div>
    </div>
  )
}
