import { z } from 'zod';
import {
  currencyCodeSchema,
  financeDateSchema,
  positiveAmountMinorSchema,
  transactionTypeSchema,
} from './finance';

const ulidLike = z.string().length(26);

export const connectSyntheticEmailSchema = z.object({
  emailAddress: z.string().trim().email().max(320).optional(),
});

export const completeGmailOAuthSchema = z.object({
  code: z.string().trim().min(1).max(2048),
});

export const importSyncSchema = z.object({
  lookbackDays: z.union([z.literal(7), z.literal(30), z.literal(90)]),
});

export const listImportCandidatesQuerySchema = z.preprocess(
  (value) => value ?? {},
  z.object({
    status: z.enum(['PENDING_REVIEW', 'CONFIRMED', 'IGNORED', 'FAILED']).optional(),
  }),
);

export const updateImportCandidateSchema = z
  .object({
    transactionType: transactionTypeSchema.optional(),
    amountMinor: positiveAmountMinorSchema.optional(),
    currency: currencyCodeSchema.optional(),
    transactionDate: financeDateSchema.optional(),
    description: z.string().trim().max(500).nullable().optional(),
    merchant: z.string().trim().max(200).nullable().optional(),
    accountId: ulidLike.nullable().optional(),
    categoryId: ulidLike.nullable().optional(),
    transferAccountId: ulidLike.nullable().optional(),
    categoryHint: z.string().trim().max(100).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  });

export const confirmImportCandidateSchema = z.preprocess(
  (value) => value ?? {},
  z.object({
    transactionType: transactionTypeSchema.optional(),
    amountMinor: positiveAmountMinorSchema.optional(),
    currency: currencyCodeSchema.optional(),
    transactionDate: financeDateSchema.optional(),
    description: z.string().trim().max(500).nullable().optional(),
    accountId: ulidLike.optional(),
    categoryId: ulidLike.nullable().optional(),
    transferAccountId: ulidLike.optional(),
  }),
);

export type ConnectSyntheticEmailInput = z.infer<typeof connectSyntheticEmailSchema>;
export type CompleteGmailOAuthInput = z.infer<typeof completeGmailOAuthSchema>;
export type ImportSyncInput = z.infer<typeof importSyncSchema>;
export type ListImportCandidatesQuery = z.infer<typeof listImportCandidatesQuerySchema>;
export type UpdateImportCandidateInput = z.infer<typeof updateImportCandidateSchema>;
export type ConfirmImportCandidateInput = z.infer<typeof confirmImportCandidateSchema>;
