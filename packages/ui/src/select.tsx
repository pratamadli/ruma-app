import type { SelectHTMLAttributes } from 'react';
import { cn } from './lib/cn';
import { fieldControlClass } from './field-styles';
import { ChevronDownIcon } from './icons';

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export function Select({ className, children, ...props }: SelectProps) {
  return (
    <div className={cn('relative w-full', className)}>
      <select
        className={fieldControlClass(
          'appearance-none pr-10 [-webkit-appearance:none] [background-image:none]',
        )}
        {...props}
      >
        {children}
      </select>
      <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[var(--ruma-color-ink-muted)]">
        <ChevronDownIcon />
      </span>
    </div>
  );
}
