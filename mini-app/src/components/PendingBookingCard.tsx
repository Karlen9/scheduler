'use client';

import { Check, MessageCircle, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { memo } from 'react';

import { ClientAvatar } from '@/components/ClientAvatar';

import type { TPendingBookingCardProps } from '@/lib/types';
import type { ReactNode } from 'react';

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
 * Defines the day short keys js value used by the component layer.
 *
 * Usage context:
 * - Reused by the component layer to keep shared values centralized.
 ***************************************************************************************************/
const dayShortKeysJS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

/***************************************************************************************************
 * Renders the pending booking card UI and related interactions.
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
function PendingBookingCardComponent({
  booking,
  onAccept,
  onReject,
  onMessageClient,
}: TPendingBookingCardProps): ReactNode {
  /***************************************************************************************************
   * Defines the t value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const t = useTranslations('PendingBookingCard');
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
     * Defines the day key value used by the component layer.
     *
     * Usage context:
     * - Reused by the component layer to keep shared values centralized.
     ***************************************************************************************************/
    const dayKey = dayShortKeysJS[date.getUTCDay()];
    /***************************************************************************************************
     * Defines the month key value used by the component layer.
     *
     * Usage context:
     * - Reused by the component layer to keep shared values centralized.
     ***************************************************************************************************/
    const monthKey = monthShortKeys[date.getUTCMonth()];
    return `${td(`daysShort.${dayKey}`)}, ${date.getUTCDate()} ${td(`monthsShort.${monthKey}`)}`;
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
    <div className={'bg-card border-l-warning rounded-xl border-l-4 p-4'}>
      <div className={'flex items-start gap-3'}>
        <ClientAvatar
          name={booking.clientDisplayName || booking.clientName}
          photoUrl={booking.clientPhotoUrl}
        />
        <div className={'min-w-0 flex-1'}>
          <p className={'text-foreground truncate font-medium'}>
            {booking.clientDisplayName || booking.clientName}
          </p>
          <p className={'text-muted-foreground text-sm'}>
            {tc('workout')}
            {booking.durationMinutes
              ? ` · ${booking.durationMinutes} ${tc('min')}`
              : booking.sessionType?.durationMinutes
                ? ` · ${booking.sessionType.durationMinutes} ${tc('min')}`
                : ''}
          </p>
          <p className={'text-foreground mt-1 text-sm'}>
            {formatDate(startsAt)}
            {', '}
            {formatTime(startsAt)}
            {' – '}
            {formatTime(endsAt)}
          </p>
          {booking.clientMessage && (
            <p className={'text-muted-foreground mt-1 text-xs italic'}>
              &ldquo;{booking.clientMessage}&rdquo;
            </p>
          )}
        </div>
      </div>

      {onMessageClient && !booking.clientIsGhost && booking.clientTelegramUserId && (
        <button
          type={'button'}
          onClick={() => onMessageClient(booking)}
          className={
            'bg-card border-border text-foreground mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border py-2 text-sm font-medium transition-opacity active:opacity-70'
          }
        >
          <MessageCircle className={'h-4 w-4'} />
          {t('message')}
        </button>
      )}

      <div className={'mt-3 flex gap-2'}>
        <button
          type={'button'}
          onClick={() => onAccept(booking)}
          className={
            'bg-action-success-bg text-action-success-text flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition-opacity active:opacity-70'
          }
        >
          <Check className={'h-4 w-4'} />
          {t('accept')}
        </button>
        <button
          type={'button'}
          onClick={() => onReject(booking)}
          className={
            'bg-action-danger-bg text-action-danger-text flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition-opacity active:opacity-70'
          }
        >
          <X className={'h-4 w-4'} />
          {t('reject')}
        </button>
      </div>
    </div>
  );
}

export const PendingBookingCard = memo(PendingBookingCardComponent);
