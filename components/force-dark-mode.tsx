"use client"

import { useEffect, useRef } from "react"
import { useTheme } from "next-themes"

interface ForceDarkModeProps {
  children: React.ReactNode
}

export function ForceDarkMode({ children }: ForceDarkModeProps) {
  const { resolvedTheme, setTheme } = useTheme()
  const previousThemeRef = useRef<string | undefined>(undefined)

  useEffect(() => {
    // Store the user's actual theme preference before forcing dark
    if (previousThemeRef.current === undefined) {
      previousThemeRef.current = resolvedTheme
    }

    // Force dark mode on public pages
    if (resolvedTheme !== "dark") {
      document.documentElement.classList.add("dark")
    }

    // Cleanup: restore the user's theme preference when leaving public pages
    return () => {
      if (previousThemeRef.current && previousThemeRef.current !== "dark") {
        document.documentElement.classList.remove("dark")
      }
    }
  }, [resolvedTheme])

  // Also ensure dark class is present during render
  useEffect(() => {
    document.documentElement.classList.add("dark")
  }, [])

  return <>{children}</>
}
