import { ArrowRight, Calendar, Check, Clock, X } from 'lucide-react';

import { ClientAvatar } from '@/components/ClientAvatar';
import { bookingStatusColors, bookingStatusKeys } from '@/lib/mappings';

import type { TBookingRowProps } from '@/lib/types';
import type { ReactNode } from 'react';

/***************************************************************************************************
 * Renders the booking row UI and related interactions.
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
export function BookingRow({
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
}: TBookingRowProps): ReactNode {
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
   * Defines the is this loading value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const isThisLoading = actionLoading === booking.id;

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
            <Calendar className={'text-muted-foreground h-4 w-4'} />
            <span className={'text-foreground text-sm'}>{formatDate(booking.startsAt)}</span>
          </div>
          <div className={'flex items-center gap-2'}>
            <Clock className={'text-muted-foreground h-4 w-4'} />
            <span className={'text-foreground text-sm'}>
              {formatTime(booking.startsAt)}
              {' — '}
              {formatTime(booking.endsAt)}
            </span>
          </div>
          <div className={'flex items-center gap-2'}>
            <ClientAvatar
              name={booking.clientDisplayName || booking.clientName}
              photoUrl={booking.clientPhotoUrl}
              size={'sm'}
            />
            <span className={'text-foreground text-sm'}>
              {booking.clientDisplayName || booking.clientName}
            </span>
          </div>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap ${statusColor}`}
        >
          {tst(statusKey)}
        </span>
      </div>

      {/***************************************************************************************************
       * Confirmed: Cancel button.
       ***************************************************************************************************/}
      {isConfirmed && (
        <div className={'border-border border-t pt-3'}>
          <button
            onClick={() => onRequestCancel(booking)}
            disabled={isThisLoading}
            className={
              'bg-background text-destructive w-full rounded-lg px-4 py-2 text-sm font-medium transition-opacity active:opacity-70 disabled:opacity-40'
            }
          >
            {isThisLoading ? tc('cancelling') : tc('cancelVerb')}
          </button>
        </div>
      )}

      {/***************************************************************************************************
       * Reschedule pending: Approve/Decline with new time.
       ***************************************************************************************************/}
      {isReschedulePending && (
        <div className={'border-border space-y-2 border-t pt-3'}>
          <div className={'text-status-purple-text flex items-center gap-2 text-xs'}>
            <span>{t('rescheduleRequest')}</span>
            <ArrowRight className={'h-3 w-3'} />
            <span className={'font-medium'}>
              {formatDate(booking.startsAt)}
              {', '}
              {formatTime(booking.startsAt)}
            </span>
          </div>
          <div className={'flex gap-2'}>
            <button
              onClick={() => onApproveMoveBooking(booking)}
              disabled={isThisLoading}
              className={
                'bg-action-success-bg text-action-success-text flex flex-1 items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-opacity active:opacity-70 disabled:opacity-40'
              }
            >
              <Check className={'h-4 w-4'} />
              {tc('confirm')}
            </button>
            <button
              onClick={() => onDeclineMoveBooking(booking)}
              disabled={isThisLoading}
              className={
                'bg-action-danger-bg text-action-danger-text flex flex-1 items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-opacity active:opacity-70 disabled:opacity-40'
              }
            >
              <X className={'h-4 w-4'} />
              {tst('declined')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
