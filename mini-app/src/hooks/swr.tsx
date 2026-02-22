'use client';

import { SWRConfig } from 'swr';

import type { ReactNode } from 'react';

export function SWRProvider({ children }: { children: React.ReactNode }): ReactNode {
  return (
    <SWRConfig
      value={{
        revalidateOnFocus: true,
        dedupingInterval: 5000,
        errorRetryCount: 2,
      }}
    >
      {children}
    </SWRConfig>
  );
}
