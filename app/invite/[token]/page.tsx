'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Eye, EyeOff, Building2, Check, Loader2, AlertCircle } from 'lucide-react'
import { InteractiveGridPattern } from '@/components/ui/interactive-grid-pattern'
import { PhoneInput } from '@/components/ui/phone-input'
import Image from 'next/image'
import { ROLE_LABELS, type BusinessRole } from '@/lib/auth/roles'

interface InvitationData {
  id: string
  email: string | null
  phone: string | null
  role: BusinessRole
  expires_at: string
  business: {
    id: string
    name: string
    slug: string
    logo_url: string | null
  }
}

export default function AcceptInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const router = useRouter()

  const [invitation, setInvitation] = useState<InvitationData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  })

  useEffect(() => {
    async function fetchInvitation() {
      try {
        const response = await fetch(`/api/invitations/${token}`)
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Invalid invitation')
        }

        setInvitation(data.invitation)
        setFormData(prev => ({
          ...prev,
          email: data.invitation.email || '',
          phone: data.invitation.phone || '',
        }))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load invitation')
      } finally {
        setLoading(false)
      }
    }

    fetchInvitation()
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      setSubmitting(false)
      return
    }

    try {
      const response = await fetch(`/api/invitations/${token}/accept`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email || undefined,
          phone: formData.phone || undefined,
          password: formData.password,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to accept invitation')
      }

      setSuccess(true)

      // If already a member, redirect to login
      if (data.alreadyMember) {
        setTimeout(() => {
          router.push('/login')
        }, 2000)
        return
      }

      // Auto-login after accepting
      setTimeout(async () => {
        try {
          const loginResponse = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email: formData.email,
              password: formData.password,
            }),
          })

          const loginData = await loginResponse.json()

          if (loginResponse.ok && loginData.affiliations?.length > 0) {
            const businessAffiliation = loginData.affiliations.find(
              (a: any) => a.type === 'business' && a.businessSlug === data.businessSlug
            )

            if (businessAffiliation) {
              await fetch('/api/auth/select', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  affiliationType: 'business',
                  businessId: businessAffiliation.businessId,
                }),
              })

              router.push(`/${data.businessSlug}/dashboard`)
              router.refresh()
              return
            }
          }

          // Fallback to login page
          router.push('/login')
        } catch {
          router.push('/login')
        }
      }, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept invitation')
    } finally {
      setSubmitting(false)
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-background p-4 overflow-hidden">
        <div className="absolute top-8 left-8 z-10">
          <Image
            src="/venuestack-logo.svg"
            alt="VenueStack"
            width={160}
            height={40}
            className="invert dark:invert-0"
            priority
          />
        </div>
        <div className="absolute inset-0">
          <InteractiveGridPattern
            className="[mask-image:radial-gradient(ellipse_1000px_100%_at_82%_50%,white,transparent)]"
            width={60}
            height={60}
            squares={[30, 20]}
          />
        </div>
        <Card className="w-full max-w-md relative z-10">
          <CardContent className="py-12 flex flex-col items-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="mt-4 text-muted-foreground">Loading invitation...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Error state
  if (error && !invitation) {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-background p-4 overflow-hidden">
        <div className="absolute top-8 left-8 z-10">
          <Image
            src="/venuestack-logo.svg"
            alt="VenueStack"
            width={160}
            height={40}
            className="invert dark:invert-0"
            priority
          />
        </div>
        <div className="absolute inset-0">
          <InteractiveGridPattern
            className="[mask-image:radial-gradient(ellipse_1000px_100%_at_82%_50%,white,transparent)]"
            width={60}
            height={60}
            squares={[30, 20]}
          />
        </div>
        <Card className="w-full max-w-md relative z-10">
          <CardContent className="py-12 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
              <AlertCircle className="h-8 w-8 text-red-500" />
            </div>
            <h2 className="text-lg font-semibold">Invalid Invitation</h2>
            <p className="mt-2 text-muted-foreground">{error}</p>
            <Button className="mt-6" onClick={() => router.push('/login')}>
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Success state
  if (success) {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-background p-4 overflow-hidden">
        <div className="absolute top-8 left-8 z-10">
          <Image
            src="/venuestack-logo.svg"
            alt="VenueStack"
            width={160}
            height={40}
            className="invert dark:invert-0"
            priority
          />
        </div>
        <div className="absolute inset-0">
          <InteractiveGridPattern
            className="[mask-image:radial-gradient(ellipse_1000px_100%_at_82%_50%,white,transparent)]"
            width={60}
            height={60}
            squares={[30, 20]}
          />
        </div>
        <Card className="w-full max-w-md relative z-10">
          <CardContent className="py-12 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mb-4">
              <Check className="h-8 w-8 text-green-500" />
            </div>
            <h2 className="text-lg font-semibold">Welcome!</h2>
            <p className="mt-2 text-muted-foreground">
              You&apos;ve been added to {invitation?.business.name}. Redirecting...
            </p>
            <div className="mt-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Invitation form
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background p-4 overflow-hidden">
      <div className="absolute top-8 left-8 z-10">
        <Image
          src="/venuestack-logo.svg"
          alt="VenueStack"
          width={160}
          height={40}
          className="invert dark:invert-0"
          priority
        />
      </div>
      <div className="absolute inset-0">
        <InteractiveGridPattern
          className="[mask-image:radial-gradient(ellipse_1000px_100%_at_82%_50%,white,transparent)]"
          width={60}
          height={60}
          squares={[30, 20]}
        />
      </div>
      <Card className="w-full max-w-md relative z-10">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center overflow-hidden p-2">
              {invitation?.business.logo_url ? (
                <Image
                  src={invitation.business.logo_url}
                  alt={invitation.business.name}
                  width={48}
                  height={48}
                  className="w-full h-full object-contain"
                />
              ) : (
                <Building2 className="w-8 h-8 text-muted-foreground" />
              )}
            </div>
          </div>
          <CardTitle>Join {invitation?.business.name}</CardTitle>
          <CardDescription>
            You&apos;ve been invited to join as{' '}
            <Badge variant={invitation?.role === 'owner' ? 'default' : invitation?.role === 'server' ? 'outline' : 'secondary'} className="ml-1">
              {invitation?.role ? ROLE_LABELS[invitation.role] : 'Team Member'}
            </Badge>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Your Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                disabled={submitting}
                placeholder="John Doe"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                disabled={submitting}
                placeholder="you@example.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone *</Label>
              <PhoneInput
                value={formData.phone}
                onChange={(value) => setFormData({ ...formData, phone: value || '' })}
                required
                disabled={submitting}
                placeholder="Phone number"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Create Password *</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  minLength={6}
                  disabled={submitting}
                  placeholder="Minimum 6 characters"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  disabled={submitting}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password *</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  required
                  minLength={6}
                  disabled={submitting}
                  placeholder="Confirm your password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  disabled={submitting}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="text-sm text-red-500 bg-red-500/20 border border-red-500 rounded p-3">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating account...
                </>
              ) : (
                'Accept Invitation'
              )}
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => router.push('/login')}
                className="text-primary hover:underline"
              >
                Sign in
              </button>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
