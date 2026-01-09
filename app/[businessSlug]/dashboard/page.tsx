import { redirect } from 'next/navigation'

interface BusinessDashboardProps {
  params: Promise<{
    businessSlug: string
  }>
}

export default async function BusinessDashboard({ params }: BusinessDashboardProps) {
  const { businessSlug } = await params
  redirect(`/${businessSlug}/dashboard/events`)
}
