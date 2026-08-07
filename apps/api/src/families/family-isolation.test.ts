import { afterAll, beforeAll, describe, it } from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../app.module';
import { AllExceptionsFilter } from '../common/filters/all-exceptions.filter';
import { PrismaService } from '../prisma/prisma.service';
import { loadApiEnv, resetApiEnvCache } from '../config/env';

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.runIf(hasDatabase)('Family isolation', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    resetApiEnvCache();
    process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-at-least-32-chars!!';
    process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-at-least-32-chars!';
    loadApiEnv();

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('v1');
    app.use(cookieParser());
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.familyActivity.deleteMany();
      await prisma.familyInvitation.deleteMany();
      await prisma.refreshToken.deleteMany();
      await prisma.familyMembership.deleteMany();
      await prisma.family.deleteMany();
      await prisma.user.deleteMany({
        where: { email: { in: ['owner-a@example.com', 'member-b@example.com'] } },
      });
    }
    if (app) await app.close();
  });

  it('denies cross-family access by ID', async () => {
    const signUpA = await request(app.getHttpServer())
      .post('/v1/auth/sign-up')
      .send({ email: 'owner-a@example.com', password: 'password123', name: 'Owner A' })
      .expect(201);

    const signUpB = await request(app.getHttpServer())
      .post('/v1/auth/sign-up')
      .send({ email: 'member-b@example.com', password: 'password123', name: 'Member B' })
      .expect(201);

    const familyA = await request(app.getHttpServer())
      .post('/v1/families')
      .set('Authorization', `Bearer ${signUpA.body.accessToken}`)
      .send({ name: 'Family A' })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/v1/families/${familyA.body.id}`)
      .set('Authorization', `Bearer ${signUpA.body.accessToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .get(`/v1/families/${familyA.body.id}`)
      .set('Authorization', `Bearer ${signUpB.body.accessToken}`)
      .expect(404);
  });
});
