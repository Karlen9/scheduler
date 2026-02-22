'use client';

import { ClipboardList, Plus, User } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';

import { BottomTabBar } from '@/components/BottomTabBar';
import { getTelegramWebApp, initTelegramApp } from '@/lib/telegram';

import type { ReactNode } from 'react';

export default function ClientLayout({ children }: { children: React.ReactNode }): ReactNode {
  const pathname = usePathname();
  const router = useRouter();
  const tn = useTranslations('Navigation');
  const isHome = pathname === '/' || pathname === '';
  const isBookPage = pathname === '/book';

  const clientTabs = [
    {
      key: 'bookings',
      label: tn('bookings'),
      icon: ClipboardList,
      href: '/bookings',
      matchPaths: ['/bookings', '/recurring'],
    },
    { key: 'book', label: '', icon: Plus, href: '/book', isCenter: true },
    { key: 'profile', label: tn('profile'), icon: User, href: '/profile' },
  ];

  useEffect(() => {
    initTelegramApp();
  }, []);

  useEffect(() => {
    const webApp = getTelegramWebApp();
    if (!webApp) {
      return;
    }

    if (isHome) {
      webApp.BackButton.hide();
    } else {
      webApp.BackButton.show();
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
