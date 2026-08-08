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
  const emails = ['owner-a@example.com', 'member-b@example.com'];

  async function cleanupFixtureUsers() {
    const users = await prisma.user.findMany({ where: { email: { in: emails } } });
    const userIds = users.map((user) => user.id);
    if (userIds.length === 0) return;

    const memberships = await prisma.familyMembership.findMany({
      where: { userId: { in: userIds } },
    });
    const familyIds = [...new Set(memberships.map((item) => item.familyId))];

    await prisma.notification.deleteMany({
      where: {
        OR: [{ recipientId: { in: userIds } }, { familyId: { in: familyIds } }],
      },
    });
    if (familyIds.length > 0) {
      await prisma.groceryItem.deleteMany({
        where: { list: { familyId: { in: familyIds } } },
      });
      await prisma.groceryList.deleteMany({ where: { familyId: { in: familyIds } } });
      await prisma.task.deleteMany({ where: { familyId: { in: familyIds } } });
      await prisma.familyEvent.deleteMany({ where: { familyId: { in: familyIds } } });
      await prisma.familyActivity.deleteMany({ where: { familyId: { in: familyIds } } });
      await prisma.familyInvitation.deleteMany({ where: { familyId: { in: familyIds } } });
      await prisma.familyMembership.deleteMany({ where: { familyId: { in: familyIds } } });
      await prisma.family.deleteMany({ where: { id: { in: familyIds } } });
    }
    await prisma.refreshToken.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }

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
    await cleanupFixtureUsers();
  });

  afterAll(async () => {
    if (prisma) await cleanupFixtureUsers();
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
