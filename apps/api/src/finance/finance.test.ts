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

describe.runIf(hasDatabase)('Household finance Phase 2A', () => {
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
      where: { email: { contains: `finance-${suffix}` } },
      select: { id: true },
    });
    const userIds = users.map((u) => u.id);
    const memberships = await prisma.familyMembership.findMany({
      where: { userId: { in: userIds } },
      select: { familyId: true },
    });
    const familyIds = [...new Set(memberships.map((m) => m.familyId))];

    if (familyIds.length > 0) {
      await prisma.budgetItem.deleteMany({ where: { budget: { familyId: { in: familyIds } } } });
      await prisma.budget.deleteMany({ where: { familyId: { in: familyIds } } });
      await prisma.transaction.deleteMany({ where: { familyId: { in: familyIds } } });
      await prisma.transactionCategory.deleteMany({ where: { familyId: { in: familyIds } } });
      await prisma.financialAccount.deleteMany({ where: { familyId: { in: familyIds } } });
      await prisma.familyActivity.deleteMany({ where: { familyId: { in: familyIds } } });
      await prisma.familyMembership.deleteMany({ where: { familyId: { in: familyIds } } });
      await prisma.family.deleteMany({ where: { id: { in: familyIds } } });
    }

    await prisma.refreshToken.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await app.close();
  });

  it('supports accounts, transfers, summary, and family isolation', async () => {
    const server = app.getHttpServer();
    const today = new Date().toISOString().slice(0, 10);
    const month = today.slice(0, 7);

    const a = await request(server)
      .post('/v1/auth/sign-up')
      .send({
        email: `a-finance-${suffix}@example.com`,
        password: 'password123',
        name: 'Adli',
      })
      .expect(201);
    const stranger = await request(server)
      .post('/v1/auth/sign-up')
      .send({
        email: `s-finance-${suffix}@example.com`,
        password: 'password123',
        name: 'Stranger',
      })
      .expect(201);

    const tokenA = a.body.accessToken as string;
    const tokenS = stranger.body.accessToken as string;

    const family = await request(server)
      .post('/v1/families')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Finance Family', householdName: 'Home' })
      .expect(201);
    const familyId = family.body.id as string;

    await request(server)
      .get(`/v1/families/${familyId}/finance/summary`)
      .set('Authorization', `Bearer ${tokenS}`)
      .expect(404);

    const bca = await request(server)
      .post(`/v1/families/${familyId}/finance/accounts`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        name: 'BCA Savings',
        type: 'BANK',
        initialBalanceMinor: '10000000',
      })
      .expect(201);
    const gopay = await request(server)
      .post(`/v1/families/${familyId}/finance/accounts`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        name: 'GoPay',
        type: 'E_WALLET',
        initialBalanceMinor: '0',
      })
      .expect(201);

    const categories = await request(server)
      .get(`/v1/families/${familyId}/finance/categories`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    const salary = categories.body.categories.find(
      (c: { name: string; kind: string }) => c.name === 'Salary' && c.kind === 'INCOME',
    );
    const food = categories.body.categories.find(
      (c: { name: string; kind: string }) => c.name === 'Food & Dining' && c.kind === 'EXPENSE',
    );
    const transport = categories.body.categories.find(
      (c: { name: string; kind: string }) => c.name === 'Transportation' && c.kind === 'EXPENSE',
    );
    expect(salary).toBeTruthy();
    expect(food).toBeTruthy();
    expect(transport).toBeTruthy();

    await request(server)
      .post(`/v1/families/${familyId}/finance/transactions`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        type: 'INCOME',
        amountMinor: '15000000',
        accountId: bca.body.id,
        categoryId: salary.id,
        description: 'Salary',
        transactionDate: today,
      })
      .expect(201);

    await request(server)
      .post(`/v1/families/${familyId}/finance/transactions`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        type: 'EXPENSE',
        amountMinor: '150000',
        accountId: bca.body.id,
        categoryId: food.id,
        description: 'Dinner',
        transactionDate: today,
      })
      .expect(201);

    await request(server)
      .post(`/v1/families/${familyId}/finance/transactions`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        type: 'TRANSFER',
        amountMinor: '500000',
        accountId: bca.body.id,
        transferAccountId: gopay.body.id,
        description: 'Top up',
        transactionDate: today,
      })
      .expect(201);

    await request(server)
      .post(`/v1/families/${familyId}/finance/transactions`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        type: 'EXPENSE',
        amountMinor: '100000',
        accountId: gopay.body.id,
        categoryId: transport.id,
        description: 'Ride',
        transactionDate: today,
      })
      .expect(201);

    const summary = await request(server)
      .get(`/v1/families/${familyId}/finance/summary`)
      .query({ month })
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    expect(summary.body.incomeMinor).toBe('15000000');
    expect(summary.body.expenseMinor).toBe('250000');
    expect(summary.body.transferMinor).toBe('500000');
    expect(summary.body.netCashFlowMinor).toBe('14750000');

    const bcaBal = summary.body.accounts.find((x: { id: string }) => x.id === bca.body.id);
    const gopayBal = summary.body.accounts.find((x: { id: string }) => x.id === gopay.body.id);
    expect(bcaBal.balanceMinor).toBe('24350000');
    expect(gopayBal.balanceMinor).toBe('400000');

    const activities = await prisma.familyActivity.count({
      where: {
        familyId,
        type: { contains: 'FINANCE' },
      },
    });
    expect(activities).toBe(0);

    const txnList = await request(server)
      .get(`/v1/families/${familyId}/finance/transactions`)
      .query({ type: 'EXPENSE' })
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(txnList.body.transactions).toHaveLength(2);

    const expenseId = txnList.body.transactions[0].id as string;
    await request(server)
      .get(`/v1/families/${familyId}/finance/transactions/${expenseId}`)
      .set('Authorization', `Bearer ${tokenS}`)
      .expect(404);

    await request(server)
      .delete(`/v1/families/${familyId}/finance/transactions/${expenseId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    const soft = await prisma.transaction.findUnique({ where: { id: expenseId } });
    expect(soft?.deletedAt).not.toBeNull();
  });
});
