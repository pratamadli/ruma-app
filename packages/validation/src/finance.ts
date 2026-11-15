import { z } from 'zod';

const ulidLike = z.string().length(26);
export const unitsDecimalSchema = z
  .string()
  .regex(
    /^\d{1,16}(\.\d{1,8})?$/,
    'Use a positive decimal quantity with at most 8 fractional digits',
  )
  .refine((value) => /^[0-9.]+$/.test(value) && /[1-9]/.test(value), 'Quantity must be positive');

export const currencyCodeSchema = z
  .string()
  .trim()
  .length(3)
  .regex(/^[A-Z]{3}$/, 'currency must be a 3-letter ISO code')
  .default('IDR');

export const financeScopeSchema = z.enum(['PERSONAL', 'HOUSEHOLD']);
export const financeScopeQuerySchema = z.object({ scope: financeScopeSchema.optional() });

/** Calendar date YYYY-MM-DD (financial transaction date). */
export const financeDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD')
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, 'date must be a valid calendar date');

/** Positive integer minor units as decimal string (no floats). */
export const amountMinorSchema = z
  .string()
  .trim()
  .regex(/^[0-9]+$/, 'amount must be a non-negative integer string')
  .refine((value) => value.length <= 15, 'amount exceeds maximum precision')
  .refine(
    (value) => /^[0-9]+$/.test(value) && BigInt(value) <= 999_999_999_999_999n,
    'amount exceeds safe maximum',
  );

/** Strictly positive amount for income/expense/transfer. */
export const positiveAmountMinorSchema = amountMinorSchema.refine(
  (value) => /^[0-9]+$/.test(value) && BigInt(value) > 0n,
  'amount must be greater than zero',
);

export const financialAccountTypeSchema = z.enum([
  'BANK',
  'CASH',
  'E_WALLET',
  'CREDIT_CARD',
  'OTHER',
  'SAVINGS',
  'INVESTMENT',
]);

export const transactionTypeSchema = z.enum([
  'INCOME',
  'EXPENSE',
  'TRANSFER',
  'INVESTMENT_BUY',
  'INVESTMENT_SELL',
  'DIVIDEND',
  'BALANCE_ADJUSTMENT',
]);
export const categoryKindSchema = z.enum(['INCOME', 'EXPENSE', 'INVESTMENT']);

export const createFinancialAccountSchema = z.object({
  scope: financeScopeSchema.optional(),
  name: z.string().trim().min(1).max(120),
  type: financialAccountTypeSchema.optional(),
  currency: currencyCodeSchema.optional(),
  initialBalanceMinor: amountMinorSchema.optional(),
  ownerUserId: ulidLike.nullable().optional(),
});

export const updateFinancialAccountSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    type: financialAccountTypeSchema.optional(),
    ownerUserId: ulidLike.nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  });

export const createTransactionCategorySchema = z.object({
  name: z.string().trim().min(1).max(80),
  kind: categoryKindSchema,
});

export const updateTransactionCategorySchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  });

export const createTransactionSchema = z
  .object({
    scope: financeScopeSchema.optional(),
    payerUserId: ulidLike.optional(),
    adjustmentDirection: z.enum(['INCREASE', 'DECREASE']).optional(),
    idempotencyKey: z.string().min(8).max(120).optional(),
    instrumentName: z.string().trim().min(1).max(120).optional(),
    unitsDecimal: unitsDecimalSchema.optional(),
    unitPriceMinor: positiveAmountMinorSchema.optional(),
    feesMinor: amountMinorSchema.optional(),
    type: transactionTypeSchema,
    amountMinor: positiveAmountMinorSchema,
    accountId: ulidLike,
    transferAccountId: ulidLike.optional(),
    categoryId: ulidLike.nullable().optional(),
    description: z.string().trim().max(500).optional(),
    transactionDate: financeDateSchema,
    currency: currencyCodeSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (['TRANSFER', 'INVESTMENT_BUY', 'INVESTMENT_SELL'].includes(value.type)) {
      if (!value.transferAccountId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'transferAccountId is required for transfers',
          path: ['transferAccountId'],
        });
      } else if (value.transferAccountId === value.accountId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Source and destination accounts must differ',
          path: ['transferAccountId'],
        });
      }
      if (value.categoryId && value.type === 'TRANSFER') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Transfers cannot have a category',
          path: ['categoryId'],
        });
      }
    } else if (value.transferAccountId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'transferAccountId is only valid for transfers',
        path: ['transferAccountId'],
      });
    }
    if ((value.type === 'BALANCE_ADJUSTMENT') !== Boolean(value.adjustmentDirection)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['adjustmentDirection'],
        message: 'Only balance adjustments require an increase/decrease direction',
      });
    }
    const investment = ['INVESTMENT_BUY', 'INVESTMENT_SELL'].includes(value.type);
    if (
      !investment &&
      (value.instrumentName ||
        value.unitsDecimal ||
        value.unitPriceMinor ||
        (value.feesMinor && value.feesMinor !== '0'))
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Trade details only apply to investment buys/sells',
      });
    }
    if (Boolean(value.unitsDecimal) !== Boolean(value.unitPriceMinor))
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Quantity and unit price must be provided together',
      });
    if (
      value.type === 'INVESTMENT_SELL' &&
      value.feesMinor &&
      /^\d+$/.test(value.feesMinor) &&
      /^\d+$/.test(value.amountMinor) &&
      BigInt(value.feesMinor) >= BigInt(value.amountMinor)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Sale fees must be less than proceeds',
      });
    }
  });

export const updateTransactionSchema = z
  .object({
    instrumentName: z.string().trim().min(1).max(120).optional(),
    unitsDecimal: unitsDecimalSchema.optional(),
    unitPriceMinor: positiveAmountMinorSchema.optional(),
    feesMinor: amountMinorSchema.optional(),
    type: transactionTypeSchema.optional(),
    amountMinor: positiveAmountMinorSchema.optional(),
    accountId: ulidLike.optional(),
    transferAccountId: ulidLike.nullable().optional(),
    categoryId: ulidLike.nullable().optional(),
    description: z.string().trim().max(500).nullable().optional(),
    transactionDate: financeDateSchema.optional(),
    payerUserId: ulidLike.optional(),
    adjustmentDirection: z.enum(['INCREASE', 'DECREASE']).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  });

export const listTransactionsQuerySchema = z.preprocess(
  (value) => value ?? {},
  z.object({
    scope: financeScopeSchema.optional(),
    payerUserId: ulidLike.optional(),
    offset: z.coerce.number().int().min(0).max(100000).optional(),
    from: financeDateSchema.optional(),
    to: financeDateSchema.optional(),
    type: transactionTypeSchema.optional(),
    categoryId: ulidLike.optional(),
    accountId: ulidLike.optional(),
    q: z.string().trim().max(120).optional(),
    limit: z.coerce.number().int().min(1).max(200).optional(),
  }),
);

export const financeSummaryQuerySchema = z.preprocess(
  (value) => value ?? {},
  z.object({
    scope: financeScopeSchema.optional(),
    month: z
      .string()
      .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'month must be YYYY-MM')
      .optional(),
  }),
);

export const budgetPeriodMonthSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'month must be YYYY-MM');

export const budgetItemInputSchema = z.object({
  categoryId: ulidLike,
  amountMinor: amountMinorSchema,
});

export const createBudgetSchema = z
  .object({
    scope: financeScopeSchema.optional(),
    plannedIncomeMinor: amountMinorSchema.optional(),
    savingsAllocationMinor: amountMinorSchema.optional(),
    investmentAllocationMinor: amountMinorSchema.optional(),
    periodMonth: budgetPeriodMonthSchema,
    totalAmountMinor: amountMinorSchema.nullable().optional(),
    items: z.array(budgetItemInputSchema).max(50).optional(),
  })
  .superRefine((value, ctx) => {
    const items = value.items ?? [];
    const ids = items.map((item) => item.categoryId);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Duplicate category budgets are not allowed.',
        path: ['items'],
      });
    }
    if (value.totalAmountMinor == null && items.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide a household total and/or at least one category budget.',
        path: ['totalAmountMinor'],
      });
    }
  });

export const updateBudgetSchema = z
  .object({
    plannedIncomeMinor: amountMinorSchema.optional(),
    savingsAllocationMinor: amountMinorSchema.optional(),
    investmentAllocationMinor: amountMinorSchema.optional(),
    totalAmountMinor: amountMinorSchema.nullable().optional(),
    items: z.array(budgetItemInputSchema).max(50).optional(),
    status: z.enum(['ACTIVE', 'ARCHIVED']).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  })
  .superRefine((value, ctx) => {
    if (!value.items) return;
    const ids = value.items.map((item) => item.categoryId);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Duplicate category budgets are not allowed.',
        path: ['items'],
      });
    }
  });

export const getBudgetQuerySchema = z.preprocess(
  (value) => value ?? {},
  z.object({
    scope: financeScopeSchema.optional(),
    month: budgetPeriodMonthSchema.optional(),
  }),
);

export const financeAnalysisQuerySchema = z.preprocess(
  (value) => value ?? {},
  z.object({
    scope: financeScopeSchema.optional(),
    month: budgetPeriodMonthSchema.optional(),
    /** Number of months in the trend window ending at `month` (inclusive). */
    months: z.coerce.number().int().min(2).max(24).optional(),
  }),
);

export type CreateFinancialAccountInput = z.infer<typeof createFinancialAccountSchema>;
export type UpdateFinancialAccountInput = z.infer<typeof updateFinancialAccountSchema>;
export type CreateTransactionCategoryInput = z.infer<typeof createTransactionCategorySchema>;
export type UpdateTransactionCategoryInput = z.infer<typeof updateTransactionCategorySchema>;
export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
export type ListTransactionsQuery = z.infer<typeof listTransactionsQuerySchema>;
export type FinanceSummaryQuery = z.infer<typeof financeSummaryQuerySchema>;
export type CreateBudgetInput = z.infer<typeof createBudgetSchema>;
export type UpdateBudgetInput = z.infer<typeof updateBudgetSchema>;
export type GetBudgetQuery = z.infer<typeof getBudgetQuerySchema>;
export type FinanceAnalysisQuery = z.infer<typeof financeAnalysisQuerySchema>;

export const createFinanceGoalSchema = z.object({
  scope: financeScopeSchema.optional(),
  name: z.string().trim().min(1).max(120),
  targetAmountMinor: positiveAmountMinorSchema,
  currentAmountMinor: amountMinorSchema.optional(),
  targetDate: financeDateSchema.nullable().optional(),
});
export const updateFinanceGoalSchema = createFinanceGoalSchema
  .omit({ scope: true })
  .partial()
  .extend({
    status: z.enum(['ACTIVE', 'COMPLETED', 'ARCHIVED']).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required');
export type CreateFinanceGoalInput = z.infer<typeof createFinanceGoalSchema>;
export type UpdateFinanceGoalInput = z.infer<typeof updateFinanceGoalSchema>;
