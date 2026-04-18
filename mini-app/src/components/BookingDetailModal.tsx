'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

import { BottomSheet } from '@/components/BottomSheet';
import { ClientAvatar } from '@/components/ClientAvatar';
import { StatusBadge } from '@/components/StatusBadge';
import { dayFullLowerKeysJS } from '@/lib/constants';
import { monthGenKeys } from '@/lib/mappings';

import type { TBookingDetailModalProps } from '@/lib/types';
import type { ReactNode } from 'react';

/***************************************************************************************************
 * Renders the booking detail modal UI and related interactions.
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
export function BookingDetailModal({
  booking,
  isOpen,
  onClose,
  onReschedule,
  onCancel,
  onAccept,
  onReject,
  onMessageClient,
  onApproveReschedule,
  onDeclineReschedule,
}: TBookingDetailModalProps): ReactNode {
  /***************************************************************************************************
   * Defines the t value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const t = useTranslations('BookingDetailModal');
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
   * Defines the locale value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const locale = useLocale();
  const [retainedBooking, setRetainedBooking] = useState(booking);

  useEffect(() => {
    if (booking) {
      setRetainedBooking(booking);
    }
  }, [booking]);

  const displayBooking = booking ?? retainedBooking;

  if (!displayBooking) {
    return null;
  }

  /***************************************************************************************************
   * Defines the starts at value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const startsAt = new Date(displayBooking.startsAt);
  /***************************************************************************************************
   * Defines the ends at value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const endsAt = new Date(displayBooking.endsAt);
  const canMessageClient =
    !!onMessageClient && !displayBooking.clientIsGhost && !!displayBooking.clientTelegramUserId;

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
    /***************************************************************************************************
     * Defines the month key value used by the component layer.
     *
     * Usage context:
     * - Reused by the component layer to keep shared values centralized.
     ***************************************************************************************************/
    const monthKey = monthGenKeys[date.getUTCMonth()];
    /***************************************************************************************************
     * Defines the day key value used by the component layer.
     *
     * Usage context:
     * - Reused by the component layer to keep shared values centralized.
     ***************************************************************************************************/
    const dayKey = dayFullLowerKeysJS[date.getUTCDay()];
    return `${date.getUTCDate()} ${td(`monthsGen.${monthKey}`)}, ${td(`daysFullLower.${dayKey}`)}`;
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
    <BottomSheet isOpen={isOpen} onClose={onClose} showClose>
      {/***************************************************************************************************
       * Client info.
       ***************************************************************************************************/}
      <div className={'mb-4 flex items-center gap-4'}>
        <ClientAvatar
          name={displayBooking.clientDisplayName || displayBooking.clientName}
          photoUrl={displayBooking.clientPhotoUrl}
          size={'lg'}
        />
        <div>
          <h3 className={'text-foreground text-xl font-medium'}>
            {displayBooking.clientDisplayName || displayBooking.clientName}
          </h3>
          <StatusBadge status={displayBooking.status} className={'inline-block px-2 py-0.5'} />
        </div>
      </div>

      {/***************************************************************************************************
       * Booking details.
       ***************************************************************************************************/}
      <div className={'mb-6 space-y-3'}>
        <div className={'border-border flex justify-between border-b py-2'}>
          <span className={'text-muted-foreground'}>{t('serviceLabel')}</span>
          <span className={'text-foreground font-medium'}>
            {displayBooking.sessionType?.name || tc('workout')}
          </span>
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
        {(displayBooking.durationMinutes || displayBooking.sessionType?.durationMinutes) && (
          <div className={'border-border flex justify-between border-b py-2'}>
            <span className={'text-muted-foreground'}>{t('durationLabel')}</span>
            <span className={'text-foreground font-medium'}>
              {displayBooking.durationMinutes || displayBooking.sessionType?.durationMinutes}{' '}
              {tc('min')}
            </span>
          </div>
        )}
        {displayBooking.clientMessage && displayBooking.status !== 'reschedule_pending' && (
          <div className={'border-border border-b py-2'}>
            <span className={'text-muted-foreground text-sm'}>{t('clientComment')}</span>
            <p className={'text-foreground mt-1 text-sm'}>{displayBooking.clientMessage}</p>
          </div>
        )}
        {displayBooking.cancelReason && (
          <div className={'border-border border-b py-2'}>
            <span className={'text-muted-foreground text-sm'}>{t('cancelReason')}</span>
            <p className={'text-foreground mt-1 text-sm'}>
              {t.has(`cancelReasons.${displayBooking.cancelReason}`)
                ? t(`cancelReasons.${displayBooking.cancelReason}`)
                : displayBooking.cancelReason}
            </p>
          </div>
        )}
      </div>

      {/***************************************************************************************************
       * Action-block selection:
       * - pending + admin-created: waiting message + Reschedule/Cancel (admin can't "confirm" their own request)
       * - pending + client-created: Accept/Reject only (approve or decline the request)
       * - confirmed: Reschedule/Cancel
       *
       * The two action blocks are mutually exclusive so the modal never shows a redundant
       * Cancel/Reject pair or a misleading Confirm on a booking the admin originated.
       ***************************************************************************************************/}
      {(() => {
        const isPending = displayBooking.status === 'pending';
        const isConfirmed = displayBooking.status === 'confirmed';
        const isReschedulePending = displayBooking.status === 'reschedule_pending';
        const createdByAdmin = displayBooking.createdBy === 'specialist';
        const showApprovalActions = isPending && !createdByAdmin && (onAccept || onReject);
        const showManageActions = isConfirmed || (isPending && createdByAdmin);
        const showRescheduleApproval =
          isReschedulePending && (onApproveReschedule || onDeclineReschedule);

        return (
          <>
            {isPending && createdByAdmin && (
              <div className={'text-secondary mb-3 py-2 text-center text-sm'}>
                {t('waitingForClient')}
              </div>
            )}

            {isReschedulePending && displayBooking.clientMessage && (
              <div className={'bg-card mb-3 rounded-lg px-3 py-2'}>
                <p className={'text-muted-foreground text-xs'}>{t('specialistNote')}</p>
                <p className={'text-foreground mt-1 text-sm whitespace-pre-wrap'}>
                  {displayBooking.clientMessage}
                </p>
              </div>
            )}

            {showRescheduleApproval && (
              <div className={'mb-3 flex gap-3'}>
                <button
                  onClick={() => onApproveReschedule?.(displayBooking)}
                  className={
                    'bg-action-confirm-bg text-action-confirm-text flex-1 rounded-[28px] px-4 py-3 text-sm font-medium transition-opacity active:opacity-80'
                  }
                >
                  {t('approveRescheduleButton')}
                </button>
                <button
                  onClick={() => onDeclineReschedule?.(displayBooking)}
                  className={
                    'bg-action-danger-bg text-action-danger-text flex-1 rounded-[28px] px-4 py-3 text-sm font-medium transition-opacity active:opacity-80'
                  }
                >
                  {t('declineRescheduleButton')}
                </button>
              </div>
            )}

            {showApprovalActions && (
              <div className={'mb-3 flex gap-3'}>
                <button
                  onClick={() => onAccept?.(displayBooking)}
                  className={
                    'bg-action-confirm-bg text-action-confirm-text flex-1 rounded-[28px] px-4 py-3 text-sm font-medium transition-opacity active:opacity-80'
                  }
                >
                  {tc('confirm')}
                </button>
                <button
                  onClick={() => onReject?.(displayBooking)}
                  className={
                    'bg-action-danger-bg text-action-danger-text flex-1 rounded-[28px] px-4 py-3 text-sm font-medium transition-opacity active:opacity-80'
                  }
                >
                  {tc('cancelVerb')}
                </button>
              </div>
            )}

            {canMessageClient && (
              <button
                onClick={() => onMessageClient(displayBooking)}
                className={
                  'bg-card text-foreground mb-3 w-full rounded-[28px] px-4 py-3 text-sm font-medium transition-opacity active:opacity-80'
                }
              >
                {t('messageClientButton')}
              </button>
            )}

            {showManageActions && (
              <div className={'flex gap-3'}>
                <button
                  onClick={() => onReschedule?.(displayBooking)}
                  className={
                    'bg-card text-foreground flex-1 rounded-[28px] px-4 py-3 text-sm font-medium transition-opacity active:opacity-80'
                  }
                >
                  {t('rescheduleButton')}
                </button>
                <button
                  onClick={() => onCancel?.(displayBooking)}
                  className={
                    'bg-action-danger-bg text-action-danger-text flex-1 rounded-[28px] px-4 py-3 text-sm font-medium transition-opacity active:opacity-80'
                  }
                >
                  {t('cancelButton')}
                </button>
              </div>
            )}
          </>
        );
      })()}
    </BottomSheet>
  );
}
