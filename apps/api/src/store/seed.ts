import type {
  Account,
  LocalState,
  Platform,
  Post,
  ReportTemplate,
} from '@zpf/shared'
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

export function hashPassword(password: string, salt = randomBytes(16).toString('hex')) {
  return {
    salt,
    hash: scryptSync(password, salt, 64).toString('hex'),
  }
}

export function verifyPassword(password: string, salt: string, hash: string) {
  const current = scryptSync(password, salt, 64)
  const expected = Buffer.from(hash, 'hex')
  return current.length === expected.length && timingSafeEqual(current, expected)
}

const demoPassword = hashPassword('Demo@123')

const demoUser = {
  id: 'demo-user',
  email: 'demo@0point5show.com',
  name: 'Demo Workspace',
  createdAt: new Date().toISOString(),
  passwordHash: demoPassword.hash,
  passwordSalt: demoPassword.salt,
}

const demoPlatforms: Array<{

  platform: Platform
  displayName: string
  username: string
  color: string
  scopes: string[]
}> = [
  {
    platform: 'instagram',
    displayName: '0.5 Show',
    username: '@0point5show',
    color: '#E4405F',
    scopes: ['instagram_basic'],
  },
  {
    platform: 'facebook',
    displayName: '0.5 Show',
    username: '0.5 Show',
    color: '#1877F2',
    scopes: ['pages_show_list'],
  },
  {
    platform: 'linkedin',
    displayName: '0.5 Show',
    username: '0.5 Show',
    color: '#0A66C2',
    scopes: ['r_liteprofile'],
  },
  {
    platform: 'x',
    displayName: '0.5 Show',
    username: '@0point5show',
    color: '#000000',
    scopes: ['tweet.read'],
  },
  {
    platform: 'youtube',
    displayName: '0.5 Show',
    username: '@0point5show',
    color: '#FF0000',
    scopes: ['youtube.readonly'],
  },
  {
    platform: 'tiktok',
    displayName: '0.5 Show',
    username: '@0point5show',
    color: '#000000',
    scopes: ['user.info.basic'],
  },
  {
    platform: 'threads',
    displayName: '0.5 Show',
    username: '@0point5show',
    color: '#000000',
    scopes: ['threads_basic'],
  },
  {
    platform: 'reddit',
    displayName: '0.5 Show',
    username: 'u/0point5show',
    color: '#FF4500',
    scopes: ['identity'],
  },
]

const demoAccounts: Account[] = demoPlatforms.map((p) => ({
  id: `acc-${p.platform}`,
  userId: demoUser.id,
  platform: p.platform,
  displayName: p.displayName,
  username: p.username,
  status: 'active',
  color: p.color,
  lastSyncAt: new Date().toISOString(),
  reach: 0,
  audience: 0,
  growthPercent: 0,
  scopes: p.scopes,
  tokenExpiresAt: new Date(
    Date.now() + 30 * 24 * 60 * 60 * 1000,
  ).toISOString(),
  connectionHealth: {
    status: 'ok',
    message: 'Demo account',
    missingScopes: [],
  },
}))

export function createSeedState(): LocalState {
  return {
    users: [demoUser],
    sessions: [],
    encryptedTokens: [],
    providerCredentials: [],
    oauthStates: [],
    reports: [],
    accounts: demoAccounts,
    posts: [],
  }
}
