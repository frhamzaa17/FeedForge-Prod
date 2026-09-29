import type {
  DashboardSnapshot,
  DashboardMetric,
  Account,
  ReachPoint,
  Post,
} from '@zpf/shared'
import { Controller, Get, Query, Req } from '@nestjs/common'
import { currentUserId } from '../../auth/http-session'
import { LocalStore } from '../../store/local.store'

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly store: LocalStore) {}

  @Get()
  async getDashboard(
    @Req() request: { headers?: { cookie?: string } },
    @Query('days') requestedDays?: string,
    @Query('from') requestedFrom?: string,
    @Query('to') requestedTo?: string,
  ): Promise<DashboardSnapshot> {
    const userId = currentUserId(this.store, request)
    await this.store.syncYouTubeAccounts(userId)
    await this.store.syncYouTubeRecentPosts(userId)
    const isDemoWorkspace = this.store.isDemoWorkspace(userId)
    const to = parseDate(requestedTo) ?? new Date()
    const requestedDayCount = Number.parseInt(requestedDays ?? '28', 10)
    const presetDays = Number.isFinite(requestedDayCount) ? Math.min(365, Math.max(1, requestedDayCount)) : 28
    const from = parseDate(requestedFrom) ?? new Date(to.getTime() - (presetDays - 1) * 86_400_000)
    const rangeDays = Math.min(365, Math.max(1, Math.floor((to.getTime() - from.getTime()) / 86_400_000) + 1))
    const fromIso = isoDate(from)
    const toIso = isoDate(to)
    const previousTo = new Date(from.getTime() - 86_400_000)
    const previousFrom = new Date(previousTo.getTime() - (rangeDays - 1) * 86_400_000)
    const [youtube, previousYoutube, lifetimeYoutube] = await Promise.all([
      this.store.getYouTubeAnalytics(userId, fromIso, toIso),
      this.store.getYouTubeAnalytics(userId, isoDate(previousFrom), isoDate(previousTo)),
      // The Analytics Reports API only returns activity that occurred inside the queried
      // window, not lifetime totals. Watch time has no lifetime figure on the channel
      // resource (unlike views/subscribers), so query "since YouTube existed" once to get
      // a real lifetime number for the headline card instead of a range-scoped 0.
      this.store.getYouTubeAnalytics(userId, '2005-04-23', toIso),
    ])
    const accounts = this.store.getAccounts(userId)
    const hasAnalytics = accounts.some(
  account => account.reach > 0 || account.audience > 0
)
const dashboardAccounts: Account[] =
  !isDemoWorkspace || hasAnalytics
    ? accounts
    : [
        {
          id: 'ig',
          userId,
          platform: 'instagram',
          displayName: '0.5 Show',
          username: '@0point5show',
          status: 'active',
          color: '#E1306C',
          lastSyncAt: new Date().toISOString(),
          reach: 185000,
          audience: 45200,
          growthPercent: 8.4,
          scopes: ['basic', 'insights'],
          connectionHealth: {
            status: 'ok',
            message: 'Connected',
            missingScopes: [],
          },
        },
        {
          id: 'fb',
          userId,
          platform: 'facebook',
          displayName: '0.5 Show',
          username: '0.5 Show',
          status: 'active',
          color: '#1877F2',
          lastSyncAt: new Date().toISOString(),
          reach: 168000,
          audience: 38900,
          growthPercent: 6.8,
          scopes: ['pages_read_engagement'],
          connectionHealth: {
            status: 'ok',
            message: 'Connected',
            missingScopes: [],
          },
        },
        {
          id: 'li',
          userId,
          platform: 'linkedin',
          displayName: '0.5 Show',
          username: '@0point5show',
          status: 'active',
          color: '#0A66C2',
          lastSyncAt: new Date().toISOString(),
          reach: 74000,
          audience: 22100,
          growthPercent: 4.3,
          scopes: ['r_organization_social'],
          connectionHealth: {
            status: 'ok',
            message: 'Connected',
            missingScopes: [],
          },
        },
        {
          id: 'x',
          userId,
          platform: 'x',
          displayName: '0.5 Show',
          username: '@0point5show',
          status: 'active',
          color: '#111111',
          lastSyncAt: new Date().toISOString(),
          reach: 91000,
          audience: 31700,
          growthPercent: 5.9,
          scopes: ['tweet.read'],
          connectionHealth: {
            status: 'ok',
            message: 'Connected',
            missingScopes: [],
          },
        },
        {
          id: 'yt',
          userId,
          platform: 'youtube',
          displayName: '0.5 Show',
          username: '@0point5show',
          status: 'active',
          color: '#FF0000',
          lastSyncAt: new Date().toISOString(),
          reach: 682000,
          audience: 124000,
          growthPercent: 12.7,
          scopes: ['youtube.readonly'],
          connectionHealth: {
            status: 'ok',
            message: 'Connected',
            missingScopes: [],
          },
        },
        {
          id: 'tt',
          userId,
          platform: 'tiktok',
          displayName: '0.5 Show',
          username: '@0point5show',
          status: 'active',
          color: '#000000',
          lastSyncAt: new Date().toISOString(),
          reach: 154000,
          audience: 49800,
          growthPercent: 10.2,
          scopes: ['video.list'],
          connectionHealth: {
            status: 'ok',
            message: 'Connected',
            missingScopes: [],
          },
        },
        {
          id: 'th',
          userId,
          platform: 'threads',
          displayName: '0.5 Show',
          username: '@0point5show',
          status: 'active',
          color: '#111111',
          lastSyncAt: new Date().toISOString(),
          reach: 62000,
          audience: 17300,
          growthPercent: 3.8,
          scopes: ['threads_basic'],
          connectionHealth: {
            status: 'ok',
            message: 'Connected',
            missingScopes: [],
          },
        },
        {
          id: 'rd',
          userId,
          platform: 'reddit',
          displayName: '0.5 Show',
          username: 'u/0point5show',
          status: 'active',
          color: '#FF4500',
          lastSyncAt: new Date().toISOString(),
          reach: 48000,
          audience: 14100,
          growthPercent: 2.6,
          scopes: ['identity'],
          connectionHealth: {
            status: 'ok',
            message: 'Connected',
            missingScopes: [],
          },
        },
      ]    
    const posts = this.store.getPosts(userId)
    const publishedPosts = posts.filter((post) => post.status === 'published' && dateInRange(post.publishedAt ?? post.createdAt, from, to))
    const scheduledPosts = posts.filter((post) => post.status === 'scheduled' && dateInRange(post.scheduledAt ?? post.createdAt, from, to))
    const upcoming = this.store
      .getPosts(userId)
      .filter((post) => ['draft', 'pending_approval', 'scheduled', 'failed'].includes(post.status))
      .slice(0, 5)

    // Only YouTube is implemented today; synced YouTube uploads are tagged 'youtube'.
    const youtubeAccount = accounts.find((account) => account.platform === 'youtube')
    const youtubePosts = posts.filter((post) => post.status === 'published' && post.tags.includes('youtube'))
    // channels.list's aggregate statistics.viewCount can lag well behind individual video
    // view counts (especially for new/low-traffic channels), so Total Reach is derived from
    // the sum of already-synced per-video view counts instead of that unreliable rollup.
    const videoViewsTotal = youtubePosts.reduce((sum, post) => sum + (post.metrics.views ?? 0), 0)
    if (!isDemoWorkspace && youtubeAccount && videoViewsTotal > 0) {
      // Single source of truth: the Account Card must show the same number as the Total
      // Reach KPI, not the separate (and currently stale) channels.list aggregate. Only
      // override when we actually have synced videos to sum; otherwise keep whatever the
      // channel-level stat reports as a last-resort fallback.
      youtubeAccount.reach = videoViewsTotal
    }
    const latestYouTubePost = [...youtubePosts]
      .sort((a, b) => (b.publishedAt ?? b.createdAt).localeCompare(a.publishedAt ?? a.createdAt))[0]

    const dashboardMetrics: DashboardMetric[] = isDemoWorkspace
      ? [
          {
            label: 'Total Reach',
            value: 1900000,
            unit: 'number',
            delta: 18.5,
            detail: 'Total audience reached across all connected channels',
            series: [620000, 645000, 668000, 701000, 730000, 755000, 780000, 812000, 845000, 872000, 901000, 930000],
          },
          {
            label: 'Audience',
            value: 258900,
            unit: 'number',
            delta: 7.8,
            detail: 'Combined followers and subscribers across all channels',
            series: [220000, 223000, 226000, 230000, 234000, 238000, 242000, 246000, 250000, 253000, 256000, 258900],
          },
          {
            label: 'Watch Time',
            value: 42600,
            unit: 'hours',
            delta: 12.5,
            detail: 'Total watch time across all video platforms',
            series: [32000, 33000, 33800, 34700, 35500, 36400, 37200, 38500, 39800, 41000, 41900, 42600],
          },
          {
            label: 'Published Posts',
            value: 324,
            unit: 'number',
            delta: 9.4,
            detail: 'Total posts published across all connected channels',
            series: [
              212,
              221,
              229,
              238,
              246,
              255,
              267,
              278,
              289,
              301,
              313,
              324,
            ],
          },
        ]
      : [
          {
            label: 'Total Reach',
            // Same canonical value as the Account Card above (videoViewsTotal). Falls back
            // to the channel stat / range report only when there are no synced videos yet.
            value: videoViewsTotal || youtubeAccount?.reach || youtube.views,
            unit: 'number',
            delta: percentChange(youtube.views, previousYoutube.views),
            detail: 'Lifetime YouTube views across your channel',
            series: compactSeries(youtube.series.map((point) => point.views)),
          },
          {
            label: 'Audience',
            value: youtubeAccount?.audience ?? 0,
            unit: 'number',
            delta: percentChange(youtube.subscribersGained, previousYoutube.subscribersGained),
            detail: 'Current YouTube subscriber count',
            series: compactSeries(youtube.series.map((point) => point.subscribersGained)),
          },
          {
            label: 'Watch Time',
            // Watch time has no lifetime field on the channel resource, so this uses the
            // wide "since YouTube existed" lifetime query instead of the selected range.
            value: Math.round(lifetimeYoutube.watchMinutes / 60),
            unit: 'hours',
            delta: percentChange(youtube.watchMinutes, previousYoutube.watchMinutes),
            detail: 'Lifetime YouTube watch time',
            series: compactSeries(youtube.series.map((point) => Math.round(point.watchMinutes / 60))),
          },
          {
            label: 'Published Posts',
            value: youtubePosts.length,
            unit: 'number',
            delta: 0,
            detail: 'Number of YouTube videos synced into this workspace',
            series: postCountSeries(youtubePosts, from, to),
          },
        ]

    return {
      generatedAt: new Date().toISOString(),
      range: { from: fromIso, to: toIso, days: rangeDays },
      metrics: dashboardMetrics,
      accounts: dashboardAccounts,
      reachSeries: isDemoWorkspace ? buildReachSeries() : buildLiveReachSeries(youtube.series),
      topContent: isDemoWorkspace
        ? [...publishedPosts].sort((left, right) => right.metrics.views - left.metrics.views).slice(0, 3).map((post) => ({
            id: post.id,
            title: post.title,
            meta: post.targets.map((target) => target.platform).join(', ') || post.contentType,
            metric: `${post.metrics.views.toLocaleString()} views`,
            lift: 'No baseline yet',
          }))
        : [...youtubePosts].sort((left, right) => right.metrics.views - left.metrics.views).slice(0, 3).map((post) => ({
            id: post.id,
            title: post.title,
            meta: post.publishedAt ? new Date(post.publishedAt).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : 'Unpublished',
            metric: `${post.metrics.views.toLocaleString()} views`,
            lift: 'Synced from YouTube',
          })),
      latestContent: isDemoWorkspace
        ? {
            label: 'YouTube Video',
            title: 'How AI is Transforming Content Creation',
            platform: 'youtube',
            publishedAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
            views: 24800,
            engagementRate: 0.082,
            clicks: 1385,
          }
        : buildLatestContent(latestYouTubePost),
      upcoming: scheduledPosts.length ? scheduledPosts.slice(0, 5) : upcoming,
    }
  }
}

function parseDate(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isNaN(date.getTime()) ? undefined : date
}

function isoDate(value: Date) {
  return value.toISOString().slice(0, 10)
}

function buildReachSeries() {
  return [
    { label: 'Jun 1', total: 62000, instagram: 15000, youtube: 18000, tiktok: 12000 },
    { label: 'Jun 3', total: 68000, instagram: 16500, youtube: 19500, tiktok: 13000 },
    { label: 'Jun 5', total: 74000, instagram: 18000, youtube: 21000, tiktok: 14500 },
    { label: 'Jun 7', total: 81000, instagram: 20000, youtube: 22500, tiktok: 16000 },
    { label: 'Jun 9', total: 88000, instagram: 22000, youtube: 24500, tiktok: 17500 },
    { label: 'Jun 11', total: 94000, instagram: 23500, youtube: 26000, tiktok: 19000 },
    { label: 'Jun 13', total: 101000, instagram: 25000, youtube: 28000, tiktok: 20500 },
    { label: 'Jun 15', total: 109000, instagram: 27000, youtube: 30000, tiktok: 22000 },
    { label: 'Jun 17', total: 117000, instagram: 29000, youtube: 32000, tiktok: 24000 },
    { label: 'Jun 19', total: 126000, instagram: 31500, youtube: 34500, tiktok: 25500 },
    { label: 'Jun 21', total: 136000, instagram: 34000, youtube: 37000, tiktok: 27500 },
    { label: 'Jun 23', total: 147000, instagram: 36500, youtube: 39500, tiktok: 29500 },
  ]
}

function buildLiveReachSeries(series: Array<{ date: string; views: number }>): ReachPoint[] {
  return compactDateSeries(series).map((point) => ({
    label: formatSeriesLabel(point.date),
    total: point.views,
    instagram: 0,
    youtube: point.views,
    tiktok: 0,
  }))
}

function formatSeriesLabel(dateValue: string) {
  const date = new Date(`${dateValue}T00:00:00.000Z`)
  return Number.isNaN(date.getTime())
    ? dateValue
    : new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date)
}

function buildLatestContent(post?: Post): DashboardSnapshot['latestContent'] {
  if (!post) {
    return {
      label: 'No content yet',
      title: 'No published content yet',
      platform: 'none',
      publishedAt: undefined,
      views: 0,
      engagementRate: 0,
      clicks: 0,
    }
  }
  return {
    label: 'YouTube Video',
    title: post.title,
    platform: 'youtube',
    publishedAt: post.publishedAt,
    views: post.metrics.views ?? 0,
    engagementRate: post.metrics.engagementRate ?? 0,
    clicks: post.metrics.clicks ?? 0,
  }
}

function compactSeries(values: number[]) {
  return compactDateSeries(values.map((views, index) => ({ date: String(index), views }))).map((point) => point.views)
}

function compactDateSeries<T extends { date: string; views: number }>(series: T[]) {
  if (series.length <= 12) return series
  const bucketSize = Math.ceil(series.length / 12)
  const compacted: Array<{ date: string; views: number }> = []
  for (let index = 0; index < series.length; index += bucketSize) {
    const bucket = series.slice(index, index + bucketSize)
    compacted.push({ date: bucket[0].date, views: bucket.reduce((sum, point) => sum + point.views, 0) })
  }
  return compacted
}

function postCountSeries(posts: Array<{ publishedAt?: string; createdAt: string }>, from: Date, to: Date) {
  const dates = compactDateSeries(Array.from({ length: Math.max(1, Math.floor((to.getTime() - from.getTime()) / 86_400_000) + 1) }, (_, index) => {
    const date = new Date(from.getTime() + index * 86_400_000)
    const key = isoDate(date)
    return { date: key, views: posts.filter((post) => isoDate(new Date(post.publishedAt ?? post.createdAt)) === key).length }
  }))
  return dates.map((date) => date.views)
}

function percentChange(current: number, previous: number) {
  if (!previous) return current ? 100 : 0
  return Number((((current - previous) / previous) * 100).toFixed(1))
}

function dateInRange(value: string, from: Date, to: Date) {
  const date = new Date(value)
  return date >= from && date <= new Date(to.getTime() + 86_399_999)
}
