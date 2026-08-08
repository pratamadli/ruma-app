import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { FinancialAccount, Transaction, TransactionCategory, User } from '@prisma/client';
import type {
  FinancialAccountListResponse,
  FinancialAccountResponse,
  FinanceSummaryResponse,
  TransactionCategoryListResponse,
  TransactionCategoryResponse,
  TransactionListResponse,
  TransactionResponse,
} from '@ruma/types';
import type {
  CreateFinancialAccountInput,
  CreateTransactionCategoryInput,
  CreateTransactionInput,
  FinanceSummaryQuery,
  ListTransactionsQuery,
  UpdateFinancialAccountInput,
  UpdateTransactionCategoryInput,
  UpdateTransactionInput,
} from '@ruma/validation';
import { PrismaService } from '../prisma/prisma.service';
import { createId } from '../common/ids';
import { BudgetService } from './budget.service';
import { DEFAULT_TRANSACTION_CATEGORIES } from './default-categories';
import {
  currentUtcMonth,
  formatDateOnly,
  moneyToString,
  monthBounds,
  parseAmountMinor,
  parseDateOnly,
} from './money';

type AccountWithOwner = FinancialAccount;
type TxnWithRelations = Transaction & {
  account: FinancialAccount;
  transferAccount: FinancialAccount | null;
  category: TransactionCategory | null;
  createdBy: User;
};

@Injectable()
export class FinanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly budgets: BudgetService,
  ) {}

  // ─── Accounts ─────────────────────────────────────────────────────────────

  async listAccounts(familyId: string): Promise<FinancialAccountListResponse> {
    const family = await this.requireFamily(familyId);
    await this.ensureDefaultCategories(familyId);

    const accounts = await this.prisma.financialAccount.findMany({
      where: { familyId, deletedAt: null },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
    const balances = await this.computeBalances(
      familyId,
      accounts.map((a) => a.id),
    );

    return {
      currency: family.defaultCurrency,
      accounts: accounts.map((account) =>
        this.toAccountResponse(account, balances.get(account.id) ?? account.initialBalanceMinor),
      ),
    };
  }

  async createAccount(
    familyId: string,
    actorId: string,
    input: CreateFinancialAccountInput,
  ): Promise<FinancialAccountResponse> {
    const family = await this.requireFamily(familyId);
    if (input.ownerUserId) {
      await this.requireActiveMember(familyId, input.ownerUserId);
    }

    const account = await this.prisma.financialAccount.create({
      data: {
        id: createId(),
        familyId,
        name: input.name,
        type: input.type ?? 'BANK',
        currency: input.currency ?? family.defaultCurrency,
        initialBalanceMinor: parseAmountMinor(input.initialBalanceMinor ?? '0'),
        ownerUserId: input.ownerUserId ?? null,
        createdById: actorId,
      },
    });

    return this.toAccountResponse(account, account.initialBalanceMinor);
  }

  async updateAccount(
    familyId: string,
    accountId: string,
    input: UpdateFinancialAccountInput,
  ): Promise<FinancialAccountResponse> {
    const account = await this.requireAccount(familyId, accountId);
    if (input.ownerUserId) {
      await this.requireActiveMember(familyId, input.ownerUserId);
    }

    const updated = await this.prisma.financialAccount.update({
      where: { id: account.id },
      data: {
        name: input.name,
        type: input.type,
        ownerUserId: input.ownerUserId === undefined ? undefined : input.ownerUserId,
        isActive: input.isActive,
      },
    });

    const balances = await this.computeBalances(familyId, [updated.id]);
    return this.toAccountResponse(updated, balances.get(updated.id) ?? updated.initialBalanceMinor);
  }

  // ─── Categories ───────────────────────────────────────────────────────────

  async listCategories(familyId: string): Promise<TransactionCategoryListResponse> {
    await this.requireFamily(familyId);
    await this.ensureDefaultCategories(familyId);
    const categories = await this.prisma.transactionCategory.findMany({
      where: { familyId },
      orderBy: [{ kind: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    });
    return { categories: categories.map((c) => this.toCategoryResponse(c)) };
  }

  async createCategory(
    familyId: string,
    input: CreateTransactionCategoryInput,
  ): Promise<TransactionCategoryResponse> {
    await this.requireFamily(familyId);
    await this.ensureDefaultCategories(familyId);

    try {
      const created = await this.prisma.transactionCategory.create({
        data: {
          id: createId(),
          familyId,
          name: input.name,
          kind: input.kind,
          isSystem: false,
          sortOrder: 500,
        },
      });
      return this.toCategoryResponse(created);
    } catch {
      throw new BadRequestException({
        code: 'CATEGORY_EXISTS',
        message: 'A category with this name already exists for that type.',
      });
    }
  }

  async updateCategory(
    familyId: string,
    categoryId: string,
    input: UpdateTransactionCategoryInput,
  ): Promise<TransactionCategoryResponse> {
    const category = await this.requireCategory(familyId, categoryId);
    const updated = await this.prisma.transactionCategory.update({
      where: { id: category.id },
      data: {
        name: input.name,
        isActive: input.isActive,
      },
    });
    return this.toCategoryResponse(updated);
  }

  // ─── Transactions ─────────────────────────────────────────────────────────

  async listTransactions(
    familyId: string,
    query: ListTransactionsQuery,
  ): Promise<TransactionListResponse> {
    await this.requireFamily(familyId);
    await this.ensureDefaultCategories(familyId);

    const transactions = await this.prisma.transaction.findMany({
      where: {
        familyId,
        deletedAt: null,
        type: query.type,
        categoryId: query.categoryId,
        accountId: query.accountId,
        transactionDate: {
          gte: query.from ? parseDateOnly(query.from) : undefined,
          lte: query.to ? parseDateOnly(query.to) : undefined,
        },
        ...(query.q ? { description: { contains: query.q, mode: 'insensitive' as const } } : {}),
      },
      include: {
        account: true,
        transferAccount: true,
        category: true,
        createdBy: true,
      },
      orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }],
      take: query.limit ?? 100,
    });

    return { transactions: transactions.map((t) => this.toTransactionResponse(t)) };
  }

  async getTransaction(familyId: string, transactionId: string): Promise<TransactionResponse> {
    const txn = await this.requireTransaction(familyId, transactionId);
    return this.toTransactionResponse(txn);
  }

  async createTransaction(
    familyId: string,
    actorId: string,
    input: CreateTransactionInput,
  ): Promise<TransactionResponse> {
    return this.createLedgerTransaction(familyId, actorId, input, {
      source: 'MANUAL',
      sourceReference: null,
    });
  }

  /**
   * Shared ledger write for manual + confirmed imports (ADR-013).
   * Imported rows must still pass the same validation rules.
   */
  async createLedgerTransaction(
    familyId: string,
    actorId: string,
    input: CreateTransactionInput,
    meta: { source: 'MANUAL' | 'IMPORT'; sourceReference: string | null },
  ): Promise<TransactionResponse> {
    const family = await this.requireFamily(familyId);
    await this.ensureDefaultCategories(familyId);

    const account = await this.requireAccount(familyId, input.accountId, { activeOnly: true });
    let transferAccount: FinancialAccount | null = null;
    if (input.type === 'TRANSFER') {
      transferAccount = await this.requireAccount(familyId, input.transferAccountId!, {
        activeOnly: true,
      });
    }

    let categoryId: string | null = null;
    if (input.type !== 'TRANSFER' && input.categoryId) {
      const category = await this.requireCategory(familyId, input.categoryId, {
        activeOnly: true,
      });
      if (category.kind !== input.type) {
        throw new BadRequestException({
          code: 'CATEGORY_KIND_MISMATCH',
          message: 'Category type must match the transaction type.',
        });
      }
      categoryId = category.id;
    }

    const created = await this.prisma.transaction.create({
      data: {
        id: createId(),
        familyId,
        type: input.type,
        amountMinor: parseAmountMinor(input.amountMinor),
        currency: input.currency ?? account.currency ?? family.defaultCurrency,
        accountId: account.id,
        transferAccountId: transferAccount?.id ?? null,
        categoryId,
        description: input.description?.trim() || null,
        transactionDate: parseDateOnly(input.transactionDate),
        source: meta.source,
        sourceReference: meta.sourceReference,
        createdById: actorId,
      },
      include: {
        account: true,
        transferAccount: true,
        category: true,
        createdBy: true,
      },
    });

    return this.toTransactionResponse(created);
  }

  async updateTransaction(
    familyId: string,
    transactionId: string,
    input: UpdateTransactionInput,
  ): Promise<TransactionResponse> {
    const existing = await this.requireTransaction(familyId, transactionId);
    const nextType = input.type ?? existing.type;

    const accountId = input.accountId ?? existing.accountId;
    const account = await this.requireAccount(familyId, accountId, { activeOnly: true });

    let transferAccountId: string | null =
      input.transferAccountId === undefined ? existing.transferAccountId : input.transferAccountId;

    if (nextType === 'TRANSFER') {
      if (!transferAccountId) {
        throw new BadRequestException({
          code: 'TRANSFER_ACCOUNT_REQUIRED',
          message: 'transferAccountId is required for transfers.',
        });
      }
      if (transferAccountId === accountId) {
        throw new BadRequestException({
          code: 'TRANSFER_SAME_ACCOUNT',
          message: 'Source and destination accounts must differ.',
        });
      }
      await this.requireAccount(familyId, transferAccountId, { activeOnly: true });
    } else {
      transferAccountId = null;
    }

    let categoryId: string | null =
      input.categoryId === undefined ? existing.categoryId : input.categoryId;
    if (nextType === 'TRANSFER') {
      categoryId = null;
    } else if (categoryId) {
      const category = await this.requireCategory(familyId, categoryId, { activeOnly: true });
      if (category.kind !== nextType) {
        throw new BadRequestException({
          code: 'CATEGORY_KIND_MISMATCH',
          message: 'Category type must match the transaction type.',
        });
      }
    }

    const updated = await this.prisma.transaction.update({
      where: { id: existing.id },
      data: {
        type: nextType,
        amountMinor:
          input.amountMinor === undefined ? undefined : parseAmountMinor(input.amountMinor),
        accountId: account.id,
        transferAccountId,
        categoryId,
        description:
          input.description === undefined ? undefined : input.description?.trim() || null,
        transactionDate:
          input.transactionDate === undefined ? undefined : parseDateOnly(input.transactionDate),
      },
      include: {
        account: true,
        transferAccount: true,
        category: true,
        createdBy: true,
      },
    });

    return this.toTransactionResponse(updated);
  }

  async deleteTransaction(familyId: string, transactionId: string) {
    const existing = await this.requireTransaction(familyId, transactionId);
    await this.prisma.transaction.update({
      where: { id: existing.id },
      data: { deletedAt: new Date() },
    });
    return { ok: true };
  }

  // ─── Summary / dashboard ──────────────────────────────────────────────────

  async getSummary(familyId: string, query: FinanceSummaryQuery): Promise<FinanceSummaryResponse> {
    const family = await this.requireFamily(familyId);
    await this.ensureDefaultCategories(familyId);

    const month = query.month ?? currentUtcMonth();
    const { from, to } = monthBounds(month);

    const [accountsList, monthTxns, recent] = await Promise.all([
      this.listAccounts(familyId),
      this.prisma.transaction.findMany({
        where: {
          familyId,
          deletedAt: null,
          transactionDate: { gte: from, lte: to },
        },
        include: { category: true },
      }),
      this.prisma.transaction.findMany({
        where: { familyId, deletedAt: null },
        include: {
          account: true,
          transferAccount: true,
          category: true,
          createdBy: true,
        },
        orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }],
        take: 8,
      }),
    ]);

    let income = 0n;
    let expense = 0n;
    let transfer = 0n;
    const byCategory = new Map<string, { name: string; amount: bigint }>();

    for (const txn of monthTxns) {
      if (txn.type === 'INCOME') {
        income += txn.amountMinor;
      } else if (txn.type === 'EXPENSE') {
        expense += txn.amountMinor;
        if (txn.categoryId && txn.category) {
          const prev = byCategory.get(txn.categoryId) ?? {
            name: txn.category.name,
            amount: 0n,
          };
          prev.amount += txn.amountMinor;
          byCategory.set(txn.categoryId, prev);
        } else {
          const key = '__uncategorized__';
          const prev = byCategory.get(key) ?? { name: 'Uncategorized', amount: 0n };
          prev.amount += txn.amountMinor;
          byCategory.set(key, prev);
        }
      } else if (txn.type === 'TRANSFER') {
        transfer += txn.amountMinor;
      }
    }

    const expensesByCategory = [...byCategory.entries()]
      .map(([categoryId, value]) => ({
        categoryId,
        name: value.name,
        amountMinor: moneyToString(value.amount),
      }))
      .sort((a, b) => Number(BigInt(b.amountMinor) - BigInt(a.amountMinor)));

    const budget = await this.budgets.getActiveProgressForMonth(familyId, month);

    return {
      month,
      currency: family.defaultCurrency,
      incomeMinor: moneyToString(income),
      expenseMinor: moneyToString(expense),
      netCashFlowMinor: moneyToString(income - expense),
      transferMinor: moneyToString(transfer),
      expensesByCategory,
      recentTransactions: recent.map((t: TxnWithRelations) => this.toTransactionResponse(t)),
      accounts: accountsList.accounts.filter((a) => a.isActive),
      budget,
    };
  }

  // ─── Internals ────────────────────────────────────────────────────────────

  private async requireFamily(familyId: string) {
    const family = await this.prisma.family.findFirst({
      where: { id: familyId, deletedAt: null },
    });
    if (!family) {
      throw new NotFoundException({ code: 'FAMILY_NOT_FOUND', message: 'Family not found.' });
    }
    return family;
  }

  private async requireActiveMember(familyId: string, userId: string) {
    const membership = await this.prisma.familyMembership.findFirst({
      where: { familyId, userId, status: 'ACTIVE' },
    });
    if (!membership) {
      throw new BadRequestException({
        code: 'OWNER_NOT_IN_FAMILY',
        message: 'Owner must be an active family member.',
      });
    }
  }

  private async requireAccount(
    familyId: string,
    accountId: string,
    opts: { activeOnly?: boolean } = {},
  ) {
    const account = await this.prisma.financialAccount.findFirst({
      where: {
        id: accountId,
        familyId,
        deletedAt: null,
        ...(opts.activeOnly ? { isActive: true } : {}),
      },
    });
    if (!account) {
      throw new NotFoundException({
        code: 'ACCOUNT_NOT_FOUND',
        message: 'Account not found.',
      });
    }
    return account;
  }

  private async requireCategory(
    familyId: string,
    categoryId: string,
    opts: { activeOnly?: boolean } = {},
  ) {
    const category = await this.prisma.transactionCategory.findFirst({
      where: {
        id: categoryId,
        familyId,
        ...(opts.activeOnly ? { isActive: true } : {}),
      },
    });
    if (!category) {
      throw new NotFoundException({
        code: 'CATEGORY_NOT_FOUND',
        message: 'Category not found.',
      });
    }
    return category;
  }

  private async requireTransaction(familyId: string, transactionId: string) {
    const txn = await this.prisma.transaction.findFirst({
      where: { id: transactionId, familyId, deletedAt: null },
      include: {
        account: true,
        transferAccount: true,
        category: true,
        createdBy: true,
      },
    });
    if (!txn) {
      throw new NotFoundException({
        code: 'TRANSACTION_NOT_FOUND',
        message: 'Transaction not found.',
      });
    }
    return txn;
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

  /**
   * Authoritative balance:
   * initial + income − expense − transfers_out + transfers_in
   */
  private async computeBalances(
    familyId: string,
    accountIds: string[],
  ): Promise<Map<string, bigint>> {
    const result = new Map<string, bigint>();
    if (accountIds.length === 0) return result;

    const accounts = await this.prisma.financialAccount.findMany({
      where: { familyId, id: { in: accountIds }, deletedAt: null },
    });
    for (const account of accounts) {
      result.set(account.id, account.initialBalanceMinor);
    }

    const txns = await this.prisma.transaction.findMany({
      where: {
        familyId,
        deletedAt: null,
        OR: [{ accountId: { in: accountIds } }, { transferAccountId: { in: accountIds } }],
      },
      select: {
        type: true,
        amountMinor: true,
        accountId: true,
        transferAccountId: true,
      },
    });

    for (const txn of txns) {
      if (txn.type === 'INCOME' && result.has(txn.accountId)) {
        result.set(txn.accountId, (result.get(txn.accountId) ?? 0n) + txn.amountMinor);
      } else if (txn.type === 'EXPENSE' && result.has(txn.accountId)) {
        result.set(txn.accountId, (result.get(txn.accountId) ?? 0n) - txn.amountMinor);
      } else if (txn.type === 'TRANSFER') {
        if (result.has(txn.accountId)) {
          result.set(txn.accountId, (result.get(txn.accountId) ?? 0n) - txn.amountMinor);
        }
        if (txn.transferAccountId && result.has(txn.transferAccountId)) {
          result.set(
            txn.transferAccountId,
            (result.get(txn.transferAccountId) ?? 0n) + txn.amountMinor,
          );
        }
      }
    }

    return result;
  }

  private toAccountResponse(
    account: AccountWithOwner,
    balanceMinor: bigint,
  ): FinancialAccountResponse {
    return {
      id: account.id,
      familyId: account.familyId,
      name: account.name,
      type: account.type,
      currency: account.currency,
      initialBalanceMinor: moneyToString(account.initialBalanceMinor),
      balanceMinor: moneyToString(balanceMinor),
      ownerUserId: account.ownerUserId,
      isActive: account.isActive,
      createdAt: account.createdAt.toISOString(),
      updatedAt: account.updatedAt.toISOString(),
    };
  }

  private toCategoryResponse(category: TransactionCategory): TransactionCategoryResponse {
    return {
      id: category.id,
      familyId: category.familyId,
      name: category.name,
      kind: category.kind,
      isSystem: category.isSystem,
      isActive: category.isActive,
      sortOrder: category.sortOrder,
      createdAt: category.createdAt.toISOString(),
      updatedAt: category.updatedAt.toISOString(),
    };
  }

  private toTransactionResponse(txn: TxnWithRelations): TransactionResponse {
    return {
      id: txn.id,
      familyId: txn.familyId,
      type: txn.type,
      amountMinor: moneyToString(txn.amountMinor),
      currency: txn.currency,
      account: {
        id: txn.account.id,
        name: txn.account.name,
        type: txn.account.type,
      },
      transferAccount: txn.transferAccount
        ? {
            id: txn.transferAccount.id,
            name: txn.transferAccount.name,
            type: txn.transferAccount.type,
          }
        : null,
      category: txn.category
        ? {
            id: txn.category.id,
            name: txn.category.name,
            kind: txn.category.kind,
          }
        : null,
      description: txn.description,
      transactionDate: formatDateOnly(txn.transactionDate),
      source: txn.source,
      sourceReference: txn.sourceReference ?? null,
      createdBy: {
        id: txn.createdBy.id,
        name: txn.createdBy.name,
        email: txn.createdBy.email,
      },
      createdAt: txn.createdAt.toISOString(),
      updatedAt: txn.updatedAt.toISOString(),
    };
  }
}
