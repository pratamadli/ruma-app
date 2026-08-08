import { cn } from './lib/cn';

/**
 * Shared control chrome. Use fixed `h-11` so native <select> matches <input>
 * (Safari often ignores vertical padding on selects).
 */
export const fieldControlBaseClassName =
  'box-border w-full h-11 rounded-[var(--ruma-radius-md)] border border-[var(--ruma-color-border)] bg-[var(--ruma-color-surface-elevated)] px-3 text-[length:var(--ruma-text-sm)] leading-none text-[var(--ruma-color-ink)] shadow-[var(--ruma-shadow-sm)] outline-none transition-[border-color,box-shadow,background-color] focus-visible:border-[var(--ruma-color-accent)] focus-visible:ring-2 focus-visible:ring-[color:var(--ruma-color-focus)] disabled:cursor-not-allowed disabled:opacity-60';

export function fieldControlClass(className?: string) {
  return cn(fieldControlBaseClassName, className);
}
