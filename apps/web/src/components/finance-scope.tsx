'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import type { FinanceScope } from '@ruma/types';
import { Button } from '@ruma/ui';

const Context = createContext<{
  scope: FinanceScope;
  setScope: (scope: FinanceScope) => void;
} | null>(null);

export function FinanceScopeProvider({ children }: { children: ReactNode }) {
  const [scope, setScope] = useState<FinanceScope>('HOUSEHOLD');
  return <Context.Provider value={{ scope, setScope }}>{children}</Context.Provider>;
}

export function useFinanceScope() {
  const context = useContext(Context);
  if (!context) throw new Error('FinanceScopeProvider is required');
  return context;
}

export function FinanceScopePicker({ onChange }: { onChange?: () => void }) {
  const { scope, setScope } = useFinanceScope();
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Finance scope">
      {(['PERSONAL', 'HOUSEHOLD'] as const).map((value) => (
        <Button
          key={value}
          size="sm"
          variant={scope === value ? 'primary' : 'ghost'}
          aria-pressed={scope === value}
          onClick={() => {
            setScope(value);
            onChange?.();
          }}
        >
          {value === 'PERSONAL' ? 'Personal' : 'Household'}
        </Button>
      ))}
      <span className="text-sm text-[var(--ruma-color-ink-muted)]">
        {scope === 'PERSONAL' ? 'Visible only to you' : 'Shared with your household'}
      </span>
    </div>
  );
}
