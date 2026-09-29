import { UnauthorizedException } from '@nestjs/common'
import { LocalStore } from '../store/local.store'

export function readCookie(request: { headers?: { cookie?: string } }, name: string) {
  const cookie = request.headers?.cookie
  if (!cookie) return undefined
  return cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1)
}

export function currentUserId(store: LocalStore, request: { headers?: { cookie?: string } }) {
  const token = readCookie(request, 'zpf_session')
  if (!token) throw new UnauthorizedException('Login required')
  return store.getUserFromToken(token).id
}

function usesSecureCookie() {
  // IP-only deployments use HTTP and must explicitly set COOKIE_SECURE=false.
  // HTTPS remains the safe default for every other production deployment.
  return process.env.COOKIE_SECURE === 'true' ||
    (process.env.COOKIE_SECURE !== 'false' && process.env.NODE_ENV === 'production')
}

export function sessionCookie(token: string) {
  const secure = usesSecureCookie() ? '; Secure' : ''

  return `zpf_session=${token}; HttpOnly${secure}; SameSite=Lax; Path=/; Max-Age=${7 * 24 * 60 * 60}`
}

export const clearSessionCookie =
  usesSecureCookie()
    ? 'zpf_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0'
    : 'zpf_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0'
