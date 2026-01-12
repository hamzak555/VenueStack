/**
 * Convert hex color to RGB values
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  // Remove # if present
  hex = hex.replace(/^#/, '')

  // Handle 3-digit hex
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2]
  }

  if (hex.length !== 6) {
    return null
  }

  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)

  if (isNaN(r) || isNaN(g) || isNaN(b)) {
    return null
  }

  return { r, g, b }
}

/**
 * Get CSS variable value for a theme color with opacity
 */
export function getThemeColorStyle(themeColor: string) {
  const rgb = hexToRgb(themeColor)
  if (!rgb) {
    // Fallback to violet
    return {
      '--theme-color': '139, 92, 246',
      '--theme-color-hex': '#8b5cf6',
    }
  }
  return {
    '--theme-color': `${rgb.r}, ${rgb.g}, ${rgb.b}`,
    '--theme-color-hex': themeColor.startsWith('#') ? themeColor : `#${themeColor}`,
  }
}
