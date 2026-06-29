'use client';

import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/ConfirmDialog';
import { TopBar } from '@/components/TopBar';
import { invalidateRecurring } from '@/hooks/mutations';
import { useAdminRecurringDetail } from '@/hooks/queries';
import { api } from '@/lib/api';
import { scheduleStatusColors } from '@/lib/colors';
import { clientEntityLabel, formatDuration, formatTime, parseDayTimes } from '@/lib/helpers';
import { dayKeys, monthGenKeys, scheduleStatusKeys } from '@/lib/mappings';

import { BookingRow } from './BookingRow';
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
 * Renders the admin recurring detail page UI and related interactions.
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
export default function AdminRecurringDetailPage(): ReactNode {
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
   * Defines the tp value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const tp = useTranslations('RecurringPage');
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

  const { data: schedule, isLoading, mutate } = useAdminRecurringDetail(id);
  const [cancelTarget, setCancelTarget] = useState<TBooking | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

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
   * Formats date.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const formatDate = (isoStr: string): string => {
    /***************************************************************************************************
     * Defines the d value used by the page layer.
     *
     * Usage context:
     * - Reused by the page layer to keep shared values centralized.
     ***************************************************************************************************/
    const d = new Date(isoStr);
    /***************************************************************************************************
     * Defines the day name value used by the page layer.
     *
     * Usage context:
     * - Reused by the page layer to keep shared values centralized.
     ***************************************************************************************************/
    const dayName = getDayName(d.getUTCDay());
    return `${dayName}, ${d.getUTCDate()} ${getMonthGen(d.getUTCMonth())}`;
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
    setActionLoading(cancelTarget.id);
    try {
      await api.admin.requestCancelBooking(schedule.id, cancelTarget.id);
      toast.success(ts('sessionCancelled'));
      setCancelTarget(null);
      mutate();
      invalidateRecurring();
    } catch {
      toast.error(te('sessionCancelFailed'));
    } finally {
      setActionLoading(null);
    }
  };

  /***************************************************************************************************
   * Handles approve move booking.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const handleApproveMoveBooking = async (booking: TBooking): Promise<void> => {
    if (!schedule) {
      return;
    }
    setActionLoading(booking.id);
    try {
      await api.admin.approveMoveBooking(schedule.id, booking.id);
      toast.success(ts('moveConfirmed'));
      mutate();
      invalidateRecurring();
    } catch {
      toast.error(te('moveCancelFailed'));
    } finally {
      setActionLoading(null);
    }
  };

  /***************************************************************************************************
   * Handles decline move booking.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const handleDeclineMoveBooking = async (booking: TBooking): Promise<void> => {
    if (!schedule) {
      return;
    }
    setActionLoading(booking.id);
    try {
      await api.admin.declineMoveBooking(schedule.id, booking.id);
      toast.success(ts('moveDeclined'));
      mutate();
      invalidateRecurring();
    } catch {
      toast.error(te('moveDeclineFailed'));
    } finally {
      setActionLoading(null);
    }
  };

  if (isLoading) {
    return (
      <div className={'space-y-4 p-4'}>
        <div className={'bg-card animate-pulse rounded-xl p-4'}>
          <div className={'bg-skeleton mb-4 h-5 w-2/5 rounded'} />
          <div className={'bg-skeleton mb-3 h-4 w-1/2 rounded'} />
          <div className={'bg-skeleton mb-3 h-4 w-1/3 rounded'} />
          <div className={'bg-skeleton h-4 w-2/5 rounded'} />
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className={'bg-card animate-pulse rounded-xl p-4'}>
            <div className={'bg-skeleton mb-3 h-4 w-1/3 rounded'} />
            <div className={'bg-skeleton mb-2 h-4 w-1/2 rounded'} />
            <div className={'bg-skeleton h-4 w-2/5 rounded'} />
          </div>
        ))}
      </div>
    );
  }

  if (!schedule) {
    return (
      <div>
        <TopBar title={tp('regularSchedule')} showBack />
        <div className={'p-4'}>
          <p className={'text-muted-foreground py-8 text-center text-sm'}>
            {t('scheduleNotFound')}
          </p>
        </div>
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
    <div>
      <TopBar title={tp('regularSchedule')} showBack />

      <div className={'space-y-4 p-4'}>
        <ScheduleInfoCard
          schedule={schedule}
          scheduleStatus={scheduleStatus}
          title={tp('regularSchedule')}
          statusLabel={tst(scheduleStatusKey)}
          daysLabel={daysLabel}
          serviceName={serviceName}
          dateRange={dateRange}
          durationLabel={durationLabel}
          dayTimes={dayTimes}
        />

        {/***************************************************************************************************
         * Bookings Section.
         ***************************************************************************************************/}
        <div>
          <h3 className={'text-muted-foreground mb-3 text-sm font-medium'}>
            {t('sessionsCount', { count: sortedBookings.length })}
          </h3>

          {sortedBookings.length === 0 ? (
            <div className={'bg-card rounded-xl p-6 text-center'}>
              <p className={'text-muted-foreground text-sm'}>{t('noPlannedSessions')}</p>
            </div>
          ) : (
            <div className={'space-y-3'}>
              {sortedBookings.map((booking) => (
                <BookingRow
                  key={booking.id}
                  booking={booking}
                  actionLoading={actionLoading}
                  onRequestCancel={setCancelTarget}
                  onApproveMoveBooking={handleApproveMoveBooking}
                  onDeclineMoveBooking={handleDeclineMoveBooking}
                  formatDate={formatDate}
                  formatTime={formatTime}
                  tst={tst}
                  tc={tc}
                  t={t}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        onConfirm={handleCancelBooking}
        title={t('cancelSessionDialog')}
        description={
          cancelTarget
            ? `${formatDate(cancelTarget.startsAt)} — ${clientEntityLabel(cancelTarget, tc('self'))}`
            : undefined
        }
        confirmText={tc('cancelVerb')}
        destructive
      />
    </div>
  );
}
