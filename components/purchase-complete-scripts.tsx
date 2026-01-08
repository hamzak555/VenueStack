'use client'

import { useEffect, useRef } from 'react'

interface PurchaseCompleteScriptsProps {
  scripts: string | null | undefined
  orderDetails?: {
    amount?: number
    quantity?: number
    orderId?: string
    eventTitle?: string
    customerEmail?: string
  }
}

export function PurchaseCompleteScripts({ scripts, orderDetails }: PurchaseCompleteScriptsProps) {
  const hasExecuted = useRef(false)

  useEffect(() => {
    // Only execute once and only if there are scripts
    if (!scripts || hasExecuted.current) return
    hasExecuted.current = true

    try {
      // Make order details available globally for scripts that need them
      if (orderDetails) {
        (window as any).__purchaseData = {
          value: orderDetails.amount || 0,
          currency: 'USD',
          orderId: orderDetails.orderId,
          quantity: orderDetails.quantity,
          eventName: orderDetails.eventTitle,
          customerEmail: orderDetails.customerEmail,
        }
      }

      // Extract script content and execute
      // First, try to find script tags and execute their content
      const scriptTagRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi
      let match

      while ((match = scriptTagRegex.exec(scripts)) !== null) {
        const scriptContent = match[1].trim()
        if (scriptContent) {
          try {
            // Create a new script element and execute
            const scriptElement = document.createElement('script')
            scriptElement.textContent = scriptContent
            document.head.appendChild(scriptElement)
          } catch (scriptError) {
            console.error('Error executing purchase complete script:', scriptError)
          }
        }
      }

      // If no script tags found, try to execute the content directly
      // (in case user just pasted raw JavaScript)
      if (!scripts.includes('<script')) {
        try {
          const scriptElement = document.createElement('script')
          scriptElement.textContent = scripts
          document.head.appendChild(scriptElement)
        } catch (scriptError) {
          console.error('Error executing purchase complete script:', scriptError)
        }
      }
    } catch (error) {
      console.error('Error processing purchase complete scripts:', error)
    }
  }, [scripts, orderDetails])

  // This component doesn't render anything visible
  return null
}
