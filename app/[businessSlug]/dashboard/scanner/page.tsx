'use client'

import { use, useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, CheckCircle, XCircle, Camera, CameraOff, History } from 'lucide-react'
import { Html5QrcodeScanner } from 'html5-qrcode'
import Link from 'next/link'
import { formatCurrency } from '@/lib/utils/currency'

interface TicketValidationResult {
  valid: boolean
  message: string
  ticket?: {
    ticketNumber: string
    eventTitle: string
    customerName: string
    customerEmail: string
    price: number
    status: string
    checkedInAt: string | null
    eventDate: string
    eventTime: string | null
    location: string | null
  }
}

export default function ScannerPage({ params }: { params: Promise<{ businessSlug: string }> }) {
  const resolvedParams = use(params)
  const [business, setBusiness] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [scannerActive, setScannerActive] = useState(false)
  const [validationResult, setValidationResult] = useState<TicketValidationResult | null>(null)
  const [isValidating, setIsValidating] = useState(false)

  useEffect(() => {
    async function init() {
      const supabase = createClient()
      const { data } = await supabase
        .from('businesses')
        .select('*')
        .eq('slug', resolvedParams.businessSlug)
        .single()

      if (data) {
        setBusiness(data)
      }
      setIsLoading(false)
    }

    init()
  }, [resolvedParams.businessSlug])

  useEffect(() => {
    let scanner: Html5QrcodeScanner | null = null

    if (scannerActive && !isValidating) {
      scanner = new Html5QrcodeScanner(
        'qr-reader',
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0
        },
        false
      )

      scanner.render(onScanSuccess, onScanError)
    }

    return () => {
      if (scanner) {
        scanner.clear().catch(console.error)
      }
    }
  }, [scannerActive, isValidating])

  const onScanSuccess = async (decodedText: string) => {
    if (!business) return
    setIsValidating(true)

    try {
      const response = await fetch('/api/tickets/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          qrCodeData: decodedText,
          businessId: business.id
        }),
      })

      const result = await response.json()
      setValidationResult(result)

      // Auto-clear result after 5 seconds
      setTimeout(() => {
        setValidationResult(null)
        setIsValidating(false)
      }, 5000)
    } catch (error) {
      console.error('Validation error:', error)
      setValidationResult({
        valid: false,
        message: 'Failed to validate ticket. Please try again.'
      })
      setTimeout(() => {
        setValidationResult(null)
        setIsValidating(false)
      }, 5000)
    }
  }

  const onScanError = (error: string) => {
    // Ignore scan errors - they happen constantly while scanning
  }

  const toggleScanner = () => {
    setScannerActive(!scannerActive)
    setValidationResult(null)
  }

  if (isLoading || !business) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">Ticket Scanner</h1>
        </div>
        <Button variant="outline" asChild>
          <Link href={`/${resolvedParams.businessSlug}/dashboard/scanner/check-ins`}>
            <History className="mr-2 h-4 w-4" />
            Check-In History
          </Link>
        </Button>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>QR Code Scanner</CardTitle>
          <CardDescription>
            Point your camera at a ticket QR code to validate and check in
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Button
              onClick={toggleScanner}
              className="w-full"
              variant={scannerActive ? 'destructive' : 'default'}
            >
              {scannerActive ? (
                <>
                  <CameraOff className="mr-2 h-4 w-4" />
                  Stop Scanner
                </>
              ) : (
                <>
                  <Camera className="mr-2 h-4 w-4" />
                  Start Scanner
                </>
              )}
            </Button>

            {scannerActive && (
              <div className="border rounded-lg overflow-hidden bg-black">
                <div id="qr-reader" className="w-full"></div>
              </div>
            )}

            {isValidating && !validationResult && (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin" />
                <span className="ml-3">Validating ticket...</span>
              </div>
            )}

            {validationResult && (
              <div className={`border rounded-lg p-6 ${
                validationResult.valid
                  ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                  : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
              }`}>
                <div className="flex items-center gap-3 mb-4">
                  {validationResult.valid ? (
                    <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
                  ) : (
                    <XCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
                  )}
                  <div>
                    <h3 className={`text-xl font-bold ${
                      validationResult.valid
                        ? 'text-green-900 dark:text-green-100'
                        : 'text-red-900 dark:text-red-100'
                    }`}>
                      {validationResult.valid ? 'Valid Ticket' : 'Invalid Ticket'}
                    </h3>
                    <p className={`text-sm ${
                      validationResult.valid
                        ? 'text-green-700 dark:text-green-200'
                        : 'text-red-700 dark:text-red-200'
                    }`}>
                      {validationResult.message}
                    </p>
                  </div>
                </div>

                {validationResult.ticket && (
                  <div className="space-y-3 mt-4 pt-4 border-t border-green-200 dark:border-green-800">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs font-medium text-green-900 dark:text-green-100">Event</p>
                        <p className="text-sm text-green-700 dark:text-green-200">{validationResult.ticket.eventTitle}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-green-900 dark:text-green-100">Ticket Number</p>
                        <p className="text-sm text-green-700 dark:text-green-200 font-mono">{validationResult.ticket.ticketNumber}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-green-900 dark:text-green-100">Customer</p>
                        <p className="text-sm text-green-700 dark:text-green-200">{validationResult.ticket.customerName}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-green-900 dark:text-green-100">Price</p>
                        <p className="text-sm text-green-700 dark:text-green-200">{formatCurrency(validationResult.ticket.price)}</p>
                      </div>
                      {validationResult.ticket.eventDate && (
                        <div>
                          <p className="text-xs font-medium text-green-900 dark:text-green-100">Event Date</p>
                          <p className="text-sm text-green-700 dark:text-green-200">
                            {new Date(validationResult.ticket.eventDate).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                            {validationResult.ticket.eventTime && ` at ${validationResult.ticket.eventTime}`}
                          </p>
                        </div>
                      )}
                      {validationResult.ticket.location && (
                        <div>
                          <p className="text-xs font-medium text-green-900 dark:text-green-100">Location</p>
                          <p className="text-sm text-green-700 dark:text-green-200">{validationResult.ticket.location}</p>
                        </div>
                      )}
                    </div>
                    {validationResult.ticket.checkedInAt && (
                      <div className="mt-3 pt-3 border-t border-green-200 dark:border-green-800">
                        <Badge variant="secondary">
                          Previously checked in: {new Date(validationResult.ticket.checkedInAt).toLocaleString()}
                        </Badge>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
