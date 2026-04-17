'use client';

import { CalendarDays, ChartColumn, ClipboardList, Settings } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback, useMemo } from 'react';

import { resolveTestAwareHref } from '@/lib/routes';

import { BottomTabBar } from './BottomTabBar';
import { TelegramBackButtonProvider } from './TelegramBackButtonProvider';

import type { TAdminLayoutProps } from '@/lib/types';
import type { ReactNode } from 'react';

/***************************************************************************************************
 * Renders the admin layout UI and related interactions.
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
export function AdminLayout({ children }: TAdminLayoutProps): ReactNode {
  /***************************************************************************************************
   * Defines the pathname value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const pathname = usePathname();
  /***************************************************************************************************
   * Defines the router value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const router = useRouter();
  /***************************************************************************************************
   * Defines the tn value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const tn = useTranslations('Navigation');
  const adminHref = resolveTestAwareHref(pathname, '/admin');
  const adminBookHref = resolveTestAwareHref(pathname, '/admin/book');
  const adminAnalyticsHref = resolveTestAwareHref(pathname, '/admin/analytics');
  const adminBookingsHref = resolveTestAwareHref(pathname, '/admin/bookings');
  const adminRecurringHref = resolveTestAwareHref(pathname, '/admin/recurring');
  const adminSettingsHref = resolveTestAwareHref(pathname, '/admin/settings');
  /***************************************************************************************************
   * Defines the is home value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const isHome = pathname === adminHref || pathname === `${adminHref}/`;
  /***************************************************************************************************
   * Defines the is book page value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const isBookPage = pathname === adminBookHref;

  /***************************************************************************************************
   * Defines the admin tabs value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const adminTabs = useMemo(
    () => [
      {
        key: 'home',
        label: tn('bookings'),
        icon: ClipboardList,
        href: adminHref,
        matchPaths: [adminBookingsHref, adminRecurringHref],
      },
      {
        key: 'book',
        label: tn('adminBook'),
        icon: CalendarDays,
        href: adminBookHref,
        isCenter: true,
      },
      {
        key: 'analytics',
        label: tn('analytics'),
        icon: ChartColumn,
        href: adminAnalyticsHref,
      },
      {
        key: 'profile',
        label: tn('settings'),
        icon: Settings,
        href: adminSettingsHref,
        matchPaths: [adminSettingsHref],
      },
    ],
    [
      adminAnalyticsHref,
      adminBookHref,
      adminBookingsHref,
      adminHref,
      adminRecurringHref,
      adminSettingsHref,
      tn,
    ],
  );

  const handleBack = useCallback((): void => {
    router.push(adminHref);
  }, [adminHref, router]);

  return (
    <TelegramBackButtonProvider isRoot={isHome} onBack={handleBack}>
      <div className={'bg-background min-h-screen'} style={{ maxWidth: '430px', margin: '0 auto' }}>
        <div className={isBookPage ? '' : ''}>{children}</div>
        {!isBookPage && <BottomTabBar tabs={adminTabs} />}
      </div>
    </TelegramBackButtonProvider>
  );
}
