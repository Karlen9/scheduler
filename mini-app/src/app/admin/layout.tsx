'use client';

import { useEffect } from 'react';

import { AdminLayout } from '@/components/AdminLayout';
import { initTelegramApp } from '@/lib/telegram';

import type { ReactNode } from 'react';

/***************************************************************************************************
 * Renders the admin root layout UI and related interactions.
 *
 * Parameters:
 * - props: Component props that drive rendering and callbacks.
 *
 * Returns:
 * - The computed value for the current operation as ReactNode.
 *
 * Side effects:
 * - May derive UI state, invoke callbacks, and trigger user-facing rendering updates.
 ***************************************************************************************************/
export default function AdminRootLayout({ children }: { children: React.ReactNode }): ReactNode {
  useEffect(() => {
    initTelegramApp();
  }, []);

  return <AdminLayout>{children}</AdminLayout>;
}
