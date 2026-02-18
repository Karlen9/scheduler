'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { Calendar, Clock, Dumbbell, Repeat, X, Check, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { TopBar } from '@/components/TopBar';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { api } from '@/lib/api';
import { ClientAvatar } from '@/components/ClientAvatar';
import { RecurringSchedule, Booking } from '@/lib/types';
import { formatDuration } from '@/components/DurationSelector';
import { useAdminRecurringDetail } from '@/hooks/queries';
import { invalidateRecurring } from '@/hooks/mutations';

// --- Constants (colors only) ---

const scheduleStatusColors: Record<string, { color: string; border: string }> = {
  pending: {
    color: 'bg-status-pending-bg text-status-pending-text',
    border: 'border-status-pending-border',
  },
  active: {
    color: 'bg-status-confirmed-bg text-status-confirmed-text',
    border: 'border-status-confirmed-border',
  },
  declined: {
    color: 'bg-status-rejected-bg text-status-rejected-text',
    border: 'border-status-rejected-border',
  },
  cancelled: {
    color: 'bg-status-cancelled-bg text-status-cancelled-text',
    border: 'border-status-cancelled-border',
  },
};

const scheduleStatusKeys: Record<string, string> = {
  pending: 'pending',
  active: 'active',
  declined: 'declined',
  cancelled: 'cancelled',
};

const bookingStatusColors: Record<string, string> = {
  pending: 'bg-status-pending-bg text-status-pending-text',
  confirmed: 'bg-status-confirmed-bg text-status-confirmed-text',
  rejected: 'bg-status-rejected-bg text-status-rejected-text',
  cancelled: 'bg-status-cancelled-bg text-status-cancelled-text',
  completed: 'bg-status-completed-bg text-status-completed-text',
  cancel_requested: 'bg-status-warning-bg text-status-warning-text',
  reschedule_pending: 'bg-status-purple-bg text-status-purple-text',
};

const bookingStatusKeys: Record<string, string> = {
  pending: 'pending',
  confirmed: 'confirmed',
  rejected: 'rejected',
  cancelled: 'cancelled',
  completed: 'completed',
  cancel_requested: 'cancelRequested',
  reschedule_pending: 'reschedulePending',
};

// --- Key mappings ---

const dayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
const monthGenKeys = [
  'jan',
  'feb',
  'mar',
  'apr',
  'may',
  'jun',
  'jul',
  'aug',
  'sep',
  'oct',
  'nov',
  'dec',
] as const;
const monthShortKeys = monthGenKeys;

// --- Pure helpers ---

function parseDayTimes(dayTimesJSON?: string): Record<string, string> | null {
  if (!dayTimesJSON) return null;
  try {
    return JSON.parse(dayTimesJSON);
  } catch {
    return null;
  }
}

function formatTime(isoStr: string): string {
  const d = new Date(isoStr);
  const h = String(d.getUTCHours()).padStart(2, '0');
  const m = String(d.getUTCMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

// --- Component ---

export default function AdminRecurringDetailPage() {
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
  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const getDayName = (day: number) => tdat(`daysShort.${dayKeys[day]}`);
  const getMonthGen = (month: number) => tdat(`monthsGen.${monthGenKeys[month]}`);
  const getMonthShort = (month: number) => tdat(`monthsShort.${monthShortKeys[month]}`);

  const formatDate = (isoStr: string): string => {
    const d = new Date(isoStr);
    const dayName = getDayName(d.getUTCDay());
    return `${dayName}, ${d.getUTCDate()} ${getMonthGen(d.getUTCMonth())}`;
  };

  const formatDateRange = (startDate?: string, endDate?: string): string | null => {
    if (!startDate || !endDate) return null;
    const start = new Date(startDate);
    const end = new Date(endDate);
    return `${start.getDate()} ${getMonthShort(start.getMonth())} — ${end.getDate()} ${getMonthShort(end.getMonth())}`;
  };

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

  const getServiceName = (sched: RecurringSchedule): string => {
    if (sched.sessionType?.name) {
      return sched.sessionType.name;
    }
    return formatDuration(sched.durationMinutes, td('hour'));
  };

  const handleCancelBooking = async () => {
    if (!cancelTarget || !schedule) return;
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

  const handleApproveMoveBooking = async (booking: Booking) => {
    if (!schedule) return;
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

  const handleDeclineMoveBooking = async (booking: Booking) => {
    if (!schedule) return;
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

  // --- Loading skeleton ---
  if (isLoading) {
    return (
      <div>
        <TopBar title={tp('regularSchedule')} showBack />
        <div className="space-y-4 p-4">
          <div className="bg-card animate-pulse rounded-xl p-4">
            <div className="bg-border mb-4 h-5 w-1/3 rounded" />
            <div className="bg-border mb-3 h-4 w-2/3 rounded" />
            <div className="bg-border mb-3 h-4 w-1/2 rounded" />
            <div className="bg-border h-4 w-2/5 rounded" />
          </div>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-card animate-pulse rounded-xl p-4">
              <div className="bg-border mb-3 h-4 w-1/2 rounded" />
              <div className="bg-border mb-2 h-4 w-1/3 rounded" />
              <div className="bg-border h-4 w-2/5 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!schedule) {
    return (
      <div>
        <TopBar title={tp('regularSchedule')} showBack />
        <div className="p-4">
          <p className="text-muted-foreground py-8 text-center text-sm">{t('scheduleNotFound')}</p>
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

  const sortedBookings = [...(schedule.bookings || [])].sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
  );

  return (
    <div>
      <TopBar title={tp('regularSchedule')} showBack />

      <div className="space-y-4 p-4">
        {/* Schedule Info Card */}
        <div className={`bg-card rounded-xl border-l-4 p-4 ${scheduleStatus.border}`}>
          <div className="mb-3 flex items-start justify-between">
            <h2 className="text-foreground text-base font-medium">{tp('regularSchedule')}</h2>
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${scheduleStatus.color}`}>
              {tst(scheduleStatusKey)}
            </span>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <ClientAvatar
                name={schedule.clientName}
                photoUrl={schedule.clientPhotoUrl}
                size="sm"
              />
              <span className="text-foreground text-sm">{schedule.clientName}</span>
            </div>

            <div className="flex items-center gap-2">
              <Dumbbell className="text-muted-foreground h-4 w-4" />
              <span className="text-foreground text-sm">{serviceName}</span>
            </div>

            {dayTimes ? (
              <div className="flex items-center gap-2">
                <Clock className="text-muted-foreground h-4 w-4" />
                <span className="text-foreground text-sm">
                  {daysLabel}
                  <span className="text-muted-foreground">
                    {' '}
                    · {formatDuration(schedule.durationMinutes, td('hour'))}
                  </span>
                </span>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <Repeat className="text-muted-foreground h-4 w-4" />
                  <span className="text-foreground text-sm">{daysLabel}</span>
                </div>

                <div className="flex items-center gap-2">
                  <Clock className="text-muted-foreground h-4 w-4" />
                  <span className="text-foreground text-sm">
                    {schedule.time}
                    <span className="text-muted-foreground">
                      {' '}
                      · {formatDuration(schedule.durationMinutes, td('hour'))}
                    </span>
                  </span>
                </div>
              </>
            )}

            {dateRange && (
              <div className="flex items-center gap-2">
                <Calendar className="text-muted-foreground h-4 w-4" />
                <span className="text-muted-foreground text-sm">{dateRange}</span>
              </div>
            )}
          </div>
        </div>

        {/* Bookings Section */}
        <div>
          <h3 className="text-muted-foreground mb-3 text-sm font-medium">
            {t('sessionsCount', { count: sortedBookings.length })}
          </h3>

          {sortedBookings.length === 0 ? (
            <div className="bg-card rounded-xl p-6 text-center">
              <p className="text-muted-foreground text-sm">{t('noPlannedSessions')}</p>
            </div>
          ) : (
            <div className="space-y-3">
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
            ? `${formatDate(cancelTarget.startsAt)} — ${cancelTarget.clientName}`
            : undefined
        }
        confirmText={tc('cancelVerb')}
        destructive
      />
    </div>
  );
}

// --- Booking Row Component ---

interface BookingRowProps {
  booking: Booking;
  actionLoading: string | null;
  onRequestCancel: (booking: Booking) => void;
  onApproveMoveBooking: (booking: Booking) => void;
  onDeclineMoveBooking: (booking: Booking) => void;
  formatDate: (iso: string) => string;
  formatTime: (iso: string) => string;
  tst: ReturnType<typeof useTranslations>;
  tc: ReturnType<typeof useTranslations>;
  t: ReturnType<typeof useTranslations>;
}

function BookingRow({
  booking,
  actionLoading,
  onRequestCancel,
  onApproveMoveBooking,
  onDeclineMoveBooking,
  formatDate,
  formatTime,
  tst,
  tc,
  t,
}: BookingRowProps) {
  const statusColor = bookingStatusColors[booking.status] || bookingStatusColors.pending;
  const statusKey = bookingStatusKeys[booking.status] || 'pending';
  const isThisLoading = actionLoading === booking.id;

  const isConfirmed = booking.status === 'confirmed';
  const isReschedulePending = booking.status === 'reschedule_pending';

  return (
    <div className="bg-card rounded-xl p-4">
      <div className="mb-2 flex items-start justify-between">
        <div className="flex-1 space-y-1.5">
          <div className="flex items-center gap-2">
            <Calendar className="text-muted-foreground h-4 w-4" />
            <span className="text-foreground text-sm">{formatDate(booking.startsAt)}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="text-muted-foreground h-4 w-4" />
            <span className="text-foreground text-sm">
              {formatTime(booking.startsAt)} — {formatTime(booking.endsAt)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <ClientAvatar name={booking.clientName} photoUrl={booking.clientPhotoUrl} size="sm" />
            <span className="text-foreground text-sm">{booking.clientName}</span>
          </div>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap ${statusColor}`}
        >
          {tst(statusKey)}
        </span>
      </div>

      {/* Confirmed: Cancel button */}
      {isConfirmed && (
        <div className="border-border border-t pt-3">
          <button
            onClick={() => onRequestCancel(booking)}
            disabled={isThisLoading}
            className="bg-background text-destructive w-full rounded-lg px-4 py-2 text-sm font-medium transition-opacity active:opacity-70 disabled:opacity-40"
          >
            {isThisLoading ? tc('cancelling') : tc('cancelVerb')}
          </button>
        </div>
      )}

      {/* Reschedule pending: Approve/Decline with new time */}
      {isReschedulePending && (
        <div className="border-border space-y-2 border-t pt-3">
          <div className="text-status-purple-text flex items-center gap-2 text-xs">
            <span>{t('rescheduleRequest')}</span>
            <ArrowRight className="h-3 w-3" />
            <span className="font-medium">
              {formatDate(booking.startsAt)}, {formatTime(booking.startsAt)}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onApproveMoveBooking(booking)}
              disabled={isThisLoading}
              className="bg-action-success-bg text-action-success-text flex flex-1 items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-opacity active:opacity-70 disabled:opacity-40"
            >
              <Check className="h-4 w-4" />
              {tc('confirm')}
            </button>
            <button
              onClick={() => onDeclineMoveBooking(booking)}
              disabled={isThisLoading}
              className="bg-action-danger-bg text-action-danger-text flex flex-1 items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-opacity active:opacity-70 disabled:opacity-40"
            >
              <X className="h-4 w-4" />
              {tst('declined')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
