import { ReactNode } from 'react'
import { ForceDarkMode } from '@/components/force-dark-mode'

interface PublicLayoutProps {
  children: ReactNode
}

export default function PublicLayout({ children }: PublicLayoutProps) {
  return <ForceDarkMode>{children}</ForceDarkMode>
}
