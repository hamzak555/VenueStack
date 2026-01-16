'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { UserPlus, Pencil, Trash2, Clock, Send, Copy, Check, Mail, Phone } from 'lucide-react'
import { PhoneInput } from '@/components/ui/phone-input'

interface AdminUserDisplay {
  id: string
  email: string
  name: string
  phone: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  source?: 'legacy' | 'global'
}

interface AdminInvitation {
  id: string
  email: string | null
  phone: string | null
  status: 'pending' | 'accepted' | 'expired' | 'cancelled'
  created_at: string
  expires_at: string
  token: string
}

export function AdminUsersManagement() {
  const [users, setUsers] = useState<AdminUserDisplay[]>([])
  const [invitations, setInvitations] = useState<AdminInvitation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Invite user state
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
  const [inviteForm, setInviteForm] = useState({
    email: '',
    phone: '',
  })
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Edit user state
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<AdminUserDisplay | null>(null)
  const [editForm, setEditForm] = useState({
    email: '',
    password: '',
    name: '',
    phone: '',
    is_active: true,
  })
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState('')

  // Delete user state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingUser, setDeletingUser] = useState<AdminUserDisplay | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  // Cancel invitation state
  const [cancelInviteDialogOpen, setCancelInviteDialogOpen] = useState(false)
  const [selectedInvitation, setSelectedInvitation] = useState<AdminInvitation | null>(null)
  const [cancelLoading, setCancelLoading] = useState(false)
  const [cancelError, setCancelError] = useState('')

  // Copy link state
  const [copiedLink, setCopiedLink] = useState<string | null>(null)

  useEffect(() => {
    fetchAll()
  }, [])

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/admin/users')

      if (!response.ok) {
        throw new Error('Failed to fetch users')
      }

      const data = await response.json()
      setUsers(data)
    } catch (err: any) {
      setError(err.message || 'Failed to load users')
    }
  }

  const fetchInvitations = async () => {
    try {
      const response = await fetch('/api/admin/invitations')

      if (!response.ok) {
        throw new Error('Failed to fetch invitations')
      }

      const data = await response.json()
      setInvitations(data)
    } catch (err) {
      console.error('Failed to fetch invitations:', err)
    }
  }

  const fetchAll = async () => {
    setLoading(true)
    setError('')
    await Promise.all([fetchUsers(), fetchInvitations()])
    setLoading(false)
  }

  const openInviteDialog = () => {
    setInviteForm({ email: '', phone: '' })
    setInviteError('')
    setSuccessMessage(null)
    setInviteDialogOpen(true)
  }

  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setInviteLoading(true)
    setInviteError('')
    setSuccessMessage(null)

    try {
      const response = await fetch('/api/admin/invitations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: inviteForm.email || undefined,
          phone: inviteForm.phone || undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send invitation')
      }

      if (data.autoPromoted) {
        // User was auto-promoted (already exists in system)
        setSuccessMessage(`${data.user.name} has been promoted to platform admin!`)
        fetchUsers()
      } else {
        // Invitation was sent
        setSuccessMessage('Invitation sent successfully!')
        fetchInvitations()
      }

      setInviteForm({ email: '', phone: '' })
      setTimeout(() => {
        setInviteDialogOpen(false)
        setSuccessMessage(null)
      }, 2000)
    } catch (err: any) {
      setInviteError(err.message || 'Failed to send invitation')
    } finally {
      setInviteLoading(false)
    }
  }

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingUser) return

    setEditLoading(true)
    setEditError('')

    try {
      const updateData: any = {
        email: editForm.email,
        name: editForm.name,
        phone: editForm.phone || null,
        is_active: editForm.is_active,
      }

      // Only include password if it's not empty
      if (editForm.password) {
        updateData.password = editForm.password
      }

      const response = await fetch(`/api/admin/users/${editingUser.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update user')
      }

      setUsers(users.map((u) => (u.id === editingUser.id ? data : u)))
      setEditDialogOpen(false)
      setEditingUser(null)
      setEditForm({ email: '', password: '', name: '', phone: '', is_active: true })
    } catch (err: any) {
      setEditError(err.message || 'Failed to update user')
    } finally {
      setEditLoading(false)
    }
  }

  const handleDeleteUser = async () => {
    if (!deletingUser) return

    setDeleteLoading(true)
    setDeleteError('')

    try {
      const response = await fetch(`/api/admin/users/${deletingUser.id}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete user')
      }

      setUsers(users.filter((u) => u.id !== deletingUser.id))
      setDeleteDialogOpen(false)
      setDeletingUser(null)
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete user')
    } finally {
      setDeleteLoading(false)
    }
  }

  const handleCancelInvitation = async () => {
    if (!selectedInvitation) return

    setCancelLoading(true)
    setCancelError('')

    try {
      const response = await fetch(`/api/admin/invitations/${selectedInvitation.id}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to cancel invitation')
      }

      setCancelInviteDialogOpen(false)
      setSelectedInvitation(null)
      fetchInvitations()
    } catch (err: any) {
      setCancelError(err.message || 'Failed to cancel invitation')
    } finally {
      setCancelLoading(false)
    }
  }

  const copyInviteLink = async (invitation: AdminInvitation) => {
    const link = `${window.location.origin}/admin-invite/${invitation.token}`
    await navigator.clipboard.writeText(link)
    setCopiedLink(invitation.id)
    setTimeout(() => setCopiedLink(null), 2000)
  }

  const openEditDialog = (user: AdminUserDisplay) => {
    setEditingUser(user)
    setEditForm({
      email: user.email,
      password: '',
      name: user.name,
      phone: user.phone || '',
      is_active: user.is_active,
    })
    setEditError('')
    setEditDialogOpen(true)
  }

  const openDeleteDialog = (user: AdminUserDisplay) => {
    setDeletingUser(user)
    setDeleteError('')
    setDeleteDialogOpen(true)
  }

  const openCancelInviteDialog = (invitation: AdminInvitation) => {
    setSelectedInvitation(invitation)
    setCancelError('')
    setCancelInviteDialogOpen(true)
  }

  const pendingInvitations = invitations.filter(i => i.status === 'pending')

  if (loading) {
    return <div className="text-center py-8">Loading users...</div>
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-500 mb-4">{error}</p>
        <Button onClick={fetchAll}>Retry</Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin Users</h1>
        </div>
        <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openInviteDialog}>
              <UserPlus className="mr-2 h-4 w-4" />
              Invite User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleInviteUser}>
              <DialogHeader>
                <DialogTitle>Invite Admin User</DialogTitle>
                <DialogDescription>
                  Send an invitation to become a platform administrator.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="flex items-end gap-3">
                  <div className="flex-1 space-y-2">
                    <Label htmlFor="invite-email">Email</Label>
                    <Input
                      id="invite-email"
                      type="email"
                      placeholder="admin@example.com"
                      value={inviteForm.email}
                      onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                      disabled={inviteLoading}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground pb-2.5">and/or</span>
                  <div className="flex-1 space-y-2">
                    <Label htmlFor="invite-phone">Phone</Label>
                    <PhoneInput
                      value={inviteForm.phone}
                      onChange={(value) => setInviteForm({ ...inviteForm, phone: value || '' })}
                      disabled={inviteLoading}
                    />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  If the user already exists in the system, they will be automatically promoted to admin.
                  Otherwise, they will receive an invitation to create their account.
                </p>
                {inviteError && (
                  <div className="text-sm text-red-500 bg-red-500/20 border border-red-500 rounded p-3">
                    {inviteError}
                  </div>
                )}
                {successMessage && (
                  <div className="text-sm text-green-500 bg-green-500/20 border border-green-500 rounded p-3">
                    {successMessage}
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setInviteDialogOpen(false)}
                  disabled={inviteLoading}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={inviteLoading || (!inviteForm.email && !inviteForm.phone)}>
                  {inviteLoading ? 'Sending...' : 'Send Invitation'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Admin Users Card */}
      <Card>
        <CardHeader>
          <CardTitle>Platform Administrators</CardTitle>
          <CardDescription>
            {users.length} admin user{users.length !== 1 ? 's' : ''} registered
          </CardDescription>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">
                No admin users found
              </p>
              <Button onClick={openInviteDialog}>
                <UserPlus className="mr-2 h-4 w-4" />
                Invite Your First Admin User
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell className="text-sm">{user.email}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {user.phone || '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.is_active ? 'success' : 'secondary'}>
                        {user.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(user.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        {user.source === 'legacy' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(user)}
                          >
                            Edit
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openDeleteDialog(user)}
                        >
                          {user.source === 'global' ? 'Remove' : 'Delete'}
                        </Button>
                      </div>
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

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <form onSubmit={handleEditUser}>
            <DialogHeader>
              <DialogTitle>Edit Admin User</DialogTitle>
              <DialogDescription>
                Update admin user information
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Name</Label>
                <Input
                  id="edit-name"
                  placeholder="John Doe"
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm({ ...editForm, name: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  placeholder="john@example.com"
                  value={editForm.email}
                  onChange={(e) =>
                    setEditForm({ ...editForm, email: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-phone">Phone</Label>
                <Input
                  id="edit-phone"
                  type="tel"
                  placeholder="+1 (555) 123-4567"
                  value={editForm.phone}
                  onChange={(e) =>
                    setEditForm({ ...editForm, phone: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-password">Password</Label>
                <Input
                  id="edit-password"
                  type="password"
                  placeholder="Leave blank to keep current password"
                  value={editForm.password}
                  onChange={(e) =>
                    setEditForm({ ...editForm, password: e.target.value })
                  }
                />
                <p className="text-sm text-gray-500">
                  Leave blank to keep the current password
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  id="edit-active"
                  type="checkbox"
                  checked={editForm.is_active}
                  onChange={(e) =>
                    setEditForm({ ...editForm, is_active: e.target.checked })
                  }
                  className="h-4 w-4"
                />
                <Label htmlFor="edit-active">Active</Label>
              </div>
              {editError && <p className="text-sm text-red-500">{editError}</p>}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditDialogOpen(false)}
                disabled={editLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={editLoading}>
                {editLoading ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Admin User</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {deletingUser?.name}? This action cannot
              be undone.
            </DialogDescription>
          </DialogHeader>
          {deleteError && (
            <p className="text-sm text-red-500 py-2">{deleteError}</p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleteLoading}
            >
              Cancel
            </Button>
            <Button
              className="bg-red-500/20 text-red-500 border border-red-500 hover:bg-red-500/30"
              onClick={handleDeleteUser}
              disabled={deleteLoading}
            >
              {deleteLoading ? 'Deleting...' : 'Delete User'}
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
                <span className="font-medium">Email:</span> {selectedInvitation.email || '—'}
              </p>
              <p className="text-sm">
                <span className="font-medium">Phone:</span> {selectedInvitation.phone || '—'}
              </p>
            </div>
          )}
          {cancelError && (
            <div className="text-sm text-red-500 bg-red-500/20 border border-red-500 rounded p-3">
              {cancelError}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCancelInviteDialogOpen(false)}
              disabled={cancelLoading}
            >
              Keep Invitation
            </Button>
            <Button
              className="bg-red-500/20 text-red-500 border border-red-500 hover:bg-red-500/30"
              onClick={handleCancelInvitation}
              disabled={cancelLoading}
            >
              {cancelLoading ? 'Cancelling...' : 'Cancel Invitation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
