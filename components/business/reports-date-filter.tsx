'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useMemo } from 'react'
import { DateRange } from 'react-day-picker'
import { DateRangePicker } from '@/components/ui/date-range-picker'
import { DateRangePreset, getPresetDateRange } from '@/lib/utils/date-range'

export function ReportsDateFilter() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const preset = (searchParams.get('preset') as DateRangePreset) || 'last-30-days'
  const fromParam = searchParams.get('from')
  const toParam = searchParams.get('to')

  const value = useMemo((): DateRange | undefined => {
    if (preset === 'custom' && fromParam && toParam) {
      return {
        from: new Date(fromParam),
        to: new Date(toParam),
      }
    }
    return getPresetDateRange(preset)
  }, [preset, fromParam, toParam])

  const handleChange = useCallback(
    (range: DateRange | undefined, newPreset: DateRangePreset) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set('preset', newPreset)

      if (newPreset === 'custom' && range?.from && range?.to) {
        params.set('from', range.from.toISOString())
        params.set('to', range.to.toISOString())
      } else {
        params.delete('from')
        params.delete('to')
      }

      router.push(`?${params.toString()}`)
    },
    [router, searchParams]
  )

  return (
    <DateRangePicker
      value={value}
      onChange={handleChange}
      preset={preset}
    />
  )
}
