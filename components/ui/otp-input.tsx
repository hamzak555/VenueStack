'use client'

import { useRef, useState, useEffect, KeyboardEvent, ClipboardEvent } from 'react'
import { cn } from '@/lib/utils'

interface OtpInputProps {
  value: string
  onChange: (value: string) => void
  length?: number
  disabled?: boolean
  autoFocus?: boolean
  className?: string
}

export function OtpInput({
  value,
  onChange,
  length = 6,
  disabled = false,
  autoFocus = true,
  className,
}: OtpInputProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])
  const [activeIndex, setActiveIndex] = useState(0)

  // Split value into individual digits
  const digits = value.split('').slice(0, length)
  while (digits.length < length) {
    digits.push('')
  }

  // Focus first input on mount
  useEffect(() => {
    if (autoFocus && inputRefs.current[0]) {
      inputRefs.current[0].focus()
    }
  }, [autoFocus])

  const focusInput = (index: number) => {
    if (index >= 0 && index < length && inputRefs.current[index]) {
      inputRefs.current[index]?.focus()
      setActiveIndex(index)
    }
  }

  const handleChange = (index: number, digit: string) => {
    if (disabled) return

    // Only accept single digits
    const sanitized = digit.replace(/\D/g, '').slice(-1)

    if (sanitized) {
      const newDigits = [...digits]
      newDigits[index] = sanitized
      onChange(newDigits.join(''))

      // Move to next input
      if (index < length - 1) {
        focusInput(index + 1)
      }
    }
  }

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return

    if (e.key === 'Backspace') {
      e.preventDefault()
      const newDigits = [...digits]

      if (digits[index]) {
        // Clear current digit
        newDigits[index] = ''
        onChange(newDigits.join(''))
      } else if (index > 0) {
        // Move to previous and clear
        newDigits[index - 1] = ''
        onChange(newDigits.join(''))
        focusInput(index - 1)
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault()
      focusInput(index - 1)
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      e.preventDefault()
      focusInput(index + 1)
    } else if (e.key === 'Delete') {
      e.preventDefault()
      const newDigits = [...digits]
      newDigits[index] = ''
      onChange(newDigits.join(''))
    }
  }

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    if (disabled) return

    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length)
    if (pastedData) {
      onChange(pastedData)
      // Focus the next empty input or the last one
      const nextIndex = Math.min(pastedData.length, length - 1)
      focusInput(nextIndex)
    }
  }

  const handleFocus = (index: number) => {
    setActiveIndex(index)
    // Select the content when focused
    inputRefs.current[index]?.select()
  }

  return (
    <div className={cn('flex gap-2 justify-center', className)}>
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => { inputRefs.current[index] = el }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          onChange={(e) => handleChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={handlePaste}
          onFocus={() => handleFocus(index)}
          disabled={disabled}
          className={cn(
            'w-12 h-14 text-center text-2xl font-semibold rounded-lg border-2 bg-background transition-all duration-150',
            'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
            digit ? 'border-primary' : 'border-input',
            activeIndex === index && !disabled && 'border-primary ring-2 ring-ring ring-offset-2',
            disabled && 'opacity-50 cursor-not-allowed',
          )}
          aria-label={`Digit ${index + 1}`}
        />
      ))}
    </div>
  )
}
