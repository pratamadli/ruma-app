import type { SVGProps } from 'react';
import { cn } from './lib/cn';

type MarkProps = SVGProps<SVGSVGElement> & {
  /** Small sage doorway under the roof. Hide for tiny favicons. */
  showDoor?: boolean;
};

/** Geometric R + house mark. Uses `currentColor` for ink; door uses brand sage. */
export function RumaMark({ className, showDoor = true, ...props }: MarkProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden={props['aria-label'] ? undefined : true}
      className={cn('block text-[var(--ruma-color-ink)]', className)}
      {...props}
    >
      <g stroke="currentColor" strokeWidth="4" strokeLinecap="square" strokeLinejoin="miter">
        <path d="M16 10v44" />
        <path d="M16 10h18c9 0 15 6 15 15s-6 15-15 15H16" />
        <path d="M36 40l14 14" />
        <path d="M24 24l8-8 8 8" />
      </g>
      {showDoor ? (
        <rect
          x="29"
          y="26"
          width="6"
          height="9"
          rx="1.5"
          fill="var(--ruma-color-accent, #6F806F)"
        />
      ) : null}
    </svg>
  );
}

function OpenA({ className }: { className?: string }) {
  return (
    <span className={cn('relative inline-block w-[0.82em] align-baseline', className)} aria-hidden>
      <span className="invisible">A</span>
      <svg viewBox="0 0 28 28" className="absolute inset-0 h-full w-full" fill="none" aria-hidden>
        <path
          d="M4 24 L14 6 L24 24"
          stroke="currentColor"
          strokeWidth="2.75"
          strokeLinecap="square"
          strokeLinejoin="miter"
        />
      </svg>
    </span>
  );
}

/** Letters after the mark: UM + open A → reads as RUMA with the mark as R. */
function UmaLetters({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-baseline font-[family-name:var(--ruma-font-display)] font-bold tracking-[0.12em]',
        className,
      )}
    >
      UM
      <OpenA />
    </span>
  );
}

/** Standalone wordmark (no mark): full RUMA with open A. */
export function RumaWordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-baseline font-[family-name:var(--ruma-font-display)] text-[length:var(--ruma-text-2xl)] font-bold tracking-[0.12em] text-[var(--ruma-color-ink)]',
        className,
      )}
      aria-label="RUMA"
    >
      RUM
      <OpenA />
    </span>
  );
}

type LockupProps = {
  className?: string;
  showDoor?: boolean;
  withTagline?: boolean;
};

/** Mark + UMA letters (+ optional tagline). Mark serves as the leading R. */
export function RumaLockup({ className, showDoor = true, withTagline = false }: LockupProps) {
  return (
    <div
      className={cn('flex flex-col items-start gap-3 text-[var(--ruma-color-ink)]', className)}
      role="img"
      aria-label={withTagline ? "RUMA — Your family's second brain" : 'RUMA'}
    >
      <div className="flex items-center gap-3">
        <RumaMark className="h-12 w-12 shrink-0 sm:h-14 sm:w-14" showDoor={showDoor} />
        <UmaLetters className="text-4xl sm:text-5xl" />
      </div>
      {withTagline ? (
        <div className="flex max-w-sm flex-col gap-2 pl-[3.75rem] sm:pl-[4.25rem]">
          <div className="h-0.5 w-11 bg-[var(--ruma-color-accent,#6F806F)]" />
          <p className="m-0 text-[0.7rem] font-medium tracking-[0.16em] text-[var(--ruma-color-ink-muted)] uppercase sm:text-xs">
            Your family&apos;s second brain
          </p>
        </div>
      ) : null}
    </div>
  );
}

type BrandLinkProps = {
  className?: string;
  markClassName?: string;
  showDoor?: boolean;
  /** 'mark' | 'wordmark' | 'lockup' */
  variant?: 'mark' | 'wordmark' | 'lockup';
};

/** Compact horizontal brand for nav: mark (as R) + UMA. */
export function RumaBrand({
  className,
  markClassName,
  showDoor = true,
  variant = 'lockup',
}: BrandLinkProps) {
  if (variant === 'mark') {
    return <RumaMark className={cn('h-8 w-8', markClassName, className)} showDoor={showDoor} />;
  }
  if (variant === 'wordmark') {
    return <RumaWordmark className={className} />;
  }
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 text-[var(--ruma-color-ink)] sm:gap-2.5',
        className,
      )}
      aria-label="RUMA"
    >
      <RumaMark
        className={cn('h-7 w-7 shrink-0 sm:h-8 sm:w-8', markClassName)}
        showDoor={showDoor}
      />
      <UmaLetters className="text-lg sm:text-[length:var(--ruma-text-xl)]" />
    </span>
  );
}
