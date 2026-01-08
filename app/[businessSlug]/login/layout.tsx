import { ReactNode } from 'react'
import { ForceDarkMode } from '@/components/force-dark-mode'

interface LoginLayoutProps {
  children: ReactNode
}

export default function LoginLayout({ children }: LoginLayoutProps) {
  return <ForceDarkMode>{children}</ForceDarkMode>
}
