'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';

export function ActivityTabs() {
  const pathname = usePathname();
  const t = useTranslations('ActivityTabs');

  const tabs = [
    { label: t('bookings'), href: '/bookings' },
    { label: t('book'), href: '/book' },
    { label: t('schedule'), href: '/recurring' },
  ];

  return (
    <div className="px-4 pt-4 pb-2">
      <div className="bg-tab-bar flex rounded-full p-1">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href || pathname.startsWith(tab.href + '/');
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex-1 rounded-full py-2 text-center text-sm font-medium transition-colors ${
                isActive ? 'bg-tab-bar-indicator text-foreground' : 'text-muted-foreground'
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
