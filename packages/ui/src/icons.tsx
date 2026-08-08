import type { SVGProps } from 'react';
import { cn } from './lib/cn';

type IconProps = SVGProps<SVGSVGElement>;

export function CalendarIcon({ className, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={cn('h-[1.15rem] w-[1.15rem]', className)}
      {...props}
    >
      <rect
        x="3.5"
        y="5"
        width="17"
        height="15"
        rx="2.5"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path d="M8 3.5v3.5M16 3.5v3.5M3.5 10h17" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M8.5 14h2M13.5 14h2M8.5 17.5h2"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ChevronDownIcon({ className, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={cn('h-4 w-4', className)}
      {...props}
    >
      <path
        d="M6 9l6 6 6-6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Clean outline bell (Font Awesome–like), not emoji. */
export function BellIcon({ className, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={cn('h-5 w-5', className)}
      {...props}
    >
      <path
        d="M12 3.5a5 5 0 0 0-5 5v2.1c0 .7-.2 1.4-.6 2L5.2 14.4c-.5.7 0 1.6.8 1.6h12c.8 0 1.3-.9.8-1.6l-1.2-1.8c-.4-.6-.6-1.3-.6-2V8.5a5 5 0 0 0-5-5Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="M9.5 18a2.5 2.5 0 0 0 5 0"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}
