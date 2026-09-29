import { Body, Controller, Get, Post, Req, Res, UnauthorizedException } from '@nestjs/common'
import type { LoginInput, SignupInput } from '@zpf/shared'
import { clearSessionCookie, readCookie, sessionCookie } from '../../auth/http-session'
import { LocalStore } from '../../store/local.store'

@Controller('auth')
export class AuthController {
  constructor(private readonly store: LocalStore) {}

  @Post('signup')
  async signup(
    @Body() input: SignupInput,
    @Res({ passthrough: true }) response: { setHeader: (name: string, value: string | string[]) => void },
  ) {
    const result = await this.store.signup(input)
    response.setHeader('Set-Cookie', [
      clearSessionCookie,
      sessionCookie(result.token),
    ])
    return { user: result.user }
  }

  @Post('login')
  async login(
    @Body() input: LoginInput,
    @Res({ passthrough: true }) response: { setHeader: (name: string, value: string | string[]) => void },
  ) {
    const result = await this.store.login(input)
    response.setHeader('Set-Cookie', [
      clearSessionCookie,
      sessionCookie(result.token),
    ])
    return { user: result.user }
  }

  @Post('logout')
  async logout(
    @Req() request: { headers?: { cookie?: string } },
    @Res({ passthrough: true }) response: { setHeader: (name: string, value: string) => void },
  ) {
    await this.store.logout(readCookie(request, 'zpf_session'))
    response.setHeader('Set-Cookie', clearSessionCookie)
    return { ok: true }
  }

  @Get('me')
  me(@Req() request: { headers?: { cookie?: string } }) {
    const user = this.store.getUserFromToken(readCookie(request, 'zpf_session'))
    if (!user) throw new UnauthorizedException('No active session')
    return { user }
  }
}
