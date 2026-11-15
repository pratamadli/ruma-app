import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  type Budget,
  type BudgetItem,
  type FinanceScope,
  type TransactionCategory,
} from '@prisma/client';
import type { BudgetAlertResponse, BudgetMonthResponse, BudgetProgressResponse } from '@ruma/types';
import type { CreateBudgetInput, GetBudgetQuery, UpdateBudgetInput } from '@ruma/validation';
import { PrismaService } from '../prisma/prisma.service';
import { createId } from '../common/ids';
import { DEFAULT_TRANSACTION_CATEGORIES } from './default-categories';
import { computeProgress } from './budget-progress';
import { currentUtcMonth, moneyToString, monthBounds, parseAmountMinor } from './money';
import { accessibleWhere, auditFinance, requireFinanceMember, scopeWhere } from './finance-access';

type BudgetWithItems = Budget & {
  items: Array<BudgetItem & { category: TransactionCategory }>;
};

@Injectable()
export class BudgetService {
  constructor(private readonly prisma: PrismaService) {}

  async getForMonth(
    familyId: string,
    query: GetBudgetQuery,
    actorId: string,
  ): Promise<BudgetMonthResponse> {
    await requireFinanceMember(this.prisma, familyId, actorId);
    const family = await this.requireFamily(familyId);
    await this.ensureDefaultCategories(familyId);
    const month = query.month ?? currentUtcMonth();
    const expenseTotal = await this.sumExpenses(familyId, month, actorId, query.scope);

    const budget = await this.prisma.budget.findFirst({
      where: { ...scopeWhere(familyId, actorId, query.scope), periodMonth: month },
      include: {
        items: {
          include: { category: true },
          orderBy: { category: { sortOrder: 'asc' } },
        },
      },
    });

    return {
      month,
      currency: family.defaultCurrency,
      expenseTotalMinor: moneyToString(expenseTotal),
      budget: budget ? await this.toProgressResponse(budget, expenseTotal) : null,
    };
  }

  async getById(
    familyId: string,
    budgetId: string,
    actorId: string,
  ): Promise<BudgetProgressResponse> {
    await requireFinanceMember(this.prisma, familyId, actorId);
    const budget = await this.requireBudget(familyId, budgetId, actorId);
    const expenseTotal = await this.sumExpenses(
      familyId,
      budget.periodMonth,
      actorId,
      budget.scope,
    );
    return this.toProgressResponse(budget, expenseTotal);
  }

  async create(
    familyId: string,
    actorId: string,
    input: CreateBudgetInput,
  ): Promise<BudgetProgressResponse> {
    await requireFinanceMember(this.prisma, familyId, actorId);
    const family = await this.requireFamily(familyId);
    await this.ensureDefaultCategories(familyId);

    const existing = await this.prisma.budget.findFirst({
      where: { ...scopeWhere(familyId, actorId, input.scope), periodMonth: input.periodMonth },
    });
    if (existing) {
      throw new ConflictException({
        code: 'BUDGET_EXISTS',
        message: 'A budget already exists for this month. Edit or restore it instead.',
      });
    }

    const items = input.items ?? [];
    await this.validateExpenseCategories(
      familyId,
      items.map((i) => i.categoryId),
    );

    const created = await this.prisma
      .$transaction(async (tx) => {
        const row = await tx.budget.create({
          data: {
            id: createId(),
            familyId,
            scope: input.scope ?? 'HOUSEHOLD',
            ownerUserId: input.scope === 'PERSONAL' ? actorId : null,
            plannedIncomeMinor: BigInt(input.plannedIncomeMinor ?? '0'),
            savingsAllocationMinor: BigInt(input.savingsAllocationMinor ?? '0'),
            investmentAllocationMinor: BigInt(input.investmentAllocationMinor ?? '0'),
            periodMonth: input.periodMonth,
            currency: family.defaultCurrency,
            totalAmountMinor:
              input.totalAmountMinor === undefined || input.totalAmountMinor === null
                ? null
                : parseAmountMinor(input.totalAmountMinor),
            status: 'ACTIVE',
            createdById: actorId,
            items: {
              create: items.map((item) => ({
                id: createId(),
                categoryId: item.categoryId,
                amountMinor: parseAmountMinor(item.amountMinor),
              })),
            },
          },
          include: {
            items: {
              include: { category: true },
              orderBy: { category: { sortOrder: 'asc' } },
            },
          },
        });

        await auditFinance(tx, familyId, actorId, row.id, 'BUDGET_CREATED');
        return row;
      })
      .catch((error: unknown) => {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
          throw new ConflictException({
            code: 'BUDGET_EXISTS',
            message: 'A budget already exists for this month and scope.',
          });
        throw error;
      });
    const expenseTotal = await this.sumExpenses(
      familyId,
      created.periodMonth,
      actorId,
      created.scope,
    );
    return this.toProgressResponse(created, expenseTotal);
  }

  async update(
    familyId: string,
    budgetId: string,
    input: UpdateBudgetInput,
    actorId: string,
  ): Promise<BudgetProgressResponse> {
    await requireFinanceMember(this.prisma, familyId, actorId);
    const existing = await this.requireBudget(familyId, budgetId, actorId);

    if (input.items) {
      await this.validateExpenseCategories(
        familyId,
        input.items.map((i) => i.categoryId),
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (input.items) {
        await tx.budgetItem.deleteMany({ where: { budgetId: existing.id } });
        if (input.items.length > 0) {
          await tx.budgetItem.createMany({
            data: input.items.map((item) => ({
              id: createId(),
              budgetId: existing.id,
              categoryId: item.categoryId,
              amountMinor: parseAmountMinor(item.amountMinor),
            })),
          });
        }
      }

      const row = await tx.budget.update({
        where: { id: existing.id },
        data: {
          plannedIncomeMinor:
            input.plannedIncomeMinor === undefined ? undefined : BigInt(input.plannedIncomeMinor),
          savingsAllocationMinor:
            input.savingsAllocationMinor === undefined
              ? undefined
              : BigInt(input.savingsAllocationMinor),
          investmentAllocationMinor:
            input.investmentAllocationMinor === undefined
              ? undefined
              : BigInt(input.investmentAllocationMinor),
          totalAmountMinor:
            input.totalAmountMinor === undefined
              ? undefined
              : input.totalAmountMinor === null
                ? null
                : parseAmountMinor(input.totalAmountMinor),
          status: input.status,
          archivedAt:
            input.status === 'ARCHIVED' ? new Date() : input.status === 'ACTIVE' ? null : undefined,
        },
        include: {
          items: {
            include: { category: true },
            orderBy: { category: { sortOrder: 'asc' } },
          },
        },
      });
      await auditFinance(tx, familyId, actorId, row.id, 'BUDGET_UPDATED');
      return row;
    });

    const expenseTotal = await this.sumExpenses(
      familyId,
      updated.periodMonth,
      actorId,
      updated.scope,
    );
    return this.toProgressResponse(updated, expenseTotal);
  }

  async archive(familyId: string, budgetId: string, actorId: string) {
    await requireFinanceMember(this.prisma, familyId, actorId);
    const existing = await this.requireBudget(familyId, budgetId, actorId);
    await this.prisma.$transaction(async (tx) => {
      await tx.budget.update({
        where: { id: existing.id },
        data: { status: 'ARCHIVED', archivedAt: new Date() },
      });
      await auditFinance(tx, familyId, actorId, existing.id, 'BUDGET_ARCHIVED');
    });
    return { ok: true };
  }

  /** Lightweight helper for finance summary embedding. */
  async getActiveProgressForMonth(
    familyId: string,
    month: string,
    actorId: string,
    scope: FinanceScope = 'HOUSEHOLD',
  ): Promise<BudgetProgressResponse | null> {
    const budget = await this.prisma.budget.findFirst({
      where: { ...scopeWhere(familyId, actorId, scope), periodMonth: month, status: 'ACTIVE' },
      include: {
        items: {
          include: { category: true },
          orderBy: { category: { sortOrder: 'asc' } },
        },
      },
    });
    if (!budget) return null;
    const expenseTotal = await this.sumExpenses(familyId, month, actorId, scope);
    return this.toProgressResponse(budget, expenseTotal);
  }

  private async toProgressResponse(
    budget: BudgetWithItems,
    expenseTotal: bigint,
  ): Promise<BudgetProgressResponse> {
    const spentByCategory = await this.sumExpensesByCategory(
      budget.familyId,
      budget.periodMonth,
      budget.ownerUserId ?? budget.createdById,
      budget.scope,
    );

    const items = budget.items.map((item) => {
      const spent = spentByCategory.get(item.categoryId) ?? 0n;
      return {
        id: item.id,
        categoryId: item.categoryId,
        categoryName: item.category.name,
        ...computeProgress(item.amountMinor, spent),
      };
    });

    const household =
      budget.totalAmountMinor == null
        ? null
        : computeProgress(budget.totalAmountMinor, expenseTotal);

    const alerts: BudgetAlertResponse[] = [];
    if (household && (household.status === 'WARNING' || household.status === 'OVER_BUDGET')) {
      alerts.push({
        categoryId: null,
        categoryName: null,
        status: household.status,
        message:
          household.status === 'OVER_BUDGET'
            ? `Household budget is over by ${formatOver(household.remainingMinor)}.`
            : 'Household budget is nearly used this month.',
      });
    }
    for (const item of items) {
      if (item.status === 'WARNING') {
        alerts.push({
          categoryId: item.categoryId,
          categoryName: item.categoryName,
          status: item.status,
          message: `${item.categoryName} is approaching its monthly budget.`,
        });
      } else if (item.status === 'OVER_BUDGET') {
        alerts.push({
          categoryId: item.categoryId,
          categoryName: item.categoryName,
          status: item.status,
          message: `${item.categoryName} is over budget by ${formatOver(item.remainingMinor)}.`,
        });
      }
    }

    return {
      id: budget.id,
      scope: budget.scope,
      plannedIncomeMinor: budget.plannedIncomeMinor.toString(),
      savingsAllocationMinor: budget.savingsAllocationMinor.toString(),
      investmentAllocationMinor: budget.investmentAllocationMinor.toString(),
      unallocatedMinor: (
        budget.plannedIncomeMinor -
        (budget.totalAmountMinor ??
          budget.items.reduce((total, item) => total + item.amountMinor, 0n)) -
        budget.savingsAllocationMinor -
        budget.investmentAllocationMinor
      ).toString(),
      familyId: budget.familyId,
      periodMonth: budget.periodMonth,
      currency: budget.currency,
      status: budget.status,
      household,
      items,
      alerts,
      expenseTotalMinor: moneyToString(expenseTotal),
      createdAt: budget.createdAt.toISOString(),
      updatedAt: budget.updatedAt.toISOString(),
    };
  }

  private async sumExpenses(
    familyId: string,
    month: string,
    actorId: string,
    scope: FinanceScope = 'HOUSEHOLD',
  ): Promise<bigint> {
    const { from, to } = monthBounds(month);
    const agg = await this.prisma.transaction.aggregate({
      where: {
        ...scopeWhere(familyId, actorId, scope),
        deletedAt: null,
        type: 'EXPENSE',
        transactionDate: { gte: from, lte: to },
      },
      _sum: { amountMinor: true },
    });
    return agg._sum.amountMinor ?? 0n;
  }

  private async sumExpensesByCategory(
    familyId: string,
    month: string,
    actorId: string,
    scope: FinanceScope,
  ): Promise<Map<string, bigint>> {
    const { from, to } = monthBounds(month);
    const rows = await this.prisma.transaction.groupBy({
      by: ['categoryId'],
      where: {
        ...scopeWhere(familyId, actorId, scope),
        deletedAt: null,
        type: 'EXPENSE',
        transactionDate: { gte: from, lte: to },
        categoryId: { not: null },
      },
      _sum: { amountMinor: true },
    });
    const map = new Map<string, bigint>();
    for (const row of rows) {
      if (row.categoryId) {
        map.set(row.categoryId, row._sum.amountMinor ?? 0n);
      }
    }
    return map;
  }

  private async validateExpenseCategories(familyId: string, categoryIds: string[]) {
    if (categoryIds.length === 0) return;
    const categories = await this.prisma.transactionCategory.findMany({
      where: { familyId, id: { in: categoryIds } },
    });
    if (categories.length !== categoryIds.length) {
      throw new NotFoundException({
        code: 'CATEGORY_NOT_FOUND',
        message: 'One or more categories were not found.',
      });
    }
    for (const category of categories) {
      if (category.kind !== 'EXPENSE') {
        throw new BadRequestException({
          code: 'CATEGORY_KIND_MISMATCH',
          message: 'Budget items must use expense categories.',
        });
      }
    }
  }

  private async requireFamily(familyId: string) {
    const family = await this.prisma.family.findFirst({
      where: { id: familyId, deletedAt: null },
    });
    if (!family) {
      throw new NotFoundException({ code: 'FAMILY_NOT_FOUND', message: 'Family not found.' });
    }
    return family;
  }

  private async requireBudget(
    familyId: string,
    budgetId: string,
    actorId: string,
  ): Promise<BudgetWithItems> {
    const budget = await this.prisma.budget.findFirst({
      where: { id: budgetId, ...accessibleWhere(familyId, actorId) },
      include: {
        items: {
          include: { category: true },
          orderBy: { category: { sortOrder: 'asc' } },
        },
      },
    });
    if (!budget) {
      throw new NotFoundException({ code: 'BUDGET_NOT_FOUND', message: 'Budget not found.' });
    }
    return budget;
  }

  private async ensureDefaultCategories(familyId: string) {
    const count = await this.prisma.transactionCategory.count({ where: { familyId } });
    if (count > 0) return;
    await this.prisma.transactionCategory.createMany({
      data: DEFAULT_TRANSACTION_CATEGORIES.map((item) => ({
        id: createId(),
        familyId,
        name: item.name,
        kind: item.kind,
        isSystem: true,
        sortOrder: item.sortOrder,
      })),
      skipDuplicates: true,
    });
  }
}

function formatOver(remainingMinor: string): string {
  const abs = remainingMinor.startsWith('-') ? remainingMinor.slice(1) : remainingMinor;
  return `Rp ${abs.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}
