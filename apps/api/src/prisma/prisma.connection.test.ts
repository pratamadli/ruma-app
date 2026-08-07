import { afterAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.runIf(hasDatabase)('Prisma database connection', () => {
  const prisma = new PrismaClient();

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('connects and answers SELECT 1', async () => {
    const rows = await prisma.$queryRaw<{ ok: number }[]>`SELECT 1::int as ok`;
    expect(rows[0]?.ok).toBe(1);
  });
});
