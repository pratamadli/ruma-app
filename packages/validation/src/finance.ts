import { z } from 'zod';

const ulidLike = z.string().length(26);

const currencyCodeSchema = z
  .string()
  .trim()
  .length(3)
  .regex(/^[A-Z]{3}$/, 'currency must be a 3-letter ISO code')
  .default('IDR');

/** Calendar date YYYY-MM-DD (financial transaction date). */
export const financeDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD');

/** Positive integer minor units as decimal string (no floats). */
export const amountMinorSchema = z
  .string()
  .trim()
  .regex(/^[0-9]+$/, 'amount must be a non-negative integer string')
  .refine((value) => value.length <= 15, 'amount exceeds maximum precision')
  .refine((value) => BigInt(value) >= 0n, 'amount must be non-negative')
  .refine((value) => BigInt(value) <= 999_999_999_999_999n, 'amount exceeds safe maximum');

/** Strictly positive amount for income/expense/transfer. */
export const positiveAmountMinorSchema = amountMinorSchema.refine(
  (value) => BigInt(value) > 0n,
  'amount must be greater than zero',
);

export const financialAccountTypeSchema = z.enum([
  'BANK',
  'CASH',
  'E_WALLET',
  'CREDIT_CARD',
  'OTHER',
]);

export const transactionTypeSchema = z.enum(['INCOME', 'EXPENSE', 'TRANSFER']);
export const categoryKindSchema = z.enum(['INCOME', 'EXPENSE']);

export const createFinancialAccountSchema = z.object({
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
    if (value.type === 'TRANSFER') {
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
      if (value.categoryId) {
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
  });

export const updateTransactionSchema = z
  .object({
    type: transactionTypeSchema.optional(),
    amountMinor: positiveAmountMinorSchema.optional(),
    accountId: ulidLike.optional(),
    transferAccountId: ulidLike.nullable().optional(),
    categoryId: ulidLike.nullable().optional(),
    description: z.string().trim().max(500).nullable().optional(),
    transactionDate: financeDateSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  });

export const listTransactionsQuerySchema = z.preprocess(
  (value) => value ?? {},
  z.object({
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
    month: z
      .string()
      .regex(/^\d{4}-\d{2}$/, 'month must be YYYY-MM')
      .optional(),
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
