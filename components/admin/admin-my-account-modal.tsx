'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Eye, EyeOff } from 'lucide-react'

interface AdminAccount {
  id: string
  email: string
  phone: string | null
  name: string
}

interface AdminMyAccountModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AdminMyAccountModal({ open, onOpenChange }: AdminMyAccountModalProps) {
  const [user, setUser] = useState<AdminAccount | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })

  const fetchAccount = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/admin/account')
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load account')
      }

      setUser(data)
      setFormData({
        name: data.name,
        email: data.email,
        phone: data.phone || '',
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load account')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) {
      fetchAccount()
    }
  }, [open])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(null)

    // Validate password if changing
    if (formData.newPassword) {
      if (formData.newPassword !== formData.confirmPassword) {
        setError('New passwords do not match')
        setSaving(false)
        return
      }
      if (!formData.currentPassword) {
        setError('Current password is required to change password')
        setSaving(false)
        return
      }
    }

    try {
      const updates: any = {}

      if (formData.name !== user?.name) {
        updates.name = formData.name
      }
      if (formData.email !== user?.email) {
        updates.email = formData.email
      }
      if (formData.phone !== (user?.phone || '')) {
        updates.phone = formData.phone || null
      }
      if (formData.newPassword) {
        updates.password = formData.newPassword
        updates.currentPassword = formData.currentPassword
      }

      // If no changes, just close
      if (Object.keys(updates).length === 0) {
        onOpenChange(false)
        return
      }

      const response = await fetch('/api/admin/account', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update account')
      }

      setUser(data)
      setFormData({
        name: data.name,
        email: data.email,
        phone: data.phone || '',
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      })
      setSuccess('Account updated successfully!')

      setTimeout(() => {
        setSuccess(null)
        onOpenChange(false)
      }, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update account')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>My Account</DialogTitle>
          <DialogDescription>
            Manage your admin account information and password
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-muted-foreground">
            Loading...
          </div>
        ) : (
          <form onSubmit={handleSave}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="admin-account-name">Name</Label>
                <Input
                  id="admin-account-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  disabled={saving}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="admin-account-email">Email</Label>
                <Input
                  id="admin-account-email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  disabled={saving}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="admin-account-phone">Phone</Label>
                <Input
                  id="admin-account-phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  disabled={saving}
                  placeholder="+1 (555) 000-0000"
                />
              </div>

              <div className="border-t pt-4 mt-4">
                <p className="text-sm text-muted-foreground mb-4">
                  Change password (leave blank to keep current)
                </p>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="admin-current-password">Current Password</Label>
                    <div className="relative">
                      <Input
                        id="admin-current-password"
                        type={showCurrentPassword ? 'text' : 'password'}
                        value={formData.currentPassword}
                        onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
                        disabled={saving}
                        className="pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      >
                        {showCurrentPassword ? (
                          <EyeOff className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="admin-new-password">New Password</Label>
                    <div className="relative">
                      <Input
                        id="admin-new-password"
                        type={showPassword ? 'text' : 'password'}
                        value={formData.newPassword}
                        onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                        disabled={saving}
                        className="pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="admin-confirm-password">Confirm New Password</Label>
                    <Input
                      id="admin-confirm-password"
                      type="password"
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                      disabled={saving}
                    />
                  </div>
                </div>
              </div>

              {error && (
                <div className="text-sm text-red-500 bg-red-500/20 border border-red-500 rounded p-3">
                  {error}
                </div>
              )}

              {success && (
                <div className="text-sm text-green-500 bg-green-500/20 border border-green-500 rounded p-3">
                  {success}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
