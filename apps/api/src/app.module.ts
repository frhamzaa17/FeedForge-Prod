import { Module } from '@nestjs/common'
import { AccountsController } from './modules/accounts/accounts.controller'
import { AiController } from './modules/ai/ai.controller'
import { AnalyticsController } from './modules/analytics/analytics.controller'
import { AuthController } from './modules/auth/auth.controller'
import { DashboardController } from './modules/dashboard/dashboard.controller'
import { HealthController } from './modules/health/health.controller'
import { PostsController } from './modules/posts/posts.controller'
import { ReportsController } from './modules/reports/reports.controller'
import { LocalStore } from './store/local.store'

@Module({
  controllers: [HealthController, AuthController, AccountsController, DashboardController, PostsController, AnalyticsController, AiController, ReportsController],
  providers: [LocalStore],
})
export class AppModule {}
