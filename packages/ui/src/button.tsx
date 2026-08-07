import type { ButtonHTMLAttributes, PropsWithChildren } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './lib/cn';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 font-[family-name:var(--ruma-font-body)] text-[length:var(--ruma-text-sm)] font-semibold leading-none rounded-[var(--ruma-radius-md)] transition-[transform,opacity,background-color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ruma-color-focus)] disabled:cursor-not-allowed disabled:opacity-55',
  {
    variants: {
      variant: {
        primary:
          'bg-[var(--ruma-color-ink)] text-[var(--ruma-color-surface)] border border-[var(--ruma-color-ink)] shadow-[var(--ruma-shadow-sm)] hover:opacity-95',
        secondary:
          'bg-[var(--ruma-color-accent-soft)] text-[var(--ruma-color-ink)] border border-[var(--ruma-color-border)] hover:bg-[color-mix(in_srgb,var(--ruma-color-accent-soft),white_25%)]',
        ghost:
          'bg-transparent text-[var(--ruma-color-ink)] border border-transparent hover:bg-black/5',
        danger:
          'bg-[var(--ruma-color-danger)] text-white border border-[var(--ruma-color-danger)] shadow-[var(--ruma-shadow-sm)]',
      },
      size: {
        default: 'px-[1.1rem] py-[0.7rem]',
        sm: 'px-3 py-2 text-xs',
        lg: 'px-5 py-3 text-base',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'default',
    },
  },
);

export type ButtonProps = PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>
>;

export function Button({
  variant,
  size,
  className,
  type = 'button',
  children,
  ...props
}: ButtonProps) {
  return (
    <button type={type} className={cn(buttonVariants({ variant, size }), className)} {...props}>
      {children}
    </button>
  );
}
