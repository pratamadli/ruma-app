import { z } from 'zod';

const ulidLike = z.string().length(26);

export const taskStatusSchema = z.enum(['TODO', 'IN_PROGRESS', 'COMPLETED']);
export const taskPrioritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH']);

/** ISO weekday: 1 = Monday … 7 = Sunday */
export const recurrenceWeekdaysSchema = z
  .array(z.number().int().min(1).max(7))
  .max(7)
  .transform((days) => [...new Set(days)].sort((a, b) => a - b));

export const taskRecurrenceSchema = z.enum([
  'NONE',
  'DAILY',
  'WEEKLY',
  'MONTHLY',
  'YEARLY',
  'CUSTOM_WEEKDAYS',
]);

const recurrenceFields = {
  recurrence: taskRecurrenceSchema.optional(),
  recurrenceWeekdays: recurrenceWeekdaysSchema.optional(),
};

function refineRecurrence<T extends { recurrence?: string; recurrenceWeekdays?: number[] }>(
  value: T,
  ctx: z.RefinementCtx,
) {
  const recurrence = value.recurrence ?? 'NONE';
  const days = value.recurrenceWeekdays ?? [];
  if (recurrence === 'CUSTOM_WEEKDAYS' && days.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Select at least one weekday for custom recurrence.',
      path: ['recurrenceWeekdays'],
    });
  }
  if (
    recurrence !== 'CUSTOM_WEEKDAYS' &&
    days.length > 0 &&
    value.recurrenceWeekdays !== undefined
  ) {
    // Allow clients to send []; ignore non-empty for non-custom by clearing expectation
  }
}

export const createTaskSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(2000).optional(),
    status: taskStatusSchema.optional(),
    priority: taskPrioritySchema.optional(),
    assignedToId: ulidLike.nullable().optional(),
    dueDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'dueDate must be YYYY-MM-DD')
      .nullable()
      .optional(),
    ...recurrenceFields,
  })
  .superRefine(refineRecurrence);

export const updateTaskSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    status: taskStatusSchema.optional(),
    priority: taskPrioritySchema.optional(),
    assignedToId: ulidLike.nullable().optional(),
    dueDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'dueDate must be YYYY-MM-DD')
      .nullable()
      .optional(),
    ...recurrenceFields,
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  })
  .superRefine(refineRecurrence);

export const createGroceryItemSchema = z.object({
  name: z.string().trim().min(1).max(200),
  quantity: z.string().trim().max(80).optional(),
  category: z.string().trim().max(80).optional(),
  assignedToId: ulidLike.nullable().optional(),
});

export const updateGroceryItemSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    quantity: z.string().trim().max(80).nullable().optional(),
    category: z.string().trim().max(80).nullable().optional(),
    assignedToId: ulidLike.nullable().optional(),
    isCompleted: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  });

export const createFamilyEventSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(2000).optional(),
    location: z.string().trim().max(200).optional(),
    startAt: z.string().datetime({ offset: true }),
    endAt: z.string().datetime({ offset: true }).nullable().optional(),
    allDay: z.boolean().optional(),
    ...recurrenceFields,
  })
  .refine((value) => !value.endAt || value.endAt >= value.startAt, {
    message: 'endAt must be after startAt',
    path: ['endAt'],
  })
  .superRefine(refineRecurrence);

export const updateFamilyEventSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    location: z.string().trim().max(200).nullable().optional(),
    startAt: z.string().datetime({ offset: true }).optional(),
    endAt: z.string().datetime({ offset: true }).nullable().optional(),
    allDay: z.boolean().optional(),
    ...recurrenceFields,
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  })
  .superRefine(refineRecurrence);

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type CreateGroceryItemInput = z.infer<typeof createGroceryItemSchema>;
export type UpdateGroceryItemInput = z.infer<typeof updateGroceryItemSchema>;
export type CreateFamilyEventInput = z.infer<typeof createFamilyEventSchema>;
export type UpdateFamilyEventInput = z.infer<typeof updateFamilyEventSchema>;
