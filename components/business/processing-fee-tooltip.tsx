'use client'

import { Info } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { formatCurrency } from '@/lib/utils/currency'

interface ProcessingFeeTooltipProps {
  platformFee: number
  stripeFee: number
  platformFeePayer?: 'customer' | 'business'
  stripeFeePayer?: 'customer' | 'business'
}

export function ProcessingFeeTooltip({
  platformFee,
  stripeFee,
  platformFeePayer = 'customer',
  stripeFeePayer = 'customer'
}: ProcessingFeeTooltipProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isHovered && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      setPosition({
        top: rect.bottom + 8,
        left: rect.left - 100 // Offset to the left to center it better
      })
    }
  }, [isHovered])

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="inline-flex items-center ml-1"
      >
        <Info className="h-4 w-4 text-muted-foreground cursor-help flex-shrink-0" />
      </div>

      {/* Tooltip Portal */}
      {isHovered && typeof window !== 'undefined' &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              top: `${position.top}px`,
              left: `${position.left}px`,
              zIndex: 9999
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
          >
            <div className="bg-popover border border-border rounded-lg overflow-hidden min-w-[240px]">
              <div className="px-3 py-2 bg-muted/50 border-b font-medium text-xs">
                Fee Breakdown
              </div>
              <div className="p-3 space-y-2 text-xs">
                <div className="flex items-center justify-between gap-6">
                  <div className="flex items-center gap-2">
                    <span>Platform Fee</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${platformFeePayer === 'customer' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' : 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300'}`}>
                      {platformFeePayer === 'customer' ? 'Customer' : 'You'}
                    </span>
                  </div>
                  <span className="font-medium">{formatCurrency(platformFee)}</span>
                </div>
                <div className="flex items-center justify-between gap-6">
                  <div className="flex items-center gap-2">
                    <span>Stripe Fee</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${stripeFeePayer === 'customer' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' : 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300'}`}>
                      {stripeFeePayer === 'customer' ? 'Customer' : 'You'}
                    </span>
                  </div>
                  <span className="font-medium">{formatCurrency(stripeFee)}</span>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )
      }
    </>
  )
}
