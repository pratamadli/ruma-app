import type { HTMLAttributes, PropsWithChildren } from 'react';
import { cn } from './lib/cn';

export function Card({
  className,
  children,
  ...props
}: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) {
  return (
    <div
      className={cn(
        'rounded-[var(--ruma-radius-lg)] border border-[var(--ruma-color-border)] bg-[var(--ruma-color-surface-elevated)] p-[var(--ruma-space-5)] shadow-[var(--ruma-shadow-md)]',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardTitle({
  className,
  children,
  ...props
}: PropsWithChildren<HTMLAttributes<HTMLHeadingElement>>) {
  return (
    <h3
      className={cn(
        'm-0 font-[family-name:var(--ruma-font-display)] text-[length:var(--ruma-text-xl)] font-semibold tracking-tight',
        className,
      )}
      {...props}
    >
      {children}
    </h3>
  );
}

export function CardDescription({
  className,
  children,
  ...props
}: PropsWithChildren<HTMLAttributes<HTMLParagraphElement>>) {
  return (
    <p
      className={cn(
        'mt-2 mb-0 text-[length:var(--ruma-text-sm)] text-[var(--ruma-color-ink-muted)]',
        className,
      )}
      {...props}
    >
      {children}
    </p>
  );
}
