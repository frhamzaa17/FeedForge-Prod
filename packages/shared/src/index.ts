export const platforms = [
  'instagram',
  'facebook',
  'linkedin',
  'x',
  'youtube',
  'tiktok',
  'threads',
  'reddit',
] as const

export type Platform = (typeof platforms)[number]
export type PostStatus =
  | 'draft'
  | 'pending_approval'
  | 'scheduled'
  | 'publishing'
  | 'published'
  | 'failed'
  | 'archived'

export type Account = {
  id: string
  userId: string
  platform: Platform
  displayName: string
  username: string
  status: 'active' | 'token_expired' | 'disconnected' | 'rate_limited' | 'error'
  color: string
  lastSyncAt: string
  reach: number
  audience: number
  growthPercent: number
  scopes: string[]
  tokenExpiresAt?: string
  connectionHealth: {
    status: 'ok' | 'missing_scope' | 'needs_reauth' | 'not_configured'
    message: string
    missingScopes: string[]
  }
}

export type PostTarget = {
  id: string
  accountId: string
  platform: Platform
  status: PostStatus
  text?: string
  error?: string
  retries: number
  platformPostId?: string
  platformUrl?: string
  publishedAt?: string
}

export type Post = {
  id: string
  userId: string
  title: string
  text: string
  contentType: 'text' | 'image' | 'video' | 'reel' | 'short' | 'story' | 'carousel' | 'thread' | 'clip'
  status: PostStatus
  scheduledAt?: string
  publishedAt?: string
  campaign?: string
  tags: string[]
  notes?: string
  createdAt: string
  updatedAt: string
  targets: PostTarget[]
  sourceEpisodeId?: string
  utmUrl?: string
  metrics: {
    reach: number
    impressions: number
    views: number
    likes: number
    comments: number
    shares: number
    saves: number
    clicks: number
    engagementRate: number
  }
}

export type CreatePostInput = {
  title: string
  text: string
  contentType: Post['contentType']
  targetAccountIds: string[]
  scheduledAt?: string
  submitForApproval?: boolean
  campaign?: string
  tags?: string[]
  notes?: string
  sourceEpisodeId?: string
  platformOverrides?: Record<string, string>
}

export type User = {
  id: string
  email: string
  name: string
  createdAt: string
}

export type AuthSession = {
  tokenHash: string
  userId: string
  expiresAt: string
}

export type SignupInput = {
  email: string
  name: string
  password: string
}

export type LoginInput = {
  email: string
  password: string
}

export type AuthResponse = {
  user: User
}

export type AccountConnectionConfig = {
  platform: Platform
  label: string
  configured: boolean
  configuredBy: 'workspace' | 'server' | 'none'
  scopes: string[]
  authUrl?: string
  redirectUri: string
  notes: string[]
}

export type ProviderCredentialPublic = {
  platform: Platform
  configured: boolean
  configuredBy: 'workspace' | 'server' | 'none'
  clientIdPreview?: string
  updatedAt?: string
  redirectUri: string
}

export type SaveProviderCredentialInput = {
  platform: Platform
  clientId: string
  clientSecret: string
}

export type AccountConnectionResult = {
  account: Account
  backfillJob: {
    id: string
    status: 'queued'
    queuedAt: string
  }
}

export type MetricKey =
  | 'reach'
  | 'impressions'
  | 'views'
  | 'likes'
  | 'comments'
  | 'shares'
  | 'saves'
  | 'clicks'
  | 'engagementRate'

export type DashboardMetric = {
  label: string
  value: number
  unit: 'number' | 'hours'
  delta: number
  detail: string
  series: number[]
}

export type ReachPoint = {
  label: string
  total: number
  instagram: number
  youtube: number
  tiktok: number
}

export type DashboardSnapshot = {
  generatedAt: string
  range: {
    from: string
    to: string
    days: number
  }
  metrics: DashboardMetric[]
  accounts: Account[]
  reachSeries: ReachPoint[]
  topContent: Array<{
    id: string
    title: string
    meta: string
    metric: string
    lift: string
  }>
  latestContent: {
    label: string
    title: string
    platform: Platform | 'none'
    publishedAt?: string
    views: number
    engagementRate: number
    clicks: number
  }
  upcoming: Post[]
}

export type AnalyticsQuery = {
  metric: MetricKey
  denominator: 'reach' | 'impressions' | 'followers'
  accountIds?: string[]
  format?: Post['contentType']
  campaign?: string
  from?: string
  to?: string
}

export type AnalyticsSnapshot = {
  query: AnalyticsQuery
  accountSummary: Array<{
    accountId: string
    platform: Platform
    displayName: string
    username: string
    status: Account['status']
    reach: number
    audience: number
    lastSyncAt: string
    healthMessage: string
  }>
  ranked: Array<{
    postId: string
    title: string
    value: number
    denominator: string
    platformCodes: string[]
    status: PostStatus
    viral: boolean
    benchmark: string
  }>
  worst: Array<{
    postId: string
    title: string
    value: number
    denominator: string
  }>
  heatmap: Array<{
    day: number
    hour: number
    score: number
  }>
  trends: Array<{
    label: string
    lift: number
    evidence: string
  }>
  attribution: Array<{
    clipId: string
    episodeId: string
    attributedPlays: number
    utmUrl: string
  }>
}

export type AiInsightsSnapshot = {
  bestTimes: Array<{
    accountId: string
    label: string
    confidence: number
    reason: string
  }>
  viralScores: Array<{
    postId: string
    title: string
    probability: number
    reason: string
  }>
  recommendations: Array<{
    title: string
    confidence: number
    action: string
  }>
  repurposing: Array<{
    sourceEpisodeId: string
    title: string
    outputs: Array<{ platform: Platform; copy: string }>
  }>
  clipSuggestions: Array<{
    sourceEpisodeId: string
    start: string
    end: string
    reason: string
  }>
  forecast: Array<{
    accountId: string
    nextWeekGrowthPercent: number
    method: string
  }>
}

export type CaptionRequest = {
  topic: string
  platform: Platform
  tone?: string
  sourceText?: string
}

export type CaptionResponse = {
  copy: string
  provider: 'anthropic' | 'gemini' | 'openrouter' | 'local-template'
  requiresHumanApproval: true
}

export type ReportTemplate = {
  id: string
  name: string
  format: 'csv' | 'json'
  metricSet: MetricKey[]
  accountIds: string[]
  whiteLabel: boolean
  schedule?: 'weekly' | 'monthly'
}

export type LocalState = {
  users: Array<User & { passwordHash: string; passwordSalt: string }>
  sessions: AuthSession[]
  accounts: Account[]
  posts: Post[]
  encryptedTokens: Array<{
    id: string
    userId: string
    accountId: string
    encryptedAccessToken: string
    encryptedRefreshToken?: string
    scopes: string[]
    expiresAt?: string
  }>
  providerCredentials: Array<{
    id: string
    userId: string
    platform: Platform
    encryptedClientId: string
    encryptedClientSecret: string
    updatedAt: string
  }>
  oauthStates: Array<{
    id: string
    userId: string
    platform: Platform
    state: string
    codeVerifier?: string
    scopes: string[]
    createdAt: string
  }>
  reports: ReportTemplate[]
}
