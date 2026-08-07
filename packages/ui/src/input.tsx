import type { InputHTMLAttributes } from 'react';
import { cn } from './lib/cn';

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

export function Input({ className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        'w-full rounded-[var(--ruma-radius-md)] border border-[var(--ruma-color-border)] bg-[var(--ruma-color-surface-elevated)] px-3 py-[0.7rem] text-[length:var(--ruma-text-sm)] text-[var(--ruma-color-ink)] shadow-[var(--ruma-shadow-sm)] outline-none transition-[border-color,box-shadow] placeholder:text-[var(--ruma-color-ink-muted)] focus-visible:border-[var(--ruma-color-accent)] focus-visible:ring-2 focus-visible:ring-[color:var(--ruma-color-focus)] disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
      {...props}
    />
  );
}
