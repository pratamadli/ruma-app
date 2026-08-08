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
        {/* Stem */}
        <path d="M16 10v44" />
        {/* Bowl */}
        <path d="M16 10h18c9 0 15 6 15 15s-6 15-15 15H16" />
        {/* Leg */}
        <path d="M36 40l14 14" />
        {/* Roof (house) */}
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

/** Wordmark with open A (roof) — tracking matches Swiss lockup. */
export function RumaWordmark({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 200 40"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden={props['aria-label'] ? undefined : true}
      className={cn('block text-[var(--ruma-color-ink)]', className)}
      {...props}
    >
      <g
        fontFamily="var(--ruma-font-display, ui-sans-serif, system-ui, sans-serif)"
        fontWeight="700"
      >
        <text x="0" y="30" fontSize="32" letterSpacing="0.22em">
          RUM
        </text>
      </g>
      {/* Open A / roof */}
      <path
        d="M152 30 L166 8 L180 30"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
    </svg>
  );
}

type LockupProps = SVGProps<SVGSVGElement> & {
  showDoor?: boolean;
  withTagline?: boolean;
};

/** Mark + wordmark (+ optional tagline) for marketing / landing. */
export function RumaLockup({
  className,
  showDoor = true,
  withTagline = false,
  ...props
}: LockupProps) {
  const height = withTagline ? 96 : 64;
  return (
    <svg
      viewBox={`0 0 280 ${height}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={props['aria-label'] ?? 'RUMA'}
      className={cn('block text-[var(--ruma-color-ink)]', className)}
      {...props}
    >
      <g transform="translate(0 0)">
        <g
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="square"
          strokeLinejoin="miter"
          transform="translate(0 4) scale(0.9)"
        >
          <path d="M16 10v44" />
          <path d="M16 10h18c9 0 15 6 15 15s-6 15-15 15H16" />
          <path d="M36 40l14 14" />
          <path d="M24 24l8-8 8 8" />
        </g>
        {showDoor ? (
          <rect
            x="26.1"
            y="27.4"
            width="5.4"
            height="8.1"
            rx="1.35"
            fill="var(--ruma-color-accent, #6F806F)"
            transform="translate(0 4)"
          />
        ) : null}
      </g>

      <g
        fill="currentColor"
        fontFamily="var(--ruma-font-display, ui-sans-serif, system-ui, sans-serif)"
        fontWeight="700"
        transform="translate(72 8)"
      >
        <text x="0" y="36" fontSize="36" letterSpacing="0.28em">
          RUM
        </text>
      </g>
      <path
        d="M232 44 L248 18 L264 44"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />

      {withTagline ? (
        <>
          <line
            x1="72"
            y1="62"
            x2="120"
            y2="62"
            stroke="var(--ruma-color-accent, #6F806F)"
            strokeWidth="2"
          />
          <text
            x="72"
            y="84"
            fill="currentColor"
            opacity="0.65"
            fontFamily="var(--ruma-font-body, ui-sans-serif, system-ui, sans-serif)"
            fontSize="11"
            fontWeight="500"
            letterSpacing="0.22em"
          >
            YOUR FAMILY’S SECOND BRAIN
          </text>
        </>
      ) : null}
    </svg>
  );
}

type BrandLinkProps = {
  className?: string;
  markClassName?: string;
  showDoor?: boolean;
  /** 'mark' | 'wordmark' | 'lockup' */
  variant?: 'mark' | 'wordmark' | 'lockup';
};

/** Compact horizontal brand for nav: mark + RUMA wordmark. */
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
    return <RumaWordmark className={cn('h-7 w-auto', className)} />;
  }
  return (
    <span
      className={cn('inline-flex items-center gap-2.5 text-[var(--ruma-color-ink)]', className)}
    >
      <RumaMark className={cn('h-8 w-8 shrink-0', markClassName)} showDoor={showDoor} />
      <span className="font-[family-name:var(--ruma-font-display)] text-[length:var(--ruma-text-xl)] font-bold tracking-[0.22em]">
        RUM
        <span className="relative inline-block w-[0.85em]" aria-hidden>
          <span className="invisible">A</span>
          <svg
            viewBox="0 0 28 28"
            className="absolute inset-0 h-full w-full"
            fill="none"
            aria-hidden
          >
            <path
              d="M4 24 L14 6 L24 24"
              stroke="currentColor"
              strokeWidth="2.75"
              strokeLinecap="square"
              strokeLinejoin="miter"
            />
          </svg>
        </span>
      </span>
    </span>
  );
}
