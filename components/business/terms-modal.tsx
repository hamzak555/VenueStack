'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'

interface TermsModalProps {
  isOpen: boolean
  onClose: () => void
  businessName: string
  termsAndConditions: string
}

export function TermsModal({ isOpen, onClose, businessName, termsAndConditions }: TermsModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Terms of Service</DialogTitle>
          <DialogDescription>
            {businessName}&apos;s terms and conditions
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="whitespace-pre-wrap text-sm text-muted-foreground">
            {termsAndConditions}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
