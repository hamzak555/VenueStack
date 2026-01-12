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
 * Check if a color is light (for determining contrast text color)
 * Uses relative luminance calculation
 */
export function isLightColor(hex: string): boolean {
  const rgb = hexToRgb(hex)
  if (!rgb) return false

  // Calculate relative luminance using sRGB formula
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255
  return luminance > 0.5
}

/**
 * Check if a color is too dark to be visible on dark backgrounds
 */
export function isDarkColor(hex: string): boolean {
  const rgb = hexToRgb(hex)
  if (!rgb) return false

  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255
  return luminance < 0.2
}

/**
 * Lighten a color by a percentage
 */
export function lightenColor(hex: string, percent: number): string {
  const rgb = hexToRgb(hex)
  if (!rgb) return hex

  const r = Math.min(255, Math.round(rgb.r + (255 - rgb.r) * percent))
  const g = Math.min(255, Math.round(rgb.g + (255 - rgb.g) * percent))
  const b = Math.min(255, Math.round(rgb.b + (255 - rgb.b) * percent))

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

/**
 * Get CSS variable value for a theme color with opacity
 */
export function getThemeColorStyle(themeColor: string) {
  const rgb = hexToRgb(themeColor)
  if (!rgb) {
    // Fallback to violet
    return {
      '--theme-color': '139 92 246',
      '--theme-color-hex': '#8b5cf6',
      '--theme-color-contrast': '#ffffff',
    }
  }
  const hexColor = themeColor.startsWith('#') ? themeColor : `#${themeColor}`
  const contrastColor = isLightColor(hexColor) ? '#000000' : '#ffffff'

  // For very dark colors, provide a lightened version for visibility on dark backgrounds
  let visibleHex = hexColor
  let visibleRgb = rgb
  if (isDarkColor(hexColor)) {
    visibleHex = lightenColor(hexColor, 0.5) // Lighten by 50%
    visibleRgb = hexToRgb(visibleHex) || rgb
  }

  return {
    '--theme-color': `${visibleRgb.r} ${visibleRgb.g} ${visibleRgb.b}`,
    '--theme-color-hex': visibleHex,
    '--theme-color-contrast': contrastColor,
  }
}
