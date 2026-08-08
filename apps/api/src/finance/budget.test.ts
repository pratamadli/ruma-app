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

describe.runIf(hasDatabase)('Household budgeting Phase 2B', () => {
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
      where: { email: { contains: `budget-${suffix}` } },
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
      await prisma.familyInvitation.deleteMany({ where: { familyId: { in: familyIds } } });
      await prisma.familyMembership.deleteMany({ where: { familyId: { in: familyIds } } });
      await prisma.family.deleteMany({ where: { id: { in: familyIds } } });
    }

    await prisma.refreshToken.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await app.close();
  });

  it('tracks plan vs actual, excludes income/transfers, and isolates families', async () => {
    const server = app.getHttpServer();
    const today = new Date().toISOString().slice(0, 10);
    const month = today.slice(0, 7);

    const a = await request(server)
      .post('/v1/auth/sign-up')
      .send({
        email: `a-budget-${suffix}@example.com`,
        password: 'password123',
        name: 'Adli',
      })
      .expect(201);
    const stranger = await request(server)
      .post('/v1/auth/sign-up')
      .send({
        email: `s-budget-${suffix}@example.com`,
        password: 'password123',
        name: 'Stranger',
      })
      .expect(201);

    const tokenA = a.body.accessToken as string;
    const tokenS = stranger.body.accessToken as string;

    const family = await request(server)
      .post('/v1/families')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Budget Family', householdName: 'Home' })
      .expect(201);
    const familyId = family.body.id as string;

    const bca = await request(server)
      .post(`/v1/families/${familyId}/finance/accounts`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'BCA', type: 'BANK', initialBalanceMinor: '10000000' })
      .expect(201);
    const gopay = await request(server)
      .post(`/v1/families/${familyId}/finance/accounts`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'GoPay', type: 'E_WALLET', initialBalanceMinor: '0' })
      .expect(201);

    const categories = await request(server)
      .get(`/v1/families/${familyId}/finance/categories`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    const findCat = (name: string, kind: string) =>
      categories.body.categories.find(
        (c: { name: string; kind: string }) => c.name === name && c.kind === kind,
      );
    const salary = findCat('Salary', 'INCOME');
    const food = findCat('Food & Dining', 'EXPENSE');
    const transport = findCat('Transportation', 'EXPENSE');
    const shopping = findCat('Shopping', 'EXPENSE');

    await request(server)
      .post(`/v1/families/${familyId}/finance/transactions`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        type: 'INCOME',
        amountMinor: '15000000',
        accountId: bca.body.id,
        categoryId: salary.id,
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
        transactionDate: today,
      })
      .expect(201);

    const budget = await request(server)
      .post(`/v1/families/${familyId}/finance/budgets`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        periodMonth: month,
        totalAmountMinor: '8000000',
        items: [
          { categoryId: food.id, amountMinor: '2000000' },
          { categoryId: transport.id, amountMinor: '1000000' },
          { categoryId: shopping.id, amountMinor: '750000' },
        ],
      })
      .expect(201);

    await request(server)
      .post(`/v1/families/${familyId}/finance/budgets`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        periodMonth: month,
        totalAmountMinor: '1000000',
      })
      .expect(409);

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
        type: 'EXPENSE',
        amountMinor: '100000',
        accountId: gopay.body.id,
        categoryId: transport.id,
        description: 'Transport',
        transactionDate: today,
      })
      .expect(201);
    await request(server)
      .post(`/v1/families/${familyId}/finance/transactions`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        type: 'EXPENSE',
        amountMinor: '450000',
        accountId: bca.body.id,
        categoryId: food.id,
        description: 'Groceries',
        transactionDate: today,
      })
      .expect(201);

    const view = await request(server)
      .get(`/v1/families/${familyId}/finance/budgets`)
      .query({ month })
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    expect(view.body.budget.id).toBe(budget.body.id);
    expect(view.body.budget.household.budgetMinor).toBe('8000000');
    expect(view.body.expenseTotalMinor).toBe('700000');
    expect(view.body.budget.household.spentMinor).toBe('700000');
    expect(view.body.budget.household.remainingMinor).toBe('7300000');
    const foodItem = view.body.budget.items.find(
      (i: { categoryId: string }) => i.categoryId === food.id,
    );
    const transportItem = view.body.budget.items.find(
      (i: { categoryId: string }) => i.categoryId === transport.id,
    );
    const shoppingItem = view.body.budget.items.find(
      (i: { categoryId: string }) => i.categoryId === shopping.id,
    );

    expect(foodItem.spentMinor).toBe('600000');
    expect(foodItem.remainingMinor).toBe('1400000');
    expect(foodItem.percentage).toBe(30);
    expect(transportItem.spentMinor).toBe('100000');
    expect(transportItem.remainingMinor).toBe('900000');
    expect(transportItem.percentage).toBe(10);
    expect(shoppingItem.spentMinor).toBe('0');
    expect(shoppingItem.remainingMinor).toBe('750000');
    expect(shoppingItem.percentage).toBe(0);

    await request(server)
      .get(`/v1/families/${familyId}/finance/budgets/${budget.body.id}`)
      .set('Authorization', `Bearer ${tokenS}`)
      .expect(404);

    await request(server)
      .patch(`/v1/families/${familyId}/finance/budgets/${budget.body.id}`)
      .set('Authorization', `Bearer ${tokenS}`)
      .send({ totalAmountMinor: '1' })
      .expect(404);

    const patched = await request(server)
      .patch(`/v1/families/${familyId}/finance/budgets/${budget.body.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        items: [
          { categoryId: food.id, amountMinor: '2500000' },
          { categoryId: transport.id, amountMinor: '1000000' },
        ],
      })
      .expect(200);
    expect(patched.body.items).toHaveLength(2);

    await request(server)
      .delete(`/v1/families/${familyId}/finance/budgets/${budget.body.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    const archived = await prisma.budget.findUnique({ where: { id: budget.body.id } });
    expect(archived?.status).toBe('ARCHIVED');

    const activities = await prisma.familyActivity.count({
      where: { familyId, type: { contains: 'BUDGET' } },
    });
    expect(activities).toBe(0);
  });
});
