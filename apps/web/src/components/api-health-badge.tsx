'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchHealth } from '@/lib/api';

export function ApiHealthBadge() {
  const health = useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth,
    retry: false,
  });

  const label = health.isLoading
    ? 'Checking API…'
    : health.isSuccess
      ? `API ${health.data.status}`
      : 'API offline';

  return (
    <p
      style={{
        margin: 0,
        fontSize: 'var(--ruma-text-sm)',
        color: 'var(--ruma-color-ink-muted)',
      }}
      aria-live="polite"
    >
      {label}
    </p>
  );
}
