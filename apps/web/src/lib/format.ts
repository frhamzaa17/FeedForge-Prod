import type { Platform, PostStatus } from '@zpf/shared'

export function compactNumber(value: number) {
  return new Intl.NumberFormat('en', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

export function relativeTime(value: string) {
  const deltaMinutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60_000))
  if (deltaMinutes < 60) return `${deltaMinutes}m ago`
  const hours = Math.round(deltaMinutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

export function freshnessLabel(value?: string) {
  if (!value) return 'Not updated yet'
  const deltaMinutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60_000))
  if (deltaMinutes < 2) return 'Updated just now'
  return `Updated ${relativeTime(value)}`
}

export function dateTime(value?: string) {
  if (!value) return 'Not scheduled'
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function statusLabel(status: PostStatus) {
  return status.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export function platformLabel(platform: Platform) {
  if (platform === 'x') return 'X'
  return platform.charAt(0).toUpperCase() + platform.slice(1)
}

export function platformCode(platform: Platform) {
  const codes: Record<Platform, string> = {
    instagram: 'IG',
    facebook: 'FB',
    linkedin: 'IN',
    x: 'X',
    youtube: 'YT',
    tiktok: 'TT',
    threads: 'TH',
    reddit: 'RD',
  }
  return codes[platform]
}

export function platformColor(platform: Platform) {
  const colors: Record<Platform, string> = {
    instagram: '#e85d92',
    facebook: '#1877f2',
    linkedin: '#2563eb',
    x: '#111827',
    youtube: '#ef4444',
    tiktok: '#111827',
    threads: '#4b5563',
    reddit: '#ff4500',
  }
  return colors[platform]
}
