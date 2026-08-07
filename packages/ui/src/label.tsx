import type { LabelHTMLAttributes, PropsWithChildren } from 'react';
import { cn } from './lib/cn';

export type LabelProps = PropsWithChildren<LabelHTMLAttributes<HTMLLabelElement>>;

export function Label({ className, children, ...props }: LabelProps) {
  return (
    <label
      className={cn(
        'mb-2 block text-[length:var(--ruma-text-sm)] font-medium text-[var(--ruma-color-ink)]',
        className,
      )}
      {...props}
    >
      {children}
    </label>
  );
}
