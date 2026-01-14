'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Eye, Users } from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'

interface PageViewAnalytics {
  date: string
  views: number
  unique_visitors: number
}

interface PageViewStats {
  total_views: number
  unique_visitors: number
  views_by_page: {
    page_type: string
    views: number
  }[]
  daily_views: PageViewAnalytics[]
}

interface PageViewsChartProps {
  stats: PageViewStats
  themeColor?: string
}

const pageTypeLabels: Record<string, string> = {
  business_home: 'Business Page',
  event_page: 'Event Pages',
  checkout: 'Checkout',
}

// Helper to adjust color lightness
function adjustColorLightness(hex: string, amount: number): string {
  // Convert hex to RGB
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)

  // Adjust each component
  const adjust = (c: number) => Math.max(0, Math.min(255, c + amount))

  const newR = adjust(r).toString(16).padStart(2, '0')
  const newG = adjust(g).toString(16).padStart(2, '0')
  const newB = adjust(b).toString(16).padStart(2, '0')

  return `#${newR}${newG}${newB}`
}

export function PageViewsChart({ stats, themeColor = '#3b82f6' }: PageViewsChartProps) {
  // Create a secondary color by adjusting the theme color
  const secondaryColor = adjustColorLightness(themeColor, -60)
  // Format dates for display
  const chartData = stats.daily_views.map(item => ({
    ...item,
    dateLabel: new Date(item.date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    }),
  }))

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Public Page Performance</CardTitle>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{stats.total_views.toLocaleString()}</span>
              <span className="text-xs text-muted-foreground">Total Views</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{stats.unique_visitors.toLocaleString()}</span>
              <span className="text-xs text-muted-foreground">Unique Visitors</span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
            <Eye className="h-12 w-12 mb-4 opacity-50" />
            <p>No page view data yet</p>
            <p className="text-sm">Views will appear once visitors start browsing your pages</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Chart */}
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={chartData}
                  margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={themeColor} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={themeColor} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorVisitors" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={secondaryColor} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={secondaryColor} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="dateLabel"
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="views"
                    name="Page Views"
                    stroke={themeColor}
                    fillOpacity={1}
                    fill="url(#colorViews)"
                  />
                  <Area
                    type="monotone"
                    dataKey="unique_visitors"
                    name="Unique Visitors"
                    stroke={secondaryColor}
                    fillOpacity={1}
                    fill="url(#colorVisitors)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Page type breakdown */}
            {stats.views_by_page.length > 0 && (
              <div className="border-t pt-4">
                <p className="text-sm font-medium mb-3">Views by Page Type</p>
                <div className="grid grid-cols-3 gap-4">
                  {stats.views_by_page.map(item => (
                    <div key={item.page_type} className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                      <span className="text-sm">{pageTypeLabels[item.page_type] || item.page_type}</span>
                      <span className="font-medium">{item.views.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
