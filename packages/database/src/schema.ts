import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  bigint,
  real,
  jsonb,
  pgEnum,
  index,
  uniqueIndex,
  primaryKey,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

// ────────────────────────────────────────────────────────────
// ENUMS
// ────────────────────────────────────────────────────────────
export const platformEnum = pgEnum('platform', [
  'instagram', 'facebook', 'linkedin', 'x', 'youtube', 'tiktok', 'threads', 'reddit', 'spotify', 'apple',
])

export const roleEnum = pgEnum('role', [
  'owner', 'admin', 'editor', 'analyst', 'viewer',
])

export const accountStatusEnum = pgEnum('account_status', [
  'active', 'token_expired', 'disconnected', 'rate_limited', 'error',
])

export const postStatusEnum = pgEnum('post_status', [
  'draft', 'pending_approval', 'scheduled', 'publishing', 'published', 'failed', 'archived',
])

export const contentTypeEnum = pgEnum('content_type', [
  'text', 'image', 'video', 'reel', 'short', 'story', 'carousel', 'thread', 'podcast_episode', 'clip',
])

export const assetTypeEnum = pgEnum('asset_type', [
  'image', 'video', 'audio', 'document', 'thumbnail',
])

export const metricKeyEnum = pgEnum('metric_key', [
  'reach', 'impressions', 'views', 'watch_time_seconds', 'likes', 'comments',
  'shares', 'saves', 'bookmarks', 'clicks', 'followers', 'subscribers',
  'podcast_downloads', 'episode_completion_rate', 'profile_visits', 'website_clicks',
])

// ────────────────────────────────────────────────────────────
// ORGANIZATIONS
// ────────────────────────────────────────────────────────────
export const organizations = pgTable('organizations', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  plan: varchar('plan', { length: 50 }).default('free').notNull(),
  logoUrl: text('logo_url'),
  settings: jsonb('settings').default({}).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// ────────────────────────────────────────────────────────────
// USERS
// ────────────────────────────────────────────────────────────
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  avatarUrl: text('avatar_url'),
  passwordHash: text('password_hash'),  // null for OAuth-only users
  emailVerified: boolean('email_verified').default(false).notNull(),
  lastLoginAt: timestamp('last_login_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const sessions = pgTable('sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  userIdx: index('idx_sessions_user').on(t.userId),
  expiryIdx: index('idx_sessions_expiry').on(t.expiresAt),
}))

// ────────────────────────────────────────────────────────────
// ORG MEMBERS (user <-> org junction with role)
// ────────────────────────────────────────────────────────────
export const orgMembers = pgTable('org_members', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: roleEnum('role').notNull().default('viewer'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  uniqueMember: uniqueIndex('uq_org_member').on(t.orgId, t.userId),
  orgIdx: index('idx_org_members_org').on(t.orgId),
}))

// ────────────────────────────────────────────────────────────
// ACCOUNT GROUPS
// ────────────────────────────────────────────────────────────
export const accountGroups = pgTable('account_groups', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  color: varchar('color', { length: 7 }),   // hex color for UI
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// ────────────────────────────────────────────────────────────
// ACCOUNTS (one per connected social profile)
// ────────────────────────────────────────────────────────────
export const accounts = pgTable('accounts', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  groupId: uuid('group_id').references(() => accountGroups.id, { onDelete: 'set null' }),
  platform: platformEnum('platform').notNull(),
  externalId: varchar('external_id', { length: 255 }).notNull(),  // platform's user/page ID
  displayName: varchar('display_name', { length: 255 }).notNull(),
  username: varchar('username', { length: 255 }),
  avatarUrl: text('avatar_url'),
  status: accountStatusEnum('status').default('active').notNull(),
  scopes: text('scopes').array().default([]).notNull(),  // granted OAuth scopes
  metadata: jsonb('metadata').default({}).notNull(),      // platform-specific data
  lastSyncAt: timestamp('last_sync_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  uniqueAccount: uniqueIndex('uq_account_platform_external').on(t.orgId, t.platform, t.externalId),
  orgIdx: index('idx_accounts_org').on(t.orgId),
  platformIdx: index('idx_accounts_platform').on(t.platform),
}))

// ────────────────────────────────────────────────────────────
// ACCOUNT TOKENS (encrypted OAuth tokens)
// ────────────────────────────────────────────────────────────
export const accountTokens = pgTable('account_tokens', {
  id: uuid('id').defaultRandom().primaryKey(),
  accountId: uuid('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  // Stored AES-256 encrypted — never store plaintext
  encryptedAccessToken: text('encrypted_access_token').notNull(),
  encryptedRefreshToken: text('encrypted_refresh_token'),
  expiresAt: timestamp('expires_at'),
  scopes: text('scopes').array().default([]).notNull(),
  tokenType: varchar('token_type', { length: 50 }).default('Bearer'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  accountIdx: index('idx_account_tokens_account').on(t.accountId),
}))

export const oauthStates = pgTable('oauth_states', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  platform: platformEnum('platform').notNull(),
  stateHash: varchar('state_hash', { length: 64 }).notNull().unique(),
  encryptedCodeVerifier: text('encrypted_code_verifier'),
  scopes: text('scopes').array().default([]).notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  userPlatformIdx: index('idx_oauth_states_user_platform').on(t.userId, t.platform),
}))

// ────────────────────────────────────────────────────────────
// CAMPAIGNS
// ────────────────────────────────────────────────────────────
export const campaigns = pgTable('campaigns', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  tags: text('tags').array().default([]).notNull(),
  color: varchar('color', { length: 7 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// ────────────────────────────────────────────────────────────
// EPISODES (podcast episodes)
// ────────────────────────────────────────────────────────────
export const episodes = pgTable('episodes', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  showId: varchar('show_id', { length: 255 }).notNull(),  // podcast host's show ID
  externalId: varchar('external_id', { length: 255 }),     // podcast host's episode ID
  rssGuid: varchar('rss_guid', { length: 500 }),
  title: varchar('title', { length: 500 }).notNull(),
  description: text('description'),
  audioUrl: text('audio_url'),
  imageUrl: text('image_url'),
  durationSeconds: integer('duration_seconds'),
  publishedAt: timestamp('published_at'),
  season: integer('season'),
  episodeNumber: integer('episode_number'),
  transcriptUrl: text('transcript_url'),
  transcriptText: text('transcript_text'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  orgIdx: index('idx_episodes_org').on(t.orgId),
  rssGuidIdx: index('idx_episodes_rss_guid').on(t.rssGuid),
}))

// ────────────────────────────────────────────────────────────
// CONTENT ASSETS (media files)
// ────────────────────────────────────────────────────────────
export const contentAssets = pgTable('content_assets', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  sourceEpisodeId: uuid('source_episode_id').references(() => episodes.id, { onDelete: 'set null' }),
  type: assetTypeEnum('type').notNull(),
  filename: varchar('filename', { length: 500 }).notNull(),
  storageUrl: text('storage_url').notNull(),       // S3 URL
  thumbnailUrl: text('thumbnail_url'),
  mimeType: varchar('mime_type', { length: 100 }),
  fileSizeBytes: bigint('file_size_bytes', { mode: 'number' }),
  durationSeconds: integer('duration_seconds'),
  width: integer('width'),
  height: integer('height'),
  metadata: jsonb('metadata').default({}).notNull(),
  uploadedBy: uuid('uploaded_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  orgIdx: index('idx_assets_org').on(t.orgId),
  episodeIdx: index('idx_assets_episode').on(t.sourceEpisodeId),
}))

// ────────────────────────────────────────────────────────────
// POSTS
// ────────────────────────────────────────────────────────────
export const posts = pgTable('posts', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  createdBy: uuid('created_by').notNull().references(() => users.id),
  campaignId: uuid('campaign_id').references(() => campaigns.id, { onDelete: 'set null' }),
  status: postStatusEnum('status').default('draft').notNull(),
  contentType: contentTypeEnum('content_type').notNull(),
  // Master content (overridden per-platform in post_targets)
  text: text('text'),
  scheduledAt: timestamp('scheduled_at'),
  publishedAt: timestamp('published_at'),
  tags: text('tags').array().default([]).notNull(),
  notes: text('notes'),       // internal notes, not published
  metadata: jsonb('metadata').default({}).notNull(),
  approvedBy: uuid('approved_by').references(() => users.id),
  approvedAt: timestamp('approved_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  orgStatusScheduled: index('idx_posts_org_status_scheduled').on(t.orgId, t.status, t.scheduledAt),
  orgCampaign: index('idx_posts_campaign').on(t.campaignId),
}))

// ────────────────────────────────────────────────────────────
// POST TARGETS (one per platform a post is sent to)
// ────────────────────────────────────────────────────────────
export const postTargets = pgTable('post_targets', {
  id: uuid('id').defaultRandom().primaryKey(),
  postId: uuid('post_id').notNull().references(() => posts.id, { onDelete: 'cascade' }),
  accountId: uuid('account_id').notNull().references(() => accounts.id),
  status: postStatusEnum('status').default('draft').notNull(),
  // Per-platform content override
  text: text('text'),
  platformPostId: varchar('platform_post_id', { length: 500 }),  // ID returned by platform
  platformUrl: text('platform_url'),
  error: text('error'),
  retries: integer('retries').default(0).notNull(),
  lastAttemptAt: timestamp('last_attempt_at'),
  publishedAt: timestamp('published_at'),
  metadata: jsonb('metadata').default({}).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  postIdx: index('idx_post_targets_post').on(t.postId),
  accountIdx: index('idx_post_targets_account').on(t.accountId),
  statusIdx: index('idx_post_targets_status').on(t.status),
}))

// ────────────────────────────────────────────────────────────
// POST ASSETS (junction: post <-> content assets)
// ────────────────────────────────────────────────────────────
export const postAssets = pgTable('post_assets', {
  postId: uuid('post_id').notNull().references(() => posts.id, { onDelete: 'cascade' }),
  assetId: uuid('asset_id').notNull().references(() => contentAssets.id, { onDelete: 'cascade' }),
  order: integer('order').default(0).notNull(),
}, (t) => ({
  pk: primaryKey({ columns: [t.postId, t.assetId] }),
}))

// ────────────────────────────────────────────────────────────
// METRICS DAILY (the compounding asset — never delete)
// ────────────────────────────────────────────────────────────
export const metricsDaily = pgTable('metrics_daily', {
  id: uuid('id').defaultRandom().primaryKey(),
  accountId: uuid('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  date: varchar('date', { length: 10 }).notNull(),    // "2026-06-08"
  metricKey: metricKeyEnum('metric_key').notNull(),
  value: real('value').notNull(),
  rawPayload: jsonb('raw_payload'),                    // original API response for audit
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  uniqueMetric: uniqueIndex('uq_metric_daily').on(t.accountId, t.date, t.metricKey),
  accountDateIdx: index('idx_metrics_account_date').on(t.accountId, t.date),
}))

// ────────────────────────────────────────────────────────────
// FOLLOWERS DAILY
// ────────────────────────────────────────────────────────────
export const followersDaily = pgTable('followers_daily', {
  id: uuid('id').defaultRandom().primaryKey(),
  accountId: uuid('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  date: varchar('date', { length: 10 }).notNull(),
  followers: integer('followers'),
  subscribers: integer('subscribers'),       // YouTube
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  uniqueFollowers: uniqueIndex('uq_followers_daily').on(t.accountId, t.date),
  accountDateIdx: index('idx_followers_account_date').on(t.accountId, t.date),
}))

// ────────────────────────────────────────────────────────────
// COMMENTS
// ────────────────────────────────────────────────────────────
export const comments = pgTable('comments', {
  id: uuid('id').defaultRandom().primaryKey(),
  accountId: uuid('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  postTargetId: uuid('post_target_id').references(() => postTargets.id, { onDelete: 'set null' }),
  platformCommentId: varchar('platform_comment_id', { length: 500 }).notNull(),
  authorName: varchar('author_name', { length: 255 }),
  authorHandle: varchar('author_handle', { length: 255 }),
  authorAvatarUrl: text('author_avatar_url'),
  text: text('text').notNull(),
  sentiment: varchar('sentiment', { length: 20 }),    // positive/neutral/negative
  isReplied: boolean('is_replied').default(false).notNull(),
  platformCreatedAt: timestamp('platform_created_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  uniqueComment: uniqueIndex('uq_comment_platform').on(t.accountId, t.platformCommentId),
  accountIdx: index('idx_comments_account').on(t.accountId),
}))

// ────────────────────────────────────────────────────────────
// AUDIT LOGS (immutable)
// ────────────────────────────────────────────────────────────
export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  actorId: uuid('actor_id').references(() => users.id),
  action: varchar('action', { length: 100 }).notNull(),
  targetType: varchar('target_type', { length: 100 }),  // 'post', 'account', 'user', etc.
  targetId: varchar('target_id', { length: 255 }),
  metadata: jsonb('metadata').default({}).notNull(),
  ipAddress: varchar('ip_address', { length: 45 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  orgIdx: index('idx_audit_logs_org').on(t.orgId),
  actorIdx: index('idx_audit_logs_actor').on(t.actorId),
}))

export const reportTemplates = pgTable('report_templates', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  createdBy: uuid('created_by').notNull().references(() => users.id),
  name: varchar('name', { length: 255 }).notNull(),
  format: varchar('format', { length: 20 }).default('csv').notNull(),
  metricSet: text('metric_set').array().default([]).notNull(),
  accountIds: uuid('account_ids').array().default([]).notNull(),
  whiteLabel: boolean('white_label').default(false).notNull(),
  schedule: varchar('schedule', { length: 20 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  orgIdx: index('idx_report_templates_org').on(t.orgId),
}))

// ────────────────────────────────────────────────────────────
// RELATIONS
// ────────────────────────────────────────────────────────────
export const organizationsRelations = relations(organizations, ({ many }) => ({
  members: many(orgMembers),
  accounts: many(accounts),
  accountGroups: many(accountGroups),
  posts: many(posts),
  assets: many(contentAssets),
  campaigns: many(campaigns),
  episodes: many(episodes),
  auditLogs: many(auditLogs),
}))

export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(orgMembers),
  posts: many(posts),
  sessions: many(sessions),
}))

export const accountsRelations = relations(accounts, ({ one, many }) => ({
  org: one(organizations, { fields: [accounts.orgId], references: [organizations.id] }),
  group: one(accountGroups, { fields: [accounts.groupId], references: [accountGroups.id] }),
  tokens: many(accountTokens),
  metrics: many(metricsDaily),
  followers: many(followersDaily),
  comments: many(comments),
  postTargets: many(postTargets),
}))

export const postsRelations = relations(posts, ({ one, many }) => ({
  org: one(organizations, { fields: [posts.orgId], references: [organizations.id] }),
  creator: one(users, { fields: [posts.createdBy], references: [users.id] }),
  campaign: one(campaigns, { fields: [posts.campaignId], references: [campaigns.id] }),
  targets: many(postTargets),
  assets: many(postAssets),
}))

export const postTargetsRelations = relations(postTargets, ({ one }) => ({
  post: one(posts, { fields: [postTargets.postId], references: [posts.id] }),
  account: one(accounts, { fields: [postTargets.accountId], references: [accounts.id] }),
}))

export const episodesRelations = relations(episodes, ({ one, many }) => ({
  org: one(organizations, { fields: [episodes.orgId], references: [organizations.id] }),
  assets: many(contentAssets),
}))
