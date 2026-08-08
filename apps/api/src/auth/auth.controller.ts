import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import type { Response, Request } from 'express';
import { signInSchema, signUpSchema } from '@ruma/validation';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from './auth.types';
import { loadApiEnv } from '../config/env';

export const REFRESH_COOKIE = 'ruma_refresh';

@Controller('auth')
export class AuthController {
  private readonly env = loadApiEnv();

  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('sign-up')
  async signUp(
    @Body(new ZodValidationPipe(signUpSchema)) body: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.signUp(body as never);
    this.setRefreshCookie(res, result.refreshToken);
    return { accessToken: result.accessToken, user: result.user };
  }

  @Public()
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('sign-in')
  async signIn(
    @Body(new ZodValidationPipe(signInSchema)) body: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.signIn(body as never);
    this.setRefreshCookie(res, result.refreshToken);
    return { accessToken: result.accessToken, user: result.user };
  }

  @Public()
  @HttpCode(200)
  @Post('refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const raw = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    const result = await this.authService.refresh(raw ?? '');
    this.setRefreshCookie(res, result.refreshToken);
    return { accessToken: result.accessToken, user: result.user };
  }

  @Public()
  @HttpCode(200)
  @Post('sign-out')
  async signOut(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const raw = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    await this.authService.signOut(raw);
    res.clearCookie(REFRESH_COOKIE, this.refreshCookieOptions());
    return { ok: true };
  }

  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.me(user.id);
  }

  private setRefreshCookie(res: Response, token: string) {
    res.cookie(REFRESH_COOKIE, token, {
      ...this.refreshCookieOptions(),
      maxAge: this.env.REFRESH_TOKEN_TTL_SECONDS * 1000,
    });
  }

  /**
   * Cross-origin web (Vercel) + API (Railway/Render) needs SameSite=None; Secure
   * so the browser sends the refresh cookie on credentialed fetch.
   */
  private refreshCookieOptions() {
    const crossSite = this.env.NODE_ENV === 'production';
    return {
      httpOnly: true,
      secure: crossSite,
      sameSite: crossSite ? ('none' as const) : ('lax' as const),
      path: '/v1/auth',
    };
  }
}
