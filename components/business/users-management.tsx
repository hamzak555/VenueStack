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
import { Plus, Trash2, Send, Clock, UserPlus, Copy, Check, Mail, Phone, HelpCircle, CheckCircle2, XCircle, MinusCircle, ChevronDown } from 'lucide-react'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { PhoneInput } from '@/components/ui/phone-input'
import { getInvitableRoles, ROLE_LABELS, type BusinessRole } from '@/lib/auth/roles'

interface User {
  id: string
  email: string
  name: string
  phone: string | null
  role: BusinessRole
  is_active: boolean
  created_at: string
  user_id: string | null
}

interface Invitation {
  id: string
  email: string | null
  phone: string | null
  role: BusinessRole
  status: 'pending' | 'accepted' | 'expired' | 'cancelled'
  created_at: string
  expires_at: string
  token: string
}

interface UsersManagementProps {
  businessId: string
  businessSlug: string
  userRole: BusinessRole
}

export function UsersManagement({ businessId, businessSlug, userRole }: UsersManagementProps) {
  const [users, setUsers] = useState<User[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [cancelInviteDialogOpen, setCancelInviteDialogOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [selectedInvitation, setSelectedInvitation] = useState<Invitation | null>(null)
  // Get roles this user can invite
  const invitableRoles = getInvitableRoles(userRole)
  const defaultRole = invitableRoles.includes('manager') ? 'manager' : invitableRoles[0] || 'manager'

  const [formData, setFormData] = useState({
    email: '',
    phone: '',
    role: defaultRole as BusinessRole,
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

      setFormData({ email: '', phone: '', role: defaultRole })
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
    setFormData({ email: '', phone: '', role: defaultRole })
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
                        onValueChange={(value: BusinessRole) =>
                          setFormData({ ...formData, role: value })
                        }
                        disabled={formLoading}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {invitableRoles.map((role) => (
                            <SelectItem key={role} value={role}>
                              {ROLE_LABELS[role]}
                            </SelectItem>
                          ))}
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
                      <Badge variant={user.role === 'owner' ? 'default' : user.role === 'server' ? 'outline' : 'secondary'}>
                        {ROLE_LABELS[user.role] || user.role}
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
                      <Badge variant={invitation.role === 'owner' ? 'default' : invitation.role === 'server' ? 'outline' : 'secondary'}>
                        {ROLE_LABELS[invitation.role] || invitation.role}
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

      {/* Role Permissions Reference */}
      <RolePermissionsCard />
    </div>
  )
}

// Permission indicator component
function PermissionIcon({ access }: { access: 'full' | 'limited' | 'none' }) {
  if (access === 'full') {
    return <CheckCircle2 className="h-4 w-4 text-green-500" />
  }
  if (access === 'limited') {
    return <MinusCircle className="h-4 w-4 text-yellow-500" />
  }
  return <XCircle className="h-4 w-4 text-muted-foreground/40" />
}

// Role permissions reference card
function RolePermissionsCard() {
  const [isOpen, setIsOpen] = useState(false)

  const permissions = [
    {
      section: 'Events',
      description: 'View and manage events',
      owner: 'full',
      manager: 'full',
      host: 'limited',
      accounting: 'full',
      server: 'limited',
    },
    {
      section: 'Table Service',
      description: 'Manage table reservations',
      owner: 'full',
      manager: 'full',
      host: 'full',
      accounting: 'full',
      server: 'limited',
    },
    {
      section: 'Tickets',
      description: 'View ticket orders and check-ins',
      owner: 'full',
      manager: 'full',
      host: 'full',
      accounting: 'full',
      server: 'none',
    },
    {
      section: 'Ticket Sales',
      description: 'View all ticket sales and revenue',
      owner: 'full',
      manager: 'full',
      host: 'none',
      accounting: 'full',
      server: 'none',
    },
    {
      section: 'Reports',
      description: 'View financial reports and analytics',
      owner: 'full',
      manager: 'full',
      host: 'none',
      accounting: 'full',
      server: 'none',
    },
    {
      section: 'Customers',
      description: 'View customer database',
      owner: 'full',
      manager: 'full',
      host: 'none',
      accounting: 'none',
      server: 'none',
    },
    {
      section: 'Team Management',
      description: 'Invite and manage users',
      owner: 'full',
      manager: 'limited',
      host: 'none',
      accounting: 'none',
      server: 'none',
    },
    {
      section: 'Floor Plan',
      description: 'Edit venue layouts',
      owner: 'full',
      manager: 'full',
      host: 'none',
      accounting: 'none',
      server: 'none',
    },
    {
      section: 'Marketing',
      description: 'Manage tracking links and campaigns',
      owner: 'full',
      manager: 'full',
      host: 'none',
      accounting: 'none',
      server: 'none',
    },
    {
      section: 'Account Settings',
      description: 'Business profile and preferences',
      owner: 'full',
      manager: 'none',
      host: 'none',
      accounting: 'none',
      server: 'none',
    },
    {
      section: 'Subscription',
      description: 'Billing and plan management',
      owner: 'full',
      manager: 'none',
      host: 'none',
      accounting: 'none',
      server: 'none',
    },
    {
      section: 'Payments',
      description: 'Stripe connection and payouts',
      owner: 'full',
      manager: 'none',
      host: 'none',
      accounting: 'none',
      server: 'none',
    },
  ] as const

  const roleDescriptions = {
    owner: 'Full access to all features including billing, payments, and account settings.',
    manager: 'Can manage events, tables, tickets, customers, marketing, and team members (except owners).',
    host: 'Can manage events and table service. Cannot see financial data or revenue stats.',
    accounting: 'Financial access to reports, ticket sales, and revenue. Cannot manage customers or settings.',
    server: 'Limited to table service for assigned tables only. Can view event calendar.',
  }

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger className="w-full">
          <CardHeader className="cursor-pointer">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-base">Role Permissions</CardTitle>
              </div>
              <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">
            {/* Role Descriptions */}
            <div className="grid gap-3 mb-6">
              {(Object.entries(roleDescriptions) as [BusinessRole, string][]).map(([role, description]) => (
                <div key={role} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                  <Badge variant={role === 'owner' ? 'default' : role === 'server' ? 'outline' : 'secondary'} className="mt-0.5">
                    {ROLE_LABELS[role]}
                  </Badge>
                  <p className="text-sm text-muted-foreground">{description}</p>
                </div>
              ))}
            </div>

            {/* Permissions Table */}
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-[200px]">Feature</TableHead>
                    <TableHead className="text-center w-[80px]">Owner</TableHead>
                    <TableHead className="text-center w-[80px]">Manager</TableHead>
                    <TableHead className="text-center w-[80px]">Host</TableHead>
                    <TableHead className="text-center w-[80px]">Accounting</TableHead>
                    <TableHead className="text-center w-[80px]">Server</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {permissions.map((perm) => (
                    <TableRow key={perm.section}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{perm.section}</p>
                          <p className="text-xs text-muted-foreground">{perm.description}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center">
                          <PermissionIcon access={perm.owner} />
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center">
                          <PermissionIcon access={perm.manager} />
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center">
                          <PermissionIcon access={perm.host} />
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center">
                          <PermissionIcon access={perm.accounting} />
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center">
                          <PermissionIcon access={perm.server} />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-6 mt-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                <span>Full access</span>
              </div>
              <div className="flex items-center gap-1.5">
                <MinusCircle className="h-3.5 w-3.5 text-yellow-500" />
                <span>Limited access</span>
              </div>
              <div className="flex items-center gap-1.5">
                <XCircle className="h-3.5 w-3.5 text-muted-foreground/40" />
                <span>No access</span>
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}
