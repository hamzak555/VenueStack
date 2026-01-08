'use client'

import { createContext, useContext, useEffect, useState } from 'react'

interface GoogleMapsContextType {
  isLoaded: boolean
}

const GoogleMapsContext = createContext<GoogleMapsContextType>({ isLoaded: false })

export function useGoogleMaps() {
  return useContext(GoogleMapsContext)
}

interface GoogleMapsProviderProps {
  children: React.ReactNode
}

export function GoogleMapsProvider({ children }: GoogleMapsProviderProps) {
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Check if script is already loaded
    if (window.google && window.google.maps) {
      setIsLoaded(true)
      return
    }

    // Check if script is already being loaded
    const existingScript = document.querySelector(`script[src*="maps.googleapis.com"]`)
    if (existingScript) {
      existingScript.addEventListener('load', () => setIsLoaded(true))
      return
    }

    // Load Google Maps script
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places`
    script.async = true
    script.defer = true
    script.onload = () => setIsLoaded(true)

    document.head.appendChild(script)
  }, [])

  return (
    <GoogleMapsContext.Provider value={{ isLoaded }}>
      {children}
    </GoogleMapsContext.Provider>
  )
}
