import type { CategoryKind } from '@prisma/client';

/** Seeded once per family on first finance access. Names may evolve; uniqueness is (familyId, name, kind). */
export const DEFAULT_TRANSACTION_CATEGORIES: ReadonlyArray<{
  name: string;
  kind: CategoryKind;
  sortOrder: number;
}> = [
  { name: 'Salary', kind: 'INCOME', sortOrder: 10 },
  { name: 'Business', kind: 'INCOME', sortOrder: 20 },
  { name: 'Other Income', kind: 'INCOME', sortOrder: 30 },
  { name: 'Food & Dining', kind: 'EXPENSE', sortOrder: 110 },
  { name: 'Groceries', kind: 'EXPENSE', sortOrder: 120 },
  { name: 'Transportation', kind: 'EXPENSE', sortOrder: 130 },
  { name: 'Utilities', kind: 'EXPENSE', sortOrder: 140 },
  { name: 'Housing', kind: 'EXPENSE', sortOrder: 150 },
  { name: 'Shopping', kind: 'EXPENSE', sortOrder: 160 },
  { name: 'Entertainment', kind: 'EXPENSE', sortOrder: 170 },
  { name: 'Healthcare', kind: 'EXPENSE', sortOrder: 180 },
  { name: 'Education', kind: 'EXPENSE', sortOrder: 190 },
  { name: 'Travel', kind: 'EXPENSE', sortOrder: 200 },
  { name: 'Subscriptions', kind: 'EXPENSE', sortOrder: 210 },
  { name: 'Other', kind: 'EXPENSE', sortOrder: 220 },
];
