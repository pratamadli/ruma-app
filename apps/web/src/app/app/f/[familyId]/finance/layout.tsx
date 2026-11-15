import type { ReactNode } from 'react';
import { FinanceScopeProvider } from '@/components/finance-scope';

export default function FinanceLayout({ children }: { children: ReactNode }) {
  return <FinanceScopeProvider>{children}</FinanceScopeProvider>;
}
