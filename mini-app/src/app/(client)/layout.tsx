'use client';

import { ClipboardList, Plus, User } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo } from 'react';

import { BottomTabBar } from '@/components/BottomTabBar';
import { getTelegramWebApp } from '@/lib/telegram';

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
  /***************************************************************************************************
   * Defines the is home value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const isHome = pathname === '/' || pathname === '';
  /***************************************************************************************************
   * Defines the is book page value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const isBookPage = pathname === '/book';

  /***************************************************************************************************
   * Defines the client tabs value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const clientTabs = useMemo(
    () => [
      {
        key: 'bookings',
        label: tn('bookings'),
        icon: ClipboardList,
        href: '/bookings',
        matchPaths: ['/bookings', '/recurring'],
      },
      { key: 'book', label: '', icon: Plus, href: '/book', isCenter: true },
      { key: 'profile', label: tn('profile'), icon: User, href: '/profile' },
    ],
    [tn],
  );

  useEffect(() => {
    /***************************************************************************************************
     * Defines the web app value used by the page layer.
     *
     * Usage context:
     * - Reused by the page layer to keep shared values centralized.
     ***************************************************************************************************/
    const webApp = getTelegramWebApp();
    if (!webApp) {
      return;
    }

    if (isHome) {
      webApp.BackButton.hide();
    } else {
      webApp.BackButton.show();
      /***************************************************************************************************
       * Defines the handler value used by the page layer.
       *
       * Usage context:
       * - Reused by the page layer to keep shared values centralized.
       ***************************************************************************************************/
      const handler = (): void => router.push('/');
      webApp.BackButton.onClick(handler);
      return () => webApp.BackButton.offClick(handler);
    }
  }, [isHome, router]);

  return (
    <div className={'bg-background min-h-screen'} style={{ maxWidth: '430px', margin: '0 auto' }}>
      <div className={isBookPage ? '' : 'pb-24'}>{children}</div>
      {!isBookPage && <BottomTabBar tabs={clientTabs} />}
    </div>
  );
}
