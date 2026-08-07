'use client';

import type { PropsWithChildren, ReactNode } from 'react';
import { cn } from './lib/cn';
import { Button } from './button';

export type DialogProps = PropsWithChildren<{
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  footer?: ReactNode;
}>;

export function Dialog({ open, title, description, onClose, footer, children }: DialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4" role="presentation">
      <button
        type="button"
        aria-label="Close dialog overlay"
        className="absolute inset-0 bg-[rgb(25_25_25_/_0.28)] backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="ruma-dialog-title"
        className={cn(
          'relative z-10 w-full max-w-md rounded-[var(--ruma-radius-lg)] border border-[var(--ruma-color-border)] bg-[var(--ruma-color-surface-elevated)] p-[var(--ruma-space-5)] shadow-[var(--ruma-shadow-md)]',
        )}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2
              id="ruma-dialog-title"
              className="m-0 text-[length:var(--ruma-text-xl)] font-semibold"
            >
              {title}
            </h2>
            {description ? (
              <p className="mt-2 mb-0 text-[length:var(--ruma-text-sm)] text-[var(--ruma-color-ink-muted)]">
                {description}
              </p>
            ) : null}
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
            Close
          </Button>
        </div>
        <div>{children}</div>
        {footer ? <div className="mt-5 flex justify-end gap-2">{footer}</div> : null}
      </div>
    </div>
  );
}
