import { z } from 'zod';
import { emailSchema } from './email';
import {
  amountMinorSchema,
  createTransactionSchema,
  financeDateSchema,
  financeScopeSchema,
  financeSummaryQuerySchema,
  unitsDecimalSchema,
} from './finance';

export const telegramIdSchema = z.string().regex(/^[1-9]\d{0,15}$/);
export const telegramConnectSchema = z.object({
  email: emailSchema,
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-F0-9]{4}(?:-[A-F0-9]{4}){5}$/),
});
export type TelegramConnectInput = z.infer<typeof telegramConnectSchema>;
export const draftInputSchema = z.object({
  transaction: createTransactionSchema,
  idempotencyKey: z.string().min(8).max(120),
});
export const hermesToolSchema = z.discriminatedUnion('tool', [
  z.object({ tool: z.literal('get_finance_context') }),
  z.object({
    tool: z.literal('list_accounts'),
    familyId: z.string().length(26),
    scope: financeScopeSchema,
  }),
  z.object({ tool: z.literal('list_categories'), familyId: z.string().length(26) }),
  z.object({
    tool: z.literal('create_transaction_draft'),
    familyId: z.string().length(26),
    input: draftInputSchema,
  }),
  z.object({
    tool: z.literal('confirm_transaction'),
    familyId: z.string().length(26),
    draftId: z.string().length(26),
  }),
  z.object({
    tool: z.literal('get_monthly_summary'),
    familyId: z.string().length(26),
    query: financeSummaryQuerySchema,
  }),
]);
export const telegramUpdateSchema = z.object({
  update_id: z.number().int().nonnegative(),
  message: z
    .object({
      text: z.string().max(4000).optional(),
      from: z.object({ id: z.number().int().positive().max(Number.MAX_SAFE_INTEGER) }),
      chat: z.object({ id: z.number().int(), type: z.string() }),
    })
    .optional(),
  callback_query: z
    .object({
      id: z.string(),
      data: z.string().max(64),
      from: z.object({ id: z.number().int().positive().max(Number.MAX_SAFE_INTEGER) }),
      message: z.object({ chat: z.object({ id: z.number().int(), type: z.string() }) }),
    })
    .optional(),
});
export type DraftInput = z.infer<typeof draftInputSchema>;
export type HermesToolInput = z.infer<typeof hermesToolSchema>;
export type TelegramUpdate = z.infer<typeof telegramUpdateSchema>;

export const investmentPositionSchema = z.object({
  scope: financeScopeSchema,
  accountId: z.string().length(26),
  instrumentName: z.string().trim().min(1).max(120),
  assetType: z.enum(['STOCK', 'FUND', 'BOND', 'GOLD', 'CRYPTO', 'OTHER']),
  unitsDecimal: unitsDecimalSchema,
});
export const updatePositionSchema = investmentPositionSchema
  .omit({ scope: true, accountId: true })
  .partial()
  .extend({ isActive: z.boolean().optional() })
  .refine((input) => Object.keys(input).length > 0, 'At least one field is required');
export const investmentValuationSchema = z.object({
  valuationDate: financeDateSchema,
  valueMinor: amountMinorSchema,
});
export const financeTimezoneSchema = z
  .string()
  .max(100)
  .refine((value) => {
    try {
      new Intl.DateTimeFormat('en', { timeZone: value }).format();
      return true;
    } catch {
      return false;
    }
  }, 'Use a supported IANA timezone');
const financeScheduleFields = z.object({
  scope: financeScopeSchema,
  kind: z.enum(['REMINDER', 'MONTHLY_REPORT']),
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional(),
  dueAt: z.string().datetime({ offset: true }).optional(),
  timezone: financeTimezoneSchema,
  deliveryDay: z.number().int().min(1).max(28).default(1),
  deliveryHour: z.number().int().min(0).max(23).default(9),
  deliveryMinute: z.number().int().min(0).max(59).default(0),
  recipientIds: z.array(z.string().length(26)).max(100).default([]),
});
export const financeScheduleSchema = financeScheduleFields.refine(
  (input) => input.kind !== 'REMINDER' || Boolean(input.dueAt),
  'A reminder needs a due date/time',
);
export const updateFinanceScheduleSchema = financeScheduleFields
  .omit({ scope: true, kind: true })
  .partial()
  .extend({ enabled: z.boolean().optional() })
  .refine((input) => Object.keys(input).length > 0, 'At least one field is required');
export const toggleScheduleSchema = z.object({ enabled: z.boolean() });
export type InvestmentPositionInput = z.infer<typeof investmentPositionSchema>;
export type UpdatePositionInput = z.infer<typeof updatePositionSchema>;
export type InvestmentValuationInput = z.infer<typeof investmentValuationSchema>;
export type FinanceScheduleInput = z.infer<typeof financeScheduleSchema>;
export type UpdateFinanceScheduleInput = z.infer<typeof updateFinanceScheduleSchema>;
