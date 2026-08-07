import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { AppModule } from '../app.module';
import { AllExceptionsFilter } from '../common/filters/all-exceptions.filter';
import { PrismaService } from '../prisma/prisma.service';
import { loadApiEnv, resetApiEnvCache } from '../config/env';
import { createHash } from 'node:crypto';

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.runIf(hasDatabase)('Family workspace', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const emails = [
    'phase1-owner@example.com',
    'phase1-member@example.com',
    'phase1-wrong@example.com',
  ];

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
    app.use(cookieParser());
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    if (prisma) {
      const users = await prisma.user.findMany({ where: { email: { in: emails } } });
      const userIds = users.map((user) => user.id);
      const memberships = await prisma.familyMembership.findMany({
        where: { userId: { in: userIds } },
      });
      const familyIds = [...new Set(memberships.map((item) => item.familyId))];
      await prisma.familyActivity.deleteMany({ where: { familyId: { in: familyIds } } });
      await prisma.familyInvitation.deleteMany({ where: { familyId: { in: familyIds } } });
      await prisma.familyMembership.deleteMany({ where: { familyId: { in: familyIds } } });
      await prisma.family.deleteMany({ where: { id: { in: familyIds } } });
      await prisma.refreshToken.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    if (app) await app.close();
  });

  it('supports create → invite → accept → activity + isolation', async () => {
    const owner = await request(app.getHttpServer())
      .post('/v1/auth/sign-up')
      .send({ email: emails[0], password: 'password123', name: 'Owner' })
      .expect(201);

    const member = await request(app.getHttpServer())
      .post('/v1/auth/sign-up')
      .send({ email: emails[1], password: 'password123', name: 'Member' })
      .expect(201);

    const stranger = await request(app.getHttpServer())
      .post('/v1/auth/sign-up')
      .send({ email: emails[2], password: 'password123', name: 'Stranger' })
      .expect(201);

    const family = await request(app.getHttpServer())
      .post('/v1/families')
      .set('Authorization', `Bearer ${owner.body.accessToken}`)
      .send({ name: 'Pratama Household', householdName: 'Home', timezone: 'Asia/Jakarta' })
      .expect(201);

    expect(family.body.role).toBe('OWNER');
    expect(family.body.timezone).toBe('Asia/Jakarta');

    const invite = await request(app.getHttpServer())
      .post(`/v1/families/${family.body.id}/invitations`)
      .set('Authorization', `Bearer ${owner.body.accessToken}`)
      .send({ email: emails[1], role: 'MEMBER' })
      .expect(201);

    expect(invite.body.inviteUrl).toContain('/invite/');
    const token = String(invite.body.inviteUrl).split('/invite/')[1];

    await request(app.getHttpServer())
      .post(`/v1/invitations/${token}/accept`)
      .set('Authorization', `Bearer ${stranger.body.accessToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .post(`/v1/invitations/${token}/accept`)
      .set('Authorization', `Bearer ${member.body.accessToken}`)
      .expect(201);

    await request(app.getHttpServer())
      .post(`/v1/invitations/${token}/accept`)
      .set('Authorization', `Bearer ${member.body.accessToken}`)
      .expect(400);

    const members = await request(app.getHttpServer())
      .get(`/v1/families/${family.body.id}/members`)
      .set('Authorization', `Bearer ${owner.body.accessToken}`)
      .expect(200);

    expect(members.body.members).toHaveLength(2);

    const activity = await request(app.getHttpServer())
      .get(`/v1/families/${family.body.id}/activity`)
      .set('Authorization', `Bearer ${member.body.accessToken}`)
      .expect(200);

    expect(
      activity.body.activities.some((item: { type: string }) => item.type === 'FAMILY_CREATED'),
    ).toBe(true);
    expect(
      activity.body.activities.some(
        (item: { type: string }) => item.type === 'INVITATION_ACCEPTED',
      ),
    ).toBe(true);

    await request(app.getHttpServer())
      .get(`/v1/families/${family.body.id}/activity`)
      .set('Authorization', `Bearer ${stranger.body.accessToken}`)
      .expect(404);

    // Expired invitation rejected
    const expiredInvite = await request(app.getHttpServer())
      .post(`/v1/families/${family.body.id}/invitations`)
      .set('Authorization', `Bearer ${owner.body.accessToken}`)
      .send({ email: 'phase1-expired@example.com', role: 'MEMBER' })
      .expect(201);
    const expiredToken = String(expiredInvite.body.inviteUrl).split('/invite/')[1]!;
    await prisma.familyInvitation.update({
      where: { tokenHash: createHash('sha256').update(expiredToken).digest('hex') },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await request(app.getHttpServer()).get(`/v1/invitations/${expiredToken}`).expect(400);

    // Revoked invitation rejected
    const revokeInvite = await request(app.getHttpServer())
      .post(`/v1/families/${family.body.id}/invitations`)
      .set('Authorization', `Bearer ${owner.body.accessToken}`)
      .send({ email: 'phase1-revoked@example.com', role: 'MEMBER' })
      .expect(201);
    await request(app.getHttpServer())
      .delete(`/v1/families/${family.body.id}/invitations/${revokeInvite.body.id}`)
      .set('Authorization', `Bearer ${owner.body.accessToken}`)
      .expect(200);
    const revokedToken = String(revokeInvite.body.inviteUrl).split('/invite/')[1]!;
    await request(app.getHttpServer()).get(`/v1/invitations/${revokedToken}`).expect(400);
  });
});
