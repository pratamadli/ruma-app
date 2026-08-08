import type { InputHTMLAttributes } from 'react';
import { cn } from './lib/cn';
import { fieldControlClass } from './field-styles';
import { CalendarIcon } from './icons';

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

export function Input({ className, type, ...props }: InputProps) {
  const dateLike = type === 'date' || type === 'datetime-local' || type === 'time';

  if (dateLike) {
    return (
      <div className={cn('relative w-full', className)}>
        <span className="pointer-events-none absolute top-1/2 left-3 z-[1] -translate-y-1/2 text-[var(--ruma-color-accent)]">
          <CalendarIcon />
        </span>
        <input
          type={type}
          className={fieldControlClass(
            [
              'h-12 border-[color-mix(in_srgb,var(--ruma-color-accent)_28%,var(--ruma-color-border))]',
              'bg-[color-mix(in_srgb,var(--ruma-color-accent-soft)_55%,var(--ruma-color-surface-elevated))]',
              'pl-11 pr-3 font-medium tracking-wide text-[var(--ruma-color-ink)]',
              'appearance-none [color-scheme:light]',
              '[&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-y-0 [&::-webkit-calendar-picker-indicator]:right-2',
              '[&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-10',
              '[&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0',
            ].join(' '),
          )}
          {...props}
        />
        <span
          aria-hidden
          className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[var(--ruma-color-ink-muted)]"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
            <path
              d="M8 10l4 4 4-4"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </div>
    );
  }

  return (
    <input
      type={type}
      className={fieldControlClass(cn('placeholder:text-[var(--ruma-color-ink-muted)]', className))}
      {...props}
    />
  );
}
