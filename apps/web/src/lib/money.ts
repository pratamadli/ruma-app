/** Parse user-typed IDR amount (supports 150000 or 150.000) into minor-unit string. */
export function parseIdrInput(raw: string): string | null {
  const cleaned = raw.replace(/[^\d]/g, '');
  if (!cleaned) return null;
  if (!/^\d+$/.test(cleaned)) return null;
  if (cleaned.length > 15) return null;
  return cleaned.replace(/^0+(?=\d)/, '') || '0';
}

/** Format minor units for display, e.g. 150000 → "Rp 150.000". */
export function formatIdr(minor: string | null | undefined): string {
  if (minor == null || minor === '') return 'Rp 0';
  const negative = minor.startsWith('-');
  const digits = (negative ? minor.slice(1) : minor).replace(/\D/g, '') || '0';
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${negative ? '-' : ''}Rp ${grouped}`;
}

export function todayDateOnly(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function currentMonth(): string {
  return todayDateOnly().slice(0, 7);
}

export function monthLabel(month: string): string {
  const parts = month.split('-').map(Number);
  const y = parts[0] ?? 1970;
  const m = parts[1] ?? 1;
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });
}

export function shiftMonth(month: string, delta: number): string {
  const parts = month.split('-').map(Number);
  const y = parts[0] ?? 1970;
  const m = parts[1] ?? 1;
  const date = new Date(y, m - 1 + delta, 1);
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${yy}-${mm}`;
}

export function formatAccountType(type: string): string {
  return type.replaceAll('_', ' ');
}

export function formatPercent(value: number | null | undefined): string {
  if (value == null) return '—';
  const rounded = Math.round(value * 10) / 10;
  return `${rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1)}%`;
}
