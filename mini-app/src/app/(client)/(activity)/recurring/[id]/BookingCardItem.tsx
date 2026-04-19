import { ArrowRight, Calendar, CalendarCheck, Clock, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { formatTime } from '@/lib/helpers';
import { bookingStatusColors, bookingStatusKeys } from '@/lib/mappings';

import type { TBookingCardItemProps } from '@/lib/types';
import type { ReactNode } from 'react';

/***************************************************************************************************
 * Renders the booking card item UI and related interactions.
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
export function BookingCardItem({
  booking,
  onRequestCancel,
  formatBookingDate,
  onApproveReschedule,
  onDeclineReschedule,
  rescheduleBusy = false,
  replacedBooking,
}: TBookingCardItemProps): ReactNode {
  /***************************************************************************************************
   * Defines the tc value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const tc = useTranslations('Common');
  /***************************************************************************************************
   * Defines the tst value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const tst = useTranslations('Status');
  /***************************************************************************************************
   * Defines the t value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const t = useTranslations('RecurringDetail');

  /***************************************************************************************************
   * Defines the status color value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const statusColor = bookingStatusColors[booking.status] || bookingStatusColors.pending;
  /***************************************************************************************************
   * Defines the status key value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const statusKey = bookingStatusKeys[booking.status] || 'pending';
  /***************************************************************************************************
   * Defines the is confirmed value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const isConfirmed = booking.status === 'confirmed';
  /***************************************************************************************************
   * Defines the is reschedule pending value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const isReschedulePending = booking.status === 'reschedule_pending';

  return (
    <div className={'bg-card rounded-xl p-4'}>
      <div className={'mb-2 flex items-start justify-between'}>
        <div className={'flex-1 space-y-1.5'}>
          <div className={'flex items-center gap-2'}>
            <Calendar className={'text-muted-foreground h-4 w-4 shrink-0'} />
            <span className={'text-foreground text-sm'}>{formatBookingDate(booking.startsAt)}</span>
          </div>
          <div className={'flex items-center gap-2'}>
            <Clock className={'text-muted-foreground h-4 w-4 shrink-0'} />
            <span className={'text-foreground text-sm'}>
              {formatTime(booking.startsAt)}
              <span className={'text-muted-foreground'}>{' — '}</span>
              {formatTime(booking.endsAt)}
            </span>
          </div>
          {(booking.durationMinutes || booking.sessionType?.durationMinutes) && (
            <div className={'flex items-center gap-2'}>
              <CalendarCheck className={'text-muted-foreground h-4 w-4 shrink-0'} />
              <span className={'text-foreground text-sm'}>
                {tc('workout')}
                <span className={'text-muted-foreground'}>
                  {' '}
                  {'· '}
                  {booking.durationMinutes || booking.sessionType?.durationMinutes} {tc('min')}
                </span>
              </span>
            </div>
          )}
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${statusColor}`}>
          {tst(statusKey)}
        </span>
      </div>

      {/***************************************************************************************************
       * Action area.
       ***************************************************************************************************/}
      {isConfirmed && (
        <div className={'border-border border-t pt-3'}>
          <button
            onClick={() => onRequestCancel(booking)}
            className={
              'bg-background text-destructive flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-opacity active:opacity-70'
            }
          >
            <X className={'h-4 w-4'} />
            {tc('cancelVerb')}
          </button>
        </div>
      )}

      {isReschedulePending && replacedBooking && (
        <div className={'text-muted-foreground mb-2 text-xs'}>
          <span>{t('rescheduleOldLabel')}</span>{' '}
          <span className={'line-through'}>
            {formatBookingDate(replacedBooking.startsAt)} {formatTime(replacedBooking.startsAt)}
          </span>
        </div>
      )}

      {isReschedulePending && booking.clientMessage && (
        <div className={'bg-background mb-2 rounded-lg px-3 py-2'}>
          <p className={'text-muted-foreground text-xs'}>{t('specialistNote')}</p>
          <p className={'text-foreground mt-1 text-sm whitespace-pre-wrap'}>
            {booking.clientMessage}
          </p>
        </div>
      )}

      {isReschedulePending && onApproveReschedule && onDeclineReschedule ? (
        <div className={'border-border space-y-2 border-t pt-3'}>
          <button
            onClick={async () => onApproveReschedule(booking)}
            disabled={rescheduleBusy}
            className={
              'bg-action-confirm-bg text-action-confirm-text w-full rounded-lg px-4 py-2 text-sm font-medium transition-opacity active:opacity-70 disabled:opacity-60'
            }
          >
            {t('approveRescheduleButton')}
          </button>
          <button
            onClick={async () => onDeclineReschedule(booking)}
            disabled={rescheduleBusy}
            className={
              'bg-background text-destructive w-full rounded-lg px-4 py-2 text-sm font-medium transition-opacity active:opacity-70 disabled:opacity-60'
            }
          >
            {t('declineRescheduleButton')}
          </button>
        </div>
      ) : isReschedulePending ? (
        <div className={'border-border border-t pt-3'}>
          <div className={'flex items-center justify-center gap-2'}>
            <ArrowRight className={'text-status-purple-text h-4 w-4'} />
            <span className={'text-status-purple-text text-sm'}>
              {t('awaitingRescheduleConfirmation')}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
