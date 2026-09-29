import { BadRequestException, Body, Controller, Delete, Get, NotFoundException, Param, Post, Query, Req, Res, UnauthorizedException } from '@nestjs/common'
import type { Platform, SaveProviderCredentialInput } from '@zpf/shared'
import { randomBytes } from 'node:crypto'
import { currentUserId } from '../../auth/http-session'
import { createConnectionConfig } from './account-oauth'
import { LocalStore } from '../../store/local.store'

@Controller('accounts')
export class AccountsController {
  constructor(private readonly store: LocalStore) {}

  @Get()
  getAccounts(@Req() request: { headers?: { cookie?: string } }) {
    return this.store.getAccounts(currentUserId(this.store, request))
  }

@Get('connect/:platform')
async connect(@Param('platform') platform: Platform, @Req() request: { headers?: { cookie?: string } }) {
    const userId = currentUserId(this.store, request)

    const scopes = this.store.getRequiredScopes(platform)
    const state = randomBytes(24).toString('hex')

    const config = createConnectionConfig(
        platform,
        scopes,
        state,
        this.store.resolveProviderCredential(userId, platform),
    )

    await this.store.storeOauthState(
        userId,
        platform,
        state,
        scopes,
        config.codeVerifier,
    )

    return config
}

  @Get('provider-credentials')
  providerCredentials(@Req() request: { headers?: { cookie?: string } }) {
    return this.store.getProviderCredentials(currentUserId(this.store, request))
  }

@Post('provider-credentials')
saveProviderCredential(
  @Req() request: { headers?: { cookie?: string } },
  @Body() body: SaveProviderCredentialInput,
) {
  return this.store.saveProviderCredential(currentUserId(this.store, request), body)
}

  @Delete('provider-credentials/:platform')
  deleteProviderCredential(@Param('platform') platform: Platform, @Req() request: { headers?: { cookie?: string } }) {
    return this.store.deleteProviderCredential(currentUserId(this.store, request), platform)
  }

  @Post('connect/:platform/mock')
  connectMock(@Param('platform') platform: Platform, @Req() request: { headers?: { cookie?: string } }, @Body() body: { username?: string }) {
    return this.store.connectMockAccount(currentUserId(this.store, request), platform, body.username)
  }

  @Delete(':accountId')
  async disconnect(@Param('accountId') accountId: string, @Req() request: { headers?: { cookie?: string } }) {
    const account = await this.store.disconnectAccount(currentUserId(this.store, request), accountId)
    if (!account) throw new NotFoundException('Connected account not found')
    return { ok: true, account }
  }

  @Get('oauth/:platform/callback')
  async callback(
    @Param('platform') platform: Platform,
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string | undefined,
    @Req() request: { headers?: { cookie?: string } },
    @Res() response: { redirect: (url: string) => void },
  ) {
    if (error) return response.redirect(`${process.env.APP_URL ?? 'http://localhost:3000'}/settings?connection=error&message=${encodeURIComponent(error)}`)
    if (!code || !state) throw new BadRequestException('OAuth callback is missing code or state')
    const oauthState = this.store.consumeOauthState(platform, state)
    if (!oauthState) {
      throw new UnauthorizedException(
        'This connection link expired or was already used. Please try connecting again.',
      )
    }

const userId = oauthState.userId

    try {
      if (platform === 'reddit') await this.finishReddit(userId, code, oauthState.scopes)
      else if (platform === 'x') await this.finishX(userId, code, oauthState.scopes, oauthState.codeVerifier)
      else if (platform === 'youtube') await this.finishYouTube(userId, code, oauthState.scopes)
      else throw new BadRequestException('Live connection for this platform is not finished yet')
      return response.redirect(`${process.env.APP_URL ?? 'http://localhost:3000'}/settings?connection=success&platform=${platform}`)
    } catch (callbackError) {
      const message = callbackError instanceof Error ? callbackError.message : 'OAuth connection failed'
      return response.redirect(`${process.env.APP_URL ?? 'http://localhost:3000'}/settings?connection=error&message=${encodeURIComponent(message)}`)
    }
  }

  private async finishReddit(userId: string, code: string, scopes: string[]) {
    const credentials = this.store.resolveProviderCredential(userId, 'reddit')
    const clientId = credentials.clientId
    const clientSecret = credentials.clientSecret
    if (!clientId || !clientSecret) throw new Error('Reddit credentials are not configured')
    const redirectUri = `${process.env.API_URL ?? 'http://localhost:4000'}/api/accounts/oauth/reddit/callback`
    const tokenResponse = await fetch('https://www.reddit.com/api/v1/access_token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': process.env.REDDIT_USER_AGENT ?? '0.5-show/0.1',
      },
      body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri }),
    })
    if (!tokenResponse.ok) throw new Error(`Reddit token exchange failed (${tokenResponse.status})`)
    const token = await tokenResponse.json() as { access_token: string; refresh_token?: string; expires_in?: number; scope?: string }
    const profileResponse = await fetch('https://oauth.reddit.com/api/v1/me', {
      headers: { Authorization: `Bearer ${token.access_token}`, 'User-Agent': process.env.REDDIT_USER_AGENT ?? '0.5-show/0.1' },
    })
    if (!profileResponse.ok) throw new Error(`Reddit identity validation failed (${profileResponse.status})`)
    const profile = await profileResponse.json() as { id: string; name: string }
    return this.store.connectOauthAccount({
      userId,
      platform: 'reddit',
      externalId: profile.id,
      displayName: 'Reddit',
      username: `u/${profile.name}`,
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      scopes: token.scope?.split(' ') ?? scopes,
      expiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1000).toISOString() : undefined,
    })
  }

  private async finishX(userId: string, code: string, scopes: string[], codeVerifier?: string) {
    const credentials = this.store.resolveProviderCredential(userId, 'x')
    const clientId = credentials.clientId
    if (!clientId || !codeVerifier) throw new Error('X credentials or PKCE verifier are not configured')
    const redirectUri = `${process.env.API_URL ?? 'http://localhost:4000'}/api/accounts/oauth/x/callback`
    const headers: Record<string, string> = { 'Content-Type': 'application/x-www-form-urlencoded' }
    if (credentials.clientSecret) headers.Authorization = `Basic ${Buffer.from(`${clientId}:${credentials.clientSecret}`).toString('base64')}`
    const tokenResponse = await fetch('https://api.x.com/2/oauth2/token', {
      method: 'POST',
      headers,
      body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri, client_id: clientId, code_verifier: codeVerifier }),
    })
    if (!tokenResponse.ok) throw new Error(`X token exchange failed (${tokenResponse.status})`)
    const token = await tokenResponse.json() as { access_token: string; refresh_token?: string; expires_in?: number; scope?: string }
    const profileResponse = await fetch('https://api.x.com/2/users/me', { headers: { Authorization: `Bearer ${token.access_token}` } })
    if (!profileResponse.ok) throw new Error(`X identity validation failed (${profileResponse.status})`)
    const profile = await profileResponse.json() as { data: { id: string; name: string; username: string } }
    return this.store.connectOauthAccount({
      userId,
      platform: 'x',
      externalId: profile.data.id,
      displayName: profile.data.name,
      username: `@${profile.data.username}`,
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      scopes: token.scope?.split(' ') ?? scopes,
      expiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1000).toISOString() : undefined,
    })
  }

  private async finishYouTube(userId: string, code: string, scopes: string[]) {
    const credentials = this.store.resolveProviderCredential(userId, 'youtube')
    const clientId = credentials.clientId
    const clientSecret = credentials.clientSecret
    if (!clientId || !clientSecret) throw new Error('YouTube credentials are not configured')

    const redirectUri = `${process.env.API_URL ?? 'http://localhost:4000'}/api/accounts/oauth/youtube/callback`
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    })
    if (!tokenResponse.ok) throw new Error(`YouTube token exchange failed (${tokenResponse.status}): ${await tokenResponse.text()}`)

    const token = await tokenResponse.json() as {
      access_token: string
      refresh_token?: string
      expires_in?: number
      scope?: string
    }

    const channelResponse = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true', {
      headers: { Authorization: `Bearer ${token.access_token}` },
    })
    if (!channelResponse.ok) throw new Error(`YouTube channel validation failed (${channelResponse.status}): ${await channelResponse.text()}`)

    const channels = await channelResponse.json() as {
      items?: Array<{
        id: string
        snippet?: { title?: string; customUrl?: string }
        statistics?: { subscriberCount?: string; viewCount?: string }
      }>
    }
    const channel = channels.items?.[0]
    if (!channel) throw new Error('No YouTube channel was returned for this Google account')

    return this.store.connectOauthAccount({
      userId,
      platform: 'youtube',
      externalId: channel.id,
      displayName: channel.snippet?.title ?? 'YouTube',
      username: channel.snippet?.customUrl ?? channel.snippet?.title ?? channel.id,
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      scopes: token.scope?.split(' ') ?? scopes,
      expiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1000).toISOString() : undefined,
      audience: Number.parseInt(channel.statistics?.subscriberCount ?? '0', 10) || 0,
      reach: Number.parseInt(channel.statistics?.viewCount ?? '0', 10) || 0,
    })
  }
}
