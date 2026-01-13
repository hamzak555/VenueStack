'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Trash2, Send, Clock, UserPlus, Copy, Check, Mail, Phone } from 'lucide-react'
import { PhoneInput } from '@/components/ui/phone-input'

interface User {
  id: string
  email: string
  name: string
  phone: string | null
  role: 'admin' | 'regular'
  is_active: boolean
  created_at: string
  user_id: string | null
}

interface Invitation {
  id: string
  email: string | null
  phone: string | null
  role: 'admin' | 'regular'
  status: 'pending' | 'accepted' | 'expired' | 'cancelled'
  created_at: string
  expires_at: string
  token: string
}

interface UsersManagementProps {
  businessId: string
  businessSlug: string
}

export function UsersManagement({ businessId, businessSlug }: UsersManagementProps) {
  const [users, setUsers] = useState<User[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [cancelInviteDialogOpen, setCancelInviteDialogOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [selectedInvitation, setSelectedInvitation] = useState<Invitation | null>(null)
  const [formData, setFormData] = useState({
    email: '',
    phone: '',
    role: 'regular' as 'admin' | 'regular',
  })
  const [formLoading, setFormLoading] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [copiedLink, setCopiedLink] = useState<string | null>(null)

  const fetchUsers = async () => {
    try {
      const response = await fetch(`/api/business/${businessId}/users`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch users')
      }

      setUsers(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch users')
    }
  }

  const fetchInvitations = async () => {
    try {
      const response = await fetch(`/api/business/${businessId}/invitations`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch invitations')
      }

      setInvitations(data)
    } catch (err) {
      console.error('Failed to fetch invitations:', err)
    }
  }

  const fetchAll = async () => {
    setLoading(true)
    setError(null)
    await Promise.all([fetchUsers(), fetchInvitations()])
    setLoading(false)
  }

  useEffect(() => {
    fetchAll()
  }, [businessId])

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormLoading(true)
    setFormError(null)
    setSuccessMessage(null)

    try {
      const response = await fetch(`/api/business/${businessId}/invitations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email || undefined,
          phone: formData.phone || undefined,
          role: formData.role,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send invitation')
      }

      if (data.autoLinked) {
        // User was auto-linked (already exists in system)
        setSuccessMessage(`${data.user.name} has been added to your business!`)
        fetchUsers()
      } else {
        // Invitation was sent
        setSuccessMessage('Invitation sent successfully!')
        fetchInvitations()
      }

      setFormData({ email: '', phone: '', role: 'regular' })
      setTimeout(() => {
        setInviteDialogOpen(false)
        setSuccessMessage(null)
      }, 2000)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to send invitation')
    } finally {
      setFormLoading(false)
    }
  }

  const handleResendInvitation = async (invitation: Invitation) => {
    try {
      const response = await fetch(`/api/business/${businessId}/invitations/${invitation.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'resend' }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to resend invitation')
      }

      fetchInvitations()
    } catch (err) {
      console.error('Failed to resend invitation:', err)
    }
  }

  const handleCancelInvitation = async () => {
    if (!selectedInvitation) return

    setFormLoading(true)
    setFormError(null)

    try {
      const response = await fetch(`/api/business/${businessId}/invitations/${selectedInvitation.id}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to cancel invitation')
      }

      setCancelInviteDialogOpen(false)
      setSelectedInvitation(null)
      fetchInvitations()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to cancel invitation')
    } finally {
      setFormLoading(false)
    }
  }

  const handleRemoveUser = async () => {
    if (!selectedUser) return

    setFormLoading(true)
    setFormError(null)

    try {
      const response = await fetch(`/api/business/${businessId}/users/${selectedUser.id}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to remove user')
      }

      setDeleteDialogOpen(false)
      setSelectedUser(null)
      fetchUsers()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to remove user')
    } finally {
      setFormLoading(false)
    }
  }

  const copyInviteLink = async (invitation: Invitation) => {
    const link = `${window.location.origin}/invite/${invitation.token}`
    await navigator.clipboard.writeText(link)
    setCopiedLink(invitation.id)
    setTimeout(() => setCopiedLink(null), 2000)
  }

  const openInviteDialog = () => {
    setFormData({ email: '', phone: '', role: 'regular' })
    setFormError(null)
    setSuccessMessage(null)
    setInviteDialogOpen(true)
  }

  const openRemoveDialog = (user: User) => {
    setSelectedUser(user)
    setFormError(null)
    setDeleteDialogOpen(true)
  }

  const openCancelInviteDialog = (invitation: Invitation) => {
    setSelectedInvitation(invitation)
    setFormError(null)
    setCancelInviteDialogOpen(true)
  }

  const pendingInvitations = invitations.filter(i => i.status === 'pending')

  if (loading) {
    return <div>Loading users...</div>
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">Error</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm">{error}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Team Members */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Team Members</CardTitle>
              <CardDescription>
                {users.length} member{users.length !== 1 ? 's' : ''} with access to this dashboard
              </CardDescription>
            </div>
            <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={openInviteDialog}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Invite User
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={handleInvite}>
                  <DialogHeader>
                    <DialogTitle>Invite User</DialogTitle>
                    <DialogDescription>
                      Send an invitation to join your business.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="flex items-end gap-3">
                      <div className="flex-1 space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          disabled={formLoading}
                          placeholder="user@example.com"
                        />
                      </div>
                      <span className="text-xs text-muted-foreground pb-2.5">and/or</span>
                      <div className="flex-1 space-y-2">
                        <Label htmlFor="phone">Phone</Label>
                        <PhoneInput
                          value={formData.phone}
                          onChange={(value) => setFormData({ ...formData, phone: value || '' })}
                          disabled={formLoading}
                          placeholder="Phone number"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="role">Role</Label>
                      <Select
                        value={formData.role}
                        onValueChange={(value: 'admin' | 'regular') =>
                          setFormData({ ...formData, role: value })
                        }
                        disabled={formLoading}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="regular">Regular User</SelectItem>
                          <SelectItem value="admin">Admin User</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {formError && (
                      <div className="text-sm text-red-500 bg-red-500/20 border border-red-500 rounded p-3">
                        {formError}
                      </div>
                    )}
                    {successMessage && (
                      <div className="text-sm text-green-500 bg-green-500/20 border border-green-500 rounded p-3">
                        {successMessage}
                      </div>
                    )}
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setInviteDialogOpen(false)} disabled={formLoading}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={formLoading || (!formData.email && !formData.phone)}>
                      {formLoading ? 'Sending...' : 'Send Invitation'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">No team members yet</p>
              <Button onClick={openInviteDialog}>
                <UserPlus className="mr-2 h-4 w-4" />
                Invite Your First Team Member
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell className="text-muted-foreground">{user.phone || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                        {user.role === 'admin' ? 'Admin' : 'Regular'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(user.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openRemoveDialog(user)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pending Invitations */}
      {pendingInvitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Pending Invitations
            </CardTitle>
            <CardDescription>
              {pendingInvitations.length} pending invitation{pendingInvitations.length !== 1 ? 's' : ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contact</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingInvitations.map((invitation) => (
                  <TableRow key={invitation.id}>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {invitation.email && (
                          <div className="flex items-center gap-1 text-sm">
                            <Mail className="h-3 w-3 text-muted-foreground" />
                            {invitation.email}
                          </div>
                        )}
                        {invitation.phone && (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            {invitation.phone}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={invitation.role === 'admin' ? 'default' : 'secondary'}>
                        {invitation.role === 'admin' ? 'Admin' : 'Regular'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(invitation.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(invitation.expires_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyInviteLink(invitation)}
                          title="Copy invite link"
                        >
                          {copiedLink === invitation.id ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleResendInvitation(invitation)}
                          title="Resend invitation"
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openCancelInviteDialog(invitation)}
                          title="Cancel invitation"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Remove User Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove User</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove this user from your business? They will lose access to this dashboard.
            </DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="py-4">
              <p className="text-sm">
                <span className="font-medium">Name:</span> {selectedUser.name}
              </p>
              <p className="text-sm">
                <span className="font-medium">Email:</span> {selectedUser.email}
              </p>
            </div>
          )}
          {formError && (
            <div className="text-sm text-red-500 bg-red-500/20 border border-red-500 rounded p-3">
              {formError}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={formLoading}>
              Cancel
            </Button>
            <Button className="bg-red-500/20 text-red-500 border border-red-500 hover:bg-red-500/30" onClick={handleRemoveUser} disabled={formLoading}>
              {formLoading ? 'Removing...' : 'Remove User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Invitation Dialog */}
      <Dialog open={cancelInviteDialogOpen} onOpenChange={setCancelInviteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Invitation</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel this invitation? The invite link will no longer work.
            </DialogDescription>
          </DialogHeader>
          {selectedInvitation && (
            <div className="py-4">
              <p className="text-sm">
                <span className="font-medium">Email:</span> {selectedInvitation.email || '-'}
              </p>
              <p className="text-sm">
                <span className="font-medium">Phone:</span> {selectedInvitation.phone || '-'}
              </p>
            </div>
          )}
          {formError && (
            <div className="text-sm text-red-500 bg-red-500/20 border border-red-500 rounded p-3">
              {formError}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelInviteDialogOpen(false)} disabled={formLoading}>
              Keep Invitation
            </Button>
            <Button className="bg-red-500/20 text-red-500 border border-red-500 hover:bg-red-500/30" onClick={handleCancelInvitation} disabled={formLoading}>
              {formLoading ? 'Cancelling...' : 'Cancel Invitation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
