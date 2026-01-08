'use client'

import { useState, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MapPin, Check } from 'lucide-react'
import { useGoogleMaps } from '@/components/providers/google-maps-provider'

interface LocationAutocompleteProps {
  value: string
  onChange: (location: string, placeId: string | null, lat: number | null, lng: number | null) => void
  disabled?: boolean
  label?: string
  placeholder?: string
}

export function LocationAutocomplete({
  value,
  onChange,
  disabled,
  label = 'Location',
  placeholder = 'Search for a venue or address...'
}: LocationAutocompleteProps) {
  const { isLoaded } = useGoogleMaps()
  const [inputValue, setInputValue] = useState(value)
  const [hasValidLocation, setHasValidLocation] = useState(!!value)
  const inputRef = useRef<HTMLInputElement>(null)
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null)

  useEffect(() => {
    setInputValue(value)
    setHasValidLocation(!!value)
  }, [value])

  useEffect(() => {
    if (!inputRef.current || !isLoaded || !window.google) return

    // Avoid re-initializing if already set up
    if (autocompleteRef.current) return

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
        setHasValidLocation(false)
        return
      }

      // Use the full formatted address for the location
      const location = place.formatted_address || ''
      const placeId = place.place_id || null
      const lat = place.geometry.location?.lat() || null
      const lng = place.geometry.location?.lng() || null

      setInputValue(location)
      setHasValidLocation(true)
      onChange(location, placeId, lat, lng)
    })

    return () => {
      if (autocompleteRef.current) {
        google.maps.event.clearInstanceListeners(autocompleteRef.current)
        autocompleteRef.current = null
      }
    }
  }, [isLoaded, onChange])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setInputValue(newValue)

    // User is typing - mark as invalid until they select from dropdown
    setHasValidLocation(false)

    // If user manually clears the input completely, clear the saved location
    if (newValue === '') {
      onChange('', null, null, null)
    }
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="location">{label}</Label>
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          id="location"
          value={inputValue}
          onChange={handleInputChange}
          disabled={disabled}
          placeholder={placeholder}
          className={`pl-10 ${hasValidLocation ? 'pr-10' : ''}`}
        />
        {hasValidLocation && (
          <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-600" />
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {hasValidLocation
          ? 'Location verified'
          : 'Start typing and select from the dropdown'}
      </p>
    </div>
  )
}
