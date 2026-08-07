import type { AnchorHTMLAttributes, HTMLAttributes, PropsWithChildren } from 'react';
import { cn } from './lib/cn';

export function Nav({
  className,
  children,
  ...props
}: PropsWithChildren<HTMLAttributes<HTMLElement>>) {
  return (
    <nav
      className={cn(
        'flex flex-wrap items-center gap-3 border-b border-[var(--ruma-color-border)] pb-4',
        className,
      )}
      {...props}
    >
      {children}
    </nav>
  );
}

export function NavBrand({
  className,
  children,
  ...props
}: PropsWithChildren<AnchorHTMLAttributes<HTMLAnchorElement>>) {
  return (
    <a
      className={cn(
        'mr-auto font-[family-name:var(--ruma-font-display)] text-[length:var(--ruma-text-xl)] font-bold tracking-tight text-[var(--ruma-color-ink)] no-underline',
        className,
      )}
      {...props}
    >
      {children}
    </a>
  );
}

export function NavLink({
  className,
  children,
  ...props
}: PropsWithChildren<AnchorHTMLAttributes<HTMLAnchorElement>>) {
  return (
    <a
      className={cn(
        'rounded-[var(--ruma-radius-sm)] px-3 py-2 text-[length:var(--ruma-text-sm)] font-medium text-[var(--ruma-color-ink-muted)] no-underline transition-colors hover:bg-black/5 hover:text-[var(--ruma-color-ink)]',
        className,
      )}
      {...props}
    >
      {children}
    </a>
  );
}
