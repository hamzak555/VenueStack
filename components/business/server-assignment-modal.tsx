'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Loader2, User } from 'lucide-react'
import { toast } from 'sonner'

interface ServerUser {
  id: string
  name: string
  email: string
}

interface ServerAssignmentModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  eventId: string
  sectionId: string
  tableName: string
  currentAssignedServerIds: string[]
  businessId: string
  onAssignmentChange?: () => void
}

export function ServerAssignmentModal({
  open,
  onOpenChange,
  eventId,
  sectionId,
  tableName,
  currentAssignedServerIds,
  businessId,
  onAssignmentChange,
}: ServerAssignmentModalProps) {
  const [serverUsers, setServerUsers] = useState<ServerUser[]>([])
  const [selectedServerIds, setSelectedServerIds] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Load server users when modal opens
  useEffect(() => {
    if (open) {
      loadServerUsers()
      setSelectedServerIds(currentAssignedServerIds)
    }
  }, [open, currentAssignedServerIds])

  const loadServerUsers = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/business/${businessId}/users?role=server`)
      if (response.ok) {
        const data = await response.json()
        setServerUsers(Array.isArray(data) ? data : [])
      }
    } catch (error) {
      console.error('Error loading server users:', error)
      toast.error('Failed to load server users')
    } finally {
      setIsLoading(false)
    }
  }

  const handleToggleServer = (serverId: string) => {
    setSelectedServerIds(prev => {
      if (prev.includes(serverId)) {
        return prev.filter(id => id !== serverId)
      }
      return [...prev, serverId]
    })
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const response = await fetch(`/api/events/${eventId}/tables/assign-server`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectionId,
          tableName,
          serverUserIds: selectedServerIds,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to assign servers')
      }

      toast.success('Server assignment updated')
      onOpenChange(false)
      onAssignmentChange?.()
    } catch (error) {
      console.error('Error assigning servers:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to assign servers')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Assign Server to Table {tableName}</DialogTitle>
          <DialogDescription>
            Select which server(s) can manage this table.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : serverUsers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <User className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">No server users found.</p>
              <p className="text-xs mt-1">Invite users with the Server role first.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {serverUsers.map(server => (
                <label
                  key={server.id}
                  className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent cursor-pointer transition-colors"
                >
                  <Checkbox
                    checked={selectedServerIds.includes(server.id)}
                    onCheckedChange={() => handleToggleServer(server.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{server.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{server.email}</p>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving || isLoading}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
