'use client'

import Link from 'next/link'
import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { useAuth } from '@/components/auth-provider'

export default function SignupPage() {
  const router = useRouter()
  const { refresh } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    if (password.length < 8) return setError('Use at least 8 characters')
    try {
      await api.signup({ name, email, password })
      await refresh()
      router.replace('/')
    } catch (signupError) {
      setError(signupError instanceof Error ? signupError.message : 'Signup failed')
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-shell">
        <aside className="auth-hero">
          <span className="brand-mark">ZPF</span>
          <p className="eyebrow">0.5 Show</p>
          <h2>Build a private performance history from day one.</h2>
          <p>Every workspace keeps its channels, credentials, posts, reports, and analytics separated.</p>
          <div className="auth-stats">
            <span><strong>OAuth</strong><small>Channel setup</small></span>
            <span><strong>CSV</strong><small>Report export</small></span>
            <span><strong>Sync</strong><small>Real metrics</small></span>
          </div>
          <div className="auth-preview-card">
            <small>Data boundary</small>
            <strong>Accounts and reports stay scoped</strong>
            <i><span style={{ width: '82%' }} /><span style={{ width: '61%' }} /><span style={{ width: '45%' }} /></i>
          </div>
        </aside>
        <form className="auth-card" onSubmit={submit}>
          <p className="eyebrow">New workspace</p>
          <h1>Create your account.</h1>
          <p>Your accounts, posts, tokens, analytics, and reports remain scoped to this 0.5 Show user.</p>
          <label>Name<input value={name} onChange={(event) => { setName(event.target.value); setError('') }} required /></label>
          <label>Email<input type="email" value={email} onChange={(event) => { setEmail(event.target.value); setError('') }} required /></label>
          <label>Password
            <span className="password-field">
              <input type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => { setPassword(event.target.value); setError('') }} required />
              <button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((visible) => !visible)}>{showPassword ? 'Hide' : 'Show'}</button>
            </span>
          </label>
          {error ? <div className="validation-message">{error}</div> : null}
          <button className="primary-button" type="submit">Create workspace</button>
          <Link href="/login">Already have an account?</Link>
        </form>
      </section>
    </main>
  )
}
