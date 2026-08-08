import { cn } from './lib/cn';

/** Shared control chrome for Input, Select, and native date/time fields. */
export const fieldControlBaseClassName =
  'w-full min-h-[2.75rem] rounded-[var(--ruma-radius-md)] border border-[var(--ruma-color-border)] bg-[var(--ruma-color-surface-elevated)] px-3 py-[0.7rem] text-[length:var(--ruma-text-sm)] leading-normal text-[var(--ruma-color-ink)] shadow-[var(--ruma-shadow-sm)] outline-none transition-[border-color,box-shadow] focus-visible:border-[var(--ruma-color-accent)] focus-visible:ring-2 focus-visible:ring-[color:var(--ruma-color-focus)] disabled:cursor-not-allowed disabled:opacity-60';

export function fieldControlClass(className?: string) {
  return cn(fieldControlBaseClassName, className);
}
