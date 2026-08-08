import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { AllExceptionsFilter } from '../common/filters/all-exceptions.filter';
import { resetApiEnvCache } from '../config/env';

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.runIf(hasDatabase)('Household collaboration Phase 1', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const suffix = Date.now();

  beforeAll(async () => {
    resetApiEnvCache();
    process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-at-least-32-characters!!';
    process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-at-least-32-characters!';
    process.env.CORS_ORIGINS ??= 'http://localhost:3000';
    process.env.APP_URL ??= 'http://localhost:3000';

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
    const users = await prisma.user.findMany({
      where: { email: { contains: `collab-${suffix}` } },
      select: { id: true },
    });
    const userIds = users.map((u) => u.id);
    const memberships = await prisma.familyMembership.findMany({
      where: { userId: { in: userIds } },
      select: { familyId: true },
    });
    const familyIds = [...new Set(memberships.map((m) => m.familyId))];

    if (familyIds.length > 0) {
      await prisma.notification.deleteMany({ where: { familyId: { in: familyIds } } });
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
    await app.close();
  });

  it('supports tasks, grocery, calendar, notifications with family isolation', async () => {
    const server = app.getHttpServer();

    const a = await request(server)
      .post('/v1/auth/sign-up')
      .send({
        email: `a-collab-${suffix}@example.com`,
        password: 'password123',
        name: 'Adli',
      })
      .expect(201);
    const b = await request(server)
      .post('/v1/auth/sign-up')
      .send({
        email: `b-collab-${suffix}@example.com`,
        password: 'password123',
        name: 'Wife',
      })
      .expect(201);
    const stranger = await request(server)
      .post('/v1/auth/sign-up')
      .send({
        email: `s-collab-${suffix}@example.com`,
        password: 'password123',
        name: 'Stranger',
      })
      .expect(201);

    const tokenA = a.body.accessToken as string;
    const tokenB = b.body.accessToken as string;
    const tokenS = stranger.body.accessToken as string;
    const userBId = b.body.user.id as string;

    const family = await request(server)
      .post('/v1/families')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Pratama', householdName: 'Pratama Household', timezone: 'Asia/Jakarta' })
      .expect(201);
    const familyId = family.body.id as string;

    const invite = await request(server)
      .post(`/v1/families/${familyId}/invitations`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ email: `b-collab-${suffix}@example.com`, role: 'MEMBER' })
      .expect(201);
    const inviteUrl = invite.body.inviteUrl as string;
    const token = inviteUrl.split('/').pop()!;

    await request(server)
      .post(`/v1/invitations/${token}/accept`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(201);

    const task = await request(server)
      .post(`/v1/families/${familyId}/tasks`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        title: 'Pay electricity bill',
        assignedToId: userBId,
        dueDate: new Date().toISOString().slice(0, 10),
      })
      .expect(201);
    expect(task.body.assignedTo.id).toBe(userBId);

    const notificationsB = await request(server)
      .get('/v1/notifications')
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);
    expect(notificationsB.body.unreadCount).toBeGreaterThan(0);
    expect(
      notificationsB.body.notifications.some((n: { type: string }) => n.type === 'TASK_ASSIGNED'),
    ).toBe(true);

    await request(server)
      .patch(`/v1/families/${familyId}/tasks/${task.body.id}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ status: 'COMPLETED' })
      .expect(200);

    await request(server)
      .post(`/v1/families/${familyId}/grocery/items`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Milk' })
      .expect(201);

    const grocery = await request(server)
      .get(`/v1/families/${familyId}/grocery`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);
    const milk = grocery.body.items.find((item: { name: string }) => item.name === 'Milk');
    expect(milk).toBeTruthy();

    await request(server)
      .patch(`/v1/families/${familyId}/grocery/items/${milk.id}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ isCompleted: true })
      .expect(200);

    const startAt = new Date(Date.now() + 86400000).toISOString();
    await request(server)
      .post(`/v1/families/${familyId}/events`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ title: 'Family dinner', startAt })
      .expect(201);

    const dashboard = await request(server)
      .get(`/v1/families/${familyId}/dashboard`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(dashboard.body.groceryOpenCount).toBeGreaterThanOrEqual(0);
    expect(dashboard.body.upcomingEventsCount).toBeGreaterThanOrEqual(1);

    await request(server)
      .get(`/v1/families/${familyId}/tasks`)
      .set('Authorization', `Bearer ${tokenS}`)
      .expect(404);

    await request(server)
      .get(`/v1/families/${familyId}/grocery`)
      .set('Authorization', `Bearer ${tokenS}`)
      .expect(404);

    await request(server)
      .get(`/v1/families/${familyId}/events`)
      .set('Authorization', `Bearer ${tokenS}`)
      .expect(404);
  });
});
