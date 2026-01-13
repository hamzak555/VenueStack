'use client'

import PhoneInputWithCountry from 'react-phone-number-input'
import 'react-phone-number-input/style.css'
import { cn } from '@/lib/utils'

interface PhoneInputProps {
  value: string
  onChange: (value: string | undefined) => void
  disabled?: boolean
  required?: boolean
  placeholder?: string
  className?: string
  defaultCountry?: 'US' | 'CA' | 'GB' | 'AU'
}

export function PhoneInput({
  value,
  onChange,
  disabled = false,
  required = false,
  placeholder = 'Phone number',
  className,
  defaultCountry = 'US',
}: PhoneInputProps) {
  return (
    <PhoneInputWithCountry
      international
      countryCallingCodeEditable={false}
      defaultCountry={defaultCountry}
      value={value}
      onChange={(val) => onChange(val || '')}
      disabled={disabled}
      placeholder={placeholder}
      className={cn(
        'phone-input-container flex h-9 w-full rounded-md border border-input bg-transparent text-sm shadow-sm transition-colors',
        'focus-within:outline-none focus-within:ring-1 focus-within:ring-ring',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
    />
  )
}
