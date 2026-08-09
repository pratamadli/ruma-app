import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  FinanceAnalysisResponse,
  FinanceInsightResponse,
  FinanceMonthTotals,
  FinanceTopCategory,
  MonthComparisonResponse,
} from '@ruma/types';
import type { FinanceAnalysisQuery } from '@ruma/validation';
import { PrismaService } from '../../prisma/prisma.service';
import { BudgetService } from '../budget.service';
import { shiftMonth } from '../budget-progress';
import { currentUtcMonth, formatDateOnly, moneyToString, monthBounds } from '../money';
import { averageBigInt, medianBigInt, moneyDiffString, percentChange, percentOf } from './percent';
import { detectRecurringPatterns, type ExpenseForRecurring } from './recurring';

@Injectable()
export class IntelligenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly budgets: BudgetService,
  ) {}

  async getAnalysis(
    familyId: string,
    query: FinanceAnalysisQuery,
  ): Promise<FinanceAnalysisResponse> {
    const family = await this.prisma.family.findFirst({
      where: { id: familyId, deletedAt: null },
    });
    if (!family) {
      throw new NotFoundException({ code: 'FAMILY_NOT_FOUND', message: 'Family not found.' });
    }

    const month = query.month ?? currentUtcMonth();
    const monthsCount = query.months ?? 6;
    const trendMonths = this.buildMonthWindow(month, monthsCount);
    const previousMonth = shiftMonth(month, -1);

    const [trend, topCategories, categoryChanges, budget, expenseWindow] = await Promise.all([
      this.buildTrend(familyId, trendMonths),
      this.buildTopCategories(familyId, month),
      this.buildCategoryChanges(familyId, month, previousMonth),
      this.budgets.getActiveProgressForMonth(familyId, month),
      this.loadExpenseWindow(familyId, shiftMonth(month, -(Math.max(monthsCount, 12) - 1)), month),
    ]);

    const current = trend.find((t) => t.month === month) ?? emptyTotals(month);
    const previous = trend.find((t) => t.month === previousMonth) ?? emptyTotals(previousMonth);
    const comparison = this.buildComparison(current, previous);
    const recurring = detectRecurringPatterns(expenseWindow);
    const anomalies = this.detectAnomalies(expenseWindow, month, trend, topCategories);
    const insights = this.generateInsights({
      month,
      previousMonth,
      comparison,
      topCategories,
      categoryChanges,
      budget,
      recurring,
      anomalies,
      monthsWithData: trend.filter((t) => BigInt(t.expenseMinor) > 0n || BigInt(t.incomeMinor) > 0n)
        .length,
    });

    return {
      month,
      currency: family.defaultCurrency,
      monthsWithData: trend.filter((t) => BigInt(t.expenseMinor) > 0n || BigInt(t.incomeMinor) > 0n)
        .length,
      summary: current,
      comparison,
      trend,
      topCategories,
      categoryChanges,
      budget,
      recurring,
      anomalies,
      insights,
    };
  }

  private buildMonthWindow(anchor: string, count: number): string[] {
    const months: string[] = [];
    for (let i = count - 1; i >= 0; i--) {
      months.push(shiftMonth(anchor, -i));
    }
    return months;
  }

  private async buildTrend(familyId: string, months: string[]): Promise<FinanceMonthTotals[]> {
    const from = monthBounds(months[0]!).from;
    const to = monthBounds(months[months.length - 1]!).to;

    const rows = await this.prisma.transaction.findMany({
      where: {
        familyId,
        deletedAt: null,
        type: { in: ['INCOME', 'EXPENSE'] },
        transactionDate: { gte: from, lte: to },
      },
      select: { type: true, amountMinor: true, transactionDate: true },
    });

    const map = new Map<string, { income: bigint; expense: bigint }>();
    for (const m of months) map.set(m, { income: 0n, expense: 0n });

    for (const row of rows) {
      const key = formatDateOnly(row.transactionDate).slice(0, 7);
      const bucket = map.get(key);
      if (!bucket) continue;
      if (row.type === 'INCOME') bucket.income += row.amountMinor;
      else bucket.expense += row.amountMinor;
    }

    return months.map((m) => {
      const bucket = map.get(m)!;
      return {
        month: m,
        incomeMinor: moneyToString(bucket.income),
        expenseMinor: moneyToString(bucket.expense),
        netCashFlowMinor: moneyToString(bucket.income - bucket.expense),
      };
    });
  }

  private async buildTopCategories(familyId: string, month: string): Promise<FinanceTopCategory[]> {
    const { from, to } = monthBounds(month);
    const rows = await this.prisma.transaction.groupBy({
      by: ['categoryId'],
      where: {
        familyId,
        deletedAt: null,
        type: 'EXPENSE',
        transactionDate: { gte: from, lte: to },
      },
      _sum: { amountMinor: true },
    });

    const total = rows.reduce((acc, row) => acc + (row._sum.amountMinor ?? 0n), 0n);
    const categoryIds = rows.map((r) => r.categoryId).filter((id): id is string => Boolean(id));
    const categories = await this.prisma.transactionCategory.findMany({
      where: { id: { in: categoryIds } },
    });
    const nameById = new Map(categories.map((c) => [c.id, c.name]));

    const uncategorized = rows.find((r) => r.categoryId == null)?._sum.amountMinor ?? 0n;

    const list: FinanceTopCategory[] = rows
      .filter((r) => r.categoryId)
      .map((r) => {
        const amount = r._sum.amountMinor ?? 0n;
        return {
          categoryId: r.categoryId!,
          name: nameById.get(r.categoryId!) ?? 'Unknown',
          amountMinor: moneyToString(amount),
          percentageOfExpenses: percentOf(amount, total),
        };
      })
      .sort((a, b) => Number(BigInt(b.amountMinor) - BigInt(a.amountMinor)));

    if (uncategorized > 0n) {
      list.push({
        categoryId: '__uncategorized__',
        name: 'Uncategorized',
        amountMinor: moneyToString(uncategorized),
        percentageOfExpenses: percentOf(uncategorized, total),
      });
      list.sort((a, b) => Number(BigInt(b.amountMinor) - BigInt(a.amountMinor)));
    }

    return list;
  }

  private async buildCategoryChanges(
    familyId: string,
    month: string,
    previousMonth: string,
  ): Promise<FinanceAnalysisResponse['categoryChanges']> {
    const [current, previous] = await Promise.all([
      this.categorySpendMap(familyId, month),
      this.categorySpendMap(familyId, previousMonth),
    ]);
    const ids = new Set([...current.keys(), ...previous.keys()]);
    const categories = await this.prisma.transactionCategory.findMany({
      where: { id: { in: [...ids].filter((id) => id !== '__uncategorized__') } },
    });
    const nameById = new Map(categories.map((c) => [c.id, c.name]));

    const changes = [...ids].map((categoryId) => {
      const cur = current.get(categoryId) ?? 0n;
      const prev = previous.get(categoryId) ?? 0n;
      return {
        categoryId,
        name:
          categoryId === '__uncategorized__'
            ? 'Uncategorized'
            : (nameById.get(categoryId) ?? 'Unknown'),
        currentMinor: moneyToString(cur),
        previousMinor: moneyToString(prev),
        differenceMinor: moneyDiffString(cur, prev),
        percentageChange: percentChange(cur, prev),
      };
    });

    return changes.sort(
      (a, b) =>
        Math.abs(Number(BigInt(b.differenceMinor))) - Math.abs(Number(BigInt(a.differenceMinor))),
    );
  }

  private async categorySpendMap(familyId: string, month: string) {
    const { from, to } = monthBounds(month);
    const rows = await this.prisma.transaction.groupBy({
      by: ['categoryId'],
      where: {
        familyId,
        deletedAt: null,
        type: 'EXPENSE',
        transactionDate: { gte: from, lte: to },
      },
      _sum: { amountMinor: true },
    });
    const map = new Map<string, bigint>();
    for (const row of rows) {
      map.set(row.categoryId ?? '__uncategorized__', row._sum.amountMinor ?? 0n);
    }
    return map;
  }

  private buildComparison(
    current: FinanceMonthTotals,
    previous: FinanceMonthTotals,
  ): MonthComparisonResponse {
    const curExp = BigInt(current.expenseMinor);
    const prevExp = BigInt(previous.expenseMinor);
    const curInc = BigInt(current.incomeMinor);
    const prevInc = BigInt(previous.incomeMinor);
    const curNet = BigInt(current.netCashFlowMinor);
    const prevNet = BigInt(previous.netCashFlowMinor);

    return {
      currentMonth: current.month,
      previousMonth: previous.month,
      expenses: {
        currentMinor: current.expenseMinor,
        previousMinor: previous.expenseMinor,
        differenceMinor: moneyDiffString(curExp, prevExp),
        percentageChange: percentChange(curExp, prevExp),
      },
      income: {
        currentMinor: current.incomeMinor,
        previousMinor: previous.incomeMinor,
        differenceMinor: moneyDiffString(curInc, prevInc),
        percentageChange: percentChange(curInc, prevInc),
      },
      netCashFlow: {
        currentMinor: current.netCashFlowMinor,
        previousMinor: previous.netCashFlowMinor,
        differenceMinor: moneyDiffString(curNet, prevNet),
        percentageChange: percentChange(curNet, prevNet),
      },
    };
  }

  private async loadExpenseWindow(
    familyId: string,
    fromMonth: string,
    toMonth: string,
  ): Promise<ExpenseForRecurring[]> {
    const from = monthBounds(fromMonth).from;
    const to = monthBounds(toMonth).to;
    const rows = await this.prisma.transaction.findMany({
      where: {
        familyId,
        deletedAt: null,
        type: 'EXPENSE',
        transactionDate: { gte: from, lte: to },
      },
      include: { category: true },
      orderBy: { transactionDate: 'asc' },
      take: 5000,
    });
    return rows.map((row) => ({
      id: row.id,
      amountMinor: row.amountMinor,
      description: row.description,
      categoryId: row.categoryId,
      categoryName: row.category?.name ?? null,
      transactionDate: row.transactionDate,
    }));
  }

  private detectAnomalies(
    expenses: ExpenseForRecurring[],
    month: string,
    trend: FinanceMonthTotals[],
    topCategories: FinanceTopCategory[],
  ): FinanceAnalysisResponse['anomalies'] {
    const anomalies: FinanceAnalysisResponse['anomalies'] = [];
    const monthExpenses = expenses.filter((e) =>
      formatDateOnly(e.transactionDate).startsWith(month),
    );
    const historical = expenses.filter((e) => !formatDateOnly(e.transactionDate).startsWith(month));

    // Large transactions vs median of history
    if (historical.length >= 10) {
      const med = medianBigInt(historical.map((e) => e.amountMinor));
      if (med != null && med > 0n) {
        const threshold = med * 3n;
        for (const txn of monthExpenses) {
          if (txn.amountMinor >= threshold) {
            anomalies.push({
              type: 'LARGE_TRANSACTION',
              severity: 'ATTENTION',
              title: 'Unusually large expense',
              description: `${txn.description?.trim() || 'An expense'} (${moneyLabel(txn.amountMinor)}) is much larger than your typical expense.`,
              metadata: {
                transactionId: txn.id,
                amountMinor: moneyToString(txn.amountMinor),
                medianMinor: moneyToString(med),
              },
            });
          }
        }
      }
    }

    // Month spike vs prior months average
    const priorMonths = trend.filter((t) => t.month < month);
    const priorExpenseValues = priorMonths.map((t) => BigInt(t.expenseMinor)).filter((v) => v > 0n);
    const currentExpense = BigInt(trend.find((t) => t.month === month)?.expenseMinor ?? '0');
    if (priorExpenseValues.length >= 2) {
      const avg = averageBigInt(priorExpenseValues);
      if (avg != null && avg > 0n && currentExpense >= (avg * 3n) / 2n) {
        anomalies.push({
          type: 'MONTH_SPIKE',
          severity: 'ATTENTION',
          title: 'Spending higher than usual',
          description: `Household expenses look higher than your recent monthly average.`,
          metadata: {
            currentMinor: moneyToString(currentExpense),
            averageMinor: moneyToString(avg),
          },
        });
      }
    }

    // Category spikes: rebuild from expense window
    const byCatMonth = new Map<string, Map<string, bigint>>();
    for (const e of expenses) {
      if (!e.categoryId) continue;
      const m = formatDateOnly(e.transactionDate).slice(0, 7);
      const inner = byCatMonth.get(e.categoryId) ?? new Map();
      inner.set(m, (inner.get(m) ?? 0n) + e.amountMinor);
      byCatMonth.set(e.categoryId, inner);
    }
    for (const top of topCategories.slice(0, 8)) {
      if (top.categoryId.startsWith('__')) continue;
      const series = byCatMonth.get(top.categoryId);
      if (!series) continue;
      const prior = [...series.entries()]
        .filter(([m]) => m < month)
        .map(([, v]) => v)
        .filter((v) => v > 0n);
      if (prior.length < 2) continue;
      const avg = averageBigInt(prior);
      const cur = series.get(month) ?? 0n;
      if (avg != null && avg > 0n && cur >= (avg * 3n) / 2n) {
        anomalies.push({
          type: 'CATEGORY_SPIKE',
          severity: 'ATTENTION',
          title: `${top.name} spending is higher than usual`,
          description: `${top.name} looks significantly higher than recent months.`,
          metadata: {
            categoryId: top.categoryId,
            currentMinor: moneyToString(cur),
            averageMinor: moneyToString(avg),
          },
        });
      }
    }

    return anomalies.slice(0, 8);
  }

  private generateInsights(input: {
    month: string;
    previousMonth: string;
    comparison: MonthComparisonResponse;
    topCategories: FinanceTopCategory[];
    categoryChanges: FinanceAnalysisResponse['categoryChanges'];
    budget: Awaited<ReturnType<BudgetService['getActiveProgressForMonth']>>;
    recurring: FinanceAnalysisResponse['recurring'];
    anomalies: FinanceAnalysisResponse['anomalies'];
    monthsWithData: number;
  }): FinanceInsightResponse[] {
    const insights: FinanceInsightResponse[] = [];
    const prevLabel = input.previousMonth;

    // Budget
    if (input.budget?.household?.status === 'OVER_BUDGET') {
      insights.push({
        type: 'OVER_BUDGET',
        severity: 'ATTENTION',
        title: 'Household budget exceeded',
        description: `Spending is over the household budget for this month.`,
        metadata: { remainingMinor: input.budget.household.remainingMinor },
      });
    } else if (input.budget?.household?.status === 'WARNING') {
      insights.push({
        type: 'BUDGET_WARNING',
        severity: 'ATTENTION',
        title: 'Household budget nearly used',
        description: `You are approaching the household budget for this month.`,
        metadata: { percentage: input.budget.household.percentage },
      });
    }
    const pressure = input.budget?.items
      .filter((i) => i.status === 'WARNING' || i.status === 'OVER_BUDGET')
      .sort((a, b) => (b.percentage ?? 0) - (a.percentage ?? 0))[0];
    if (pressure) {
      insights.push({
        type: pressure.status === 'OVER_BUDGET' ? 'OVER_BUDGET' : 'BUDGET_WARNING',
        severity: 'ATTENTION',
        title:
          pressure.status === 'OVER_BUDGET'
            ? `${pressure.categoryName} is over budget`
            : `${pressure.categoryName} is close to budget`,
        description:
          pressure.status === 'OVER_BUDGET'
            ? `${pressure.categoryName} has exceeded its monthly budget.`
            : `${pressure.categoryName} is at ${pressure.percentage ?? 0}% of its monthly budget.`,
        metadata: { categoryId: pressure.categoryId, percentage: pressure.percentage },
      });
    }

    // MoM spending
    const pct = input.comparison.expenses.percentageChange;
    if (input.monthsWithData >= 2 && pct != null && Math.abs(pct) >= 10) {
      insights.push({
        type: pct > 0 ? 'SPENDING_INCREASE' : 'SPENDING_DECREASE',
        severity: 'INFO',
        title: pct > 0 ? 'Spending increased' : 'Spending decreased',
        description:
          pct > 0
            ? `Expenses are ${Math.abs(pct)}% higher than ${prevLabel}.`
            : `Expenses are ${Math.abs(pct)}% lower than ${prevLabel}.`,
        metadata: {
          percentageChange: pct,
          differenceMinor: input.comparison.expenses.differenceMinor,
        },
      });
    } else if (input.monthsWithData < 2) {
      insights.push({
        type: 'INSUFFICIENT_DATA',
        severity: 'INFO',
        title: 'Keep adding transactions',
        description: 'Add another month of activity to unlock spending trends and comparisons.',
        metadata: {},
      });
    }

    // Anomalies (already calm)
    for (const anomaly of input.anomalies.slice(0, 2)) {
      insights.push({
        type: anomaly.type,
        severity: anomaly.severity,
        title: anomaly.title,
        description: anomaly.description,
        metadata: anomaly.metadata,
      });
    }

    // Recurring
    for (const pattern of input.recurring.slice(0, 2)) {
      insights.push({
        type: 'RECURRING_PATTERN',
        severity: 'INFO',
        title: 'Recurring pattern detected',
        description: `${pattern.label} appears to be a monthly expense around ${moneyLabel(BigInt(pattern.typicalAmountMinor))}.`,
        metadata: {
          occurrenceCount: pattern.occurrenceCount,
          categoryId: pattern.categoryId,
        },
      });
    }

    // Top category
    const top = input.topCategories[0];
    if (top && BigInt(top.amountMinor) > 0n) {
      insights.push({
        type: 'TOP_CATEGORY',
        severity: 'INFO',
        title: `${top.name} is your largest expense`,
        description:
          top.percentageOfExpenses != null
            ? `${top.name} is ${top.percentageOfExpenses}% of expenses this month.`
            : `${top.name} is your largest expense category this month.`,
        metadata: { categoryId: top.categoryId, amountMinor: top.amountMinor },
      });
    }

    // Category increase highlight
    const rising = input.categoryChanges.find(
      (c) => c.percentageChange != null && c.percentageChange >= 15 && BigInt(c.currentMinor) > 0n,
    );
    if (rising) {
      insights.push({
        type: 'CATEGORY_INCREASE',
        severity: 'INFO',
        title: `${rising.name} spending increased`,
        description: `${rising.name} spending is ${rising.percentageChange}% higher than ${prevLabel}.`,
        metadata: { categoryId: rising.categoryId, percentageChange: rising.percentageChange },
      });
    }

    return prioritizeInsights(insights).slice(0, 5);
  }
}

function emptyTotals(month: string): FinanceMonthTotals {
  return {
    month,
    incomeMinor: '0',
    expenseMinor: '0',
    netCashFlowMinor: '0',
  };
}

function moneyLabel(amount: bigint): string {
  const digits = amount.toString();
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `Rp ${grouped}`;
}

const PRIORITY: Record<string, number> = {
  OVER_BUDGET: 1,
  BUDGET_WARNING: 2,
  SPENDING_INCREASE: 3,
  SPENDING_DECREASE: 3,
  CATEGORY_SPIKE: 4,
  MONTH_SPIKE: 4,
  LARGE_TRANSACTION: 5,
  CATEGORY_INCREASE: 6,
  RECURRING_PATTERN: 7,
  TOP_CATEGORY: 8,
  INSUFFICIENT_DATA: 9,
};

function prioritizeInsights(insights: FinanceInsightResponse[]): FinanceInsightResponse[] {
  const seen = new Set<string>();
  return [...insights]
    .sort((a, b) => (PRIORITY[a.type] ?? 50) - (PRIORITY[b.type] ?? 50))
    .filter((insight) => {
      const key = `${insight.type}:${insight.title}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}
