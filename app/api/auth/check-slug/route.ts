import { NextRequest, NextResponse } from 'next/server'
import { isSlugAvailable } from '@/lib/db/businesses'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const slug = searchParams.get('slug')

    if (!slug) {
      return NextResponse.json(
        { error: 'Slug is required' },
        { status: 400 }
      )
    }

    // Validate slug format
    const slugRegex = /^[a-z0-9-]+$/
    if (!slugRegex.test(slug)) {
      return NextResponse.json({
        available: false,
        message: 'URL can only contain lowercase letters, numbers, and hyphens',
      })
    }

    // Check reserved slugs
    const reservedSlugs = ['admin', 'api', 'login', 'register', 'dashboard', 'settings', 'help', 'support', 'www', 'app']
    if (reservedSlugs.includes(slug.toLowerCase())) {
      return NextResponse.json({
        available: false,
        message: 'This URL is reserved',
      })
    }

    const available = await isSlugAvailable(slug.toLowerCase())

    return NextResponse.json({
      available,
      message: available ? 'This URL is available' : 'This URL is already taken',
    })
  } catch (error) {
    console.error('Slug check error:', error)
    return NextResponse.json(
      { error: 'Failed to check availability' },
      { status: 500 }
    )
  }
}
