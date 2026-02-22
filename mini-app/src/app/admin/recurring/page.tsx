'use client';

import { Repeat } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';

import { ActivityBackButton } from '@/components/ActivityBackButton';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState } from '@/components/EmptyState';
import { RecurringScheduleCard } from '@/components/RecurringScheduleCard';
import { invalidateRecurring } from '@/hooks/mutations';
import { useAdminRecurringSchedules, useAdminServices } from '@/hooks/queries';
import { api } from '@/lib/api';

import type { TRecurringSchedule } from '@/lib/types';
import type { ReactNode } from 'react';

export default function AdminRecurringPage(): ReactNode {
  const t = useTranslations('RecurringPage');
  const tc = useTranslations('Common');
  const te = useTranslations('Errors');
  const ts = useTranslations('Success');
  const { data: schedules, isLoading: schedulesLoading } = useAdminRecurringSchedules();
  const { data: services, isLoading: servicesLoading } = useAdminServices();

  const isLoading = schedulesLoading || servicesLoading;

  const [cancelTarget, setCancelTarget] = useState<TRecurringSchedule | null>(null);

  const handleApprove = async (schedule: TRecurringSchedule): Promise<void> => {
    try {
      await api.admin.approveRecurringSchedule(schedule.id);
      toast.success(ts('scheduleConfirmed'));
      invalidateRecurring();
    } catch {
      toast.error(te('scheduleConfirmFailed'));
    }
  };

  const handleDecline = async (schedule: TRecurringSchedule): Promise<void> => {
    try {
      await api.admin.declineRecurringSchedule(schedule.id);
      toast.success(ts('scheduleDeclined'));
      invalidateRecurring();
    } catch {
      toast.error(te('scheduleDeclineFailed'));
    }
  };

  const handleCancel = async (): Promise<void> => {
    if (!cancelTarget) {
      return;
    }
    try {
      await api.admin.cancelRecurringSchedule(cancelTarget.id);
      toast.success(ts('scheduleCancelled'));
      setCancelTarget(null);
      invalidateRecurring();
    } catch {
      toast.error(te('scheduleCancelFailed'));
    }
  };

  const pendingSchedules = schedules.filter((s) => s.status === 'pending');
  const activeSchedules = schedules.filter((s) => s.status === 'active');
  const declinedSchedules = schedules.filter((s) => s.status === 'declined');
  const cancelledSchedules = schedules.filter((s) => s.status === 'cancelled');
  const hasSchedules = schedules.length > 0;

  if (isLoading) {
    return (
      <div>
        <ActivityBackButton href={'/admin'} />
        <div className={'animate-pulse space-y-3 p-4'}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className={'bg-card space-y-2 rounded-xl p-4'}>
              <div className={'bg-border h-4 w-1/3 rounded'} />
              <div className={'bg-border h-3 w-2/3 rounded'} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <ActivityBackButton href={'/admin'} />

      <div className={'space-y-6 p-4'}>
        {!hasSchedules ? (
          <EmptyState
            icon={<Repeat className={'h-16 w-16'} />}
            title={t('emptyTitle')}
            description={t('emptyDescription')}
          />
        ) : (
          <>
            {pendingSchedules.length > 0 && (
              <div>
                <h3 className={'text-muted-foreground mb-3 text-sm font-medium'}>
                  {t('pendingSection')}
                </h3>
                <div className={'space-y-3'}>
                  {pendingSchedules.map((schedule) => (
                    <RecurringScheduleCard
                      key={schedule.id}
                      schedule={schedule}
                      services={services}
                      onCancel={setCancelTarget}
                      onApprove={schedule.createdBy === 'client' ? handleApprove : undefined}
                      onDecline={schedule.createdBy === 'client' ? handleDecline : undefined}
                      detailPath={'/admin/recurring'}
                    />
                  ))}
                </div>
              </div>
            )}

            {activeSchedules.length > 0 && (
              <div>
                <h3 className={'text-muted-foreground mb-3 text-sm font-medium'}>
                  {t('activeSection')}
                </h3>
                <div className={'space-y-3'}>
                  {activeSchedules.map((schedule) => (
                    <RecurringScheduleCard
                      key={schedule.id}
                      schedule={schedule}
                      services={services}
                      onCancel={setCancelTarget}
                      detailPath={'/admin/recurring'}
                    />
                  ))}
                </div>
              </div>
            )}

            {declinedSchedules.length > 0 && (
              <div>
                <h3 className={'text-muted-foreground mb-3 text-sm font-medium'}>
                  {t('declinedSection')}
                </h3>
                <div className={'space-y-3'}>
                  {declinedSchedules.map((schedule) => (
                    <RecurringScheduleCard
                      key={schedule.id}
                      schedule={schedule}
                      services={services}
                    />
                  ))}
                </div>
              </div>
            )}

            {cancelledSchedules.length > 0 && (
              <div>
                <h3 className={'text-muted-foreground mb-3 text-sm font-medium'}>
                  {t('cancelledSection')}
                  {' ('}
                  {cancelledSchedules.length}
                  {')'}
                </h3>
                <div className={'space-y-3'}>
                  {cancelledSchedules.map((schedule) => (
                    <RecurringScheduleCard
                      key={schedule.id}
                      schedule={schedule}
                      services={services}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <ConfirmDialog
        isOpen={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        onConfirm={handleCancel}
        title={t('cancelDialog')}
        description={t('cancelDialogDescription')}
        confirmText={tc('cancelVerb')}
        destructive
      />
    </div>
  );
}
