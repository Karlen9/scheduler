'use client';

import { SWRConfig } from 'swr';

import type { ReactNode } from 'react';

const swrCache = new Map();

/***************************************************************************************************
 * Renders the swrprovider UI and related interactions.
 *
 * Parameters:
 * - props: Component props that drive rendering and callbacks.
 *
 * Returns:
 * - The computed value for the current operation as ReactNode.
 *
 * Side effects:
 * - May trigger SWR fetches, cache reads, cache writes, or React-driven revalidation.
 ***************************************************************************************************/
export function SWRProvider({ children }: { children: React.ReactNode }): ReactNode {
  return (
    <SWRConfig
      value={{
        provider: () => swrCache,
        revalidateOnFocus: false,
        revalidateOnReconnect: false,
        revalidateIfStale: false,
        dedupingInterval: 30000,
        errorRetryCount: 2,
      }}
    >
      {children}
    </SWRConfig>
  );
}
