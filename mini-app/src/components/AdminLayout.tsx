'use client';

import { ClipboardList, Plus, User } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';

import { getTelegramWebApp } from '@/lib/telegram';

import { BottomTabBar } from './BottomTabBar';

import type { ReactNode } from 'react';

type TAdminLayoutProps = {
  children: ReactNode;
};

export function AdminLayout({ children }: TAdminLayoutProps): ReactNode {
  const pathname = usePathname();
  const router = useRouter();
  const tn = useTranslations('Navigation');
  const isHome = pathname === '/admin' || pathname === '/admin/';
  const isBookPage = pathname === '/admin/book';

  const adminTabs = [
    {
      key: 'home',
      label: tn('bookings'),
      icon: ClipboardList,
      href: '/admin',
      matchPaths: ['/admin/recurring'],
    },
    { key: 'book', label: '', icon: Plus, href: '/admin/book', isCenter: true },
    { key: 'profile', label: tn('profile'), icon: User, href: '/admin/settings' },
  ];

  useEffect(() => {
    const webApp = getTelegramWebApp();
    if (!webApp) {
      return;
    }

    if (isHome) {
      webApp.BackButton.hide();
    } else {
      webApp.BackButton.show();
      const handler = (): void => router.push('/admin');
      webApp.BackButton.onClick(handler);
      return () => webApp.BackButton.offClick(handler);
    }
  }, [isHome, router]);

  return (
    <div className={'bg-background min-h-screen'} style={{ maxWidth: '430px', margin: '0 auto' }}>
      <div className={isBookPage ? '' : 'pb-24'}>{children}</div>
      {!isBookPage && <BottomTabBar tabs={adminTabs} />}
    </div>
  );
}
