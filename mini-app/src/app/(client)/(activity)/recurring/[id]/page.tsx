'use client';

import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/ConfirmDialog';
import { invalidateRecurring } from '@/hooks/mutations';
import { useRecurringDetail } from '@/hooks/queries';
import { api } from '@/lib/api';
import { scheduleStatusColors } from '@/lib/colors';
import { formatDuration, parseDayTimes } from '@/lib/helpers';
import { dayKeys, monthGenKeys, scheduleStatusKeys } from '@/lib/mappings';

import { BookingCardItem } from './BookingCardItem';
import { ScheduleInfoCard } from './ScheduleInfoCard';

import type { TBooking, TRecurringSchedule } from '@/lib/types';
import type { ReactNode } from 'react';

/***************************************************************************************************
 * Lists translation or cache keys reused by the page layer.
 *
 * Usage context:
 * - Reused by the page layer to keep shared values centralized.
 ***************************************************************************************************/
const monthShortKeys = monthGenKeys;

/***************************************************************************************************
 * Renders the recurring schedule detail page UI and related interactions.
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
export default function RecurringScheduleDetailPage(): ReactNode {
  /***************************************************************************************************
   * Defines the params value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const params = useParams();
  /***************************************************************************************************
   * Defines the id value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const id = params.id as string;

  /***************************************************************************************************
   * Defines the t value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const t = useTranslations('RecurringDetail');
  /***************************************************************************************************
   * Defines the tst value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const tst = useTranslations('Status');
  /***************************************************************************************************
   * Defines the tc value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const tc = useTranslations('Common');
  /***************************************************************************************************
   * Defines the td value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const td = useTranslations('Duration');
  /***************************************************************************************************
   * Defines the tdat value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const tdat = useTranslations('Dates');
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

  const { data: schedule, isLoading, mutate } = useRecurringDetail(id);
  const [cancelTarget, setCancelTarget] = useState<TBooking | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  /***************************************************************************************************
   * Returns day name.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const getDayName = (day: number): string => tdat(`daysShort.${dayKeys[day]}`);
  /***************************************************************************************************
   * Returns month gen.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const getMonthGen = (month: number): string => tdat(`monthsGen.${monthGenKeys[month]}`);
  /***************************************************************************************************
   * Returns month short.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const getMonthShort = (month: number): string => tdat(`monthsShort.${monthShortKeys[month]}`);

  /***************************************************************************************************
   * Formats days of week.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const formatDaysOfWeek = (sched: TRecurringSchedule): string => {
    if (sched.daysOfWeek) {
      return sched.daysOfWeek
        .split(',')
        .map((d) => getDayName(parseInt(d)))
        .join(', ');
    }
    return getDayName(sched.dayOfWeek);
  };

  /***************************************************************************************************
   * Formats day times display.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const formatDayTimesDisplay = (dayTimesMap: Record<string, string>): string => {
    /***************************************************************************************************
     * Defines the entries value used by the page layer.
     *
     * Usage context:
     * - Reused by the page layer to keep shared values centralized.
     ***************************************************************************************************/
    const entries = Object.entries(dayTimesMap)
      .map(([d, time]) => ({ day: parseInt(d), time }))
      .sort((a, b) => a.day - b.day);
    return entries.map((e) => `${getDayName(e.day)} ${e.time}`).join(', ');
  };

  /***************************************************************************************************
   * Formats date range.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const formatDateRange = (startDate?: string, endDate?: string): string | null => {
    if (!startDate || !endDate) {
      return null;
    }
    /***************************************************************************************************
     * Defines the start value used by the page layer.
     *
     * Usage context:
     * - Reused by the page layer to keep shared values centralized.
     ***************************************************************************************************/
    const start = new Date(startDate);
    /***************************************************************************************************
     * Defines the end value used by the page layer.
     *
     * Usage context:
     * - Reused by the page layer to keep shared values centralized.
     ***************************************************************************************************/
    const end = new Date(endDate);
    return `${start.getDate()} ${getMonthShort(start.getMonth())} — ${end.getDate()} ${getMonthShort(end.getMonth())}`;
  };

  /***************************************************************************************************
   * Formats booking date.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const formatBookingDate = (isoString: string): string => {
    /***************************************************************************************************
     * Defines the date value used by the page layer.
     *
     * Usage context:
     * - Reused by the page layer to keep shared values centralized.
     ***************************************************************************************************/
    const date = new Date(isoString);
    /***************************************************************************************************
     * Defines the day name value used by the page layer.
     *
     * Usage context:
     * - Reused by the page layer to keep shared values centralized.
     ***************************************************************************************************/
    const dayName = getDayName(date.getUTCDay());
    return `${dayName}, ${date.getUTCDate()} ${getMonthGen(date.getUTCMonth())}`;
  };

  /***************************************************************************************************
   * Returns service name.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const getServiceName = (sched: TRecurringSchedule): string => {
    if (sched.sessionType?.name) {
      return sched.sessionType.name;
    }
    return formatDuration(sched.durationMinutes, td('hour'), td('minutes'));
  };

  /***************************************************************************************************
   * Handles cancel booking.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const handleCancelBooking = async (): Promise<void> => {
    if (!cancelTarget || !schedule) {
      return;
    }
    setIsCancelling(true);
    try {
      await api.requestCancelBooking(schedule.id, cancelTarget.id);
      toast.success(ts('sessionCancelled'));
      setCancelTarget(null);
      mutate();
      invalidateRecurring();
    } catch {
      toast.error(te('sessionCancelFailed'));
    } finally {
      setIsCancelling(false);
    }
  };

  /***************************************************************************************************
   * Loading skeleton.
   ***************************************************************************************************/
  if (isLoading) {
    return (
      <div className={'space-y-4 p-4'}>
        <div className={'bg-card animate-pulse rounded-xl p-4'}>
          <div className={'bg-border mb-4 h-5 w-2/5 rounded'} />
          <div className={'bg-border mb-3 h-4 w-1/2 rounded'} />
          <div className={'bg-border mb-3 h-4 w-1/3 rounded'} />
          <div className={'bg-border h-4 w-2/5 rounded'} />
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className={'bg-card animate-pulse rounded-xl p-4'}>
            <div className={'bg-border mb-3 h-4 w-1/3 rounded'} />
            <div className={'bg-border mb-2 h-4 w-1/2 rounded'} />
            <div className={'bg-border h-4 w-2/5 rounded'} />
          </div>
        ))}
      </div>
    );
  }

  if (!schedule) {
    return (
      <div className={'p-4'}>
        <p className={'text-muted-foreground mt-8 text-center text-sm'}>{t('scheduleNotFound')}</p>
      </div>
    );
  }

  /***************************************************************************************************
   * Defines the schedule status value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const scheduleStatus = scheduleStatusColors[schedule.status] || scheduleStatusColors.pending;
  /***************************************************************************************************
   * Defines the schedule status key value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const scheduleStatusKey = scheduleStatusKeys[schedule.status] || 'pending';
  /***************************************************************************************************
   * Defines the day times value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const dayTimes = parseDayTimes(schedule.dayTimes);
  /***************************************************************************************************
   * Defines the days label value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const daysLabel = dayTimes ? formatDayTimesDisplay(dayTimes) : formatDaysOfWeek(schedule);
  /***************************************************************************************************
   * Defines the date range value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const dateRange = formatDateRange(schedule.startDate, schedule.endDate);
  /***************************************************************************************************
   * Defines the service name value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const serviceName = getServiceName(schedule);
  /***************************************************************************************************
   * Defines the duration label value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const durationLabel = formatDuration(schedule.durationMinutes, td('hour'), td('minutes'));

  /***************************************************************************************************
   * Defines the sorted bookings value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const sortedBookings = [...(schedule.bookings || [])].sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
  );

  return (
    <>
      <div className={'space-y-4 p-4'}>
        <ScheduleInfoCard
          schedule={schedule}
          scheduleStatus={scheduleStatus}
          scheduleStatusLabel={tst(scheduleStatusKey)}
          serviceName={serviceName}
          daysLabel={daysLabel}
          dateRange={dateRange}
          durationLabel={durationLabel}
          dayTimes={dayTimes}
        />

        {/***************************************************************************************************
         * Bookings section.
         ***************************************************************************************************/}
        {sortedBookings.length > 0 ? (
          <div>
            <h3 className={'text-muted-foreground mb-3 text-sm font-medium'}>
              {t('sessionsCount', { count: sortedBookings.length })}
            </h3>
            <div className={'space-y-3'}>
              {sortedBookings.map((booking) => (
                <BookingCardItem
                  key={booking.id}
                  booking={booking}
                  onRequestCancel={setCancelTarget}
                  formatBookingDate={formatBookingDate}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className={'py-8 text-center'}>
            <p className={'text-muted-foreground text-sm'}>{t('noSessionsPlanned')}</p>
          </div>
        )}
      </div>

      {/***************************************************************************************************
       * Cancel confirmation dialog.
       ***************************************************************************************************/}
      <ConfirmDialog
        isOpen={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        onConfirm={handleCancelBooking}
        title={t('cancelSessionDialog')}
        description={t('cancelSessionDescription')}
        confirmText={isCancelling ? tc('cancelling') : tc('cancelVerb')}
        destructive
      />
    </>
  );
}
