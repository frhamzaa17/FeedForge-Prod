import type { AccountConnectionConfig, Platform } from '@zpf/shared'
import { createHash, randomBytes } from 'node:crypto'

const redirectBase = process.env.API_URL ?? 'http://localhost:4000'

export type OAuthClientCredentials = {
  clientId?: string
  clientSecret?: string
  source: 'workspace' | 'server' | 'none'
}

export function createConnectionConfig(platform: Platform, scopes: string[], state: string, credentials: OAuthClientCredentials): AccountConnectionConfig & { codeVerifier?: string } {
  const redirectUri = `${redirectBase}/api/accounts/oauth/${platform}/callback`
  const clientId = credentials.clientId
  const configuredBy = credentials.source
  const configured = Boolean(clientId && (platform === 'x' || credentials.clientSecret))

  if (platform === 'reddit') {
    return {
      platform,
      label: 'Reddit',
      configured,
      configuredBy,
      scopes,
      redirectUri,
      authUrl: configured ? `https://www.reddit.com/api/v1/authorize?client_id=${clientId}&response_type=code&state=${state}&redirect_uri=${encodeURIComponent(redirectUri)}&duration=permanent&scope=${encodeURIComponent(scopes.join(' '))}` : undefined,
      notes: [configured ? 'Reddit is ready to connect for this brand.' : 'Add this brand\'s Reddit Client ID and Secret before connecting.', 'Minimum permissions: identity, read, submit.'],
    }
  }

  if (platform === 'x') {
    const codeVerifier = randomBytes(32).toString('base64url')
    const challenge = createHash('sha256').update(codeVerifier).digest('base64url')
    return {
      platform,
      label: 'X',
      configured,
      configuredBy,
      scopes,
      redirectUri,
      codeVerifier,
      authUrl: configured ? `https://twitter.com/i/oauth2/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes.join(' '))}&state=${state}&code_challenge=${challenge}&code_challenge_method=S256` : undefined,
      notes: [configured ? 'X is ready to connect for this brand.' : 'Add this brand\'s X Client ID and Secret before connecting.', 'Minimum permissions: read profile, read posts, publish posts, offline access.'],
    }
  }

  const authUrl = configured ? genericAuthUrl(platform, clientId, redirectUri, scopes, state) : undefined

  return {
    platform,
    label: platform.charAt(0).toUpperCase() + platform.slice(1),
    configured,
    configuredBy,
    scopes,
    redirectUri,
    authUrl,
    notes: [
      configured ? `${platform.charAt(0).toUpperCase() + platform.slice(1)} is ready to connect for this brand.` : `Add this brand's ${platform} Client ID and Secret before connecting.`,
      platform === 'youtube'
        ? 'YouTube connects fully for channel analytics and recent uploads.'
        : 'Connection screen is prepared; this platform still needs final platform approval before live posting.',
    ],
  }
}

function genericAuthUrl(platform: Platform, clientId: string | undefined, redirectUri: string, scopes: string[], state: string) {
  if (!clientId) return undefined
  const scope = encodeURIComponent(scopes.join(platform === 'youtube' ? ' ' : ' '))
  const redirect = encodeURIComponent(redirectUri)

  if (platform === 'youtube') return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirect}&response_type=code&access_type=offline&prompt=consent&scope=${scope}&state=${state}`
  if (platform === 'linkedin') return `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${clientId}&redirect_uri=${redirect}&scope=${scope}&state=${state}`
  if (platform === 'tiktok') return `https://www.tiktok.com/v2/auth/authorize/?client_key=${clientId}&response_type=code&scope=${scope}&redirect_uri=${redirect}&state=${state}`
  return `https://www.facebook.com/v20.0/dialog/oauth?client_id=${clientId}&redirect_uri=${redirect}&response_type=code&scope=${scope}&state=${state}`
}
