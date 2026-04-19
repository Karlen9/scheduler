'use client';

import { Calendar, CalendarCheck, Clock } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { memo } from 'react';

import { StatusBadge } from '@/components/StatusBadge';

import type { TBookingCardProps } from '@/lib/types';
import type { ReactNode } from 'react';

/***************************************************************************************************
 * Lists translation or cache keys reused by the component layer.
 *
 * Usage context:
 * - Reused by the component layer to keep shared values centralized.
 ***************************************************************************************************/
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
];

/***************************************************************************************************
 * Renders the booking card UI and related interactions.
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
function BookingCardComponent({
  booking,
  onCancel,
  onConfirm,
  onDecline,
  onApproveReschedule,
  onDeclineReschedule,
  replacedBooking,
}: TBookingCardProps): ReactNode {
  /***************************************************************************************************
   * Defines the tc value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const tc = useTranslations('Common');
  /***************************************************************************************************
   * Defines the tb value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const tb = useTranslations('BookingsPage');
  /***************************************************************************************************
   * Defines the td value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const td = useTranslations('Dates');
  /***************************************************************************************************
   * Defines the locale value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const locale = useLocale();

  /***************************************************************************************************
   * Defines the starts at value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const startsAt = new Date(booking.startsAt);
  /***************************************************************************************************
   * Defines the ends at value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const endsAt = new Date(booking.endsAt);
  const isPast = startsAt.getTime() <= Date.now();
  const displayStatus = booking.status === 'confirmed' && isPast ? 'completed' : booking.status;
  /***************************************************************************************************
   * Defines the is active value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const isActive = !isPast && (booking.status === 'pending' || booking.status === 'confirmed');
  /***************************************************************************************************
   * Defines the is specialist pending value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const isSpecialistPending = booking.status === 'pending' && booking.createdBy === 'specialist';
  const isReschedulePending = booking.status === 'reschedule_pending';

  /***************************************************************************************************
   * Formats date.
   *
   * Parameters:
   * - date: Date value used by the current operation.
   *
   * Returns:
   * - The computed value for the current operation as string.
   *
   * Side effects:
   * - May derive UI state, invoke callbacks, and trigger user-facing rendering updates.
   ***************************************************************************************************/
  function formatDate(date: Date): string {
    return `${date.getUTCDate()} ${td(`monthsGen.${monthGenKeys[date.getUTCMonth()]}`)} ${date.getUTCFullYear()}`;
  }

  /***************************************************************************************************
   * Formats time.
   *
   * Parameters:
   * - date: Date value used by the current operation.
   *
   * Returns:
   * - The computed value for the current operation as string.
   *
   * Side effects:
   * - May derive UI state, invoke callbacks, and trigger user-facing rendering updates.
   ***************************************************************************************************/
  function formatTime(date: Date): string {
    return date.toLocaleTimeString(locale === 'en' ? 'en-US' : 'ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC',
    });
  }

  return (
    <div className={'bg-card rounded-xl p-4'}>
      <div className={'mb-3 flex items-start justify-between'}>
        <div className={'flex-1'}>
          <div className={'mb-2 flex items-center gap-2'}>
            <Calendar className={'text-muted-foreground h-4 w-4'} />
            <span className={'text-foreground text-sm'}>{formatDate(startsAt)}</span>
          </div>
          <div className={'mb-2 flex items-center gap-2'}>
            <Clock className={'text-muted-foreground h-4 w-4'} />
            <span className={'text-foreground text-sm'}>
              {formatTime(startsAt)}
              {' – '}
              {formatTime(endsAt)}
            </span>
          </div>
          {isReschedulePending && replacedBooking && (
            <div className={'mb-2 flex items-center gap-2 pl-6'}>
              <span className={'text-muted-foreground text-xs'}>
                {tb('rescheduleOldLabel')}{' '}
                <span className={'line-through'}>
                  {formatDate(new Date(replacedBooking.startsAt))}{' '}
                  {formatTime(new Date(replacedBooking.startsAt))}
                </span>
              </span>
            </div>
          )}
          <div className={'flex items-center gap-2'}>
            <CalendarCheck className={'text-muted-foreground h-4 w-4'} />
            <span className={'text-foreground text-sm'}>
              {tc('workout')}
              {(booking.durationMinutes || booking.sessionType?.durationMinutes) && (
                <span className={'text-muted-foreground'}>
                  {' '}
                  {'· '}
                  {booking.durationMinutes || booking.sessionType?.durationMinutes} {tc('min')}
                </span>
              )}
            </span>
          </div>
        </div>
        <StatusBadge status={displayStatus} />
      </div>

      {isReschedulePending && onApproveReschedule && onDeclineReschedule ? (
        <div className={'border-border space-y-2 border-t pt-3'}>
          <p className={'text-muted-foreground mb-2 text-xs'}>{tb('rescheduleRequested')}</p>
          {booking.clientMessage && (
            <p
              className={
                'bg-background text-foreground mb-2 rounded-lg px-3 py-2 text-sm whitespace-pre-wrap'
              }
            >
              {booking.clientMessage}
            </p>
          )}
          <button
            onClick={() => onApproveReschedule(booking)}
            className={
              'bg-action-confirm-bg text-action-confirm-text w-full rounded-lg px-4 py-2 text-sm font-medium transition-opacity active:opacity-70'
            }
          >
            {tb('approveRescheduleButton')}
          </button>
          <button
            onClick={() => onDeclineReschedule(booking)}
            className={
              'bg-background text-destructive w-full rounded-lg px-4 py-2 text-sm font-medium transition-opacity active:opacity-70'
            }
          >
            {tb('declineRescheduleButton')}
          </button>
        </div>
      ) : isSpecialistPending && onConfirm && onDecline ? (
        <div className={'border-border space-y-2 border-t pt-3'}>
          <p className={'text-muted-foreground mb-2 text-xs'}>{tb('specialistBookedYou')}</p>
          <button
            onClick={() => onConfirm(booking)}
            className={
              'bg-action-confirm-bg text-action-confirm-text w-full rounded-lg px-4 py-2 text-sm font-medium transition-opacity active:opacity-70'
            }
          >
            {tc('confirm')}
          </button>
          <button
            onClick={() => onDecline(booking)}
            className={
              'bg-background text-destructive w-full rounded-lg px-4 py-2 text-sm font-medium transition-opacity active:opacity-70'
            }
          >
            {tb('declineButton')}
          </button>
        </div>
      ) : (
        isActive && (
          <div className={'border-border border-t pt-3'}>
            <button
              onClick={() => onCancel?.(booking)}
              className={
                'bg-background text-destructive w-full rounded-lg px-4 py-2 text-sm font-medium transition-opacity active:opacity-70'
              }
            >
              {tc('cancelVerb')}
            </button>
          </div>
        )
      )}
    </div>
  );
}

export const BookingCard = memo(BookingCardComponent);
