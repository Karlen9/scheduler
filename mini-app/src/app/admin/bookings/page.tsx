'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { resolveTestAwareHref } from '@/lib/routes';

import type { ReactNode } from 'react';

/***************************************************************************************************
 * Renders the admin bookings redirect UI and related interactions.
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
export default function AdminBookingsRedirect(): ReactNode {
  /***************************************************************************************************
   * Defines the router value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    router.replace(resolveTestAwareHref(pathname, '/admin'));
  }, [pathname, router]);
  return null;
}
