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
import { createId } from '../common/ids';

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
      await prisma.investmentPosition.deleteMany({ where: { familyId: { in: familyIds } } });
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

    const owner = await prisma.user.findUniqueOrThrow({
      where: { email: `a-finance-${suffix}@example.com` },
    });
    const other = await prisma.user.findUniqueOrThrow({
      where: { email: `s-finance-${suffix}@example.com` },
    });
    await prisma.familyMembership.create({
      data: { id: createId(), familyId, userId: other.id, role: 'MEMBER' },
    });
    const personal = await request(server)
      .post(`/v1/families/${familyId}/finance/accounts`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Private wallet', type: 'CASH', scope: 'PERSONAL' })
      .expect(201);
    expect(personal.body.ownerUserId).toBe(owner.id);
    const body = {
      type: 'EXPENSE',
      amountMinor: '12345',
      accountId: personal.body.id,
      transactionDate: `${month}-01`,
      scope: 'PERSONAL',
      idempotencyKey: 'private-expense-retry',
    };
    const writes = await Promise.all(
      [1, 2].map(() =>
        request(server)
          .post(`/v1/families/${familyId}/finance/transactions`)
          .set('Authorization', `Bearer ${tokenA}`)
          .send(body)
          .expect(201),
      ),
    );
    expect(writes[0]!.body.id).toBe(writes[1]!.body.id);
    const privateId = writes[0]!.body.id as string;
    for (const method of ['get', 'patch', 'delete'] as const) {
      const attempt = request(server)[method](
        `/v1/families/${familyId}/finance/transactions/${privateId}`,
      );
      await attempt
        .set('Authorization', `Bearer ${tokenS}`)
        .send(method === 'patch' ? { description: 'No access' } : {})
        .expect(404);
    }
    await request(server)
      .patch(`/v1/families/${familyId}/finance/accounts/${personal.body.id}`)
      .set('Authorization', `Bearer ${tokenS}`)
      .send({ name: 'No access' })
      .expect(404);
    await request(server)
      .post(`/v1/families/${familyId}/finance/transactions`)
      .set('Authorization', `Bearer ${tokenS}`)
      .send({ ...body, idempotencyKey: 'another-user-key' })
      .expect(404);
    await request(server)
      .post(`/v1/families/${familyId}/finance/transactions`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ ...body, scope: 'HOUSEHOLD', idempotencyKey: 'scope-mismatch-key' })
      .expect(404);
    const personalSummary = await request(server)
      .get(`/v1/families/${familyId}/finance/summary`)
      .query({ month, scope: 'PERSONAL' })
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(personalSummary.body.expenseMinor).toBe('12345');
    const personalAnalysis = await request(server)
      .get(`/v1/families/${familyId}/finance/analysis`)
      .query({ month, scope: 'PERSONAL' })
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(personalAnalysis.body.summary.expenseMinor).toBe('12345');
    const personalPage = await request(server)
      .get(`/v1/families/${familyId}/finance/transactions`)
      .query({ scope: 'PERSONAL', from: `${month}-01`, to: `${month}-01`, limit: 1 })
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(personalPage.body.transactions).toHaveLength(1);
    expect(personalPage.body.nextOffset).toBeNull();
    const otherSummary = await request(server)
      .get(`/v1/families/${familyId}/finance/summary`)
      .query({ month, scope: 'PERSONAL' })
      .set('Authorization', `Bearer ${tokenS}`)
      .expect(200);
    expect(otherSummary.body.expenseMinor).toBe('0');
    expect(otherSummary.body.accounts).toHaveLength(0);
    const shared = await request(server)
      .get(`/v1/families/${familyId}/finance/transactions`)
      .set('Authorization', `Bearer ${tokenS}`)
      .expect(200);
    expect(shared.body.transactions.some((row: { id: string }) => row.id === privateId)).toBe(
      false,
    );

    const investment = await request(server)
      .post(`/v1/families/${familyId}/finance/accounts`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Investments', type: 'INVESTMENT' })
      .expect(201);
    const beforeInvestment = await request(server)
      .get(`/v1/families/${familyId}/finance/summary`)
      .query({ month })
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    await request(server)
      .post(`/v1/families/${familyId}/finance/transactions`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        type: 'INVESTMENT_BUY',
        amountMinor: '500000',
        accountId: bca.body.id,
        transferAccountId: investment.body.id,
        transactionDate: today,
      })
      .expect(201);
    const afterInvestment = await request(server)
      .get(`/v1/families/${familyId}/finance/summary`)
      .query({ month })
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(afterInvestment.body.expenseMinor).toBe(beforeInvestment.body.expenseMinor);
    expect(afterInvestment.body.incomeMinor).toBe(beforeInvestment.body.incomeMinor);
    expect(afterInvestment.body.investmentBuyMinor).toBe('500000');
    await request(server)
      .post(`/v1/families/${familyId}/finance/transactions`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ ...body, amountMinor: '999' })
      .expect(409);

    const plan = await request(server)
      .post(`/v1/families/${familyId}/finance/budgets`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        scope: 'PERSONAL',
        periodMonth: month,
        totalAmountMinor: '50000',
        plannedIncomeMinor: '100000',
        savingsAllocationMinor: '20000',
        investmentAllocationMinor: '10000',
      })
      .expect(201);
    expect(plan.body.expenseTotalMinor).toBe('12345');
    expect(plan.body.household.remainingMinor).toBe('37655');
    expect(plan.body.unallocatedMinor).toBe('20000');
    await request(server)
      .get(`/v1/families/${familyId}/finance/budgets/${plan.body.id}`)
      .set('Authorization', `Bearer ${tokenS}`)
      .expect(404);
    await request(server)
      .patch(`/v1/families/${familyId}/finance/budgets/${plan.body.id}`)
      .set('Authorization', `Bearer ${tokenS}`)
      .send({ totalAmountMinor: '5' })
      .expect(404);
    await request(server)
      .post(`/v1/families/${familyId}/finance/budgets`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ periodMonth: month, totalAmountMinor: '50000' })
      .expect(201);
    const unchanged = await prisma.transaction.findUniqueOrThrow({ where: { id: privateId } });
    expect(unchanged.amountMinor).toBe(12345n);
    const goal = await request(server)
      .post(`/v1/families/${familyId}/finance/goals`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        scope: 'PERSONAL',
        name: 'Emergency reserve',
        targetAmountMinor: '100000',
        currentAmountMinor: '12345',
      })
      .expect(201);
    await request(server)
      .patch(`/v1/families/${familyId}/finance/goals/${goal.body.id}`)
      .set('Authorization', `Bearer ${tokenS}`)
      .send({ currentAmountMinor: '1' })
      .expect(404);
    const otherGoals = await request(server)
      .get(`/v1/families/${familyId}/finance/goals?scope=PERSONAL`)
      .set('Authorization', `Bearer ${tokenS}`)
      .expect(200);
    expect(otherGoals.body.goals).toHaveLength(0);
    const position = await request(server)
      .post(`/v1/families/${familyId}/finance/investments`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        scope: 'HOUSEHOLD',
        accountId: investment.body.id,
        instrumentName: 'Manual fund',
        assetType: 'FUND',
        unitsDecimal: '1.5',
      })
      .expect(201);
    await request(server)
      .post(`/v1/families/${familyId}/finance/investments/${position.body.id}/valuations`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ valueMinor: '600000', valuationDate: today })
      .expect(201);
    const holdings = await request(server)
      .get(`/v1/families/${familyId}/finance/investments?scope=HOUSEHOLD`)
      .set('Authorization', `Bearer ${tokenS}`)
      .expect(200);
    expect(holdings.body.totalValuationMinor).toBe('600000');
    const trade = await request(server)
      .post(`/v1/families/${familyId}/finance/transactions`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        type: 'INVESTMENT_BUY',
        accountId: bca.body.id,
        transferAccountId: investment.body.id,
        amountMinor: '5000',
        unitsDecimal: '1.5',
        unitPriceMinor: '3333',
        feesMinor: '100',
        transactionDate: today,
      })
      .expect(201);
    expect(trade.body.feesMinor).toBe('100');
    const valued = await request(server)
      .get(`/v1/families/${familyId}/finance/summary`)
      .query({ month })
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(valued.body.expenseMinor).toBe(beforeInvestment.body.expenseMinor);
    expect(valued.body.investmentFeesMinor).toBe('100');
    expect(
      valued.body.accounts.find((row: { id: string }) => row.id === bca.body.id).balanceMinor,
    ).toBe(
      (
        BigInt(
          afterInvestment.body.accounts.find((row: { id: string }) => row.id === bca.body.id)
            .balanceMinor,
        ) - 5100n
      ).toString(),
    );
    await request(server)
      .post(`/v1/families/${familyId}/finance/transactions`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        type: 'INVESTMENT_SELL',
        accountId: investment.body.id,
        transferAccountId: bca.body.id,
        amountMinor: '5000',
        unitsDecimal: '1.5',
        unitPriceMinor: '3333',
        feesMinor: '200',
        transactionDate: today,
      })
      .expect(201);
    const sold = await request(server)
      .get(`/v1/families/${familyId}/finance/summary`)
      .query({ month })
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(
      sold.body.accounts.find((row: { id: string }) => row.id === bca.body.id).balanceMinor,
    ).toBe(
      (
        BigInt(
          valued.body.accounts.find((row: { id: string }) => row.id === bca.body.id).balanceMinor,
        ) + 4800n
      ).toString(),
    );
    expect(
      sold.body.accounts.find((row: { id: string }) => row.id === investment.body.id).balanceMinor,
    ).toBe('500000');
    expect(sold.body.investmentFeesMinor).toBe('300');
    expect(sold.body.expenseMinor).toBe(beforeInvestment.body.expenseMinor);
    await request(server)
      .post(`/v1/families/${familyId}/finance/transactions`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        type: 'INVESTMENT_BUY',
        accountId: bca.body.id,
        transferAccountId: investment.body.id,
        amountMinor: '5001',
        unitsDecimal: '1.5',
        unitPriceMinor: '3333',
        transactionDate: today,
      })
      .expect(400);
    const privateBroker = await request(server)
      .post(`/v1/families/${familyId}/finance/accounts`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Private broker', type: 'INVESTMENT', scope: 'PERSONAL' })
      .expect(201);
    const privatePosition = await request(server)
      .post(`/v1/families/${familyId}/finance/investments`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        scope: 'PERSONAL',
        accountId: privateBroker.body.id,
        instrumentName: 'Private fund',
        assetType: 'FUND',
        unitsDecimal: '1',
      })
      .expect(201);
    await request(server)
      .patch(`/v1/families/${familyId}/finance/investments/${privatePosition.body.id}`)
      .set('Authorization', `Bearer ${tokenS}`)
      .send({ unitsDecimal: '2' })
      .expect(404);
    await request(server)
      .post(`/v1/families/${familyId}/finance/investments/${privatePosition.body.id}/valuations`)
      .set('Authorization', `Bearer ${tokenS}`)
      .send({ valueMinor: '1', valuationDate: today })
      .expect(404);
    const otherPositions = await request(server)
      .get(`/v1/families/${familyId}/finance/investments?scope=PERSONAL`)
      .set('Authorization', `Bearer ${tokenS}`)
      .expect(200);
    expect(otherPositions.body.positions).toHaveLength(0);
  });
});
