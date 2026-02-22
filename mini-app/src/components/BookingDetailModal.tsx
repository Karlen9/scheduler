'use client';

import { useLocale, useTranslations } from 'next-intl';

import { BottomSheet } from '@/components/BottomSheet';
import { ClientAvatar } from '@/components/ClientAvatar';
import { StatusBadge } from '@/components/StatusBadge';
import { dayFullLowerKeysJS } from '@/lib/constants';
import { monthGenKeys } from '@/lib/mappings';

import type { TBooking, TVoidFunction } from '@/lib/types';
import type { ReactNode } from 'react';

type TBookingDetailModalProps = {
  booking: TBooking | null;
  isOpen: boolean;
  onClose: TVoidFunction;
  onReschedule?: (booking: TBooking) => void;
  onCancel?: (booking: TBooking) => void;
  onAccept?: (booking: TBooking) => void;
  onReject?: (booking: TBooking) => void;
};

export function BookingDetailModal({
  booking,
  isOpen,
  onClose,
  onReschedule,
  onCancel,
  onAccept,
  onReject,
}: TBookingDetailModalProps): ReactNode {
  const t = useTranslations('BookingDetailModal');
  const tc = useTranslations('Common');
  const td = useTranslations('Dates');
  const locale = useLocale();

  if (!booking) {
    return null;
  }

  const startsAt = new Date(booking.startsAt);
  const endsAt = new Date(booking.endsAt);

  function formatDate(date: Date): string {
    const monthKey = monthGenKeys[date.getUTCMonth()];
    const dayKey = dayFullLowerKeysJS[date.getUTCDay()];
    return `${date.getUTCDate()} ${td(`monthsGen.${monthKey}`)}, ${td(`daysFullLower.${dayKey}`)}`;
  }

  function formatTime(date: Date): string {
    return date.toLocaleTimeString(locale === 'en' ? 'en-US' : 'ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC',
    });
  }

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} showClose>
      {/* Client info */}
      <div className={'mb-4 flex items-center gap-4'}>
        <ClientAvatar
          name={booking.clientDisplayName || booking.clientName}
          photoUrl={booking.clientPhotoUrl}
          size={'lg'}
        />
        <div>
          <h3 className={'text-foreground text-xl font-medium'}>
            {booking.clientDisplayName || booking.clientName}
          </h3>
          <StatusBadge status={booking.status} className={'inline-block px-2 py-0.5'} />
        </div>
      </div>

      {/* Booking details */}
      <div className={'mb-6 space-y-3'}>
        <div className={'border-border flex justify-between border-b py-2'}>
          <span className={'text-muted-foreground'}>{t('serviceLabel')}</span>
          <span className={'text-foreground font-medium'}>{tc('workout')}</span>
        </div>
        <div className={'border-border flex justify-between border-b py-2'}>
          <span className={'text-muted-foreground'}>{t('dateLabel')}</span>
          <span className={'text-foreground font-medium'}>{formatDate(startsAt)}</span>
        </div>
        <div className={'border-border flex justify-between border-b py-2'}>
          <span className={'text-muted-foreground'}>{t('timeLabel')}</span>
          <span className={'text-foreground font-medium'}>
            {formatTime(startsAt)}
            {' – '}
            {formatTime(endsAt)}
          </span>
        </div>
        {(booking.durationMinutes || booking.sessionType?.durationMinutes) && (
          <div className={'border-border flex justify-between border-b py-2'}>
            <span className={'text-muted-foreground'}>{t('durationLabel')}</span>
            <span className={'text-foreground font-medium'}>
              {booking.durationMinutes || booking.sessionType?.durationMinutes} {tc('min')}
            </span>
          </div>
        )}
        {booking.clientMessage && (
          <div className={'border-border border-b py-2'}>
            <span className={'text-muted-foreground text-sm'}>{t('clientComment')}</span>
            <p className={'text-foreground mt-1 text-sm'}>{booking.clientMessage}</p>
          </div>
        )}
        {booking.cancelReason && (
          <div className={'border-border border-b py-2'}>
            <span className={'text-muted-foreground text-sm'}>{t('cancelReason')}</span>
            <p className={'text-foreground mt-1 text-sm'}>
              {t.has(`cancelReasons.${booking.cancelReason}`)
                ? t(`cancelReasons.${booking.cancelReason}`)
                : booking.cancelReason}
            </p>
          </div>
        )}
      </div>

      {/* Waiting for client response on specialist-created bookings */}
      {booking.status === 'pending' && booking.createdBy === 'specialist' && (
        <div className={'text-secondary mb-3 py-2 text-center text-sm'}>
          {t('waitingForClient')}
        </div>
      )}

      {/* Accept / Reject for pending client-created bookings */}
      {booking.status === 'pending' &&
        booking.createdBy !== 'specialist' &&
        (onAccept || onReject) && (
          <div className={'mb-3 flex gap-3'}>
            <button
              onClick={() => onAccept?.(booking)}
              className={
                'bg-action-confirm-bg text-action-confirm-text flex-1 rounded-[28px] px-4 py-3 text-sm font-medium transition-opacity active:opacity-80'
              }
            >
              {tc('confirm')}
            </button>
            <button
              onClick={() => onReject?.(booking)}
              className={
                'bg-action-danger-bg text-action-danger-text flex-1 rounded-[28px] px-4 py-3 text-sm font-medium transition-opacity active:opacity-80'
              }
            >
              {tc('cancelVerb')}
            </button>
          </div>
        )}

      {/* Actions */}
      {(booking.status === 'pending' || booking.status === 'confirmed') && (
        <div className={'flex gap-3'}>
          <button
            onClick={() => onReschedule?.(booking)}
            className={
              'bg-card text-foreground flex-1 rounded-[28px] px-4 py-3 text-sm font-medium transition-opacity active:opacity-80'
            }
          >
            {t('rescheduleButton')}
          </button>
          <button
            onClick={() => onCancel?.(booking)}
            className={
              'bg-action-danger-bg text-action-danger-text flex-1 rounded-[28px] px-4 py-3 text-sm font-medium transition-opacity active:opacity-80'
            }
          >
            {t('cancelButton')}
          </button>
        </div>
      )}
    </BottomSheet>
  );
}
