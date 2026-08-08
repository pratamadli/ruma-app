import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { createHash } from 'node:crypto';
import { AppModule } from '../app.module';
import { AllExceptionsFilter } from '../common/filters/all-exceptions.filter';
import { requestIdMiddleware } from '../common/middleware/request-id.middleware';
import { PrismaService } from '../prisma/prisma.service';
import { loadApiEnv, resetApiEnvCache } from '../config/env';

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.runIf(hasDatabase)('Password reset', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const email = 'pwd-reset-owner@example.com';

  async function cleanup() {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return;
    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
    await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }

  beforeAll(async () => {
    resetApiEnvCache();
    process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-at-least-32-chars!!';
    process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-at-least-32-chars!';
    process.env.APP_URL ??= 'http://localhost:3000';
    loadApiEnv();

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('v1');
    app.use(requestIdMiddleware);
    app.use(cookieParser());
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
    prisma = app.get(PrismaService);
    await cleanup();
  });

  afterAll(async () => {
    if (prisma) await cleanup();
    if (app) await app.close();
  });

  it('supports forgot → reset → login and rejects bad tokens', async () => {
    await request(app.getHttpServer())
      .post('/v1/auth/sign-up')
      .send({ email, password: 'password123', name: 'Reset Owner' })
      .expect(201);

    const unknown = await request(app.getHttpServer())
      .post('/v1/auth/forgot-password')
      .send({ email: 'nobody-exists@example.com' })
      .expect(200);
    expect(unknown.body).toEqual({ ok: true });

    const forgot = await request(app.getHttpServer())
      .post('/v1/auth/forgot-password')
      .send({ email })
      .expect(200);
    expect(forgot.body).toEqual({ ok: true });
    expect(forgot.headers['x-request-id']).toBeTruthy();

    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    const stored = await prisma.passwordResetToken.findFirstOrThrow({
      where: { userId: user.id, usedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    // Reconstruct raw token is impossible from hash — create a known token for the remaining cases.
    const knownRaw = 'test-reset-token-value-abcdefghijklmnopqrstuvwxyz';
    const knownHash = createHash('sha256').update(knownRaw).digest('hex');
    await prisma.passwordResetToken.update({
      where: { id: stored.id },
      data: { tokenHash: knownHash },
    });

    await request(app.getHttpServer())
      .post('/v1/auth/reset-password')
      .send({ token: 'totally-invalid-token-value', password: 'newpassword99' })
      .expect(400);

    const expiredId = stored.id;
    await prisma.passwordResetToken.update({
      where: { id: expiredId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await request(app.getHttpServer())
      .post('/v1/auth/reset-password')
      .send({ token: knownRaw, password: 'newpassword99' })
      .expect(400);

    await prisma.passwordResetToken.update({
      where: { id: expiredId },
      data: { expiresAt: new Date(Date.now() + 60_000), usedAt: null },
    });

    await request(app.getHttpServer())
      .post('/v1/auth/reset-password')
      .send({ token: knownRaw, password: 'newpassword99' })
      .expect(200);

    await request(app.getHttpServer())
      .post('/v1/auth/reset-password')
      .send({ token: knownRaw, password: 'anotherpassword1' })
      .expect(400);

    await request(app.getHttpServer())
      .post('/v1/auth/sign-in')
      .send({ email, password: 'password123' })
      .expect(401);

    const signedIn = await request(app.getHttpServer())
      .post('/v1/auth/sign-in')
      .send({ email, password: 'newpassword99' })
      .expect(200);
    expect(signedIn.body.accessToken).toBeTruthy();

    const activeRefresh = await prisma.refreshToken.count({
      where: { userId: user.id, revokedAt: null },
    });
    // Only the session from the successful sign-in above should remain active.
    expect(activeRefresh).toBe(1);
  });
});
