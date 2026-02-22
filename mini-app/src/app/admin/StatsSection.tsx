'use client';

import { Bell, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { StatCard } from '@/components/StatCard';

interface StatsSectionProps {
  pendingCount: number;
  clientsCount: number;
  onPendingClick?: () => void;
  onClientsClick: () => void;
}

export function StatsSection({
  pendingCount,
  clientsCount,
  onPendingClick,
  onClientsClick,
}: StatsSectionProps) {
  const t = useTranslations('AdminDashboard');

  return (
    <div className="grid grid-cols-2 gap-3">
      <StatCard
        icon={Bell}
        iconColor="text-warning"
        iconBg="bg-warning/20"
        value={pendingCount}
        label={t('newRequests')}
        onClick={onPendingClick}
      />
      <StatCard
        icon={Users}
        iconColor="text-brand"
        iconBg="bg-brand/20"
        value={clientsCount}
        label={t('allClients')}
        onClick={onClientsClick}
      />
    </div>
  );
}
