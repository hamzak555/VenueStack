'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Eye, EyeOff, Building2, Shield, ChevronRight, Phone, Mail, Check, X, Loader2 } from 'lucide-react'
import { InteractiveGridPattern } from '@/components/ui/interactive-grid-pattern'
import { PhoneInput } from '@/components/ui/phone-input'
import { OtpInput } from '@/components/ui/otp-input'
import { toast } from 'sonner'
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

  // Mode state (login or register)
  const [mode, setMode] = useState<'login' | 'register'>('login')

  // Registration state
  const [registerForm, setRegisterForm] = useState({
    businessName: '',
    slug: '',
    userName: '',
    email: '',
    password: '',
    phone: '',
  })
  const [slugStatus, setSlugStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle')
  const [slugMessage, setSlugMessage] = useState('')
  const [registerLoading, setRegisterLoading] = useState(false)
  const [registerError, setRegisterError] = useState('')
  const [registerSuccess, setRegisterSuccess] = useState(false)
  const [showRegisterPassword, setShowRegisterPassword] = useState(false)

  // Forgot password state
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotSuccess, setForgotSuccess] = useState(false)
  const [forgotError, setForgotError] = useState('')

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setForgotError('')
    setForgotLoading(true)

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send reset email')
      }

      setForgotSuccess(true)
    } catch (err) {
      setForgotError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setForgotLoading(false)
    }
  }

  const handleBackToEmailLogin = () => {
    setShowForgotPassword(false)
    setForgotEmail('')
    setForgotSuccess(false)
    setForgotError('')
  }

  // Field validation helpers
  const isValidBusinessName = registerForm.businessName.trim().length >= 2
  const isValidUserName = registerForm.userName.trim().length >= 2
  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(registerForm.email)
  const isValidPassword = registerForm.password.length >= 6
  const isValidPhone = registerForm.phone.trim().length >= 10

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

  const handleSendCode = async (e?: React.FormEvent, isResend = false) => {
    e?.preventDefault()
    setError('')
    setSendingCode(true)

    try {
      const response = await fetch('/api/auth/sms/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phone: isResend ? normalizedPhone : phone }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send code')
      }

      setNormalizedPhone(data.phone)
      setCodeSent(true)

      if (isResend) {
        toast.success('New code sent', {
          description: `A new verification code has been sent to ${data.phone}`,
        })
      }
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

  // Generate slug from business name
  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim()
  }

  // Check slug availability with debounce
  const checkSlugAvailability = useCallback(async (slug: string) => {
    if (!slug || slug.length < 2) {
      setSlugStatus('idle')
      setSlugMessage('')
      return
    }

    setSlugStatus('checking')

    try {
      const response = await fetch(`/api/auth/check-slug?slug=${encodeURIComponent(slug)}`)
      const data = await response.json()

      setSlugStatus(data.available ? 'available' : 'taken')
      setSlugMessage(data.message)
    } catch {
      setSlugStatus('idle')
      setSlugMessage('')
    }
  }, [])

  // Debounced slug check
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (registerForm.slug) {
        checkSlugAvailability(registerForm.slug)
      }
    }, 500)

    return () => clearTimeout(timeoutId)
  }, [registerForm.slug, checkSlugAvailability])

  // Handle business name change and auto-generate slug
  const handleBusinessNameChange = (name: string) => {
    setRegisterForm(prev => ({
      ...prev,
      businessName: name,
      slug: generateSlug(name),
    }))
  }

  // Handle registration
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setRegisterError('')
    setRegisterLoading(true)

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(registerForm),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Registration failed')
      }

      setRegisterSuccess(true)

      // Auto-login after registration and redirect to subscription setup
      setTimeout(async () => {
        // Login with the new credentials
        const loginResponse = await fetch('/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: registerForm.email,
            password: registerForm.password,
          }),
        })

        const loginData = await loginResponse.json()

        if (loginResponse.ok && loginData.affiliations?.length > 0) {
          // Select the business affiliation
          const businessAffiliation = loginData.affiliations.find((a: UserAffiliation) => a.type === 'business')
          if (businessAffiliation) {
            // Create session
            const selectResponse = await fetch('/api/auth/select', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                affiliationType: businessAffiliation.type,
                businessId: businessAffiliation.businessId,
              }),
            })

            if (selectResponse.ok) {
              // Redirect to events page to see the unlock dashboard box
              router.push(`/${businessAffiliation.businessSlug}/dashboard/events`)
              router.refresh()
            }
          }
        }
      }, 1500)
    } catch (err) {
      setRegisterError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setRegisterLoading(false)
    }
  }

  // Switch to login mode
  const switchToLogin = () => {
    setMode('login')
    setRegisterError('')
    setRegisterSuccess(false)
    setSlugStatus('idle')
  }

  // Switch to register mode
  const switchToRegister = () => {
    setMode('register')
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
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>{mode === 'login' ? 'Sign in' : 'Register your business'}</CardTitle>
            <CardDescription>
              {mode === 'login'
                ? 'Choose how you\'d like to sign in'
                : 'Create your account and start your free trial'
              }
            </CardDescription>
          </div>
          <Image
            src="/venuestack-icon.svg"
            alt="VenueStack"
            width={20}
            height={20}
            className="opacity-20 dark:opacity-10 grayscale"
          />
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Login Form */}
          {mode === 'login' && (
            <>
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
              {loginMethod === 'email' && !showForgotPassword && (
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
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password">Password</Label>
                      <button
                        type="button"
                        onClick={() => {
                          setShowForgotPassword(true)
                          setForgotEmail(email)
                        }}
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Forgot password?
                      </button>
                    </div>
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

              {/* Forgot password form */}
              {loginMethod === 'email' && showForgotPassword && !forgotSuccess && (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="forgotEmail">Email</Label>
                    <Input
                      id="forgotEmail"
                      type="email"
                      placeholder="you@example.com"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      required
                      disabled={forgotLoading}
                    />
                    <p className="text-xs text-muted-foreground">
                      We'll send you a link to reset your password
                    </p>
                  </div>
                  {forgotError && (
                    <div className="text-sm text-red-500 bg-red-500/20 border border-red-500 rounded p-3">
                      {forgotError}
                    </div>
                  )}
                  <Button type="submit" className="w-full" disabled={forgotLoading}>
                    {forgotLoading ? 'Sending...' : 'Send reset link'}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full"
                    onClick={handleBackToEmailLogin}
                    disabled={forgotLoading}
                  >
                    Back to sign in
                  </Button>
                </form>
              )}

              {/* Forgot password success */}
              {loginMethod === 'email' && showForgotPassword && forgotSuccess && (
                <div className="text-center space-y-4 py-4">
                  <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto">
                    <Mail className="h-8 w-8 text-green-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">Check your email</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      We've sent a password reset link to <strong>{forgotEmail}</strong>
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={handleBackToEmailLogin}
                  >
                    Back to sign in
                  </Button>
                </div>
              )}

              {/* Phone login form */}
              {loginMethod === 'phone' && !codeSent && (
                <form onSubmit={handleSendCode} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <PhoneInput
                      value={phone}
                      onChange={(value) => setPhone(value || '')}
                      required
                      disabled={sendingCode}
                      placeholder="Phone number"
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
                  <div className="space-y-4">
                    <Label className="text-center block">Verification Code</Label>
                    <OtpInput
                      value={otpCode}
                      onChange={setOtpCode}
                      disabled={loading}
                      autoFocus
                    />
                    <p className="text-xs text-muted-foreground text-center">
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
                      onClick={() => handleSendCode(undefined, true)}
                      disabled={sendingCode}
                    >
                      {sendingCode ? 'Sending...' : 'Resend code'}
                    </Button>
                  </div>
                </form>
              )}

              {/* Register link */}
              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground normal-case">New to VenueStack?</span>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={switchToRegister}
              >
                <Building2 className="mr-2 h-4 w-4" />
                Register your business
              </Button>

            </>
          )}

          {/* Registration Form */}
          {mode === 'register' && !registerSuccess && (
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="businessName">Business Name *</Label>
                <Input
                  id="businessName"
                  type="text"
                  placeholder="My Awesome Venue"
                  value={registerForm.businessName}
                  onChange={(e) => handleBusinessNameChange(e.target.value)}
                  required
                  disabled={registerLoading}
                  className={isValidBusinessName ? 'border-green-500 focus-visible:ring-green-500' : ''}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="slug">Your URL *</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground whitespace-nowrap">venuestack.io/</span>
                  <div className="relative flex-1">
                    <Input
                      id="slug"
                      type="text"
                      placeholder="my-venue"
                      value={registerForm.slug}
                      onChange={(e) => setRegisterForm(prev => ({ ...prev, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
                      required
                      disabled={registerLoading}
                      className={`pr-8 ${
                        slugStatus === 'available' ? 'border-green-500 focus-visible:ring-green-500' :
                        slugStatus === 'taken' ? 'border-red-500 focus-visible:ring-red-500' : ''
                      }`}
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                      {slugStatus === 'checking' && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                      {slugStatus === 'available' && <Check className="h-4 w-4 text-green-500" />}
                      {slugStatus === 'taken' && <X className="h-4 w-4 text-red-500" />}
                    </div>
                  </div>
                </div>
                {slugMessage && (
                  <p className={`text-xs ${slugStatus === 'available' ? 'text-green-500' : 'text-red-500'}`}>
                    {slugMessage}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="registerUserName">Your Name *</Label>
                <Input
                  id="registerUserName"
                  type="text"
                  placeholder="John Doe"
                  value={registerForm.userName}
                  onChange={(e) => setRegisterForm(prev => ({ ...prev, userName: e.target.value }))}
                  required
                  disabled={registerLoading}
                  className={isValidUserName ? 'border-green-500 focus-visible:ring-green-500' : ''}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="registerEmail">Email *</Label>
                <Input
                  id="registerEmail"
                  type="email"
                  placeholder="you@example.com"
                  value={registerForm.email}
                  onChange={(e) => setRegisterForm(prev => ({ ...prev, email: e.target.value }))}
                  required
                  disabled={registerLoading}
                  className={isValidEmail ? 'border-green-500 focus-visible:ring-green-500' : ''}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="registerPassword">Password *</Label>
                <div className="relative">
                  <Input
                    id="registerPassword"
                    type={showRegisterPassword ? 'text' : 'password'}
                    placeholder="Minimum 6 characters"
                    value={registerForm.password}
                    onChange={(e) => setRegisterForm(prev => ({ ...prev, password: e.target.value }))}
                    required
                    minLength={6}
                    disabled={registerLoading}
                    className={`pr-10 ${isValidPassword ? 'border-green-500 focus-visible:ring-green-500' : ''}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    disabled={registerLoading}
                  >
                    {showRegisterPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="registerPhone">Phone Number *</Label>
                <PhoneInput
                  value={registerForm.phone}
                  onChange={(value) => setRegisterForm(prev => ({ ...prev, phone: value || '' }))}
                  required
                  disabled={registerLoading}
                  placeholder="Phone number"
                />
              </div>

              {registerError && (
                <div className="text-sm text-red-500 bg-red-500/20 border border-red-500 rounded p-3">
                  {registerError}
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={registerLoading || slugStatus === 'taken' || slugStatus === 'checking'}
              >
                {registerLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating your account...
                  </>
                ) : (
                  'Get Started'
                )}
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                By registering, you agree to our terms of service and privacy policy
              </p>

              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">Already have an account?</span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={switchToLogin}
              >
                Sign in instead
              </Button>
            </form>
          )}

          {/* Registration Success */}
          {mode === 'register' && registerSuccess && (
            <div className="text-center space-y-4 py-4">
              <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto">
                <Check className="h-8 w-8 text-green-500" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Welcome to VenueStack!</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Your account has been created. Redirecting you to start your free trial...
                </p>
              </div>
              <div className="flex items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
