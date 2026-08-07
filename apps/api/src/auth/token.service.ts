import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import { loadApiEnv } from '../config/env';
import type { AuthenticatedUser } from './auth.types';

@Injectable()
export class TokenService {
  private readonly env = loadApiEnv();

  private accessSecret() {
    return new TextEncoder().encode(this.env.JWT_ACCESS_SECRET);
  }

  async signAccessToken(user: AuthenticatedUser): Promise<string> {
    return new SignJWT({ email: user.email })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(user.id)
      .setIssuedAt()
      .setExpirationTime(`${this.env.ACCESS_TOKEN_TTL_SECONDS}s`)
      .sign(this.accessSecret());
  }

  async verifyAccessToken(token: string): Promise<AuthenticatedUser> {
    const { payload } = await jwtVerify(token, this.accessSecret());
    if (!payload.sub || typeof payload.email !== 'string') {
      throw new Error('Invalid access token payload');
    }
    return { id: payload.sub, email: payload.email };
  }

  createRefreshToken(): { raw: string; hash: string } {
    const raw = randomBytes(32).toString('base64url');
    return { raw, hash: this.hashToken(raw) };
  }

  hashToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  refreshExpiresAt(): Date {
    return new Date(Date.now() + this.env.REFRESH_TOKEN_TTL_SECONDS * 1000);
  }
}
