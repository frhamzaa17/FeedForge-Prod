'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import type { Account, AccountConnectionConfig, Platform, ProviderCredentialPublic } from '@zpf/shared'
import { api } from '@/lib/api'
import { freshnessLabel, platformCode, platformColor, platformLabel } from '@/lib/format'

const availablePlatforms: Platform[] = ['instagram', 'facebook', 'youtube', 'tiktok', 'linkedin', 'threads', 'x', 'reddit']

export default function SettingsPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [configs, setConfigs] = useState<Partial<Record<Platform, AccountConnectionConfig>>>({})
  const [credentials, setCredentials] = useState<Partial<Record<Platform, ProviderCredentialPublic>>>({})
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<Platform | null>(null)
  const [mockUsername, setMockUsername] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [disconnectingId, setDisconnectingId] = useState('')
  const [credentialDraft, setCredentialDraft] = useState({ clientId: '', clientSecret: '' })
  const [savingCredential, setSavingCredential] = useState(false)
  const searchParams = useSearchParams()

  const load = useCallback(async () => {
    const connected = await api.accounts()
    setAccounts(connected)
    const [configEntries, credentialList] = await Promise.all([
      Promise.all(availablePlatforms.map(async (platform) => [platform, await api.connectionConfig(platform)] as const)),
      api.providerCredentials(),
    ])
    const credentialEntries = credentialList.map((credential) => [credential.platform, credential] as const)
    setConfigs(Object.fromEntries(configEntries))
    setCredentials(Object.fromEntries(credentialEntries))
  }, [])

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    const status = searchParams.get('connection')
    const platform = searchParams.get('platform') as Platform | null
    if (status === 'success' && platform) setMessage(`${platformLabel(platform)} authorized successfully. Initial account backfill is queued.`)
    if (status === 'error') setError(searchParams.get('message') ?? 'The platform did not authorize this connection.')
  }, [searchParams])

  async function connect(platform: Platform) {
    const config = configs[platform]
    if (config?.configured && config.authUrl) {
      window.location.assign(config.authUrl)
      return
    }
    setSelected(platform)
    setCredentialDraft({ clientId: '', clientSecret: '' })
  }

  function configure(platform: Platform) {
    setSelected(platform)
    setCredentialDraft({ clientId: '', clientSecret: '' })
    setError('')
    setMessage('')
  }

  async function saveCredential() {
    if (!selected) return
    setSavingCredential(true)
    setError('')
    setMessage('')
    try {
      await api.saveProviderCredential({ platform: selected, ...credentialDraft })
      setCredentialDraft({ clientId: '', clientSecret: '' })
      setMessage(`${platformLabel(selected)} credentials saved for this brand. You can now connect ${platformLabel(selected)} channels.`)
      await load()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save connection credentials.')
    } finally {
      setSavingCredential(false)
    }
  }

  async function removeCredential(platform: Platform) {
    const confirmed = window.confirm(`Remove saved ${platformLabel(platform)} OAuth app credentials for this brand? Existing connected channel tokens are not removed.`)
    if (!confirmed) return
    setError('')
    setMessage('')
    try {
      await api.deleteProviderCredential(platform)
      setMessage(`${platformLabel(platform)} connection credentials removed for this brand.`)
      await load()
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : 'Could not remove connection credentials.')
    }
  }

  async function connectMock() {
    if (!selected) return
    setConnecting(true)
    setError('')
    try {
      const result = await api.connectMock(selected, mockUsername.trim() || undefined)
      setMessage(`${platformLabel(selected)} sample channel connected. Backfill job ${result.backfillJob.id.slice(0, 8)} queued.`)
      setSelected(null)
      setMockUsername('')
      await load()
    } catch (connectError) {
      setError(connectError instanceof Error ? connectError.message : 'Could not connect the account.')
    } finally {
      setConnecting(false)
    }
  }

  async function disconnect(account: Account) {
    const confirmed = window.confirm(`Disconnect ${platformLabel(account.platform)} ${account.username}? Scheduled posts targeting this channel will no longer publish there.`)
    if (!confirmed) return

    setDisconnectingId(account.id)
    setError('')
    setMessage('')
    try {
      await api.disconnectAccount(account.id)
      setMessage(`${platformLabel(account.platform)} ${account.username} disconnected. Stored tokens were removed.`)
      await load()
    } catch (disconnectError) {
      setError(disconnectError instanceof Error ? disconnectError.message : 'Could not disconnect this account.')
    } finally {
      setDisconnectingId('')
    }
  }

  return (
    <div className="content">
      <div className="page-heading"><div><p className="eyebrow">Workspace settings</p><h1>Connected channels</h1><p>Sign in to each social network and grant only the permissions needed to publish and read analytics.</p></div></div>
      {message ? <div className="success-message">{message}</div> : null}
      {error ? <div className="error-message">{error}</div> : null}
      <section className="panel connection-guide">
        <div><p className="eyebrow">How connection works</p><h2>Each brand owns its channel access</h2></div>
        <ol>
          <li><b>1</b><span>Add the brand&apos;s Client ID and Secret for the platform.</span></li>
          <li><b>2</b><span>Click Connect, sign in, and approve the requested permissions.</span></li>
          <li><b>3</b><span>The channel appears here and 0.5 Show starts syncing real history.</span></li>
        </ol>
        <p>Credentials and channel tokens are encrypted and kept separate for each logged-in workspace.</p>
      </section>
      <section className="settings-grid">
        {accounts.map((account) => (
          <article className="panel settings-card" key={account.id}>
            <span className="platform-icon" style={{ background: account.color }}>{platformCode(account.platform)}</span>
            <span><strong>{platformLabel(account.platform)}</strong><small>{account.username}</small></span>
            <b>{account.connectionHealth.status}</b>
            <small>{freshnessLabel(account.lastSyncAt)} | {account.scopes.join(', ')}</small>
            <p>{account.connectionHealth.message}</p>
            <button className="danger-button" disabled={disconnectingId === account.id} onClick={() => void disconnect(account)}>
              {disconnectingId === account.id ? 'Disconnecting...' : 'Disconnect'}
            </button>
          </article>
        ))}
      </section>

      <div className="section-heading"><p className="eyebrow">Add account</p><h2>Connect another channel</h2></div>
      <section className="connect-grid">
        {availablePlatforms.map((platform) => {
          const config = configs[platform]
          const credential = credentials[platform]
          return (
            <article className="panel connect-card" key={platform}>
              <span className="platform-icon" style={{ background: platformColor(platform) }}>{platformCode(platform)}</span>
              <div><strong>{platformLabel(platform)}</strong><small className={config?.configured ? 'provider-ready' : 'provider-setup'}>{config?.configured ? 'Ready to connect' : 'Add credentials first'}</small></div>
              <p>{config?.notes[0] ?? 'Loading connection details...'}</p>
              <small>{credential?.clientIdPreview ? `Client ID: ${credential.clientIdPreview}` : `Scopes: ${config?.scopes.join(', ')}`}</small>
              <div className="connect-actions">
                <button className="primary-button" onClick={() => void connect(platform)}>{config?.configured ? `Connect ${platformLabel(platform)}` : 'Add credentials'}</button>
                <button className="secondary-button" onClick={() => configure(platform)}>Manage</button>
              </div>
            </article>
          )
        })}
      </section>

      {selected ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setSelected(null)}>
          <section className="connection-modal" role="dialog" aria-modal="true" aria-labelledby="connection-title" onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" aria-label="Close" onClick={() => setSelected(null)}>x</button>
            <span className="platform-icon" style={{ background: platformColor(selected) }}>{platformCode(selected)}</span>
            <p className="eyebrow">Brand connection setup</p>
            <h2 id="connection-title">Configure {platformLabel(selected)}</h2>
            <p>Paste this brand&apos;s {platformLabel(selected)} Client ID and Secret here. After saving, the connect button will open the platform sign-in screen.</p>
            <div className="redirect-box"><small>Register this callback URL</small><code>{configs[selected]?.redirectUri}</code></div>
            {credentials[selected]?.configured ? (
              <p className="security-note"><strong>Current setup:</strong> {platformLabel(selected)} is ready. Client ID {credentials[selected]?.clientIdPreview}.</p>
            ) : (
              <p className="security-note"><strong>Current setup:</strong> No saved credentials for this brand yet.</p>
            )}
            <div className="credential-form">
              <label>Client ID<input value={credentialDraft.clientId} onChange={(event) => setCredentialDraft((draft) => ({ ...draft, clientId: event.target.value }))} placeholder={`${platformLabel(selected)} client ID`} /></label>
              <label>Client Secret<input type="password" value={credentialDraft.clientSecret} onChange={(event) => setCredentialDraft((draft) => ({ ...draft, clientSecret: event.target.value }))} placeholder={`${platformLabel(selected)} client secret`} /></label>
              <button className="primary-button" disabled={savingCredential} onClick={() => void saveCredential()}>{savingCredential ? 'Saving...' : 'Save credentials'}</button>
              {credentials[selected]?.configuredBy === 'workspace' ? <button className="danger-button" onClick={() => void removeCredential(selected)}>Remove credentials</button> : null}
            </div>
            <div className="dev-connect">
              <label>Sample username<input value={mockUsername} onChange={(event) => setMockUsername(event.target.value)} placeholder={selected === 'reddit' ? 'u/example' : '@example'} /></label>
              <button className="secondary-button" disabled={connecting} onClick={() => void connectMock()}>{connecting ? 'Connecting...' : 'Use sample channel'}</button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  )
}
