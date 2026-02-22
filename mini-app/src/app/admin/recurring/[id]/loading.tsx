import { useTranslations } from 'next-intl';

import { TopBar } from '@/components';

import type { ReactNode } from 'react';

export function Loading(): ReactNode {
  const tp = useTranslations('RecurringPage');

  return (
    <div>
      <TopBar title={tp('regularSchedule')} showBack />
      <div className={'space-y-4 p-4'}>
        <div className={'bg-card animate-pulse rounded-xl p-4'}>
          <div className={'bg-border mb-4 h-5 w-1/3 rounded'} />
          <div className={'bg-border mb-3 h-4 w-2/3 rounded'} />
          <div className={'bg-border mb-3 h-4 w-1/2 rounded'} />
          <div className={'bg-border h-4 w-2/5 rounded'} />
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className={'bg-card animate-pulse rounded-xl p-4'}>
            <div className={'bg-border mb-3 h-4 w-1/2 rounded'} />
            <div className={'bg-border mb-2 h-4 w-1/3 rounded'} />
            <div className={'bg-border h-4 w-2/5 rounded'} />
          </div>
        ))}
      </div>
    </div>
  );
}
