'use client'

import { useState, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MapPin, Check } from 'lucide-react'

interface AddressAutocompleteProps {
  value: string
  onChange: (address: string, placeId: string | null, lat: number | null, lng: number | null) => void
  disabled?: boolean
}

export function AddressAutocomplete({ value, onChange, disabled }: AddressAutocompleteProps) {
  const [inputValue, setInputValue] = useState(value)
  const [hasValidAddress, setHasValidAddress] = useState(!!value)
  const inputRef = useRef<HTMLInputElement>(null)
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null)

  useEffect(() => {
    setInputValue(value)
    setHasValidAddress(!!value)
  }, [value])

  useEffect(() => {
    if (!inputRef.current || !window.google) return

    // Initialize Google Places Autocomplete
    // No type restriction - allows any location (addresses, establishments, landmarks, etc.)
    // Restricted to USA and Canada only
    autocompleteRef.current = new window.google.maps.places.Autocomplete(inputRef.current, {
      fields: ['formatted_address', 'geometry', 'place_id', 'name'],
      componentRestrictions: { country: ['us', 'ca'] },
    })

    // Listen for place selection
    autocompleteRef.current.addListener('place_changed', () => {
      const place = autocompleteRef.current?.getPlace()

      if (!place || !place.geometry) {
        setHasValidAddress(false)
        return
      }

      const address = place.formatted_address || ''
      const placeId = place.place_id || null
      const lat = place.geometry.location?.lat() || null
      const lng = place.geometry.location?.lng() || null

      setInputValue(address)
      setHasValidAddress(true)
      onChange(address, placeId, lat, lng)
    })

    return () => {
      if (autocompleteRef.current) {
        google.maps.event.clearInstanceListeners(autocompleteRef.current)
      }
    }
  }, [onChange])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setInputValue(newValue)

    // User is typing - mark as invalid until they select from dropdown
    setHasValidAddress(false)

    // If user manually clears the input completely, clear the saved address
    if (newValue === '') {
      onChange('', null, null, null)
    }
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="address">Business Address</Label>
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          id="address"
          value={inputValue}
          onChange={handleInputChange}
          disabled={disabled}
          placeholder="Search for your business address..."
          className={`pl-10 ${hasValidAddress ? 'pr-10' : ''}`}
        />
        {hasValidAddress && (
          <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-600" />
        )}
      </div>
      {!hasValidAddress && (
        <p className="text-xs text-muted-foreground">
          Start typing and select from the dropdown to set your address and map location.
        </p>
      )}
    </div>
  )
}
