import { Injectable, OnModuleInit, UnauthorizedException } from '@nestjs/common'
import type {
  Account,
  AccountConnectionResult,
  AnalyticsQuery,
  AnalyticsSnapshot,
  AuthResponse,
  CreatePostInput,
  LocalState,
  LoginInput,
  MetricKey,
  Platform,
  Post,
  PostStatus,
  ProviderCredentialPublic,
  ReportTemplate,
  SaveProviderCredentialInput,
  SignupInput,
  User,
} from '@zpf/shared'
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { createSeedState, hashPassword, verifyPassword } from './seed'

const platformColors: Record<Platform, string> = {
  instagram: '#e85d92',
  facebook: '#1877f2',
  linkedin: '#2563eb',
  x: '#111827',
  youtube: '#ef4444',
  tiktok: '#111827',
  threads: '#4b5563',
  reddit: '#ff4500',
}

const requiredScopes: Record<Platform, string[]> = {
  instagram: ['instagram_basic', 'instagram_content_publish'],
  facebook: ['pages_read_engagement', 'pages_manage_posts'],
  linkedin: ['w_organization_social', 'r_organization_social'],
  x: ['tweet.read', 'tweet.write', 'users.read', 'offline.access'],
  youtube: ['https://www.googleapis.com/auth/youtube.readonly', 'https://www.googleapis.com/auth/youtube.upload', 'https://www.googleapis.com/auth/yt-analytics.readonly'],
  tiktok: ['user.info.basic', 'video.publish'],
  threads: ['threads_basic', 'threads_content_publish', 'threads_manage_insights'],
  reddit: ['identity', 'read', 'submit'],
}

const serverCredentialEnv: Record<Platform, { clientId: string[]; clientSecret: string[] }> = {
  instagram: { clientId: ['INSTAGRAM_CLIENT_ID', 'META_APP_ID'], clientSecret: ['INSTAGRAM_CLIENT_SECRET', 'META_APP_SECRET'] },
  facebook: { clientId: ['FACEBOOK_CLIENT_ID', 'META_APP_ID'], clientSecret: ['FACEBOOK_CLIENT_SECRET', 'META_APP_SECRET'] },
  linkedin: { clientId: ['LINKEDIN_CLIENT_ID'], clientSecret: ['LINKEDIN_CLIENT_SECRET'] },
  x: { clientId: ['X_CLIENT_ID'], clientSecret: ['X_CLIENT_SECRET'] },
  youtube: { clientId: ['YOUTUBE_CLIENT_ID', 'GOOGLE_CLIENT_ID'], clientSecret: ['YOUTUBE_CLIENT_SECRET', 'GOOGLE_CLIENT_SECRET'] },
  tiktok: { clientId: ['TIKTOK_CLIENT_ID', 'TIKTOK_CLIENT_KEY'], clientSecret: ['TIKTOK_CLIENT_SECRET'] },
  threads: { clientId: ['THREADS_CLIENT_ID', 'META_APP_ID'], clientSecret: ['THREADS_CLIENT_SECRET', 'META_APP_SECRET'] },
  reddit: { clientId: ['REDDIT_CLIENT_ID'], clientSecret: ['REDDIT_CLIENT_SECRET'] },
}

const demoAccountIds = new Set(['acc-instagram', 'acc-youtube', 'acc-tiktok', 'acc-linkedin', 'acc-threads', 'acc-facebook', 'acc-x', 'acc-reddit'])
const demoPostIds = new Set(['post-launch-clip', 'post-launch-lessons', 'post-quote-carousel', 'post-published-short', 'post-failed'])
const demoReportIds = new Set(['weekly-exec'])
const DEMO_EMAIL = 'demo@0point5show.com'

export type YouTubeDashboardAnalytics = {
  views: number
  watchMinutes: number
  subscribersGained: number
  series: Array<{ date: string; views: number; watchMinutes: number; subscribersGained: number }>
}

export type YouTubeLatestContent = {
  title: string
  publishedAt?: string
  views: number
  engagementRate: number
  clicks: number
}

@Injectable()
export class LocalStore implements OnModuleInit {
  private readonly filePath = resolve(process.cwd(), 'data', 'local-state.json')
  private state: LocalState = createSeedState()

  async onModuleInit() {
  await mkdir(dirname(this.filePath), { recursive: true })

  try {
    this.state = this.migrate(
      JSON.parse(await readFile(this.filePath, 'utf8')) as Partial<LocalState>
    )
  } catch {
    this.state = createSeedState()
  }

  await this.seedDemoWorkspace()
  await this.persist()
}

  async signup(input: SignupInput): Promise<AuthResponse & { token: string }> {
    const email = input.email.trim().toLowerCase()
    if (this.state.users.some((user) => user.email === email)) {
      throw new UnauthorizedException('An account already exists for this email')
    }
    if (!input.name?.trim()) throw new UnauthorizedException('Name is required')
    if (!email.includes('@')) throw new UnauthorizedException('A valid email is required')
    if (input.password.length < 8) throw new UnauthorizedException('Password must be at least 8 characters')
    const password = hashPassword(input.password)
    const user = {
      id: randomUUID(),
      email,
      name: input.name.trim(),
      createdAt: new Date().toISOString(),
      passwordHash: password.hash,
      passwordSalt: password.salt,
    }
    this.state.users.push(user)
    const token = this.createSession(user.id)
    await this.persist()
    return { user: this.publicUser(user), token }
  }

  async login(input: LoginInput): Promise<AuthResponse & { token: string }> {
    const user = this.state.users.find((item) => item.email === input.email.trim().toLowerCase())
    if (!user || !verifyPassword(input.password, user.passwordSalt, user.passwordHash)) {
      throw new UnauthorizedException('Invalid email or password')
    }
      const token = this.createSession(user.id)
      await this.persist()
      return { user: this.publicUser(user), token }
  }

  async logout(token?: string) {
    if (!token) return
    const tokenHash = this.hashToken(token)
    this.state.sessions = this.state.sessions.filter((session) => session.tokenHash !== tokenHash)
    await this.persist()
  }

getUserFromToken(token?: string): User {
  const tokenHash = token ? this.hashToken(token) : undefined

  const session = this.state.sessions.find(
    item =>
      item.tokenHash === tokenHash &&
      new Date(item.expiresAt) > new Date(),
  )

  const user = session
    ? this.state.users.find(item => item.id === session.userId)
    : undefined

  if (!user) throw new UnauthorizedException('Login required')
  return this.publicUser(user)
}

  getAccounts(userId: string) {
    return structuredClone(this.state.accounts.filter((account) => account.userId === userId))
  }

  async syncYouTubeAccounts(userId: string) {
    const accounts = this.state.accounts.filter((account) => account.userId === userId && account.platform === 'youtube' && account.status === 'active')
    for (const account of accounts) {
      const tokenRecord = this.state.encryptedTokens.find((token) => token.userId === userId && token.accountId === account.id)
      if (!tokenRecord) continue
      let accessToken = this.decrypt(tokenRecord.encryptedAccessToken)

      if (tokenRecord.expiresAt && new Date(tokenRecord.expiresAt) <= new Date(Date.now() + 60_000) && tokenRecord.encryptedRefreshToken) {
        const refreshed = await this.refreshYouTubeAccessToken(userId, this.decrypt(tokenRecord.encryptedRefreshToken))
        if (refreshed) {
          accessToken = refreshed.accessToken
          tokenRecord.encryptedAccessToken = this.encrypt(refreshed.accessToken)
          tokenRecord.expiresAt = refreshed.expiresAt
          account.tokenExpiresAt = refreshed.expiresAt
        }
      }

      const response = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!response.ok) {
        account.connectionHealth = { status: 'needs_reauth', message: `YouTube sync failed (${response.status}). Reconnect this channel.`, missingScopes: [] }
        account.status = 'token_expired'
        continue
      }

      const body = await response.json() as {
        items?: Array<{
          id: string
          snippet?: { title?: string; customUrl?: string }
          statistics?: { subscriberCount?: string; viewCount?: string }
        }>
      }
      const channel = body.items?.find((item) => account.id === `acc-youtube-${item.id}`) ?? body.items?.[0]
      if (!channel) continue

      account.displayName = channel.snippet?.title ?? account.displayName
      account.username = channel.snippet?.customUrl ?? account.username
      account.audience = Number.parseInt(channel.statistics?.subscriberCount ?? '0', 10) || 0
      account.reach = Number.parseInt(channel.statistics?.viewCount ?? '0', 10) || 0
      account.lastSyncAt = new Date().toISOString()
      account.status = 'active'
      account.connectionHealth = { status: 'ok', message: 'Synced live YouTube channel statistics.', missingScopes: [] }
    }
    await this.persist()
    return this.getAccounts(userId)
  }

  isDemoWorkspace(userId: string): boolean {
    const user = this.state.users.find((item) => item.id === userId)
    return user?.email === DEMO_EMAIL
  }

  async getYouTubeAnalytics(userId: string, from: string, to: string): Promise<YouTubeDashboardAnalytics> {
    const blank = { views: 0, watchMinutes: 0, subscribersGained: 0, series: buildDateSeries(from, to).map((date) => ({ date, views: 0, watchMinutes: 0, subscribersGained: 0 })) }
    const account = this.state.accounts.find((item) => item.userId === userId && item.platform === 'youtube' && item.status === 'active')
    if (!account) return blank

    const tokenRecord = this.state.encryptedTokens.find((token) => token.userId === userId && token.accountId === account.id)
    if (!tokenRecord) return blank
    let accessToken = this.decrypt(tokenRecord.encryptedAccessToken)

    if (tokenRecord.expiresAt && new Date(tokenRecord.expiresAt) <= new Date(Date.now() + 60_000) && tokenRecord.encryptedRefreshToken) {
      const refreshed = await this.refreshYouTubeAccessToken(userId, this.decrypt(tokenRecord.encryptedRefreshToken))
      if (refreshed) {
        accessToken = refreshed.accessToken
        tokenRecord.encryptedAccessToken = this.encrypt(refreshed.accessToken)
        tokenRecord.expiresAt = refreshed.expiresAt
        account.tokenExpiresAt = refreshed.expiresAt
      }
    }

    const params = new URLSearchParams({
      ids: 'channel==MINE',
      startDate: from,
      endDate: to,
      metrics: 'views,estimatedMinutesWatched,subscribersGained',
      dimensions: 'day',
      sort: 'day',
    })
    const response = await fetch(`https://youtubeanalytics.googleapis.com/v2/reports?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!response.ok) {
      account.connectionHealth = { status: 'needs_reauth', message: `YouTube Analytics sync failed (${response.status}). Reconnect or grant Analytics scope.`, missingScopes: [] }
      await this.persist()
      return blank
    }

    const body = await response.json() as { rows?: Array<[string, number, number, number]> }
    const byDate = new Map((body.rows ?? []).map(([date, views, watchMinutes, subscribersGained]) => [date, { views, watchMinutes, subscribersGained }]))
    const series = buildDateSeries(from, to).map((date) => ({
      date,
      views: byDate.get(date)?.views ?? 0,
      watchMinutes: byDate.get(date)?.watchMinutes ?? 0,
      subscribersGained: byDate.get(date)?.subscribersGained ?? 0,
    }))
    const totals = series.reduce((sum, point) => {
      const row = byDate.get(point.date)
      return {
        views: sum.views + (row?.views ?? 0),
        watchMinutes: sum.watchMinutes + (row?.watchMinutes ?? 0),
        subscribersGained: sum.subscribersGained + (row?.subscribersGained ?? 0),
      }
    }, { views: 0, watchMinutes: 0, subscribersGained: 0 })

    account.connectionHealth = { status: 'ok', message: 'Synced live YouTube channel and Analytics data.', missingScopes: [] }
    await this.persist()
    return { ...totals, series }
  }

  async getLatestYouTubeContent(userId: string): Promise<YouTubeLatestContent | undefined> {
    const account = this.state.accounts.find((item) => item.userId === userId && item.platform === 'youtube' && item.status === 'active')
    if (!account) return undefined
    const tokenRecord = this.state.encryptedTokens.find((token) => token.userId === userId && token.accountId === account.id)
    if (!tokenRecord) return undefined
    let accessToken = this.decrypt(tokenRecord.encryptedAccessToken)

    if (tokenRecord.expiresAt && new Date(tokenRecord.expiresAt) <= new Date(Date.now() + 60_000) && tokenRecord.encryptedRefreshToken) {
      const refreshed = await this.refreshYouTubeAccessToken(userId, this.decrypt(tokenRecord.encryptedRefreshToken))
      if (refreshed) {
        accessToken = refreshed.accessToken
        tokenRecord.encryptedAccessToken = this.encrypt(refreshed.accessToken)
        tokenRecord.expiresAt = refreshed.expiresAt
        account.tokenExpiresAt = refreshed.expiresAt
      }
    }

    const channelResponse = await fetch('https://www.googleapis.com/youtube/v3/channels?part=contentDetails&mine=true', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!channelResponse.ok) return undefined
    const channels = await channelResponse.json() as { items?: Array<{ contentDetails?: { relatedPlaylists?: { uploads?: string } } }> }
    const uploadsPlaylist = channels.items?.[0]?.contentDetails?.relatedPlaylists?.uploads
    if (!uploadsPlaylist) return undefined

    const playlistResponse = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsPlaylist}&maxResults=1`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!playlistResponse.ok) return undefined
    const playlist = await playlistResponse.json() as { items?: Array<{ snippet?: { title?: string; publishedAt?: string; resourceId?: { videoId?: string } } }> }
    const item = playlist.items?.[0]
    const videoId = item?.snippet?.resourceId?.videoId
    if (!item?.snippet || !videoId) return undefined

    const videoResponse = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${videoId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const video = videoResponse.ok
      ? await videoResponse.json() as { items?: Array<{ statistics?: { viewCount?: string; likeCount?: string; commentCount?: string } }> }
      : undefined
    const statistics = video?.items?.[0]?.statistics
    const views = Number.parseInt(statistics?.viewCount ?? '0', 10) || 0
    const likes = Number.parseInt(statistics?.likeCount ?? '0', 10) || 0
    const comments = Number.parseInt(statistics?.commentCount ?? '0', 10) || 0

    return {
      title: item.snippet.title ?? 'Untitled YouTube video',
      publishedAt: item.snippet.publishedAt,
      views,
      engagementRate: views ? (likes + comments) / views : 0,
      clicks: 0,
    }
  }

  async syncYouTubeRecentPosts(userId: string, maxResults = 10) {
    const account = this.state.accounts.find((item) => item.userId === userId && item.platform === 'youtube' && item.status === 'active')
    if (!account) return []
    const tokenRecord = this.state.encryptedTokens.find((token) => token.userId === userId && token.accountId === account.id)
    if (!tokenRecord) return []
    let accessToken = this.decrypt(tokenRecord.encryptedAccessToken)

    if (tokenRecord.expiresAt && new Date(tokenRecord.expiresAt) <= new Date(Date.now() + 60_000) && tokenRecord.encryptedRefreshToken) {
      const refreshed = await this.refreshYouTubeAccessToken(userId, this.decrypt(tokenRecord.encryptedRefreshToken))
      if (refreshed) {
        accessToken = refreshed.accessToken
        tokenRecord.encryptedAccessToken = this.encrypt(refreshed.accessToken)
        tokenRecord.expiresAt = refreshed.expiresAt
        account.tokenExpiresAt = refreshed.expiresAt
      }
    }

    const channelResponse = await fetch('https://www.googleapis.com/youtube/v3/channels?part=contentDetails&mine=true', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!channelResponse.ok) return []
    const channels = await channelResponse.json() as { items?: Array<{ contentDetails?: { relatedPlaylists?: { uploads?: string } } }> }
    const uploadsPlaylist = channels.items?.[0]?.contentDetails?.relatedPlaylists?.uploads
    if (!uploadsPlaylist) return []

    const playlistParams = new URLSearchParams({
      part: 'snippet',
      playlistId: uploadsPlaylist,
      maxResults: String(Math.min(Math.max(maxResults, 1), 50)),
    })
    const playlistResponse = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?${playlistParams.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!playlistResponse.ok) return []
    const playlist = await playlistResponse.json() as {
      items?: Array<{ snippet?: { title?: string; description?: string; publishedAt?: string; resourceId?: { videoId?: string } } }>
    }
    const uploads = (playlist.items ?? [])
      .map((item) => ({ snippet: item.snippet, videoId: item.snippet?.resourceId?.videoId }))
      .filter((item): item is { snippet: NonNullable<typeof item.snippet>; videoId: string } => Boolean(item.snippet && item.videoId))
    if (!uploads.length) return []

    const statsParams = new URLSearchParams({
      part: 'statistics',
      id: uploads.map((item) => item.videoId).join(','),
    })
    const statsResponse = await fetch(`https://www.googleapis.com/youtube/v3/videos?${statsParams.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const statsBody = statsResponse.ok
      ? await statsResponse.json() as { items?: Array<{ id?: string; statistics?: { viewCount?: string; likeCount?: string; commentCount?: string } }> }
      : { items: [] }
    const statsById = new Map((statsBody.items ?? []).map((item) => [item.id, item.statistics]))
    const now = new Date().toISOString()
    const synced: Post[] = []

    for (const upload of uploads) {
      const statistics = statsById.get(upload.videoId)
      const views = Number.parseInt(statistics?.viewCount ?? '0', 10) || 0
      const likes = Number.parseInt(statistics?.likeCount ?? '0', 10) || 0
      const comments = Number.parseInt(statistics?.commentCount ?? '0', 10) || 0
      const publishedAt = upload.snippet.publishedAt ?? now
      const postId = `post-youtube-${upload.videoId}`
      const post: Post = {
        id: postId,
        userId,
        title: upload.snippet.title ?? 'Untitled YouTube video',
        text: upload.snippet.description ?? '',
        contentType: 'video',
        status: 'published',
        publishedAt,
        tags: ['youtube'],
        createdAt: publishedAt,
        updatedAt: now,
        metrics: {
          reach: views,
          impressions: views,
          views,
          likes,
          comments,
          shares: 0,
          saves: 0,
          clicks: 0,
          engagementRate: views ? (likes + comments) / views : 0,
        },
        targets: [{
          id: `target-youtube-${upload.videoId}`,
          accountId: account.id,
          platform: 'youtube',
          status: 'published',
          retries: 0,
          platformPostId: upload.videoId,
          platformUrl: `https://www.youtube.com/watch?v=${upload.videoId}`,
          publishedAt,
        }],
      }

      const existing = this.state.posts.findIndex((item) => item.userId === userId && item.id === postId)
      if (existing >= 0) this.state.posts[existing] = { ...this.state.posts[existing], ...post, createdAt: this.state.posts[existing].createdAt }
      else this.state.posts.push(post)
      synced.push(structuredClone(post))
    }

    account.lastSyncAt = now
    account.connectionHealth = { status: 'ok', message: `Synced ${synced.length} recent YouTube uploads.`, missingScopes: [] }
    await this.persist()
    return synced
  }

  getProviderCredentials(userId: string): ProviderCredentialPublic[] {
    return (Object.keys(requiredScopes) as Platform[]).map((platform) => this.providerCredentialStatus(userId, platform))
  }

  getProviderCredential(userId: string, platform: Platform): ProviderCredentialPublic {
    return this.providerCredentialStatus(userId, platform)
  }

  async saveProviderCredential(userId: string, input: SaveProviderCredentialInput): Promise<ProviderCredentialPublic> {
    const clientId = input.clientId.trim()
    const clientSecret = input.clientSecret.trim()
    if (!clientId) throw new UnauthorizedException('Client ID is required')
    if (!clientSecret) throw new UnauthorizedException('Client secret is required')

    const existing = this.state.providerCredentials.find((item) => item.userId === userId && item.platform === input.platform)
    const next = {
      id: existing?.id ?? randomUUID(),
      userId,
      platform: input.platform,
      encryptedClientId: this.encrypt(clientId),
      encryptedClientSecret: this.encrypt(clientSecret),
      updatedAt: new Date().toISOString(),
    }

    if (existing) Object.assign(existing, next)
    else this.state.providerCredentials.push(next)

    await this.persist()
    return this.providerCredentialStatus(userId, input.platform)
  }

  async deleteProviderCredential(userId: string, platform: Platform) {
    this.state.providerCredentials = this.state.providerCredentials.filter((item) => !(item.userId === userId && item.platform === platform))
    await this.persist()
    return this.providerCredentialStatus(userId, platform)
  }

  resolveProviderCredential(userId: string, platform: Platform) {
    const workspace = this.state.providerCredentials.find((item) => item.userId === userId && item.platform === platform)
    if (workspace) {
      return {
        clientId: this.decrypt(workspace.encryptedClientId),
        clientSecret: this.decrypt(workspace.encryptedClientSecret),
        source: 'workspace' as const,
      }
    }

    const env = serverCredentialEnv[platform]
    const clientId = firstEnvValue(env.clientId)
    const clientSecret = firstEnvValue(env.clientSecret)
    if (clientId && (platform === 'x' || clientSecret)) return { clientId, clientSecret, source: 'server' as const }
    return { source: 'none' as const }
  }

  async disconnectAccount(userId: string, accountId: string) {
    const account = this.state.accounts.find((item) => item.userId === userId && item.id === accountId)
    if (!account) return undefined

    this.state.accounts = this.state.accounts.filter((item) => !(item.userId === userId && item.id === accountId))
    this.state.encryptedTokens = this.state.encryptedTokens.filter((item) => !(item.userId === userId && item.accountId === accountId))
    this.state.oauthStates = this.state.oauthStates.filter((item) => !(item.userId === userId && item.platform === account.platform))

    for (const post of this.state.posts.filter((item) => item.userId === userId)) {
      post.targets = post.targets.map((target) => target.accountId === accountId
        ? {
            ...target,
            status: 'failed',
            error: 'Account disconnected before this post could be published.',
          }
        : target)
    }

    await this.persist()
    return structuredClone(account)
  }

consumeOauthState(platform: Platform, state: string) {
  const index = this.state.oauthStates.findIndex(
    (item) => item.platform === platform && item.state === state,
  )

  if (index < 0) return undefined

  const record = this.state.oauthStates[index]
  this.state.oauthStates.splice(index, 1)

  return record
}

  getPosts(userId: string, status?: PostStatus) {
    const posts = this.state.posts.filter((post) => post.userId === userId)
    const filtered = status ? posts.filter((post) => post.status === status) : posts
    return structuredClone(filtered.sort((a, b) => {
      const left = a.scheduledAt ?? a.createdAt
      const right = b.scheduledAt ?? b.createdAt
      return left.localeCompare(right)
    }))
  }

  getPost(userId: string, id: string) {
    const post = this.state.posts.find((item) => item.userId === userId && item.id === id)
    return post ? structuredClone(post) : undefined
  }

  async createPost(userId: string, input: CreatePostInput) {
    const now = new Date().toISOString()
    const targetAccounts = this.state.accounts.filter((account) => account.userId === userId && input.targetAccountIds.includes(account.id))
    const status: PostStatus = input.submitForApproval ? 'pending_approval' : input.scheduledAt ? 'scheduled' : 'draft'

    const post: Post = {
      id: randomUUID(),
      userId,
      title: input.title.trim(),
      text: input.text.trim(),
      contentType: input.contentType,
      status,
      scheduledAt: input.scheduledAt,
      campaign: input.campaign?.trim() || undefined,
      tags: input.tags ?? [],
      notes: input.notes?.trim() || undefined,
      sourceEpisodeId: input.sourceEpisodeId,
      utmUrl: `https://0.5show.local/listen?utm_source=command-center&utm_campaign=${encodeURIComponent(input.campaign ?? 'general')}&utm_content=${randomUUID()}`,
      createdAt: now,
      updatedAt: now,
      metrics: { reach: 0, impressions: 0, views: 0, likes: 0, comments: 0, shares: 0, saves: 0, clicks: 0, engagementRate: 0 },
      targets: targetAccounts.map((account) => ({
        id: randomUUID(),
        accountId: account.id,
        platform: account.platform,
        status,
        text: input.platformOverrides?.[account.id],
        retries: 0,
      })),
    }

    this.state.posts.push(post)
    await this.persist()
    return structuredClone(post)
  }

  async updateStatus(userId: string, id: string, status: PostStatus) {
    const post = this.state.posts.find((item) => item.userId === userId && item.id === id)
    if (!post) return undefined
    post.status = status
    post.updatedAt = new Date().toISOString()
    post.targets = post.targets.map((target) => ({ ...target, status }))
    await this.persist()
    return structuredClone(post)
  }

  async publishPost(userId: string, id: string) {
    const post = this.state.posts.find((item) => item.userId === userId && item.id === id)
    if (!post) return undefined

    post.status = 'published'
    post.publishedAt = new Date().toISOString()
    post.updatedAt = post.publishedAt
    post.targets = post.targets.map((target) => {
      const account = this.state.accounts.find((item) => item.id === target.accountId)
      const canPublish = account?.status === 'active' && account.connectionHealth.status === 'ok'
      return {
        ...target,
        status: canPublish ? 'published' : 'failed',
        error: canPublish ? undefined : 'Account is not ready for publishing. Reconnect or grant missing scopes.',
        retries: target.retries,
        platformPostId: canPublish ? `${target.platform}-${randomUUID()}` : undefined,
        platformUrl: canPublish ? `https://${target.platform}.example/${post.id}` : undefined,
        publishedAt: canPublish ? post.publishedAt : undefined,
      }
    })
    if (post.targets.some((target) => target.status === 'failed')) post.status = 'failed'
    await this.persist()
    return structuredClone(post)
  }

  async retry(userId: string, id: string) {
    const post = this.state.posts.find((item) => item.userId === userId && item.id === id)
    if (!post) return undefined

    post.status = post.scheduledAt && new Date(post.scheduledAt) > new Date() ? 'scheduled' : 'publishing'
    post.updatedAt = new Date().toISOString()
    post.targets = post.targets.map((target) => ({
      ...target,
      status: post.status,
      retries: target.retries + 1,
      error: undefined,
    }))
    await this.persist()
    return structuredClone(post)
  }

  async connectMockAccount(userId: string, platform: Platform, username?: string): Promise<AccountConnectionResult> {
    const scopes = requiredScopes[platform]
    const now = new Date().toISOString()
    const account: Account = {
      id: `acc-${platform}-${randomUUID()}`,
      userId,
      platform,
      displayName: platform === 'x' ? 'X' : platform.charAt(0).toUpperCase() + platform.slice(1),
      username: username || (platform === 'reddit' ? 'u/new-0.5show' : `@new-${platform}`),
      status: 'active',
      color: platformColors[platform],
      lastSyncAt: now,
      reach: 0,
      audience: 0,
      growthPercent: 0,
      scopes,
      tokenExpiresAt: new Date(Date.now() + 60 * 24 * 3_600_000).toISOString(),
      connectionHealth: { status: 'ok', message: 'Mock OAuth token validated successfully.', missingScopes: [] },
    }
    this.state.accounts.push(account)
    this.state.encryptedTokens.push({
      id: randomUUID(),
      userId,
      accountId: account.id,
      encryptedAccessToken: this.encrypt(`mock-access-${platform}-${randomUUID()}`),
      encryptedRefreshToken: this.encrypt(`mock-refresh-${platform}-${randomUUID()}`),
      scopes,
      expiresAt: account.tokenExpiresAt,
    })
    await this.persist()
    return {
      account: structuredClone(account),
      backfillJob: { id: randomUUID(), status: 'queued', queuedAt: now },
    }
  }

  async connectOauthAccount(input: {
    userId: string
    platform: Platform
    externalId: string
    displayName: string
    username: string
    accessToken: string
    refreshToken?: string
    scopes: string[]
    expiresAt?: string
    audience?: number
    reach?: number
  }): Promise<AccountConnectionResult> {
    const expected = requiredScopes[input.platform]
    const missingScopes = expected.filter((scope) => !input.scopes.includes(scope))
    const now = new Date().toISOString()
    const account: Account = {
      id: `acc-${input.platform}-${input.externalId}`,
      userId: input.userId,
      platform: input.platform,
      displayName: input.displayName,
      username: input.username,
      status: missingScopes.length ? 'error' : 'active',
      color: platformColors[input.platform],
      lastSyncAt: now,
      reach: input.reach ?? 0,
      audience: input.audience ?? 0,
      growthPercent: 0,
      scopes: input.scopes,
      tokenExpiresAt: input.expiresAt,
      connectionHealth: missingScopes.length
        ? { status: 'missing_scope', message: `Missing required scopes: ${missingScopes.join(', ')}`, missingScopes }
        : { status: 'ok', message: 'OAuth token validated with the platform identity endpoint.', missingScopes: [] },
    }
    const existing = this.state.accounts.findIndex((item) => item.userId === input.userId && item.id === account.id)
    if (existing >= 0) this.state.accounts[existing] = account
    else this.state.accounts.push(account)
    this.state.encryptedTokens = this.state.encryptedTokens.filter((item) => item.accountId !== account.id)
    this.state.encryptedTokens.push({
      id: randomUUID(),
      userId: input.userId,
      accountId: account.id,
      encryptedAccessToken: this.encrypt(input.accessToken),
      encryptedRefreshToken: input.refreshToken ? this.encrypt(input.refreshToken) : undefined,
      scopes: input.scopes,
      expiresAt: input.expiresAt,
    })
    await this.persist()
    return { account: structuredClone(account), backfillJob: { id: randomUUID(), status: 'queued', queuedAt: now } }
  }

  async storeOauthState(userId: string, platform: Platform, state: string, scopes: string[], codeVerifier?: string) {
    this.state.oauthStates.push({ id: randomUUID(), userId, platform, state, scopes, codeVerifier, createdAt: new Date().toISOString() })
    await this.persist()
  }

  getRequiredScopes(platform: Platform) {
    return requiredScopes[platform]
  }

  getAnalytics(userId: string, query: AnalyticsQuery): AnalyticsSnapshot {
    const metric: MetricKey = query.metric ?? 'reach'
    const accounts = this.getAccounts(userId)
    const posts = this.getPosts(userId).filter((post) => {
      if (query.format && post.contentType !== query.format) return false
      if (query.campaign && post.campaign !== query.campaign) return false
      if (query.accountIds?.length && !post.targets.some((target) => query.accountIds?.includes(target.accountId))) return false
      const comparableDate = post.publishedAt ?? post.scheduledAt ?? post.createdAt
      if (query.from && comparableDate < `${query.from}T00:00:00.000Z`) return false
      if (query.to && comparableDate > `${query.to}T23:59:59.999Z`) return false
      return true
    })
    const values = posts.map((post) => post.metrics[metric] ?? 0)
    const median = values.length ? [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] : 0
    const mean = values.reduce((sum, value) => sum + value, 0) / (values.length || 1)
    const stddev = Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length || 1))

    const ranked = posts
      .map((post) => {
        const value = post.metrics[metric] ?? 0
        const baseline = median || 1
        return {
          postId: post.id,
          title: post.title,
          value,
          denominator: query.denominator,
          platformCodes: post.targets.map((target) => target.platform),
          status: post.status,
          viral: value > median + 2 * stddev,
          benchmark: `${(value / baseline).toFixed(1)}x ${post.contentType} baseline`,
        }
      })
      .sort((a, b) => b.value - a.value)

    return {
      query: { ...query, metric },
      accountSummary: accounts
        .filter((account) => !query.accountIds?.length || query.accountIds.includes(account.id))
        .map((account) => ({
          accountId: account.id,
          platform: account.platform,
          displayName: account.displayName,
          username: account.username,
          status: account.status,
          reach: account.reach,
          audience: account.audience,
          lastSyncAt: account.lastSyncAt,
          healthMessage: account.connectionHealth.message,
        })),
      ranked,
      worst: [...ranked].reverse().slice(0, 5).map((item) => ({ postId: item.postId, title: item.title, value: item.value, denominator: item.denominator })),
      heatmap: this.buildHeatmap(posts),
      trends: this.buildTrends(posts),
      attribution: posts.filter((post) => post.sourceEpisodeId && post.utmUrl).map((post) => ({
        clipId: post.id,
        episodeId: post.sourceEpisodeId as string,
        attributedPlays: post.metrics.clicks * 3,
        utmUrl: post.utmUrl as string,
      })),
    }
  }

  getReports(userId: string) {
    return structuredClone(this.state.reports.filter((report) => report.accountIds.every((accountId) => this.state.accounts.some((account) => account.userId === userId && account.id === accountId))))
  }

  async saveReport(userId: string, report: Omit<ReportTemplate, 'id'>) {
    const next = { ...report, id: randomUUID() }
    this.state.reports.push(next)
    await this.persist()
    return structuredClone(next)
  }

  async deleteReport(userId: string, reportId: string) {
    const report = this.getReports(userId).find((item) => item.id === reportId)
    if (!report) return undefined
    this.state.reports = this.state.reports.filter((item) => item.id !== reportId)
    await this.persist()
    return structuredClone(report)
  }

  getReport(userId: string, reportId: string) {
    return this.getReports(userId).find((report) => report.id === reportId)
  }

  exportReportCsv(userId: string, reportId: string) {
    const report = this.state.reports.find((item) => item.id === reportId)
    const selectedAccountIds = new Set(report?.accountIds ?? [])
    const accounts = this.getAccounts(userId).filter((account) => !selectedAccountIds.size || selectedAccountIds.has(account.id))
    const posts = this.getPosts(userId).filter((post) => !selectedAccountIds.size || post.targets.some((target) => selectedAccountIds.has(target.accountId)))
    const metrics = report?.metricSet ?? ['reach', 'views', 'engagementRate']
    const rows = [
      ['section', 'name', 'status', 'platform_or_campaign', 'username_or_targets', 'audience', 'last_sync_at', ...metrics],
      ...accounts.map((account) => [
        'account',
        account.displayName,
        account.status,
        account.platform,
        account.username,
        String(account.audience),
        account.lastSyncAt,
        ...metrics.map((metric) => {
          if (metric === 'reach' || metric === 'views' || metric === 'impressions') return String(account.reach)
          if (metric === 'engagementRate') return ''
          return '0'
        }),
      ]),
      ...posts.map((post) => [
        'post',
        post.title,
        post.status,
        post.campaign ?? '',
        post.targets.map((target) => target.platform).join('|'),
        '',
        post.publishedAt ?? post.scheduledAt ?? post.createdAt,
        ...metrics.map((metric) => String(post.metrics[metric] ?? 0)),
      ]),
    ]
    if (rows.length === 1) rows.push(['empty', 'No connected accounts or posts for this report yet', '', '', '', '', '', ...metrics.map(() => '')])
    return rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n')
  }

  private createSession(userId: string) {
    const token = randomBytes(32).toString('hex')
    this.state.sessions.push({ tokenHash: this.hashToken(token), userId, expiresAt: new Date(Date.now() + 7 * 24 * 3_600_000).toISOString() })
    return token
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex')
  }

  private publicUser(user: LocalState['users'][number]): User {
    return { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt }
  }

  private migrate(state: Partial<LocalState>): LocalState {
    const seed = createSeedState()
    const mockAccountIds = new Set((state.encryptedTokens ?? [])
      .filter((token) => safeDecryptForMigration(token.encryptedAccessToken).startsWith('mock-access-'))
      .map((token) => token.accountId))
    const existingAccounts = (state.accounts ?? []).filter((account) => !demoAccountIds.has(account.id) && !mockAccountIds.has(account.id))
    const existingPosts = (state.posts ?? []).filter((post) => !demoPostIds.has(post.id) && !post.targets.some((target) => demoAccountIds.has(target.accountId) || mockAccountIds.has(target.accountId)))
    const existingReports = (state.reports ?? []).filter((report) => !demoReportIds.has(report.id) && !report.accountIds.some((accountId) => demoAccountIds.has(accountId)))
    return {
      users: state.users?.length ? state.users : seed.users,
      sessions: (state.sessions ?? []).map((session) => ({
        userId: session.userId,
        expiresAt: session.expiresAt,
        tokenHash: session.tokenHash ?? this.hashToken((session as unknown as { token?: string }).token ?? randomUUID()),
      })),
      accounts: existingAccounts.map((account) => ({
        ...account,
        userId: account.userId ?? seed.users[0].id,
        scopes: account.scopes ?? requiredScopes[account.platform],
        connectionHealth: account.connectionHealth ?? { status: 'ok', message: 'Migrated development account.', missingScopes: [] },
      })),
      posts: existingPosts.map((post) => ({
        ...post,
        userId: post.userId ?? seed.users[0].id,
        metrics: post.metrics ?? { reach: 0, impressions: 0, views: 0, likes: 0, comments: 0, shares: 0, saves: 0, clicks: 0, engagementRate: 0 },
      })),
      encryptedTokens: (state.encryptedTokens ?? []).filter((token) => !demoAccountIds.has(token.accountId) && !mockAccountIds.has(token.accountId)),
      providerCredentials: state.providerCredentials ?? [],
      oauthStates: state.oauthStates ?? [],
      reports: existingReports,
    }
  }

private async seedDemoWorkspace() {
  const demoEmail = DEMO_EMAIL

  const existing = this.state.users.find(
    (user) => user.email === demoEmail
  )

  if (existing) {
    return
  }

  const password = hashPassword('Demo@123')

  this.state.users.push({
    id: 'demo-user',
    email: demoEmail,
    name: 'Demo Workspace',
    createdAt: new Date().toISOString(),
    passwordHash: password.hash,
    passwordSalt: password.salt,
  })
}

  private async refreshYouTubeAccessToken(userId: string, refreshToken: string) {
    const credentials = this.resolveProviderCredential(userId, 'youtube')
    if (!credentials.clientId || !credentials.clientSecret) return undefined
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
      }),
    })
    if (!response.ok) return undefined
    const token = await response.json() as { access_token: string; expires_in?: number }
    return {
      accessToken: token.access_token,
      expiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1000).toISOString() : undefined,
    }
  }

  private providerCredentialStatus(userId: string, platform: Platform): ProviderCredentialPublic {
    const workspace = this.state.providerCredentials.find((item) => item.userId === userId && item.platform === platform)
    const redirectUri = `${process.env.API_URL ?? 'http://localhost:4000'}/api/accounts/oauth/${platform}/callback`

    if (workspace) {
      const clientId = this.decrypt(workspace.encryptedClientId)
      return {
        platform,
        configured: true,
        configuredBy: 'workspace',
        clientIdPreview: previewSecret(clientId),
        updatedAt: workspace.updatedAt,
        redirectUri,
      }
    }

    const env = serverCredentialEnv[platform]
    const clientId = firstEnvValue(env.clientId)
    const clientSecret = firstEnvValue(env.clientSecret)
    const configured = Boolean(clientId && (platform === 'x' || clientSecret))
    return {
      platform,
      configured,
      configuredBy: configured ? 'server' : 'none',
      clientIdPreview: clientId ? previewSecret(clientId) : undefined,
      redirectUri,
    }
  }

  private buildHeatmap(posts: Post[]) {
    const cells = Array.from({ length: 7 * 24 }, (_, index) => ({ day: Math.floor(index / 24), hour: index % 24, score: 0 }))
    for (const post of posts) {
      const date = new Date(post.publishedAt ?? post.scheduledAt ?? post.createdAt)
      const cell = cells.find((item) => item.day === date.getDay() && item.hour === date.getHours())
      if (cell) cell.score += Math.round(post.metrics.engagementRate * 1000)
    }
    return cells
  }

  private buildTrends(posts: Post[]) {
    const tagCounts = new Map<string, number>()
    for (const post of posts) for (const tag of post.tags) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + post.metrics.reach)
    return [...tagCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([label, score], index) => ({ label, lift: Number((1.2 + index * 0.18).toFixed(2)), evidence: `${score.toLocaleString()} weighted reach from tagged content` }))
  }

  private encrypt(value: string) {
    const key = createHash('sha256').update(process.env.ENCRYPTION_KEY ?? 'local-development-key').digest()
    const iv = randomBytes(16)
    const cipher = createCipheriv('aes-256-gcm', key, iv)
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
    return `${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${encrypted.toString('hex')}`
  }

  decrypt(value: string) {
    const key = createHash('sha256').update(process.env.ENCRYPTION_KEY ?? 'local-development-key').digest()
    const [ivHex, tagHex, encryptedHex] = value.split(':')
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'))
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'))
    return Buffer.concat([decipher.update(Buffer.from(encryptedHex, 'hex')), decipher.final()]).toString('utf8')
  }

  private async persist() {
    await writeFile(this.filePath, JSON.stringify(this.state, null, 2), 'utf8')
  }
}

function previewSecret(value: string) {
  if (value.length <= 8) return '****'
  return `${value.slice(0, 4)}...${value.slice(-4)}`
}

function firstEnvValue(names: string[]) {
  return names.map((name) => process.env[name]).find(Boolean)
}

function buildDateSeries(from: string, to: string) {
  const start = new Date(`${from}T00:00:00.000Z`)
  const end = new Date(`${to}T00:00:00.000Z`)
  const days = Math.max(1, Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1)
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(start.getTime() + index * 86_400_000)
    return date.toISOString().slice(0, 10)
  })
}

function safeDecryptForMigration(value: string) {
  try {
    const key = createHash('sha256').update(process.env.ENCRYPTION_KEY ?? 'local-development-key').digest()
    const [ivHex, tagHex, encryptedHex] = value.split(':')
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'))
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'))
    return Buffer.concat([decipher.update(Buffer.from(encryptedHex, 'hex')), decipher.final()]).toString('utf8')
  } catch {
    return ''
  }
}
