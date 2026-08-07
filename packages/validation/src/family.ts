import { z } from 'zod';
import { emailSchema } from './email';

export const createFamilySchema = z.object({
  name: z.string().trim().min(1, 'Family name is required').max(80),
  householdName: z.string().trim().min(1).max(80).optional(),
  timezone: z.string().trim().min(1).max(64).optional(),
});

export const updateFamilySchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    householdName: z.string().trim().max(80).nullable().optional(),
    timezone: z.string().trim().min(1).max(64).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  });

export const createInvitationSchema = z.object({
  email: emailSchema,
  role: z.enum(['ADMIN', 'MEMBER']).default('MEMBER'),
});

export type CreateFamilyInput = z.infer<typeof createFamilySchema>;
export type UpdateFamilyInput = z.infer<typeof updateFamilySchema>;
export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;
