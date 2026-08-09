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
import { detectRecurringPatterns } from './recurring';
import { percentChange } from './percent';

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe('Financial intelligence helpers', () => {
  it('computes MoM percent change and handles previous=0', () => {
    expect(percentChange(3400000n, 3000000n)).toBe(13.3);
    expect(percentChange(6400000n, 7100000n)).toBe(-9.8); // integer-tenths rounding
    expect(percentChange(100n, 0n)).toBeNull();
  });

  it('detects monthly recurring patterns and ignores sparse noise', () => {
    const internet = [5, 6, 7, 8].map((m, i) => ({
      id: `int-${i}`,
      amountMinor: 350000n,
      description: 'Internet',
      categoryId: 'cat-util',
      categoryName: 'Utilities',
      transactionDate: new Date(Date.UTC(2026, m - 1, 1, 12)),
    }));
    const random = [
      {
        id: 'r1',
        amountMinor: 99000n,
        description: 'Random purchase',
        categoryId: 'cat-shop',
        categoryName: 'Shopping',
        transactionDate: new Date(Date.UTC(2026, 4, 10, 12)),
      },
      {
        id: 'r2',
        amountMinor: 120000n,
        description: 'Random purchase',
        categoryId: 'cat-shop',
        categoryName: 'Shopping',
        transactionDate: new Date(Date.UTC(2026, 5, 12, 12)),
      },
    ];

    const patterns = detectRecurringPatterns([...internet, ...random]);
    expect(patterns.some((p) => p.label === 'Internet')).toBe(true);
    expect(patterns.some((p) => p.label === 'Random purchase')).toBe(false);
  });
});

describe.runIf(hasDatabase)('Financial intelligence Phase 2C', () => {
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
      where: { email: { contains: `intel-${suffix}` } },
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

  it('returns trends, MoM, top categories, recurring, and isolates tenants', async () => {
    const server = app.getHttpServer();
    const a = await request(server)
      .post('/v1/auth/sign-up')
      .send({
        email: `a-intel-${suffix}@example.com`,
        password: 'password123',
        name: 'Adli',
      })
      .expect(201);
    const stranger = await request(server)
      .post('/v1/auth/sign-up')
      .send({
        email: `s-intel-${suffix}@example.com`,
        password: 'password123',
        name: 'Stranger',
      })
      .expect(201);

    const tokenA = a.body.accessToken as string;
    const tokenS = stranger.body.accessToken as string;

    const family = await request(server)
      .post('/v1/families')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Intel Family' })
      .expect(201);
    const familyId = family.body.id as string;

    const account = await request(server)
      .post(`/v1/families/${familyId}/finance/accounts`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'BCA', type: 'BANK', initialBalanceMinor: '0' })
      .expect(201);

    const categories = await request(server)
      .get(`/v1/families/${familyId}/finance/categories`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    const findCat = (name: string) =>
      categories.body.categories.find(
        (c: { name: string; kind: string }) => c.name === name && c.kind === 'EXPENSE',
      );
    const food = findCat('Food & Dining');
    const transport = findCat('Transportation');
    const shopping = findCat('Shopping');
    const utilities = findCat('Utilities');

    async function expense(date: string, amount: string, categoryId: string, description: string) {
      await request(server)
        .post(`/v1/families/${familyId}/finance/transactions`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          type: 'EXPENSE',
          amountMinor: amount,
          accountId: account.body.id,
          categoryId,
          description,
          transactionDate: date,
        })
        .expect(201);
    }

    // May–August acceptance spending
    const months = [
      { m: '2026-05', food: '1200000', transport: '700000', shopping: '500000' },
      { m: '2026-06', food: '1400000', transport: '800000', shopping: '600000' },
      { m: '2026-07', food: '1500000', transport: '850000', shopping: '650000' },
      { m: '2026-08', food: '1800000', transport: '900000', shopping: '700000' },
    ];
    for (const row of months) {
      await expense(`${row.m}-05`, row.food, food.id, 'Food');
      await expense(`${row.m}-08`, row.transport, transport.id, 'Transport');
      await expense(`${row.m}-12`, row.shopping, shopping.id, 'Shopping');
      await expense(`${row.m}-01`, '350000', utilities.id, 'Internet');
    }

    // Income + transfer must not affect expense intelligence
    const salary = categories.body.categories.find(
      (c: { name: string; kind: string }) => c.name === 'Salary' && c.kind === 'INCOME',
    );
    await request(server)
      .post(`/v1/families/${familyId}/finance/transactions`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        type: 'INCOME',
        amountMinor: '15000000',
        accountId: account.body.id,
        categoryId: salary.id,
        transactionDate: '2026-08-01',
      })
      .expect(201);

    const gopay = await request(server)
      .post(`/v1/families/${familyId}/finance/accounts`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'GoPay', type: 'E_WALLET', initialBalanceMinor: '0' })
      .expect(201);
    await request(server)
      .post(`/v1/families/${familyId}/finance/transactions`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        type: 'TRANSFER',
        amountMinor: '500000',
        accountId: account.body.id,
        transferAccountId: gopay.body.id,
        transactionDate: '2026-08-02',
      })
      .expect(201);

    await request(server)
      .post(`/v1/families/${familyId}/finance/budgets`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        periodMonth: '2026-08',
        totalAmountMinor: '8000000',
        items: [{ categoryId: transport.id, amountMinor: '1000000' }],
      })
      .expect(201);

    const analysis = await request(server)
      .get(`/v1/families/${familyId}/finance/analysis`)
      .query({ month: '2026-08', months: 4 })
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    expect(analysis.body.summary.expenseMinor).toBe('3750000'); // 3.4M + internet 350k
    // Acceptance core spend without internet would be 3.4M; with internet 3.75M
    expect(analysis.body.comparison.previousMonth).toBe('2026-07');
    // July = 3.0M + 350k internet = 3.35M; Aug = 3.75M → +400k on core but with internet both months equal add
    expect(BigInt(analysis.body.comparison.expenses.differenceMinor)).toBe(400000n);
    expect(analysis.body.comparison.expenses.percentageChange).toBe(11.9);

    expect(analysis.body.topCategories[0].name).toBe('Food & Dining');
    expect(analysis.body.topCategories[0].amountMinor).toBe('1800000');

    expect(analysis.body.recurring.some((p: { label: string }) => p.label === 'Internet')).toBe(
      true,
    );
    expect(analysis.body.budget).toBeTruthy();
    expect(analysis.body.insights.length).toBeGreaterThan(0);
    expect(analysis.body.insights.length).toBeLessThanOrEqual(5);

    await request(server)
      .get(`/v1/families/${familyId}/finance/analysis`)
      .query({ month: '2026-08' })
      .set('Authorization', `Bearer ${tokenS}`)
      .expect(404);

    const activities = await prisma.familyActivity.count({
      where: { familyId, type: { contains: 'INSIGHT' } },
    });
    expect(activities).toBe(0);
  });
});
