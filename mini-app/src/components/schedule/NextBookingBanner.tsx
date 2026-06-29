'use client';

import { Plus } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';

import { ClientAvatar } from '@/components/ClientAvatar';
import { wallClockNow } from '@/lib/helpers';
import { resolveTestAwareHref } from '@/lib/routes';

import type { TNextBookingBannerProps } from '@/lib/types';
import type { ReactNode } from 'react';

/***************************************************************************************************
 * Renders the next booking banner UI and related interactions.
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
export function NextBookingBanner({ booking, onBookingClick }: TNextBookingBannerProps): ReactNode {
  /***************************************************************************************************
   * Defines the router value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const router = useRouter();
  const pathname = usePathname();
  /***************************************************************************************************
   * Defines the t value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const t = useTranslations('NextBookingBanner');
  /***************************************************************************************************
   * Defines the tc value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const tc = useTranslations('Common');
  /***************************************************************************************************
   * Defines the tu value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const tu = useTranslations('TimeUnits');
  /***************************************************************************************************
   * Defines the locale value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const locale = useLocale();

  /***************************************************************************************************
   * Formats time.
   *
   * Parameters:
   * - iso: Boolean flag that influences the current operation.
   *
   * Returns:
   * - The computed value for the current operation as string.
   *
   * Side effects:
   * - May derive UI state, invoke callbacks, and trigger user-facing rendering updates.
   ***************************************************************************************************/
  function formatTime(iso: string): string {
    /***************************************************************************************************
     * Defines the d value used by the component layer.
     *
     * Usage context:
     * - Reused by the component layer to keep shared values centralized.
     ***************************************************************************************************/
    const d = new Date(iso);
    return d.toLocaleTimeString(locale === 'en' ? 'en-US' : 'ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC',
    });
  }

  /***************************************************************************************************
   * Returns time until.
   *
   * Parameters:
   * - iso: Boolean flag that influences the current operation.
   *
   * Returns:
   * - The computed value for the current operation as string.
   *
   * Side effects:
   * - May derive UI state, invoke callbacks, and trigger user-facing rendering updates.
   ***************************************************************************************************/
  function getTimeUntil(iso: string): string {
    /***************************************************************************************************
     * Defines the now value used by the component layer.
     *
     * Usage context:
     * - Reused by the component layer to keep shared values centralized.
     ***************************************************************************************************/
    const start = new Date(iso);
    /***************************************************************************************************
     * Defines the diff value used by the component layer.
     *
     * Usage context:
     * - Reused by the component layer to keep shared values centralized.
     ***************************************************************************************************/
    const diff = start.getTime() - wallClockNow();
    if (diff <= 0) {
      return tu('now');
    }
    /***************************************************************************************************
     * Defines the minutes value used by the component layer.
     *
     * Usage context:
     * - Reused by the component layer to keep shared values centralized.
     ***************************************************************************************************/
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) {
      /***************************************************************************************************
       * Defines the word value used by the component layer.
       *
       * Usage context:
       * - Reused by the component layer to keep shared values centralized.
       ***************************************************************************************************/
      const word = minuteWord(minutes);
      return tu('inMinutes', { count: minutes, word });
    }
    /***************************************************************************************************
     * Defines the hours value used by the component layer.
     *
     * Usage context:
     * - Reused by the component layer to keep shared values centralized.
     ***************************************************************************************************/
    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
      const remainingMins = minutes % 60;
      if (remainingMins === 0) {
        return tu('inHours', { count: hours, word: hourWord(hours) });
      }
      return tu('inHoursAndMinutes', { hours, hoursWord: hourWord(hours), mins: remainingMins });
    }
    /***************************************************************************************************
     * Defines the days value used by the component layer.
     *
     * Usage context:
     * - Reused by the component layer to keep shared values centralized.
     ***************************************************************************************************/
    const days = Math.floor(hours / 24);
    /***************************************************************************************************
     * Defines the word value used by the component layer.
     *
     * Usage context:
     * - Reused by the component layer to keep shared values centralized.
     ***************************************************************************************************/
    const word = dayWord(days);
    return tu('inDays', { count: days, word });
  }

  /***************************************************************************************************
   * Implements the minute word logic used by this module.
   *
   * Parameters:
   * - n: N used by the current operation.
   *
   * Returns:
   * - The computed value for the current operation as string.
   *
   * Side effects:
   * - May derive UI state, invoke callbacks, and trigger user-facing rendering updates.
   ***************************************************************************************************/
  function minuteWord(n: number): string {
    if (n % 10 === 1 && n % 100 !== 11) {
      return tu('minute1');
    }
    if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) {
      return tu('minute234');
    }
    return tu('minute5');
  }

  /***************************************************************************************************
   * Implements the hour word logic used by this module.
   *
   * Parameters:
   * - n: N used by the current operation.
   *
   * Returns:
   * - The computed value for the current operation as string.
   *
   * Side effects:
   * - May derive UI state, invoke callbacks, and trigger user-facing rendering updates.
   ***************************************************************************************************/
  function hourWord(n: number): string {
    if (n % 10 === 1 && n % 100 !== 11) {
      return tu('hour1');
    }
    if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) {
      return tu('hour234');
    }
    return tu('hour5');
  }

  /***************************************************************************************************
   * Implements the day word logic used by this module.
   *
   * Parameters:
   * - n: N used by the current operation.
   *
   * Returns:
   * - The computed value for the current operation as string.
   *
   * Side effects:
   * - May derive UI state, invoke callbacks, and trigger user-facing rendering updates.
   ***************************************************************************************************/
  function dayWord(n: number): string {
    if (n % 10 === 1 && n % 100 !== 11) {
      return tu('day1');
    }
    if ([2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100)) {
      return tu('day234');
    }
    return tu('day5');
  }

  if (!booking) {
    return (
      <div className={'px-4 pt-4'}>
        <h2 className={'text-foreground mb-3 text-base font-medium'}>{t('title')}</h2>
        <div className={'bg-card border-l-border rounded-xl border-l-4 p-4'}>
          <div className={'flex items-center justify-between'}>
            <div>
              <p className={'text-muted-foreground font-medium'}>{t('noBookings')}</p>
              <p className={'text-muted-foreground/60 mt-0.5 text-sm'}>{t('noUpcomingSessions')}</p>
            </div>
            <button
              onClick={() => router.push(resolveTestAwareHref(pathname, '/admin/choose-client'))}
              className={
                'bg-brand flex h-10 w-10 items-center justify-center rounded-full transition-opacity active:opacity-80'
              }
            >
              <Plus className={'h-5 w-5 text-white'} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={'px-4 pt-4'}>
      <h2 className={'text-foreground mb-3 text-base font-medium'}>{t('title')}</h2>
      <button
        onClick={() => onBookingClick?.(booking)}
        className={
          'bg-card border-l-brand w-full rounded-xl border-l-4 p-4 text-left transition-opacity active:opacity-80'
        }
      >
        <div className={'flex items-center gap-3'}>
          <div className={'min-w-0 flex-1'}>
            <p className={'text-foreground truncate font-medium'}>
              {booking.clientDisplayName || booking.clientName}
            </p>
            <p className={'text-muted-foreground text-sm'}>
              {tc('workout')}
              {booking.durationMinutes ? ` \u00b7 ${booking.durationMinutes} ${tc('min')}` : ''}
            </p>
            <p className={'text-brand mt-1 text-xs'}>{getTimeUntil(booking.startsAt)}</p>
            <p className={'text-foreground mt-0.5 text-sm'}>
              {formatTime(booking.startsAt)}
              {' – '}
              {formatTime(booking.endsAt)}
            </p>
          </div>
          <ClientAvatar
            name={booking.clientDisplayName || booking.clientName}
            photoUrl={booking.clientPhotoUrl}
            size={'lg'}
          />
        </div>
      </button>
    </div>
  );
}
