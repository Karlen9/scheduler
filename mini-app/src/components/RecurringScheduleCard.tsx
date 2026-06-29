'use client';

import { Calendar, Check, ChevronRight, Clock, Repeat, X } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { ClientAvatar } from '@/components/ClientAvatar';
import { StatusBadge, statusBorders } from '@/components/StatusBadge';
import { clientEntityLabel, formatDuration } from '@/lib/helpers';
import { resolveTestAwareHref } from '@/lib/routes';

import type { TRecurringSchedule, TRecurringScheduleCardProps, TSessionType } from '@/lib/types';
import type { ReactNode } from 'react';

const dayShortKeysMap: Record<number, string> = {
  0: 'sun',
  1: 'mon',
  2: 'tue',
  3: 'wed',
  4: 'thu',
  5: 'fri',
  6: 'sat',
};
/***************************************************************************************************
 * Lists translation or cache keys reused by the component layer.
 *
 * Usage context:
 * - Reused by the component layer to keep shared values centralized.
 ***************************************************************************************************/
const monthShortKeys = [
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
];

/***************************************************************************************************
 * Renders the recurring schedule card UI and related interactions.
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
export function RecurringScheduleCard({
  schedule,
  services,
  onCancel,
  onApprove,
  onDecline,
  detailPath,
}: TRecurringScheduleCardProps): ReactNode {
  /***************************************************************************************************
   * Defines the router value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const router = useRouter();
  const pathname = usePathname();
  /***************************************************************************************************
   * Defines the tc value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const tc = useTranslations('Common');
  /***************************************************************************************************
   * Defines the td value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const td = useTranslations('Dates');
  /***************************************************************************************************
   * Defines the tdu value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const tdu = useTranslations('Duration');

  /***************************************************************************************************
   * Returns day name.
   *
   * Parameters:
   * - dayNum: Day num used by the current operation.
   *
   * Returns:
   * - The computed value for the current operation as string.
   *
   * Side effects:
   * - May derive UI state, invoke callbacks, and trigger user-facing rendering updates.
   ***************************************************************************************************/
  function getDayName(dayNum: number): string {
    /***************************************************************************************************
     * Defines the key value used by the component layer.
     *
     * Usage context:
     * - Reused by the component layer to keep shared values centralized.
     ***************************************************************************************************/
    const key = dayShortKeysMap[dayNum];
    return key ? td(`daysShort.${key}`) : '?';
  }

  /***************************************************************************************************
   * Formats days of week.
   *
   * Parameters:
   * - sched: Sched used by the current operation.
   *
   * Returns:
   * - The computed value for the current operation as string.
   *
   * Side effects:
   * - May derive UI state, invoke callbacks, and trigger user-facing rendering updates.
   ***************************************************************************************************/
  function formatDaysOfWeek(sched: TRecurringSchedule): string {
    if (sched.daysOfWeek) {
      return sched.daysOfWeek
        .split(',')
        .map((d) => getDayName(parseInt(d)))
        .join(', ');
    }
    return getDayName(sched.dayOfWeek);
  }

  /***************************************************************************************************
   * Parses day times.
   *
   * Parameters:
   * - dayTimesJSON: Time value used by the current operation.
   *
   * Returns:
   * - The computed value for the current operation as Record<string, string> | null.
   *
   * Side effects:
   * - May derive UI state, invoke callbacks, and trigger user-facing rendering updates.
   ***************************************************************************************************/
  function parseDayTimes(dayTimesJSON?: string): Record<string, string> | null {
    if (!dayTimesJSON) {
      return null;
    }
    try {
      return JSON.parse(dayTimesJSON);
    } catch {
      return null;
    }
  }

  /***************************************************************************************************
   * Formats day times display.
   *
   * Parameters:
   * - dayTimes: Time value used by the current operation.
   *
   * Returns:
   * - The computed value for the current operation as string.
   *
   * Side effects:
   * - May derive UI state, invoke callbacks, and trigger user-facing rendering updates.
   ***************************************************************************************************/
  function formatDayTimesDisplay(dayTimes: Record<string, string>): string {
    /***************************************************************************************************
     * Defines the entries value used by the component layer.
     *
     * Usage context:
     * - Reused by the component layer to keep shared values centralized.
     ***************************************************************************************************/
    const entries = Object.entries(dayTimes)
      .map(([d, t]) => ({ day: parseInt(d), time: t }))
      .sort((a, b) => a.day - b.day);
    return entries.map((e) => `${getDayName(e.day)} ${e.time}`).join(', ');
  }

  /***************************************************************************************************
   * Formats date range.
   *
   * Parameters:
   * - startDate: Date value used by the current operation.
   * - endDate: Date value used by the current operation.
   *
   * Returns:
   * - The computed value for the current operation as string | null.
   *
   * Side effects:
   * - May derive UI state, invoke callbacks, and trigger user-facing rendering updates.
   ***************************************************************************************************/
  function formatDateRange(startDate?: string, endDate?: string): string | null {
    if (!startDate || !endDate) {
      return null;
    }
    /***************************************************************************************************
     * Defines the start value used by the component layer.
     *
     * Usage context:
     * - Reused by the component layer to keep shared values centralized.
     ***************************************************************************************************/
    const start = new Date(startDate);
    /***************************************************************************************************
     * Defines the end value used by the component layer.
     *
     * Usage context:
     * - Reused by the component layer to keep shared values centralized.
     ***************************************************************************************************/
    const end = new Date(endDate);
    return `${start.getDate()} ${td(`monthsShort.${monthShortKeys[start.getMonth()]}`)} — ${end.getDate()} ${td(`monthsShort.${monthShortKeys[end.getMonth()]}`)}`;
  }

  /***************************************************************************************************
   * Returns service name.
   *
   * Parameters:
   * - sched: Sched used by the current operation.
   * - svcs: Svcs used by the current operation.
   *
   * Returns:
   * - The computed value for the current operation as string.
   *
   * Side effects:
   * - May derive UI state, invoke callbacks, and trigger user-facing rendering updates.
   ***************************************************************************************************/
  function getServiceName(sched: TRecurringSchedule, svcs?: TSessionType[]): string {
    if (sched.sessionType?.name) {
      return sched.sessionType.name;
    }
    if (svcs && svcs.length > 0 && sched.sessionTypeId) {
      /***************************************************************************************************
       * Defines the match value used by the component layer.
       *
       * Usage context:
       * - Reused by the component layer to keep shared values centralized.
       ***************************************************************************************************/
      const match = svcs.find((s) => s.id === sched.sessionTypeId);
      if (match) {
        return match.name;
      }
    }
    if (svcs && svcs.length > 0) {
      /***************************************************************************************************
       * Defines the match value used by the component layer.
       *
       * Usage context:
       * - Reused by the component layer to keep shared values centralized.
       ***************************************************************************************************/
      const match = svcs.find((s) => s.durationMinutes === sched.durationMinutes);
      if (match) {
        return match.name;
      }
    }
    return formatDuration(sched.durationMinutes, tdu('hour'), tdu('minutes'));
  }

  /***************************************************************************************************
   * Defines the border value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const border = statusBorders[schedule.status] || statusBorders.pending;
  /***************************************************************************************************
   * Defines the day times value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const dayTimes = parseDayTimes(schedule.dayTimes);
  /***************************************************************************************************
   * Defines the days label value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const daysLabel = dayTimes ? formatDayTimesDisplay(dayTimes) : formatDaysOfWeek(schedule);
  /***************************************************************************************************
   * Defines the date range value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const dateRange = formatDateRange(schedule.startDate, schedule.endDate);
  /***************************************************************************************************
   * Defines the can cancel value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const canCancel = onCancel && (schedule.status === 'active' || schedule.status === 'pending');
  /***************************************************************************************************
   * Defines the can approve value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const canApprove = onApprove && schedule.status === 'pending';
  /***************************************************************************************************
   * Defines the can decline value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const canDecline = onDecline && schedule.status === 'pending';
  /***************************************************************************************************
   * Defines the has actions value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const hasActions = canCancel || canApprove || canDecline;
  /***************************************************************************************************
   * Defines the is active value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const isActive = schedule.status === 'active';

  /***************************************************************************************************
   * Handles card click.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const handleCardClick = (): void => {
    if (detailPath && isActive) {
      router.push(resolveTestAwareHref(pathname, `${detailPath}/${schedule.id}`));
    }
  };

  return (
    <div
      className={`bg-card rounded-xl border-l-4 p-4 ${border} ${detailPath && isActive ? 'cursor-pointer transition-opacity active:opacity-80' : ''}`}
      onClick={handleCardClick}
    >
      <div className={'mb-3 flex items-start justify-between'}>
        <div className={'flex-1'}>
          {schedule.clientName && (
            <div className={'mb-2 flex items-center gap-2'}>
              <ClientAvatar
                name={schedule.clientDisplayName || schedule.clientName}
                photoUrl={schedule.clientPhotoUrl}
                size={'sm'}
                isSelf={schedule.clientIsSelf}
              />
              <span className={'text-foreground text-sm font-medium'}>
                {clientEntityLabel(schedule, tc('self'))}
              </span>
            </div>
          )}
          {dayTimes ? (
            <div className={'mb-2 flex items-center gap-2'}>
              <Clock className={'text-muted-foreground h-4 w-4 shrink-0'} />
              <span className={'text-foreground text-sm'}>
                {daysLabel}
                <span className={'text-muted-foreground'}>
                  {' '}
                  {'· '}
                  {getServiceName(schedule, services)}
                </span>
              </span>
            </div>
          ) : (
            <>
              <div className={'mb-2 flex items-center gap-2'}>
                <Repeat className={'text-muted-foreground h-4 w-4'} />
                <span className={'text-foreground text-sm'}>{daysLabel}</span>
              </div>
              <div className={'mb-2 flex items-center gap-2'}>
                <Clock className={'text-muted-foreground h-4 w-4'} />
                <span className={'text-foreground text-sm'}>
                  {schedule.time}
                  <span className={'text-muted-foreground'}>
                    {' '}
                    {'· '}
                    {getServiceName(schedule, services)}
                  </span>
                </span>
              </div>
            </>
          )}
          {dateRange && (
            <div className={'flex items-center gap-2'}>
              <Calendar className={'text-muted-foreground h-4 w-4'} />
              <span className={'text-muted-foreground text-sm'}>{dateRange}</span>
            </div>
          )}
        </div>
        <div className={'flex shrink-0 items-center gap-2'}>
          <StatusBadge status={schedule.status} />
          {detailPath && isActive && <ChevronRight className={'text-muted-foreground h-4 w-4'} />}
        </div>
      </div>

      {hasActions && (
        <div className={'border-border border-t pt-3'} onClick={(e) => e.stopPropagation()}>
          <div className={'flex gap-2'}>
            {canApprove && (
              <button
                onClick={() => onApprove(schedule)}
                className={
                  'bg-action-success-bg text-action-success-text flex flex-1 items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-opacity active:opacity-70'
                }
              >
                <Check className={'h-4 w-4'} />
                {tc('confirm')}
              </button>
            )}
            {canDecline && (
              <button
                onClick={() => onDecline(schedule)}
                className={
                  'bg-action-danger-bg text-action-danger-text flex flex-1 items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-opacity active:opacity-70'
                }
              >
                <X className={'h-4 w-4'} />
                {tc('cancelVerb')}
              </button>
            )}
            {canCancel && (
              <button
                onClick={() => onCancel(schedule)}
                className={
                  'bg-background text-destructive flex flex-1 items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-opacity active:opacity-70'
                }
              >
                <X className={'h-4 w-4'} />
                {tc('cancelVerb')}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
