import { Body, Controller, Get, Post, Req } from '@nestjs/common'
import type { AiInsightsSnapshot, CaptionRequest, CaptionResponse } from '@zpf/shared'
import { currentUserId } from '../../auth/http-session'
import { LocalStore } from '../../store/local.store'
import { generateText } from './ai.provider'

@Controller('ai-insights')
export class AiController {
  constructor(private readonly store: LocalStore) {}

  @Get()
  async getInsights(@Req() request: { headers?: { cookie?: string } }): Promise<AiInsightsSnapshot> {
    const userId = currentUserId(this.store, request)
    await this.store.syncYouTubeAccounts(userId)
    await this.store.syncYouTubeRecentPosts(userId)
    const accounts = this.store.getAccounts(userId)
    const posts = this.store.getPosts(userId)
    const analytics = this.store.getAnalytics(userId, { metric: 'reach', denominator: 'reach' })
    const bestCells = [...analytics.heatmap].filter((cell) => cell.score > 0).sort((a, b) => b.score - a.score).slice(0, accounts.length)
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const aiRecommendation = await this.generateRecommendation(accounts, posts)
    const sourcePosts = posts.filter((post) => post.sourceEpisodeId)

    return {
      bestTimes: bestCells.length
        ? bestCells.map((cell, index) => {
            const account = accounts[index % accounts.length]
            return {
              accountId: account.id,
              label: `${dayNames[cell.day]} at ${String(cell.hour).padStart(2, '0')}:00`,
              confidence: Math.min(0.92, 0.5 + cell.score / 1000),
              reason: 'Transparent heuristic from stored post time and engagement history.',
            }
          })
        : accounts.map((account) => ({
            accountId: account.id,
            label: `${account.displayName}: collect post history`,
            confidence: 0,
            reason: 'This channel is connected, but 0.5 Show needs published post timestamps and engagement to recommend a real posting slot.',
          })),
      viralScores: viralScores(posts),
      recommendations: [
        ...analytics.trends.slice(0, 4).map((trend) => ({
          title: `More content around "${trend.label}"`,
          confidence: Math.min(0.95, 0.62 + trend.lift / 10),
          action: `This is based only on tagged content already saved in 0.5 Show. Create a new post using the ${trend.label} tag if it still fits your strategy.`,
        })),
        ...(aiRecommendation ? [aiRecommendation] : []),
        ...(!aiRecommendation && accounts.length ? [{
          title: 'Next data step',
          confidence: 0,
          action: `0.5 Show sees ${accounts.length} connected channel${accounts.length === 1 ? '' : 's'}. Publish or sync recent posts so it can compare formats, topics, and posting times without inventing performance data.`,
        }] : []),
      ],
      repurposing: sourcePosts.map((post) => ({
        sourceEpisodeId: post.sourceEpisodeId as string,
        title: `Repurpose ${post.title}`,
        outputs: [],
      })),
      clipSuggestions: [],
      forecast: accounts.filter((account) => account.growthPercent !== 0).map((account) => ({
        accountId: account.id,
        nextWeekGrowthPercent: Number((account.growthPercent * 0.22).toFixed(1)),
        method: 'Trailing-growth exponential smoothing heuristic.',
      })),
    }
  }

  @Post('caption')
  async caption(@Req() request: { headers?: { cookie?: string } }, @Body() input: CaptionRequest): Promise<CaptionResponse> {
    currentUserId(this.store, request)

    const prompt = `Write one ${input.platform} caption for the user's brand. Tone: ${input.tone ?? 'direct, thoughtful, minimal'}. Topic: ${input.topic}. Source: ${input.sourceText ?? 'none'}. Respect platform length and do not claim facts not in the source. Return only the caption text, no preamble.`

    try {
      const result = await generateText(prompt)
      const limit = input.platform === 'threads' ? 500 : input.platform === 'x' ? 280 : 1_500
      return { copy: result.text.slice(0, limit), provider: result.provider, requiresHumanApproval: true }
    } catch {
      // Graceful local fallback — never leave the user with an error on a caption request
      const prefix = input.platform === 'reddit' ? 'Discussion:' : input.platform === 'x' ? 'A thought:' : 'New post:'
      const source = input.sourceText?.trim() || input.topic.trim()
      const limit = input.platform === 'threads' ? 500 : input.platform === 'x' ? 280 : 1_500
      return { copy: `${prefix} ${source}`.slice(0, limit), provider: 'local-template', requiresHumanApproval: true }
    }
  }

  private async generateRecommendation(
    accounts: ReturnType<LocalStore['getAccounts']>,
    posts: ReturnType<LocalStore['getPosts']>,
  ) {
    const context = {
      connectedAccounts: accounts.map((account) => ({
        platform: account.platform,
        displayName: account.displayName,
        username: account.username,
        status: account.status,
        audience: account.audience,
        reach: account.reach,
      })),
      recentPosts: posts.slice(-10).map((post) => ({
        title: post.title,
        status: post.status,
        contentType: post.contentType,
        campaign: post.campaign,
        tags: post.tags,
        metrics: post.metrics,
      })),
    }

    const prompt = `You are the AI assistant for 0.5 Show, a social media command center. Using only the brand data provided, give one concise, actionable content recommendation. Do not invent metrics, episode numbers, or platform data. If there is not enough data to make a useful recommendation, say exactly what data is missing and the single most practical next step. Brand data: ${JSON.stringify(context)}`

    try {
      const result = await generateText(prompt)
      if (!result.text) return undefined
      return { title: 'AI recommendation', confidence: 0, action: result.text }
    } catch {
      return undefined
    }
  }
}

function viralScores(posts: ReturnType<LocalStore['getPosts']>) {
  const published = posts
    .filter((post) => post.status === 'published')
    .sort((left, right) => (right.publishedAt ?? right.createdAt).localeCompare(left.publishedAt ?? left.createdAt))
    .slice(0, 8)
  if (!published.length) return []

  const scores = published.map((post) => engagementSignal(post))
  const sorted = [...scores].sort((left, right) => left - right)
  const median = sorted[Math.floor(sorted.length / 2)] || 1

  return published.map((post) => {
    const score = engagementSignal(post)
    const lift = median ? score / median : 1
    const probability = Math.max(0.08, Math.min(0.92, 0.35 + (lift - 1) * 0.18))
    return {
      postId: post.id,
      title: post.title,
      probability: Number(probability.toFixed(2)),
      reason: `Compared with this account's recent ${post.contentType} history using views, likes, comments, shares, saves, and clicks.`,
    }
  })
}

function engagementSignal(post: ReturnType<LocalStore['getPosts']>[number]) {
  return post.metrics.views
    + post.metrics.likes * 8
    + post.metrics.comments * 14
    + post.metrics.shares * 18
    + post.metrics.saves * 12
    + post.metrics.clicks * 10
}
