import { useTranslations } from 'next-intl';

import { TopBar } from '@/components';

import type { ReactNode } from 'react';

/***************************************************************************************************
 * Renders the loading UI and related interactions.
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
export function Loading(): ReactNode {
  /***************************************************************************************************
   * Defines the tp value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const tp = useTranslations('RecurringPage');

  return (
    <div>
      <TopBar title={tp('regularSchedule')} showBack />
      <div className={'space-y-4 p-4'}>
        <div className={'bg-card animate-pulse rounded-xl p-4'}>
          <div className={'bg-skeleton mb-4 h-5 w-1/3 rounded'} />
          <div className={'bg-skeleton mb-3 h-4 w-2/3 rounded'} />
          <div className={'bg-skeleton mb-3 h-4 w-1/2 rounded'} />
          <div className={'bg-skeleton h-4 w-2/5 rounded'} />
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className={'bg-card animate-pulse rounded-xl p-4'}>
            <div className={'bg-skeleton mb-3 h-4 w-1/2 rounded'} />
            <div className={'bg-skeleton mb-2 h-4 w-1/3 rounded'} />
            <div className={'bg-skeleton h-4 w-2/5 rounded'} />
          </div>
        ))}
      </div>
    </div>
  );
}
