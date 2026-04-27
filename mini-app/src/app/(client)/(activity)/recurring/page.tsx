'use client';

import { Repeat } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EmptyState } from '@/components/EmptyState';
import { RecurringScheduleCard } from '@/components/RecurringScheduleCard';
import { invalidateRecurring } from '@/hooks/mutations';
import { useRecurringSchedules, useSessionTypes } from '@/hooks/queries';
import { api } from '@/lib/api';
import { isPreviewRoute } from '@/lib/routes';

import type { TRecurringSchedule } from '@/lib/types';
import type { ReactNode } from 'react';

/***************************************************************************************************
 * Renders the client recurring page UI and related interactions.
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
export default function ClientRecurringPage(): ReactNode {
  /***************************************************************************************************
   * Defines the t value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const t = useTranslations('RecurringPage');
  /***************************************************************************************************
   * Defines the tc value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const tc = useTranslations('Common');
  /***************************************************************************************************
   * Defines the te value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const te = useTranslations('Errors');
  /***************************************************************************************************
   * Defines the ts value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const ts = useTranslations('Success');
  const pathname = usePathname();
  const { data: schedules, isLoading: schedulesLoading } = useRecurringSchedules();
  const { data: services, isLoading: servicesLoading } = useSessionTypes();
  const isPreview = isPreviewRoute(pathname);

  /***************************************************************************************************
   * Defines the is loading value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const isLoading = schedulesLoading || servicesLoading;

  const [cancelTarget, setCancelTarget] = useState<TRecurringSchedule | null>(null);

  /***************************************************************************************************
   * Handles cancel.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const handleCancel = async (): Promise<void> => {
    if (!cancelTarget) {
      return;
    }
    try {
      await api.cancelRecurringSchedule(cancelTarget.id);
      toast.success(ts('scheduleCancelled'));
      setCancelTarget(null);
      invalidateRecurring();
    } catch {
      toast.error(te('scheduleCancelFailed'));
    }
  };

  /***************************************************************************************************
   * Defines the pending schedules value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const pendingSchedules = schedules.filter((s) => s.status === 'pending');
  /***************************************************************************************************
   * Defines the active schedules value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const activeSchedules = schedules.filter((s) => s.status === 'active');
  /***************************************************************************************************
   * Defines the declined schedules value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const declinedSchedules = schedules.filter((s) => s.status === 'declined');
  /***************************************************************************************************
   * Defines the cancelled schedules value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const cancelledSchedules = schedules.filter((s) => s.status === 'cancelled');
  /***************************************************************************************************
   * Defines the has schedules value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const hasSchedules = schedules.length > 0;

  if (isLoading) {
    return (
      <div className={'animate-pulse space-y-3 p-4'}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className={'bg-card space-y-2 rounded-xl p-4'}>
            <div className={'bg-skeleton h-4 w-1/3 rounded'} />
            <div className={'bg-skeleton h-3 w-2/3 rounded'} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
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
                      onCancel={isPreview ? undefined : setCancelTarget}
                      detailPath={'/recurring'}
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
                      onCancel={isPreview ? undefined : setCancelTarget}
                      detailPath={'/recurring'}
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

      {!isPreview && (
        <ConfirmDialog
          isOpen={!!cancelTarget}
          onClose={() => setCancelTarget(null)}
          onConfirm={handleCancel}
          title={t('cancelDialog')}
          description={t('cancelDialogDescription')}
          confirmText={tc('cancelVerb')}
          destructive
        />
      )}
    </div>
  );
}
