import { ArrowRight, Calendar, Clock, Dumbbell, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { formatTime } from '@/lib/helpers';
import { bookingStatusColors, bookingStatusKeys } from '@/lib/mappings';

import type { TBookingCardItemProps } from '@/lib/types';
import type { ReactNode } from 'react';

export function BookingCardItem({
  booking,
  onRequestCancel,
  formatBookingDate,
}: TBookingCardItemProps): ReactNode {
  const tc = useTranslations('Common');
  const tst = useTranslations('Status');
  const t = useTranslations('RecurringDetail');

  const statusColor = bookingStatusColors[booking.status] || bookingStatusColors.pending;
  const statusKey = bookingStatusKeys[booking.status] || 'pending';
  const isConfirmed = booking.status === 'confirmed';
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
              <Dumbbell className={'text-muted-foreground h-4 w-4 shrink-0'} />
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

      {/* Action area */}
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

      {isReschedulePending && (
        <div className={'border-border border-t pt-3'}>
          <div className={'flex items-center justify-center gap-2'}>
            <ArrowRight className={'text-status-purple-text h-4 w-4'} />
            <span className={'text-status-purple-text text-sm'}>
              {t('awaitingRescheduleConfirmation')}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
