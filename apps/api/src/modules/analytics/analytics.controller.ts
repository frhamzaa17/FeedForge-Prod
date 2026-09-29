import { Controller, Get, Query, Req } from '@nestjs/common'
import type { AnalyticsQuery, MetricKey, Post } from '@zpf/shared'
import { currentUserId } from '../../auth/http-session'
import { LocalStore } from '../../store/local.store'

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly store: LocalStore) {}

  @Get()
  async getAnalytics(
    @Req() request: { headers?: { cookie?: string } },
    @Query('metric') metric: MetricKey = 'reach',
    @Query('denominator') denominator: AnalyticsQuery['denominator'] = 'reach',
    @Query('accountIds') accountIds?: string,
    @Query('format') format?: Post['contentType'],
    @Query('campaign') campaign?: string,
  ) {
    const userId = currentUserId(this.store, request)
    await this.store.syncYouTubeAccounts(userId)
    await this.store.syncYouTubeRecentPosts(userId)
    return this.store.getAnalytics(userId, {
      metric,
      denominator,
      accountIds: accountIds?.split(',').filter(Boolean),
      format,
      campaign,
    })
  }
}
