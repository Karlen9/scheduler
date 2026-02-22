'use client';

import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/ConfirmDialog';
import { formatDuration } from '@/components/DurationSelector';
import { TopBar } from '@/components/TopBar';
import { invalidateRecurring } from '@/hooks/mutations';
import { useAdminRecurringDetail } from '@/hooks/queries';
import { api } from '@/lib/api';
import { scheduleStatusColors } from '@/lib/colors';
import { formatTime, parseDayTimes } from '@/lib/helpers';
import { dayKeys, monthGenKeys, scheduleStatusKeys } from '@/lib/mappings';

import { BookingRow } from './BookingRow';
import { ScheduleInfoCard } from './ScheduleInfoCard';

import type { TBooking, TRecurringSchedule } from '@/lib/types';
import type { ReactNode } from 'react';

const monthShortKeys = monthGenKeys;

export default function AdminRecurringDetailPage(): ReactNode {
  const params = useParams();
  const id = params.id as string;

  const t = useTranslations('RecurringDetail');
  const tp = useTranslations('RecurringPage');
  const tst = useTranslations('Status');
  const tc = useTranslations('Common');
  const td = useTranslations('Duration');
  const tdat = useTranslations('Dates');
  const te = useTranslations('Errors');
  const ts = useTranslations('Success');

  const { data: schedule, isLoading, mutate } = useAdminRecurringDetail(id);
  const [cancelTarget, setCancelTarget] = useState<TBooking | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const getDayName = (day: number): string => tdat(`daysShort.${dayKeys[day]}`);
  const getMonthGen = (month: number): string => tdat(`monthsGen.${monthGenKeys[month]}`);
  const getMonthShort = (month: number): string => tdat(`monthsShort.${monthShortKeys[month]}`);

  const formatDate = (isoStr: string): string => {
    const d = new Date(isoStr);
    const dayName = getDayName(d.getUTCDay());
    return `${dayName}, ${d.getUTCDate()} ${getMonthGen(d.getUTCMonth())}`;
  };

  const formatDateRange = (startDate?: string, endDate?: string): string | null => {
    if (!startDate || !endDate) {
      return null;
    }
    const start = new Date(startDate);
    const end = new Date(endDate);
    return `${start.getDate()} ${getMonthShort(start.getMonth())} — ${end.getDate()} ${getMonthShort(end.getMonth())}`;
  };

  const formatDaysOfWeek = (sched: TRecurringSchedule): string => {
    if (sched.daysOfWeek) {
      return sched.daysOfWeek
        .split(',')
        .map((d) => getDayName(parseInt(d)))
        .join(', ');
    }
    return getDayName(sched.dayOfWeek);
  };

  const formatDayTimesDisplay = (dayTimesMap: Record<string, string>): string => {
    const entries = Object.entries(dayTimesMap)
      .map(([d, time]) => ({ day: parseInt(d), time }))
      .sort((a, b) => a.day - b.day);
    return entries.map((e) => `${getDayName(e.day)} ${e.time}`).join(', ');
  };

  const getServiceName = (sched: TRecurringSchedule): string => {
    if (sched.sessionType?.name) {
      return sched.sessionType.name;
    }
    return formatDuration(sched.durationMinutes, td('hour'));
  };

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

  const scheduleStatus = scheduleStatusColors[schedule.status] || scheduleStatusColors.pending;
  const scheduleStatusKey = scheduleStatusKeys[schedule.status] || 'pending';
  const dayTimes = parseDayTimes(schedule.dayTimes);
  const daysLabel = dayTimes ? formatDayTimesDisplay(dayTimes) : formatDaysOfWeek(schedule);
  const dateRange = formatDateRange(schedule.startDate, schedule.endDate);
  const serviceName = getServiceName(schedule);
  const durationLabel = formatDuration(schedule.durationMinutes, td('hour'));

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

        {/* Bookings Section */}
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
            ? `${formatDate(cancelTarget.startsAt)} — ${cancelTarget.clientDisplayName || cancelTarget.clientName}`
            : undefined
        }
        confirmText={tc('cancelVerb')}
        destructive
      />
    </div>
  );
}
