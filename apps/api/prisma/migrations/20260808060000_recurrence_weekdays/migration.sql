-- Step 1: expand enum (must commit before use in some Postgres versions — Prisma runs this as one migration file)
ALTER TYPE "TaskRecurrence" ADD VALUE IF NOT EXISTS 'DAILY';
ALTER TYPE "TaskRecurrence" ADD VALUE IF NOT EXISTS 'CUSTOM_WEEKDAYS';
