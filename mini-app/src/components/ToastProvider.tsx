'use client';

import { Toaster } from 'sonner';

import type { ReactNode } from 'react';

/***************************************************************************************************
 * Renders the toast provider UI and related interactions.
 *
 * Parameters:
 * - None.
 *
 * Returns:
 * - The computed value for the current operation as ReactNode.
 *
 * Side effects:
 * - May derive UI state, invoke callbacks, and trigger user-facing rendering updates.
 ***************************************************************************************************/
export function ToastProvider(): ReactNode {
  return (
    <Toaster
      position={'top-center'}
      toastOptions={{
        style: {
          background: 'var(--card)',
          color: 'var(--foreground)',
          border: '1px solid var(--border)',
        },
      }}
    />
  );
}
