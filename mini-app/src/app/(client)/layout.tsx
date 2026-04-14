'use client';

import { CalendarDays, House, User } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback, useMemo } from 'react';

import { BottomTabBar } from '@/components/BottomTabBar';
import { TelegramBackButtonProvider } from '@/components/TelegramBackButtonProvider';
import { resolveTestAwareHref } from '@/lib/routes';

import type { ReactNode } from 'react';

/***************************************************************************************************
 * Renders the client layout UI and related interactions.
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
export default function ClientLayout({ children }: { children: React.ReactNode }): ReactNode {
  /***************************************************************************************************
   * Defines the pathname value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const pathname = usePathname();
  /***************************************************************************************************
   * Defines the router value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const router = useRouter();
  /***************************************************************************************************
   * Defines the tn value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const tn = useTranslations('Navigation');
  const homeHref = resolveTestAwareHref(pathname, '/');
  const bookHref = resolveTestAwareHref(pathname, '/book');
  const bookingsHref = resolveTestAwareHref(pathname, '/bookings');
  const recurringHref = resolveTestAwareHref(pathname, '/recurring');
  const profileHref = resolveTestAwareHref(pathname, '/profile');
  /***************************************************************************************************
   * Defines the is home value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const isHome = pathname === homeHref || pathname === `${homeHref}/` || pathname === '';
  /***************************************************************************************************
   * Defines the is book page value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const isBookPage = pathname === bookHref;

  /***************************************************************************************************
   * Defines the client tabs value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const clientTabs = useMemo(
    () => [
      {
        key: 'specialist',
        label: tn('specialist'),
        icon: House,
        href: homeHref,
      },
      { key: 'book', label: tn('book'), icon: CalendarDays, href: bookHref, isCenter: true },
      {
        key: 'bookings',
        label: tn('bookings'),
        icon: CalendarDays,
        href: bookingsHref,
        matchPaths: [bookingsHref, recurringHref],
      },
      { key: 'profile', label: tn('profile'), icon: User, href: profileHref },
    ],
    [bookHref, bookingsHref, homeHref, profileHref, recurringHref, tn],
  );

  const handleBack = useCallback((): void => {
    router.push(homeHref);
  }, [homeHref, router]);

  return (
    <TelegramBackButtonProvider isRoot={isHome} onBack={handleBack}>
      <div className={'bg-background min-h-screen'} style={{ maxWidth: '430px', margin: '0 auto' }}>
        <div className={isBookPage ? '' : 'pb-24'}>{children}</div>
        {!isBookPage && <BottomTabBar tabs={clientTabs} />}
      </div>
    </TelegramBackButtonProvider>
  );
}
