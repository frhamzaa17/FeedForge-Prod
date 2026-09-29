'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { useAuth } from './auth-provider'
import { LoadingState } from './loading-state'

const navItems = [
  { href: '/', label: 'Overview', icon: 'O' },
  { href: '/analytics', label: 'Analytics', icon: 'A' },
  { href: '/content', label: 'Content', icon: 'C' },
  { href: '/calendar', label: 'Calendar', icon: 'D' },
  { href: '/reports', label: 'Reports', icon: 'R' },
  { href: '/ai-insights', label: 'AI Insights', icon: 'I' },
]

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const { user, loading, logout } = useAuth()
  const isAuthPage = pathname === '/login' || pathname === '/signup'

  if (isAuthPage) return <>{children}</>
  if (loading || !user) return <LoadingState label="Checking your session..." />

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href="/" aria-label="0.5 Show home">
          <span className="brand-mark">ZPF</span>
          <span>0.5 Show<small>Command Center</small></span>
        </Link>

        <nav>
          {navItems.map((item) => (
            <Link className={pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href)) ? 'active' : ''} href={item.href} key={item.href}>
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <Link href="/settings"><span className="nav-icon">S</span>Settings</Link>
          <div className="profile">
            <span className="avatar">{user.name.charAt(0).toUpperCase()}</span>
            <span className="profile-copy"><strong>{user.name}</strong><small title={user.email}>{user.email}</small></span>
            <button className="logout-button" onClick={() => void logout()}>Log out</button>
          </div>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <Link className="mobile-brand" href="/" aria-label="Home">ZPF</Link>
          <div className="scope"><span className="status-dot" />All channels</div>
          <div className="top-actions">
            <span className="local-badge">Private workspace</span>
            <Link className="primary-button" href="/content/new">+ Create content</Link>
          </div>
        </header>
        <nav className="mobile-nav" aria-label="Mobile navigation">
          {[...navItems, { href: '/settings', label: 'Settings', icon: 'S' }].map((item) => (
            <Link className={pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href)) ? 'active' : ''} href={item.href} key={item.href}>
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mobile-account">
          <span className="avatar">{user.name.charAt(0).toUpperCase()}</span>
          <span className="profile-copy"><strong>{user.name}</strong><small title={user.email}>{user.email}</small></span>
          <button className="logout-button" onClick={() => void logout()}>Log out</button>
        </div>
        {children}
      </section>
    </main>
  )
}
