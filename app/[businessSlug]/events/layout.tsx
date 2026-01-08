import { ReactNode } from 'react'
import { ForceDarkMode } from '@/components/force-dark-mode'

interface EventsLayoutProps {
  children: ReactNode
}

export default function EventsLayout({ children }: EventsLayoutProps) {
  return <ForceDarkMode>{children}</ForceDarkMode>
}
