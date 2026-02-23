'use client';

import { Bell, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { StatCard } from '@/components/StatCard';

import type { TStatsSectionProps } from '@/lib/types';
import type { ReactNode } from 'react';

export function StatsSection({
  pendingCount,
  clientsCount,
  onPendingClick,
  onClientsClick,
}: TStatsSectionProps): ReactNode {
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
        icon={Users}
        iconColor={'text-brand'}
        iconBg={'bg-brand/20'}
        value={clientsCount}
        label={t('allClients')}
        onClick={onClientsClick}
      />
    </div>
  );
}
