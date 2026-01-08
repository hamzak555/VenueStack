/**
 * Formats a number as USD currency with thousand separators
 * @param amount - The number to format
 * @param showDecimals - Whether to show decimal places (default: true)
 * @returns Formatted string (e.g., "$1,234.56" or "$1,234")
 */
export function formatCurrency(amount: number | string, showDecimals: boolean = true): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount

  if (isNaN(num)) {
    return showDecimals ? '$0.00' : '$0'
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  }).format(num)
}
