'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { AdminMyAccountModal } from '@/components/admin/admin-my-account-modal'
import { User } from 'lucide-react'

export function AdminMyAccountButton() {
  const [modalOpen, setModalOpen] = useState(false)

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="w-full"
        onClick={() => setModalOpen(true)}
      >
        <User className="mr-2 h-4 w-4" />
        My Account
      </Button>
      <AdminMyAccountModal open={modalOpen} onOpenChange={setModalOpen} />
    </>
  )
}
