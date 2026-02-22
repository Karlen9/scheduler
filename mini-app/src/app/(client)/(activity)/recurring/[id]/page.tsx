'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { formatDuration } from '@/components/DurationSelector';
import { api } from '@/lib/api';
import { RecurringSchedule, Booking } from '@/lib/types';
import { useRecurringDetail } from '@/hooks/queries';
import { invalidateRecurring } from '@/hooks/mutations';
import { dayKeys, monthGenKeys, scheduleStatusKeys } from '@/lib/mappings';
import { scheduleStatusColors } from '@/lib/colors';
import { parseDayTimes } from '@/lib/helpers';
import { ScheduleInfoCard } from './ScheduleInfoCard';
import { BookingCardItem } from './BookingCardItem';

const monthShortKeys = monthGenKeys;

export default function RecurringScheduleDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const t = useTranslations('RecurringDetail');
  const tst = useTranslations('Status');
  const tc = useTranslations('Common');
  const td = useTranslations('Duration');
  const tdat = useTranslations('Dates');
  const te = useTranslations('Errors');
  const ts = useTranslations('Success');

  const { data: schedule, isLoading, mutate } = useRecurringDetail(id);
  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  const getDayName = (day: number) => tdat(`daysShort.${dayKeys[day]}`);
  const getMonthGen = (month: number) => tdat(`monthsGen.${monthGenKeys[month]}`);
  const getMonthShort = (month: number) => tdat(`monthsShort.${monthShortKeys[month]}`);

  const formatDaysOfWeek = (sched: RecurringSchedule): string => {
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

  const formatDateRange = (startDate?: string, endDate?: string): string | null => {
    if (!startDate || !endDate) return null;
    const start = new Date(startDate);
    const end = new Date(endDate);
    return `${start.getDate()} ${getMonthShort(start.getMonth())} — ${end.getDate()} ${getMonthShort(end.getMonth())}`;
  };

  const formatBookingDate = (isoString: string): string => {
    const date = new Date(isoString);
    const dayName = getDayName(date.getUTCDay());
    return `${dayName}, ${date.getUTCDate()} ${getMonthGen(date.getUTCMonth())}`;
  };

  const getServiceName = (sched: RecurringSchedule): string => {
    if (sched.sessionType?.name) {
      return sched.sessionType.name;
    }
    return formatDuration(sched.durationMinutes, td('hour'));
  };

  const handleCancelBooking = async () => {
    if (!cancelTarget || !schedule) return;
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

  // --- Loading skeleton ---
  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <div className="bg-card animate-pulse rounded-xl p-4">
          <div className="bg-border mb-4 h-5 w-2/5 rounded" />
          <div className="bg-border mb-3 h-4 w-1/2 rounded" />
          <div className="bg-border mb-3 h-4 w-1/3 rounded" />
          <div className="bg-border h-4 w-2/5 rounded" />
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-card animate-pulse rounded-xl p-4">
            <div className="bg-border mb-3 h-4 w-1/3 rounded" />
            <div className="bg-border mb-2 h-4 w-1/2 rounded" />
            <div className="bg-border h-4 w-2/5 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (!schedule) {
    return (
      <div className="p-4">
        <p className="text-muted-foreground mt-8 text-center text-sm">{t('scheduleNotFound')}</p>
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
    <>
      <div className="space-y-4 p-4">
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

        {/* Bookings section */}
        {sortedBookings.length > 0 ? (
          <div>
            <h3 className="text-muted-foreground mb-3 text-sm font-medium">
              {t('sessionsCount', { count: sortedBookings.length })}
            </h3>
            <div className="space-y-3">
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
          <div className="py-8 text-center">
            <p className="text-muted-foreground text-sm">{t('noSessionsPlanned')}</p>
          </div>
        )}
      </div>

      {/* Cancel confirmation dialog */}
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
