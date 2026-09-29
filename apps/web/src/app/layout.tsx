import type { Metadata } from 'next'
import { AppShell } from '@/components/app-shell'
import { AuthProvider } from '@/components/auth-provider'
import './globals.css'

export const metadata: Metadata = {
  title: '0.5 Show',
  description: 'One operating surface to plan, publish, measure, and learn across every channel.',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body><AuthProvider><AppShell>{children}</AppShell></AuthProvider></body>
    </html>
  )
}
