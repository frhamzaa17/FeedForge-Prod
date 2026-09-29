'use client'

import Link from 'next/link'
import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { useAuth } from '@/components/auth-provider'

export default function LoginPage() {
  const router = useRouter()
  const { refresh } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    try {
      await api.login({ email, password })
      await refresh()
      router.replace('/')
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Login failed')
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-shell">
        <aside className="auth-hero">
          <span className="brand-mark">ZPF</span>
          <p className="eyebrow">0.5 Show</p>
          <h2>One command center for every channel.</h2>
          <p>Connect accounts, track real performance, plan content, and turn channel history into useful next steps.</p>
          <div className="auth-stats">
            <span><strong>8</strong><small>Channel types</small></span>
            <span><strong>24/7</strong><small>Data history</small></span>
            <span><strong>AI</strong><small>Human approved</small></span>
          </div>
          <div className="auth-preview-card">
            <small>Workspace health</small>
            <strong>Analytics, publishing, reports</strong>
            <i><span style={{ width: '74%' }} /><span style={{ width: '52%' }} /><span style={{ width: '88%' }} /></i>
          </div>
        </aside>
        <form className="auth-card" onSubmit={submit}>
          <p className="eyebrow">Secure sign in</p>
          <h1>Welcome back.</h1>
          <p>Sign in to your private 0.5 Show workspace.</p>
          <label>Email<input type="email" value={email} onChange={(event) => { setEmail(event.target.value); setError('') }} required /></label>
          <label>Password
            <span className="password-field">
              <input type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => { setPassword(event.target.value); setError('') }} required />
              <button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((visible) => !visible)}>{showPassword ? 'Hide' : 'Show'}</button>
            </span>
          </label>
          {error ? <div className="validation-message">{error}</div> : null}
          <button className="primary-button" type="submit">Sign in</button>
          <Link href="/signup">Create a new workspace</Link>
        </form>
      </section>
    </main>
  )
}
