import type {
  Account,
  AccountConnectionConfig,
  AccountConnectionResult,
  AiInsightsSnapshot,
  CaptionRequest,
  CaptionResponse,
  AnalyticsSnapshot,
  AuthResponse,
  CreatePostInput,
  DashboardSnapshot,
  LoginInput,
  Platform,
  Post,
  PostStatus,
  ProviderCredentialPublic,
  ReportTemplate,
  SaveProviderCredentialInput,
  SignupInput,
} from '@zpf/shared'

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api'

async function request<T>(path: string, init?: RequestInit, timeoutMs = 10_000): Promise<T> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs)
  let response: Response

  try {
    response = await fetch(`${apiUrl}${path}`, {
      ...init,
      credentials: 'include',
      signal: init?.signal ?? controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...init?.headers,
      },
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(`0.5 Show took more than ${Math.round(timeoutMs / 1000)} seconds to respond. Try again in a moment.`)
    }
    throw error
  } finally {
    window.clearTimeout(timeout)
  }

  if (!response.ok) {
    const body = await response.json().catch(() => undefined) as { message?: string | string[] } | undefined
    const message = Array.isArray(body?.message) ? body.message.join(', ') : body?.message
    throw new Error(message ?? `Request failed with status ${response.status}`)
  }

  return response.json() as Promise<T>
}

export const api = {
  me: () => request<AuthResponse>('/auth/me'),
  login: (input: LoginInput) => request<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify(input) }),
  signup: (input: SignupInput) => request<AuthResponse>('/auth/signup', { method: 'POST', body: JSON.stringify(input) }),
  logout: () => request<{ ok: boolean }>('/auth/logout', { method: 'POST' }),
  dashboard: (query = '') => request<DashboardSnapshot>(`/dashboard${query ? `?${query}` : ''}`, undefined, 45_000),
  accounts: () => request<Account[]>('/accounts'),
  connectionConfig: (platform: Platform) => request<AccountConnectionConfig>(`/accounts/connect/${platform}`),
  providerCredentials: () => request<ProviderCredentialPublic[]>('/accounts/provider-credentials'),
  saveProviderCredential: (input: SaveProviderCredentialInput) => request<ProviderCredentialPublic>('/accounts/provider-credentials', {
    method: 'POST',
    body: JSON.stringify(input),
  }),
  deleteProviderCredential: (platform: Platform) => request<ProviderCredentialPublic>(`/accounts/provider-credentials/${platform}`, { method: 'DELETE' }),
  connectMock: (platform: Platform, username?: string) => request<AccountConnectionResult>(`/accounts/connect/${platform}/mock`, {
    method: 'POST',
    body: JSON.stringify({ username }),
  }),
  disconnectAccount: (accountId: string) => request<{ ok: boolean; account: Account }>(`/accounts/${accountId}`, { method: 'DELETE' }),
  posts: () => request<Post[]>('/posts'),
  createPost: (input: CreatePostInput) => request<Post>('/posts', {
    method: 'POST',
    body: JSON.stringify(input),
  }),
  updatePostStatus: (id: string, status: PostStatus) => request<Post>(`/posts/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  }),
  retryPost: (id: string) => request<Post>(`/posts/${id}/retry`, { method: 'POST' }),
  publishPost: (id: string) => request<Post>(`/posts/${id}/publish`, { method: 'POST' }),
  analytics: (query = '') => request<AnalyticsSnapshot>(`/analytics${query ? `?${query}` : ''}`, undefined, 45_000),
  aiInsights: () => request<AiInsightsSnapshot>('/ai-insights', undefined, 60_000),
  generateCaption: (input: CaptionRequest) => request<CaptionResponse>('/ai-insights/caption', { method: 'POST', body: JSON.stringify(input) }, 60_000),
  reports: () => request<ReportTemplate[]>('/reports'),
  saveReport: (report: Omit<ReportTemplate, 'id'>) => request<ReportTemplate>('/reports', { method: 'POST', body: JSON.stringify(report) }),
  deleteReport: (id: string) => request<{ ok: boolean; report: ReportTemplate }>(`/reports/${id}`, { method: 'DELETE' }),
  reportExportUrl: (id: string) => `${apiUrl}/reports/${id}/export.csv`,
}
