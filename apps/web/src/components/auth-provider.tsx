'use client'

import { usePathname, useRouter } from 'next/navigation'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { User } from '@zpf/shared'
import { api } from '@/lib/api'

type AuthContextValue = {
  user?: User
  loading: boolean
  setUser: (user: User) => void
  refresh: () => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [user, setUser] = useState<User>()
  const [loading, setLoading] = useState(true)
  const isAuthPage = pathname === '/login' || pathname === '/signup'

  async function refresh() {
    setLoading(true)
    try {
      const result = await api.me()
      if (!result.user) throw new Error('No active session')
      setUser(result.user)
      if (isAuthPage) router.replace('/')
    } catch {
      setUser(undefined)
      if (!isAuthPage) router.replace('/login')
    } finally {
      setLoading(false)
    }
  }

  async function logout() {
    await api.logout()
    setUser(undefined)
    router.replace('/login')
  }

  // ✅ Only run once on mount — not on every route change
  useEffect(() => { void refresh() }, [])

  return (
    <AuthContext.Provider value={{ user, loading, setUser, refresh, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used within AuthProvider')
  return value
}
