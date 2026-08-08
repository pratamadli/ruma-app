import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import type {
  ForgotPasswordInput,
  ResetPasswordInput,
  SignInInput,
  SignUpInput,
} from '@ruma/validation';
import type { AuthTokensResponse, UserResponse } from '@ruma/types';
import { PrismaService } from '../prisma/prisma.service';
import { createId } from '../common/ids';
import { TokenService } from './token.service';
import { EmailService } from '../email/email.service';
import { loadApiEnv } from '../config/env';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly env = loadApiEnv();

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly email: EmailService,
  ) {}

  async signUp(input: SignUpInput): Promise<AuthTokensResponse & { refreshToken: string }> {
    const existing = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw new ConflictException({
        code: 'EMAIL_TAKEN',
        message: 'An account with this email already exists.',
      });
    }

    const user = await this.prisma.user.create({
      data: {
        id: createId(),
        email: input.email,
        name: input.name ?? null,
        passwordHash: await argon2.hash(input.password, { type: argon2.argon2id }),
      },
    });

    return this.issueSession(user.id, user.email, user.name, user.createdAt);
  }

  async signIn(input: SignInInput): Promise<AuthTokensResponse & { refreshToken: string }> {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (!user) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password.',
      });
    }

    const valid = await argon2.verify(user.passwordHash, input.password);
    if (!valid) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password.',
      });
    }

    return this.issueSession(user.id, user.email, user.name, user.createdAt);
  }

  async refresh(rawRefreshToken: string): Promise<AuthTokensResponse & { refreshToken: string }> {
    const tokenHash = this.tokens.hashToken(rawRefreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!stored || stored.revokedAt || stored.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException({
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Refresh token is invalid or expired.',
      });
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return this.issueSession(
      stored.user.id,
      stored.user.email,
      stored.user.name,
      stored.user.createdAt,
    );
  }

  async signOut(rawRefreshToken?: string): Promise<void> {
    if (!rawRefreshToken) return;
    const tokenHash = this.tokens.hashToken(rawRefreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async me(userId: string): Promise<UserResponse> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return this.toUserResponse(user.id, user.email, user.name, user.createdAt);
  }

  /**
   * Always returns the same success shape to avoid email enumeration.
   */
  async forgotPassword(input: ForgotPasswordInput): Promise<{ ok: true }> {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (!user) {
      return { ok: true };
    }

    await this.prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    const raw = this.tokens.createRefreshToken();
    const expiresAt = new Date(Date.now() + this.env.PASSWORD_RESET_TTL_SECONDS * 1000);

    await this.prisma.passwordResetToken.create({
      data: {
        id: createId(),
        userId: user.id,
        tokenHash: raw.hash,
        expiresAt,
      },
    });

    const resetUrl = `${this.env.APP_URL}/reset-password/${raw.raw}`;
    try {
      await this.email.sendPasswordReset({ to: user.email, resetUrl });
    } catch (error) {
      this.logger.error(
        'Password reset email failed',
        error instanceof Error ? error.stack : error,
      );
      // Still return ok — do not reveal account existence via delivery failures.
    }

    return { ok: true };
  }

  async resetPassword(input: ResetPasswordInput): Promise<{ ok: true }> {
    const tokenHash = this.tokens.hashToken(input.token);
    const stored = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });

    if (!stored || stored.usedAt || stored.expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException({
        code: 'INVALID_RESET_TOKEN',
        message: 'This reset link is invalid or has expired.',
      });
    }

    const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: stored.userId },
        data: { passwordHash },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: stored.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.passwordResetToken.updateMany({
        where: { userId: stored.userId, usedAt: null },
        data: { usedAt: new Date() },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    return { ok: true };
  }

  private async issueSession(
    userId: string,
    email: string,
    name: string | null,
    createdAt: Date,
  ): Promise<AuthTokensResponse & { refreshToken: string }> {
    const accessToken = await this.tokens.signAccessToken({ id: userId, email });
    const refresh = this.tokens.createRefreshToken();

    await this.prisma.refreshToken.create({
      data: {
        id: createId(),
        userId,
        tokenHash: refresh.hash,
        expiresAt: this.tokens.refreshExpiresAt(),
      },
    });

    return {
      accessToken,
      refreshToken: refresh.raw,
      user: this.toUserResponse(userId, email, name, createdAt),
    };
  }

  private toUserResponse(
    id: string,
    email: string,
    name: string | null,
    createdAt: Date,
  ): UserResponse {
    return {
      id,
      email,
      name,
      createdAt: createdAt.toISOString(),
    };
  }
}
