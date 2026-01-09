import { NextRequest, NextResponse } from 'next/server'
import { createBusiness, isSlugAvailable } from '@/lib/db/businesses'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const { name, slug, description, contact_email, contact_phone, website } = body

    // Validate required fields
    if (!name || !slug) {
      return NextResponse.json(
        { error: 'Name and slug are required' },
        { status: 400 }
      )
    }

    // Check if slug is available
    const slugAvailable = await isSlugAvailable(slug)
    if (!slugAvailable) {
      return NextResponse.json(
        { error: 'This URL slug is already taken' },
        { status: 400 }
      )
    }

    // Create the business
    const business = await createBusiness({
      name,
      slug,
      description: description || null,
      contact_email: contact_email || null,
      contact_phone: contact_phone || null,
      website: website || null,
      user_id: null, // TODO: Link to user when auth is implemented
      is_active: true,
      logo_url: null,
    } as any)

    return NextResponse.json(business, { status: 201 })
  } catch (error) {
    console.error('Error creating business:', error)
    return NextResponse.json(
      { error: 'Failed to create business' },
      { status: 500 }
    )
  }
}
