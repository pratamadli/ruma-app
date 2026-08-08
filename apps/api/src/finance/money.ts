/** Serialize BIGINT money for JSON APIs (never Number). */
export function moneyToString(value: bigint): string {
  return value.toString();
}

export function parseAmountMinor(value: string): bigint {
  return BigInt(value);
}

export function formatDateOnly(value: Date): string {
  const y = value.getUTCFullYear();
  const m = String(value.getUTCMonth() + 1).padStart(2, '0');
  const d = String(value.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Parse YYYY-MM-DD into a UTC noon Date so Prisma @db.Date stores the calendar day stably. */
export function parseDateOnly(value: string): Date {
  const parts = value.split('-').map(Number);
  const y = parts[0] ?? 0;
  const m = parts[1] ?? 1;
  const d = parts[2] ?? 1;
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

export function monthBounds(month: string): { from: Date; to: Date; label: string } {
  const [yearStr, monthStr] = month.split('-');
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  const from = new Date(Date.UTC(year, monthIndex, 1, 12, 0, 0));
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const to = new Date(Date.UTC(year, monthIndex, lastDay, 12, 0, 0));
  return { from, to, label: month };
}

export function currentUtcMonth(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}
