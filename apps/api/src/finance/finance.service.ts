import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  type FinanceScope,
  type FinancialAccount,
  type Transaction,
  type TransactionCategory,
  type TransactionSource,
  type User,
} from '@prisma/client';
import { createHash } from 'node:crypto';
import { createTransactionSchema } from '@ruma/validation';
import { accessibleWhere, auditFinance, requireFinanceMember, scopeWhere } from './finance-access';
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

  async listAccounts(
    familyId: string,
    actorId: string,
    scope: FinanceScope = 'HOUSEHOLD',
  ): Promise<FinancialAccountListResponse> {
    await requireFinanceMember(this.prisma, familyId, actorId);
    const family = await this.requireFamily(familyId);
    await this.ensureDefaultCategories(familyId);

    const accounts = await this.prisma.financialAccount.findMany({
      where: { ...scopeWhere(familyId, actorId, scope), deletedAt: null },
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
    await requireFinanceMember(this.prisma, familyId, actorId);
    const family = await this.requireFamily(familyId);
    this.requireCurrency(input.currency ?? family.defaultCurrency);
    if (input.scope === 'PERSONAL' && input.ownerUserId && input.ownerUserId !== actorId) {
      throw new BadRequestException({
        code: 'INVALID_OWNER',
        message: 'Personal accounts must belong to you.',
      });
    }
    if (input.ownerUserId) {
      await this.requireActiveMember(familyId, input.ownerUserId);
    }

    const account = await this.prisma.$transaction(async (tx) => {
      const created = await tx.financialAccount.create({
        data: {
          id: createId(),
          familyId,
          name: input.name,
          type: input.type ?? 'BANK',
          currency: input.currency ?? family.defaultCurrency,
          initialBalanceMinor: parseAmountMinor(input.initialBalanceMinor ?? '0'),
          scope: input.scope ?? 'HOUSEHOLD',
          ownerUserId: input.scope === 'PERSONAL' ? actorId : (input.ownerUserId ?? null),
          createdById: actorId,
        },
      });
      await this.audit(tx, familyId, actorId, created.id, 'ACCOUNT_CREATED');
      return created;
    });

    return this.toAccountResponse(account, account.initialBalanceMinor);
  }

  async updateAccount(
    familyId: string,
    accountId: string,
    input: UpdateFinancialAccountInput,
    actorId: string,
  ): Promise<FinancialAccountResponse> {
    await requireFinanceMember(this.prisma, familyId, actorId);
    const account = await this.requireAccount(familyId, accountId, actorId);
    if (
      account.scope === 'PERSONAL' &&
      input.ownerUserId !== undefined &&
      input.ownerUserId !== actorId
    ) {
      throw new BadRequestException({
        code: 'INVALID_OWNER',
        message: 'Personal ownership cannot be changed.',
      });
    }
    if (input.type && input.type !== account.type) {
      const used = await this.prisma.transaction.count({
        where: { OR: [{ accountId }, { transferAccountId: accountId }] },
      });
      if (used)
        throw new BadRequestException({
          code: 'ACCOUNT_IN_USE',
          message: 'An account with history cannot change type.',
        });
    }
    if (input.ownerUserId) {
      await this.requireActiveMember(familyId, input.ownerUserId);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.financialAccount.update({
        where: { id: account.id },
        data: {
          name: input.name,
          type: input.type,
          ownerUserId: input.ownerUserId === undefined ? undefined : input.ownerUserId,
          isActive: input.isActive,
        },
      });
      await this.audit(tx, familyId, actorId, row.id, 'ACCOUNT_UPDATED');
      return row;
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
    actorId: string,
  ): Promise<TransactionCategoryResponse> {
    await requireFinanceMember(this.prisma, familyId, actorId);
    await this.ensureDefaultCategories(familyId);

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const category = await tx.transactionCategory.create({
          data: {
            id: createId(),
            familyId,
            name: input.name,
            kind: input.kind,
            isSystem: false,
            sortOrder: 500,
          },
        });
        await this.audit(tx, familyId, actorId, category.id, 'CATEGORY_CREATED');
        return category;
      });
      return this.toCategoryResponse(created);
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002')
        throw error;
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
    actorId: string,
  ): Promise<TransactionCategoryResponse> {
    await requireFinanceMember(this.prisma, familyId, actorId);
    const category = await this.requireCategory(familyId, categoryId);
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.transactionCategory.update({
        where: { id: category.id },
        data: {
          name: input.name,
          isActive: input.isActive,
        },
      });
      await this.audit(tx, familyId, actorId, row.id, 'CATEGORY_UPDATED');
      return row;
    });
    return this.toCategoryResponse(updated);
  }

  // ─── Transactions ─────────────────────────────────────────────────────────

  async listTransactions(
    familyId: string,
    query: ListTransactionsQuery,
    actorId: string,
  ): Promise<TransactionListResponse> {
    await requireFinanceMember(this.prisma, familyId, actorId);
    await this.requireFamily(familyId);
    await this.ensureDefaultCategories(familyId);

    const transactions = await this.prisma.transaction.findMany({
      where: {
        ...scopeWhere(familyId, actorId, query.scope),
        deletedAt: null,
        payerUserId: query.payerUserId,
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
      orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
      take: (query.limit ?? 100) + 1,
      skip: query.offset ?? 0,
    });

    const limit = query.limit ?? 100;
    return {
      transactions: transactions.slice(0, limit).map((t) => this.toTransactionResponse(t)),
      nextOffset: transactions.length > limit ? (query.offset ?? 0) + limit : null,
    };
  }

  async getTransaction(
    familyId: string,
    transactionId: string,
    actorId: string,
  ): Promise<TransactionResponse & { receiptIds: string[] }> {
    await requireFinanceMember(this.prisma, familyId, actorId);
    const txn = await this.requireTransaction(familyId, transactionId, actorId);
    const receipts = await this.prisma.financeReceipt.findMany({
      where: { familyId, transactionId: txn.id },
      select: { id: true },
    });
    return {
      ...this.toTransactionResponse(txn),
      receiptIds: receipts.map((receipt) => receipt.id),
    };
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
    meta: { source: TransactionSource; sourceReference: string | null },
    db?: Prisma.TransactionClient,
  ): Promise<TransactionResponse> {
    const parsed = createTransactionSchema.safeParse(input);
    if (!parsed.success)
      throw new BadRequestException({
        code: 'INVALID_TRANSACTION',
        message: parsed.error.issues.map((i) => i.message).join('; '),
      });
    input = parsed.data;
    const key = meta.sourceReference
      ? `${meta.source}:${meta.sourceReference}`
      : input.idempotencyKey
        ? `${actorId}:${input.idempotencyKey}`
        : null;
    const hash = createHash('sha256')
      .update(
        JSON.stringify({
          ...input,
          scope: input.scope ?? 'HOUSEHOLD',
          currency: input.currency ?? 'IDR',
          payerUserId: input.payerUserId ?? actorId,
        }),
      )
      .digest('hex');
    const write = async (tx: Prisma.TransactionClient) => {
      await requireFinanceMember(tx, familyId, actorId);
      if (key) {
        const previous = await tx.transaction.findUnique({
          where: { familyId_idempotencyKey: { familyId, idempotencyKey: key } },
          include: { account: true, transferAccount: true, category: true, createdBy: true },
        });
        if (previous) {
          if (previous.requestHash !== hash || previous.deletedAt)
            throw new ConflictException({
              code: 'IDEMPOTENCY_CONFLICT',
              message: 'This request key has already been used.',
            });
          return this.toTransactionResponse(previous);
        }
      }
      const data = await this.validateLedgerInput(tx, familyId, actorId, input);
      const created = await tx.transaction.create({
        data: {
          id: createId(),
          familyId,
          ...data,
          source: meta.source,
          sourceReference: meta.sourceReference,
          createdById: actorId,
          idempotencyKey: key,
          requestHash: hash,
        },
        include: { account: true, transferAccount: true, category: true, createdBy: true },
      });
      await this.audit(tx, familyId, actorId, created.id, 'TRANSACTION_CREATED');
      return this.toTransactionResponse(created);
    };
    if (db) return write(db);
    try {
      return await this.prisma.$transaction(write);
    } catch (error) {
      if (
        !key ||
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== 'P2002'
      )
        throw error;
      return this.prisma.$transaction(write);
    }
  }

  async updateTransaction(
    familyId: string,
    transactionId: string,
    input: UpdateTransactionInput,
    actorId: string,
  ): Promise<TransactionResponse> {
    await requireFinanceMember(this.prisma, familyId, actorId);
    const existing = await this.requireTransaction(familyId, transactionId, actorId);
    const type = input.type ?? existing.type;
    const movement = ['TRANSFER', 'INVESTMENT_BUY', 'INVESTMENT_SELL'].includes(type);
    const merged = createTransactionSchema.safeParse({
      scope: existing.scope,
      type,
      currency: existing.currency,
      instrumentName: type.startsWith('INVESTMENT_')
        ? (input.instrumentName ?? existing.instrumentName ?? undefined)
        : undefined,
      unitsDecimal: type.startsWith('INVESTMENT_')
        ? (input.unitsDecimal ?? existing.unitsDecimal ?? undefined)
        : undefined,
      unitPriceMinor: type.startsWith('INVESTMENT_')
        ? (input.unitPriceMinor ?? existing.unitPriceMinor?.toString())
        : undefined,
      feesMinor: type.startsWith('INVESTMENT_')
        ? (input.feesMinor ?? existing.feesMinor.toString())
        : '0',
      payerUserId: input.payerUserId ?? existing.payerUserId ?? existing.createdById,
      amountMinor: input.amountMinor ?? existing.amountMinor.toString(),
      accountId: input.accountId ?? existing.accountId,
      transferAccountId: movement
        ? (input.transferAccountId ?? existing.transferAccountId ?? undefined)
        : undefined,
      categoryId:
        type === 'TRANSFER'
          ? null
          : input.categoryId === undefined
            ? existing.categoryId
            : input.categoryId,
      description:
        input.description === undefined
          ? (existing.description ?? undefined)
          : (input.description ?? undefined),
      transactionDate: input.transactionDate ?? formatDateOnly(existing.transactionDate),
      adjustmentDirection:
        type === 'BALANCE_ADJUSTMENT'
          ? (input.adjustmentDirection ?? existing.adjustmentDirection)
          : undefined,
    });
    if (!merged.success)
      throw new BadRequestException({
        code: 'INVALID_TRANSACTION',
        message: merged.error.issues.map((i) => i.message).join('; '),
      });
    const updated = await this.prisma.$transaction(async (tx) => {
      const data = await this.validateLedgerInput(tx, familyId, actorId, merged.data);
      const row = await tx.transaction.update({
        where: { id: existing.id },
        data,
        include: { account: true, transferAccount: true, category: true, createdBy: true },
      });
      await this.audit(tx, familyId, actorId, existing.id, 'TRANSACTION_UPDATED');
      return row;
    });
    return this.toTransactionResponse(updated);
  }

  async deleteTransaction(familyId: string, transactionId: string, actorId: string) {
    await requireFinanceMember(this.prisma, familyId, actorId);
    const existing = await this.requireTransaction(familyId, transactionId, actorId);
    await this.prisma.$transaction(async (tx) => {
      await tx.transaction.update({
        where: { id: existing.id },
        data: { deletedAt: new Date() },
      });
      await this.audit(tx, familyId, actorId, existing.id, 'TRANSACTION_VOIDED');
    });
    return { ok: true };
  }

  // ─── Summary / dashboard ──────────────────────────────────────────────────

  async getSummary(
    familyId: string,
    query: FinanceSummaryQuery,
    actorId: string,
  ): Promise<FinanceSummaryResponse> {
    await requireFinanceMember(this.prisma, familyId, actorId);
    const family = await this.requireFamily(familyId);
    await this.ensureDefaultCategories(familyId);

    const month = query.month ?? currentUtcMonth();
    const { from, to } = monthBounds(month);

    const [accountsList, monthTxns, recent] = await Promise.all([
      this.listAccounts(familyId, actorId, query.scope),
      this.prisma.transaction.findMany({
        where: {
          ...scopeWhere(familyId, actorId, query.scope),
          deletedAt: null,
          transactionDate: { gte: from, lte: to },
        },
        include: { category: true },
      }),
      this.prisma.transaction.findMany({
        where: { ...scopeWhere(familyId, actorId, query.scope), deletedAt: null },
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
    let investmentBuy = 0n;
    let investmentSell = 0n;
    let dividend = 0n;
    let investmentFees = 0n;
    const byCategory = new Map<string, { name: string; amount: bigint }>();

    for (const txn of monthTxns) {
      investmentFees += txn.feesMinor;
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
      } else if (txn.type === 'INVESTMENT_BUY') {
        investmentBuy += txn.amountMinor;
      } else if (txn.type === 'INVESTMENT_SELL') {
        investmentSell += txn.amountMinor;
      } else if (txn.type === 'DIVIDEND') {
        dividend += txn.amountMinor;
      }
    }

    const expensesByCategory = [...byCategory.entries()]
      .map(([categoryId, value]) => ({
        categoryId,
        name: value.name,
        amountMinor: moneyToString(value.amount),
      }))
      .sort((a, b) => Number(BigInt(b.amountMinor) - BigInt(a.amountMinor)));

    const budget = await this.budgets.getActiveProgressForMonth(
      familyId,
      month,
      actorId,
      query.scope,
    );

    return {
      scope: query.scope ?? 'HOUSEHOLD',
      investmentBuyMinor: investmentBuy.toString(),
      investmentSellMinor: investmentSell.toString(),
      dividendMinor: dividend.toString(),
      investmentFeesMinor: investmentFees.toString(),
      month,
      currency: family.defaultCurrency,
      incomeMinor: moneyToString(income),
      expenseMinor: moneyToString(expense),
      netCashFlowMinor: moneyToString(income + dividend - expense),
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
    actorId: string,
    opts: { activeOnly?: boolean } = {},
  ) {
    const account = await this.prisma.financialAccount.findFirst({
      where: {
        id: accountId,
        ...accessibleWhere(familyId, actorId),
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

  private async requireTransaction(familyId: string, transactionId: string, actorId: string) {
    const txn = await this.prisma.transaction.findFirst({
      where: { id: transactionId, ...accessibleWhere(familyId, actorId), deletedAt: null },
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
        adjustmentDirection: true,
        feesMinor: true,
      },
    });

    for (const txn of txns) {
      if (
        (txn.type === 'INCOME' ||
          txn.type === 'DIVIDEND' ||
          (txn.type === 'BALANCE_ADJUSTMENT' && txn.adjustmentDirection === 'INCREASE')) &&
        result.has(txn.accountId)
      ) {
        result.set(txn.accountId, (result.get(txn.accountId) ?? 0n) + txn.amountMinor);
      } else if (
        (txn.type === 'EXPENSE' ||
          (txn.type === 'BALANCE_ADJUSTMENT' && txn.adjustmentDirection === 'DECREASE')) &&
        result.has(txn.accountId)
      ) {
        result.set(txn.accountId, (result.get(txn.accountId) ?? 0n) - txn.amountMinor);
      } else if (['TRANSFER', 'INVESTMENT_BUY', 'INVESTMENT_SELL'].includes(txn.type)) {
        if (result.has(txn.accountId)) {
          result.set(
            txn.accountId,
            (result.get(txn.accountId) ?? 0n) -
              txn.amountMinor -
              (txn.type === 'INVESTMENT_BUY' ? txn.feesMinor : 0n),
          );
        }
        if (txn.transferAccountId && result.has(txn.transferAccountId)) {
          result.set(
            txn.transferAccountId,
            (result.get(txn.transferAccountId) ?? 0n) +
              txn.amountMinor -
              (txn.type === 'INVESTMENT_SELL' ? txn.feesMinor : 0n),
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
      scope: account.scope,
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
      instrumentName: txn.instrumentName,
      unitsDecimal: txn.unitsDecimal,
      unitPriceMinor: txn.unitPriceMinor?.toString() ?? null,
      feesMinor: txn.feesMinor.toString(),
      scope: txn.scope,
      ownerUserId: txn.ownerUserId,
      payerUserId: txn.payerUserId,
      adjustmentDirection: txn.adjustmentDirection,
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

  private requireCurrency(currency: string) {
    if (currency !== 'IDR')
      throw new BadRequestException({
        code: 'UNSUPPORTED_CURRENCY',
        message: 'Only IDR is supported for new finance records.',
      });
  }

  async validateLedgerInput(
    db: Prisma.TransactionClient,
    familyId: string,
    actorId: string,
    input: CreateTransactionInput,
  ) {
    if (input.unitsDecimal && input.unitPriceMinor) {
      const [whole, fraction = ''] = input.unitsDecimal.split('.');
      const units = BigInt(`${whole}${fraction.padEnd(8, '0')}`);
      const principal = (units * BigInt(input.unitPriceMinor) + 50_000_000n) / 100_000_000n;
      if (principal !== BigInt(input.amountMinor))
        throw new BadRequestException({
          code: 'TRADE_AMOUNT_MISMATCH',
          message:
            'Amount must equal quantity times unit price, rounded to the nearest rupiah, excluding fees.',
        });
    }
    const scope = input.scope ?? 'HOUSEHOLD';
    const account = await db.financialAccount.findFirst({
      where: {
        id: input.accountId,
        ...scopeWhere(familyId, actorId, scope),
        deletedAt: null,
        isActive: true,
      },
    });
    if (!account)
      throw new NotFoundException({
        code: 'ACCOUNT_NOT_FOUND',
        message: 'Account not found in this scope.',
      });
    this.requireCurrency(input.currency ?? account.currency);
    if (account.currency !== (input.currency ?? 'IDR'))
      throw new BadRequestException({
        code: 'CURRENCY_MISMATCH',
        message: 'Account currency must match the transaction.',
      });
    let destination: FinancialAccount | null = null;
    if (input.transferAccountId) {
      destination = await db.financialAccount.findFirst({
        where: {
          id: input.transferAccountId,
          ...scopeWhere(familyId, actorId, scope),
          deletedAt: null,
          isActive: true,
        },
      });
      if (!destination)
        throw new NotFoundException({
          code: 'ACCOUNT_NOT_FOUND',
          message: 'Destination account not found in this scope.',
        });
      if (destination.currency !== account.currency)
        throw new BadRequestException({
          code: 'CURRENCY_MISMATCH',
          message: 'Accounts must use the same currency.',
        });
    }
    if (
      input.type === 'INVESTMENT_BUY' &&
      (destination?.type !== 'INVESTMENT' || account.type === 'INVESTMENT')
    ) {
      throw new BadRequestException({
        code: 'INVESTMENT_ACCOUNTS',
        message: 'Buy moves cash to an investment account.',
      });
    }
    if (
      input.type === 'INVESTMENT_SELL' &&
      (account.type !== 'INVESTMENT' || destination?.type === 'INVESTMENT')
    ) {
      throw new BadRequestException({
        code: 'INVESTMENT_ACCOUNTS',
        message: 'Sell moves investment value to a cash account.',
      });
    }
    if (input.categoryId) {
      const category = await db.transactionCategory.findFirst({
        where: { id: input.categoryId, familyId, isActive: true },
      });
      const kind = ['INVESTMENT_BUY', 'INVESTMENT_SELL', 'DIVIDEND'].includes(input.type)
        ? 'INVESTMENT'
        : input.type;
      if (!category || category.kind !== kind)
        throw new BadRequestException({
          code: 'CATEGORY_KIND_MISMATCH',
          message: 'Choose a valid category for this transaction type.',
        });
    }
    await requireFinanceMember(db, familyId, input.payerUserId ?? actorId);
    if (scope === 'PERSONAL' && input.payerUserId && input.payerUserId !== actorId)
      throw new BadRequestException({
        code: 'INVALID_PAYER',
        message: 'Personal records must use your identity.',
      });
    return {
      scope,
      ownerUserId: scope === 'PERSONAL' ? actorId : null,
      payerUserId: input.payerUserId ?? actorId,
      type: input.type,
      amountMinor: BigInt(input.amountMinor),
      currency: account.currency,
      accountId: account.id,
      transferAccountId: destination?.id ?? null,
      categoryId: input.categoryId ?? null,
      description: input.description?.trim() || null,
      transactionDate: parseDateOnly(input.transactionDate),
      adjustmentDirection: input.adjustmentDirection ?? null,
      instrumentName: input.instrumentName ?? null,
      unitsDecimal: input.unitsDecimal ?? null,
      unitPriceMinor: input.unitPriceMinor ? BigInt(input.unitPriceMinor) : null,
      feesMinor: BigInt(input.feesMinor ?? '0'),
    };
  }

  async audit(
    db: Prisma.TransactionClient,
    familyId: string,
    actorId: string,
    resourceId: string,
    action: string,
  ) {
    await auditFinance(db, familyId, actorId, resourceId, action);
  }
}
