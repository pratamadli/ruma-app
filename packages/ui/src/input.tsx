import type { InputHTMLAttributes } from 'react';
import { fieldControlClass } from './field-styles';

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

export function Input({ className, type, ...props }: InputProps) {
  const dateLike = type === 'date' || type === 'datetime-local' || type === 'time';
  return (
    <input
      type={type}
      className={fieldControlClass(
        [
          'placeholder:text-[var(--ruma-color-ink-muted)]',
          dateLike
            ? 'appearance-none [color-scheme:light] [&::-webkit-calendar-picker-indicator]:opacity-60 [&::-webkit-calendar-picker-indicator]:hover:opacity-100'
            : null,
          className,
        ]
          .filter(Boolean)
          .join(' '),
      )}
      {...props}
    />
  );
}
