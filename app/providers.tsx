'use client';

import type { ReactNode } from 'react';
import { AuthProvider } from '../src/context/AuthContext';
import { CrmProvider } from '../src/context/CrmContext';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <CrmProvider>{children}</CrmProvider>
    </AuthProvider>
  );
}
