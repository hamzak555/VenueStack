'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Eye, EyeOff, Building2, Shield, ChevronRight, Phone, Mail } from 'lucide-react'
import { InteractiveGridPattern } from '@/components/ui/interactive-grid-pattern'
import Image from 'next/image'

interface UserAffiliation {
  type: 'admin' | 'business'
  id: string
  name: string
  businessId?: string
  businessSlug?: string
  businessName?: string
  businessLogo?: string | null
  role?: 'admin' | 'regular'
}

export default function UnifiedLoginPage() {
  const router = useRouter()
  const [loginMethod, setLoginMethod] = useState<'email' | 'phone'>('email')

  // Email login state
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  // Phone login state
  const [phone, setPhone] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [codeSent, setCodeSent] = useState(false)
  const [sendingCode, setSendingCode] = useState(false)
  const [normalizedPhone, setNormalizedPhone] = useState('')

  // Selection state
  const [showSelection, setShowSelection] = useState(false)
  const [affiliations, setAffiliations] = useState<UserAffiliation[]>([])
  const [userName, setUserName] = useState('')
  const [selectingId, setSelectingId] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Login failed')
      }

      setUserName(data.name)
      setAffiliations(data.affiliations)

      if (data.affiliations.length === 1) {
        // Single affiliation - select automatically
        await handleSelectAffiliation(data.affiliations[0])
      } else {
        // Multiple affiliations - show selection screen
        setShowSelection(true)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleSelectAffiliation = async (affiliation: UserAffiliation) => {
    setSelectingId(affiliation.type === 'admin' ? 'admin' : affiliation.businessId || '')
    setError('')

    try {
      const response = await fetch('/api/auth/select', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          affiliationType: affiliation.type,
          businessId: affiliation.businessId,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Selection failed')
      }

      router.push(data.redirectUrl)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setSelectingId(null)
    }
  }

  const handleBackToLogin = () => {
    setShowSelection(false)
    setAffiliations([])
    setPassword('')
    setOtpCode('')
    setCodeSent(false)
    setError('')
  }

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSendingCode(true)

    try {
      const response = await fetch('/api/auth/sms/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phone }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send code')
      }

      setNormalizedPhone(data.phone)
      setCodeSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setSendingCode(false)
    }
  }

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch('/api/auth/sms/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phone: normalizedPhone, code: otpCode }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Verification failed')
      }

      setUserName(data.name)
      setAffiliations(data.affiliations)

      if (data.affiliations.length === 1) {
        await handleSelectAffiliation(data.affiliations[0])
      } else {
        setShowSelection(true)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleChangePhone = () => {
    setCodeSent(false)
    setOtpCode('')
    setError('')
  }

  // Render selection screen
  if (showSelection) {
    const adminAffiliation = affiliations.find(a => a.type === 'admin')
    const businessAffiliations = affiliations.filter(a => a.type === 'business')

    return (
      <div className="relative flex min-h-screen items-center justify-center bg-background p-4 overflow-hidden">
        <div className="absolute top-8 left-8 z-10">
          <Image
            src="/VenueStack Logo.svg"
            alt="VenueStack"
            width={160}
            height={40}
            className="dark:invert"
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
          <CardHeader>
            <CardTitle>Welcome back, {userName}</CardTitle>
            <CardDescription>
              Select where you'd like to go
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {error && (
              <div className="text-sm text-red-500 bg-red-500/20 border border-red-500 rounded p-3 mb-4">
                {error}
              </div>
            )}

            {/* Admin Dashboard Option */}
            {adminAffiliation && (
              <button
                onClick={() => handleSelectAffiliation(adminAffiliation)}
                disabled={selectingId !== null}
                className="w-full flex items-center gap-4 p-4 rounded-lg border border-border bg-card hover:bg-accent hover:border-primary/50 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Shield className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground">Admin Dashboard</p>
                  <p className="text-sm text-muted-foreground">Platform administration</p>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
              </button>
            )}

            {/* Business Options */}
            {businessAffiliations.length > 0 && (
              <>
                {adminAffiliation && businessAffiliations.length > 0 && (
                  <div className="relative py-2">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-border" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">Your Businesses</span>
                    </div>
                  </div>
                )}

                {businessAffiliations.map((affiliation) => (
                  <button
                    key={affiliation.businessId}
                    onClick={() => handleSelectAffiliation(affiliation)}
                    disabled={selectingId !== null}
                    className="w-full flex items-center gap-4 p-4 rounded-lg border border-border bg-card hover:bg-accent hover:border-primary/50 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-muted flex items-center justify-center overflow-hidden p-1.5">
                      {affiliation.businessLogo ? (
                        <Image
                          src={affiliation.businessLogo}
                          alt={affiliation.businessName || ''}
                          width={36}
                          height={36}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <Building2 className="w-6 h-6 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground truncate">
                        {affiliation.businessName}
                      </p>
                      <p className="text-sm text-muted-foreground capitalize">
                        {affiliation.role} access
                      </p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  </button>
                ))}
              </>
            )}

            <Button
              variant="ghost"
              className="w-full mt-4"
              onClick={handleBackToLogin}
              disabled={selectingId !== null}
            >
              Sign in with a different account
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Render login form
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background p-4 overflow-hidden">
      <div className="absolute top-8 left-8 z-10">
        <Image
          src="/VenueStack Logo.svg"
          alt="VenueStack"
          width={160}
          height={40}
          className="dark:invert"
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
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>
            Choose how you'd like to sign in
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Login method tabs */}
          <div className="flex rounded-lg bg-muted p-1">
            <button
              type="button"
              onClick={() => {
                setLoginMethod('email')
                setError('')
              }}
              className={`flex-1 flex items-center justify-center gap-2 rounded-md py-2 text-sm font-medium transition-colors ${
                loginMethod === 'email'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Mail className="h-4 w-4" />
              Email
            </button>
            <button
              type="button"
              onClick={() => {
                setLoginMethod('phone')
                setError('')
              }}
              className={`flex-1 flex items-center justify-center gap-2 rounded-md py-2 text-sm font-medium transition-colors ${
                loginMethod === 'phone'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Phone className="h-4 w-4" />
              Phone
            </button>
          </div>

          {/* Email login form */}
          {loginMethod === 'email' && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    disabled={loading}
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
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Signing in...' : 'Sign in'}
              </Button>
            </form>
          )}

          {/* Phone login form */}
          {loginMethod === 'phone' && !codeSent && (
            <form onSubmit={handleSendCode} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+1 (555) 123-4567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  disabled={sendingCode}
                />
                <p className="text-xs text-muted-foreground">
                  We'll send you a verification code via SMS
                </p>
              </div>
              {error && (
                <div className="text-sm text-red-500 bg-red-500/20 border border-red-500 rounded p-3">
                  {error}
                </div>
              )}
              <Button type="submit" className="w-full" disabled={sendingCode}>
                {sendingCode ? 'Sending code...' : 'Send verification code'}
              </Button>
            </form>
          )}

          {/* OTP verification form */}
          {loginMethod === 'phone' && codeSent && (
            <form onSubmit={handleVerifyCode} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="otp">Verification Code</Label>
                <Input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="123456"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  required
                  disabled={loading}
                  className="text-center text-2xl tracking-widest"
                />
                <p className="text-xs text-muted-foreground">
                  Enter the 6-digit code sent to {normalizedPhone}
                </p>
              </div>
              {error && (
                <div className="text-sm text-red-500 bg-red-500/20 border border-red-500 rounded p-3">
                  {error}
                </div>
              )}
              <Button type="submit" className="w-full" disabled={loading || otpCode.length !== 6}>
                {loading ? 'Verifying...' : 'Verify code'}
              </Button>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={handleChangePhone}
                  disabled={loading}
                >
                  Change number
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={handleSendCode}
                  disabled={sendingCode}
                >
                  {sendingCode ? 'Sending...' : 'Resend code'}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
