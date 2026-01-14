import { createClient } from '@/lib/supabase/server'
import { PageViewAnalytics } from '@/lib/types'
import { DateRangeFilter } from '@/lib/db/analytics'

export interface PageViewStats {
  total_views: number
  unique_visitors: number
  views_by_page: {
    page_type: string
    views: number
  }[]
  daily_views: PageViewAnalytics[]
}

export async function getPageViewAnalytics(
  businessId: string,
  dateRange?: DateRangeFilter
): Promise<PageViewStats> {
  const supabase = await createClient()

  // Build query for page views
  let query = supabase
    .from('page_views')
    .select('id, page_type, visitor_id, created_at')
    .eq('business_id', businessId)

  // Apply date filter if provided
  if (dateRange) {
    query = query
      .gte('created_at', dateRange.from.toISOString())
      .lte('created_at', dateRange.to.toISOString())
  }

  const { data: pageViews, error } = await query

  if (error) {
    console.error('Error fetching page views:', error)
    return {
      total_views: 0,
      unique_visitors: 0,
      views_by_page: [],
      daily_views: [],
    }
  }

  if (!pageViews || pageViews.length === 0) {
    return {
      total_views: 0,
      unique_visitors: 0,
      views_by_page: [],
      daily_views: [],
    }
  }

  // Calculate total views
  const total_views = pageViews.length

  // Calculate unique visitors
  const uniqueVisitorIds = new Set(pageViews.map(pv => pv.visitor_id))
  const unique_visitors = uniqueVisitorIds.size

  // Calculate views by page type
  const viewsByPageMap = new Map<string, number>()
  for (const pv of pageViews) {
    const current = viewsByPageMap.get(pv.page_type) || 0
    viewsByPageMap.set(pv.page_type, current + 1)
  }
  const views_by_page = Array.from(viewsByPageMap.entries())
    .map(([page_type, views]) => ({ page_type, views }))
    .sort((a, b) => b.views - a.views)

  // Calculate daily views for the chart
  const dailyViewsMap = new Map<string, { views: number; visitors: Set<string> }>()

  for (const pv of pageViews) {
    const date = new Date(pv.created_at).toISOString().split('T')[0]
    const existing = dailyViewsMap.get(date) || { views: 0, visitors: new Set<string>() }
    existing.views += 1
    existing.visitors.add(pv.visitor_id)
    dailyViewsMap.set(date, existing)
  }

  // Convert to sorted array
  const daily_views: PageViewAnalytics[] = Array.from(dailyViewsMap.entries())
    .map(([date, data]) => ({
      date,
      views: data.views,
      unique_visitors: data.visitors.size,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))

  return {
    total_views,
    unique_visitors,
    views_by_page,
    daily_views,
  }
}
