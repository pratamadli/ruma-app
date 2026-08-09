import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../../app.module';
import { PrismaService } from '../../prisma/prisma.service';
import { AllExceptionsFilter } from '../../common/filters/all-exceptions.filter';
import { resetApiEnvCache } from '../../config/env';

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.runIf(hasDatabase)('Email import Phase 2D', () => {
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
      where: { email: { contains: `import-${suffix}` } },
      select: { id: true },
    });
    const userIds = users.map((u) => u.id);
    const memberships = await prisma.familyMembership.findMany({
      where: { userId: { in: userIds } },
      select: { familyId: true },
    });
    const familyIds = [...new Set(memberships.map((m) => m.familyId))];

    if (familyIds.length > 0) {
      await prisma.importCandidate.deleteMany({ where: { familyId: { in: familyIds } } });
      await prisma.emailConnection.deleteMany({ where: { familyId: { in: familyIds } } });
      await prisma.transaction.deleteMany({ where: { familyId: { in: familyIds } } });
      await prisma.transactionCategory.deleteMany({ where: { familyId: { in: familyIds } } });
      await prisma.financialAccount.deleteMany({ where: { familyId: { in: familyIds } } });
      await prisma.notification.deleteMany({ where: { familyId: { in: familyIds } } });
      await prisma.familyActivity.deleteMany({ where: { familyId: { in: familyIds } } });
      await prisma.familyInvitation.deleteMany({ where: { familyId: { in: familyIds } } });
      await prisma.familyMembership.deleteMany({ where: { familyId: { in: familyIds } } });
      await prisma.family.deleteMany({ where: { id: { in: familyIds } } });
    }

    await prisma.refreshToken.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await app.close();
  });

  it('syncs synthetic emails, dedupes, confirms into ledger, and isolates families', async () => {
    const server = app.getHttpServer();

    const owner = await request(server)
      .post('/v1/auth/sign-up')
      .send({
        email: `owner-import-${suffix}@example.com`,
        password: 'password123',
        name: 'Owner',
      })
      .expect(201);
    const stranger = await request(server)
      .post('/v1/auth/sign-up')
      .send({
        email: `stranger-import-${suffix}@example.com`,
        password: 'password123',
        name: 'Stranger',
      })
      .expect(201);

    const token = owner.body.accessToken as string;
    const tokenS = stranger.body.accessToken as string;

    const family = await request(server)
      .post('/v1/families')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Import Family', householdName: 'Home' })
      .expect(201);
    const familyId = family.body.id as string;

    const account = await request(server)
      .post(`/v1/families/${familyId}/finance/accounts`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'BCA Savings', type: 'BANK', initialBalanceMinor: '10000000' })
      .expect(201);
    const gopay = await request(server)
      .post(`/v1/families/${familyId}/finance/accounts`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'GoPay', type: 'E_WALLET', initialBalanceMinor: '0' })
      .expect(201);

    const categories = await request(server)
      .get(`/v1/families/${familyId}/finance/categories`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const food = (categories.body.categories as Array<{ id: string; name: string }>).find(
      (c) => c.name === 'Food & Dining',
    );
    const transport = (categories.body.categories as Array<{ id: string; name: string }>).find(
      (c) => c.name === 'Transportation',
    );
    expect(food).toBeTruthy();
    expect(transport).toBeTruthy();

    await request(server)
      .get(`/v1/families/${familyId}/integrations/email`)
      .set('Authorization', `Bearer ${tokenS}`)
      .expect(404);

    const connection = await request(server)
      .post(`/v1/families/${familyId}/integrations/email/synthetic`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(201);
    const connectionId = connection.body.id as string;

    const sync1 = await request(server)
      .post(`/v1/families/${familyId}/integrations/email/${connectionId}/sync`)
      .set('Authorization', `Bearer ${token}`)
      .send({ lookbackDays: 30 })
      .expect(201);

    expect(sync1.body.messagesScanned).toBeGreaterThanOrEqual(8);
    expect(sync1.body.candidatesCreated).toBeGreaterThanOrEqual(6);
    expect(sync1.body.parseFailures).toBeGreaterThanOrEqual(1);
    expect(sync1.body.status).toBe('COMPLETED');
    expect(sync1.body.messageFetchFailures).toBe(0);

    const sync2 = await request(server)
      .post(`/v1/families/${familyId}/integrations/email/${connectionId}/sync`)
      .set('Authorization', `Bearer ${token}`)
      .send({ lookbackDays: 30 })
      .expect(201);
    expect(sync2.body.candidatesCreated).toBe(0);
    expect(sync2.body.alreadyProcessed).toBeGreaterThanOrEqual(sync1.body.messagesScanned);

    const list = await request(server)
      .get(`/v1/families/${familyId}/finance/imports`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const pending = (
      list.body.candidates as Array<{
        id: string;
        status: string;
        merchant: string | null;
        amountMinor: string | null;
        transactionType: string | null;
        suggestedAccountId: string | null;
        suggestedCategoryId: string | null;
      }>
    ).filter((c) => c.status === 'PENDING_REVIEW');

    const expense = pending.find((c) => c.merchant === 'Restaurant ABC');
    expect(expense).toBeTruthy();
    expect(expense!.amountMinor).toBe('150000');
    expect(expense!.suggestedAccountId).toBe(account.body.id);

    await request(server)
      .patch(`/v1/families/${familyId}/finance/imports/${expense!.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ categoryId: transport!.id })
      .expect(200);

    const confirmed = await request(server)
      .post(`/v1/families/${familyId}/finance/imports/${expense!.id}/confirm`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(201);

    expect(confirmed.body.transaction.source).toBe('IMPORT');
    expect(confirmed.body.transaction.amountMinor).toBe('150000');
    expect(confirmed.body.transaction.category.name).toBe('Transportation');
    expect(confirmed.body.candidate.status).toBe('CONFIRMED');
    expect(confirmed.body.candidate.confirmedTransactionId).toBe(confirmed.body.transaction.id);

    const transfer = pending.find((c) => c.transactionType === 'TRANSFER');
    expect(transfer).toBeTruthy();
    await request(server)
      .post(`/v1/families/${familyId}/finance/imports/${transfer!.id}/confirm`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(400);

    await request(server)
      .post(`/v1/families/${familyId}/finance/imports/${transfer!.id}/confirm`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        accountId: account.body.id,
        transferAccountId: gopay.body.id,
      })
      .expect(201);

    const summary = await request(server)
      .get(`/v1/families/${familyId}/finance/summary`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(Number(summary.body.expenseMinor)).toBeGreaterThanOrEqual(150000);

    await request(server)
      .get(`/v1/families/${familyId}/finance/imports`)
      .set('Authorization', `Bearer ${tokenS}`)
      .expect(404);

    const member = await request(server)
      .post('/v1/auth/sign-up')
      .send({
        email: `member-import-${suffix}@example.com`,
        password: 'password123',
        name: 'Member',
      })
      .expect(201);
    const invite = await request(server)
      .post(`/v1/families/${familyId}/invitations`)
      .set('Authorization', `Bearer ${token}`)
      .send({ email: `member-import-${suffix}@example.com`, role: 'MEMBER' })
      .expect(201);
    const inviteToken = String(invite.body.inviteUrl).split('/invite/')[1];
    await request(server)
      .post(`/v1/invitations/${inviteToken}/accept`)
      .set('Authorization', `Bearer ${member.body.accessToken}`)
      .expect(201);

    await request(server)
      .post(`/v1/families/${familyId}/integrations/email/synthetic`)
      .set('Authorization', `Bearer ${member.body.accessToken}`)
      .send({})
      .expect(403);

    const pendingAfter = await request(server)
      .get(`/v1/families/${familyId}/finance/imports?status=PENDING_REVIEW`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const ignoreIds = (pendingAfter.body.candidates as Array<{ id: string }>)
      .slice(0, 2)
      .map((c) => c.id);
    if (ignoreIds.length > 0) {
      const bulk = await request(server)
        .post(`/v1/families/${familyId}/finance/imports/bulk-ignore`)
        .set('Authorization', `Bearer ${token}`)
        .send({ candidateIds: ignoreIds })
        .expect(200);
      expect(bulk.body.ignored).toBe(ignoreIds.length);
    }
  });
});
