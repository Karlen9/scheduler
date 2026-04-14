'use client';

import { Bell, ListChecks } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { StatCard } from '@/components/StatCard';

import type { TStatsSectionProps } from '@/lib/types';
import type { ReactNode } from 'react';

/***************************************************************************************************
 * Renders the stats section UI and related interactions.
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
export function StatsSection({
  pendingCount,
  bookingsCount,
  onPendingClick,
  onBookingsClick,
}: TStatsSectionProps): ReactNode {
  /***************************************************************************************************
   * Defines the t value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const t = useTranslations('AdminDashboard');

  return (
    <div className={'grid grid-cols-2 gap-3'}>
      <StatCard
        icon={Bell}
        iconColor={'text-warning'}
        iconBg={'bg-warning/20'}
        value={pendingCount}
        label={t('newRequests')}
        onClick={onPendingClick}
      />
      <StatCard
        icon={ListChecks}
        iconColor={'text-brand'}
        iconBg={'bg-brand/20'}
        value={bookingsCount}
        label={t('allBookings')}
        onClick={onBookingsClick}
      />
    </div>
  );
}
