import { redirect } from 'next/navigation'

interface LoginPageProps {
  params: Promise<{
    businessSlug: string
  }>
}

export default function LoginPage({ params }: LoginPageProps) {
  redirect('/login')
}
