'use client';

import { Plus } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo } from 'react';

import { CurrentTimeIndicator } from './CurrentTimeIndicator';
import { TimelineBookingCard } from './TimelineBookingCard';
import { TimelineEmptySlot } from './TimelineEmptySlot';

import type { TDayTimelineProps, TEmptySlot } from '@/lib/types';
import type { ReactNode } from 'react';

/***************************************************************************************************
 * Defines the hour height value used by the component layer.
 *
 * Usage context:
 * - Reused by the component layer to keep shared values centralized.
 ***************************************************************************************************/
const HOUR_HEIGHT = 72;

/***************************************************************************************************
 * Formats hour.
 *
 * Parameters:
 * - hour: Hour used by the current operation.
 *
 * Returns:
 * - The computed value for the current operation as string.
 *
 * Side effects:
 * - May derive UI state, invoke callbacks, and trigger user-facing rendering updates.
 ***************************************************************************************************/
function formatHour(hour: number): string {
  return `${hour.toString().padStart(2, '0')}:00`;
}

/***************************************************************************************************
 * Checks whether same day.
 *
 * Parameters:
 * - a: A used by the current operation.
 * - b: B used by the current operation.
 *
 * Returns:
 * - The computed value for the current operation as boolean.
 *
 * Side effects:
 * - May derive UI state, invoke callbacks, and trigger user-facing rendering updates.
 ***************************************************************************************************/
function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/***************************************************************************************************
 * Parses time to min.
 *
 * Parameters:
 * - time: Time value used by the current operation.
 *
 * Returns:
 * - The computed value for the current operation as number.
 *
 * Side effects:
 * - May derive UI state, invoke callbacks, and trigger user-facing rendering updates.
 ***************************************************************************************************/
function parseTimeToMin(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/***************************************************************************************************
 * Formats minutes from midnight as HH:MM.
 *
 * Parameters:
 * - minutes: Minutes used by the current operation.
 *
 * Returns:
 * - The computed value for the current operation as string.
 *
 * Side effects:
 * - May derive UI state, invoke callbacks, and trigger user-facing rendering updates.
 ***************************************************************************************************/
function formatMinuteTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

/***************************************************************************************************
 * Renders the day timeline UI and related interactions.
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
export function DayTimeline({
  bookings,
  date,
  onBookingClick,
  workingHours,
  onEmptySlotClick,
}: TDayTimelineProps): ReactNode {
  /***************************************************************************************************
   * Defines the t value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const t = useTranslations('DayTimeline');
  /***************************************************************************************************
   * Defines the locale value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const locale = useLocale();

  /***************************************************************************************************
   * Defines the today value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const today = useMemo(() => new Date(), []);
  /***************************************************************************************************
   * Defines the is today value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const isToday = isSameDay(date, today);

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
   * Get working hours for this day of week.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const dayWH = useMemo(() => {
    if (!workingHours) {
      return [];
    }
    /***************************************************************************************************
     * Defines the dow value used by the component layer.
     *
     * Usage context:
     * - Reused by the component layer to keep shared values centralized.
     ***************************************************************************************************/
    const dow = date.getDay(); // 0=Sun
    return [...workingHours]
      .filter((wh) => wh.dayOfWeek === dow)
      .sort((a, b) => parseTimeToMin(a.startTime) - parseTimeToMin(b.startTime));
  }, [workingHours, date]);

  /***************************************************************************************************
   * Calculate empty slots (gaps between bookings within working hours).
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const emptySlots = useMemo<TEmptySlot[]>(() => {
    if (dayWH.length === 0) {
      return [];
    }

    /***************************************************************************************************
     * Get sorted occupied ranges.
     *
     * Usage context:
     * - Reused by the component layer to keep shared values centralized.
     ***************************************************************************************************/
    const occupied = bookings
      .map((b) => {
        /***************************************************************************************************
         * Defines the s value used by the component layer.
         *
         * Usage context:
         * - Reused by the component layer to keep shared values centralized.
         ***************************************************************************************************/
        const s = new Date(b.startsAt);
        /***************************************************************************************************
         * Defines the e value used by the component layer.
         *
         * Usage context:
         * - Reused by the component layer to keep shared values centralized.
         ***************************************************************************************************/
        const e = new Date(b.endsAt);
        return {
          start: s.getUTCHours() * 60 + s.getUTCMinutes(),
          end: e.getUTCHours() * 60 + e.getUTCMinutes(),
        };
      })
      .sort((a, b) => a.start - b.start);

    const gaps: TEmptySlot[] = [];

    for (const interval of dayWH) {
      /***************************************************************************************************
       * Defines the wh start value used by the component layer.
       *
       * Usage context:
       * - Reused by the component layer to keep shared values centralized.
       ***************************************************************************************************/
      const whStart = parseTimeToMin(interval.startTime);
      /***************************************************************************************************
       * Defines the wh end value used by the component layer.
       *
       * Usage context:
       * - Reused by the component layer to keep shared values centralized.
       ***************************************************************************************************/
      const whEnd = parseTimeToMin(interval.endTime);
      /***************************************************************************************************
       * Defines the cursor value used by the component layer.
       *
       * Usage context:
       * - Reused by the component layer to keep shared values centralized.
       ***************************************************************************************************/
      let cursor = whStart;

      for (const slot of occupied) {
        if (slot.end <= whStart || slot.start >= whEnd) {
          continue;
        }
        /***************************************************************************************************
         * Defines the slot start value used by the component layer.
         *
         * Usage context:
         * - Reused by the component layer to keep shared values centralized.
         ***************************************************************************************************/
        const slotStart = Math.max(slot.start, whStart);
        /***************************************************************************************************
         * Defines the slot end value used by the component layer.
         *
         * Usage context:
         * - Reused by the component layer to keep shared values centralized.
         ***************************************************************************************************/
        const slotEnd = Math.min(slot.end, whEnd);
        if (cursor < slotStart) {
          gaps.push({ startMin: cursor, endMin: slotStart });
        }
        cursor = Math.max(cursor, slotEnd);
      }

      if (cursor < whEnd) {
        gaps.push({ startMin: cursor, endMin: whEnd });
      }
    }

    return gaps;
  }, [bookings, dayWH]);

  /***************************************************************************************************
   * Determine hour range -- extend to working hours if available.
   ***************************************************************************************************/
  const { minHour, maxHour } = useMemo(() => {
    /***************************************************************************************************
     * Defines the min value used by the component layer.
     *
     * Usage context:
     * - Reused by the component layer to keep shared values centralized.
     ***************************************************************************************************/
    let min = 23;
    /***************************************************************************************************
     * Defines the max value used by the component layer.
     *
     * Usage context:
     * - Reused by the component layer to keep shared values centralized.
     ***************************************************************************************************/
    let max = 0;

    if (dayWH.length > 0) {
      min = Math.floor(Math.min(...dayWH.map((wh) => parseTimeToMin(wh.startTime))) / 60);
      max = Math.ceil(Math.max(...dayWH.map((wh) => parseTimeToMin(wh.endTime))) / 60);
    }

    for (const b of bookings) {
      /***************************************************************************************************
       * Defines the start value used by the component layer.
       *
       * Usage context:
       * - Reused by the component layer to keep shared values centralized.
       ***************************************************************************************************/
      const start = new Date(b.startsAt);
      /***************************************************************************************************
       * Defines the end value used by the component layer.
       *
       * Usage context:
       * - Reused by the component layer to keep shared values centralized.
       ***************************************************************************************************/
      const end = new Date(b.endsAt);
      min = Math.min(min, start.getUTCHours());
      /***************************************************************************************************
       * Defines the end hour value used by the component layer.
       *
       * Usage context:
       * - Reused by the component layer to keep shared values centralized.
       ***************************************************************************************************/
      const endHour = end.getUTCHours() + (end.getUTCMinutes() > 0 ? 1 : 0);
      max = Math.max(max, endHour);
    }

    return { minHour: min, maxHour: max };
  }, [bookings, dayWH]);

  /***************************************************************************************************
   * No working hours and no bookings -- show simple empty.
   ***************************************************************************************************/
  if (bookings.length === 0 && dayWH.length === 0) {
    return (
      <div className={'text-muted-foreground py-12 text-center text-sm'}>{t('noBookings')}</div>
    );
  }

  /***************************************************************************************************
   * No bookings but is a working day -- show empty slot without timeline grid.
   ***************************************************************************************************/
  if (bookings.length === 0 && dayWH.length > 0) {
    return (
      <div className={'space-y-2'}>
        {emptySlots.map((slot) => (
          <button
            key={`empty-${slot.startMin}`}
            onClick={() => onEmptySlotClick?.(date, formatMinuteTime(slot.startMin))}
            className={
              'border-border w-full rounded-xl border border-dashed p-4 text-left transition-opacity active:opacity-80'
            }
          >
            <div className={'flex items-center justify-between'}>
              <div>
                <p className={'text-muted-foreground text-sm font-medium'}>{t('emptySlot')}</p>
                <p className={'text-muted-foreground/60 text-xs'}>{t('timeNotOccupied')}</p>
                <p className={'text-muted-foreground mt-1 text-xs'}>
                  {formatMinuteTime(slot.startMin)}
                  {' – '}
                  {formatMinuteTime(slot.endMin)}
                </p>
              </div>
              <div className={'bg-brand/10 flex h-8 w-8 items-center justify-center rounded-full'}>
                <Plus className={'text-brand h-4 w-4'} />
              </div>
            </div>
          </button>
        ))}
      </div>
    );
  }

  const hourLabels: number[] = [];
  for (let h = minHour; h <= maxHour; h++) {
    hourLabels.push(h);
  }

  /***************************************************************************************************
   * Defines the total height value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const totalHeight = (maxHour - minHour) * HOUR_HEIGHT;

  /***************************************************************************************************
   * Current time indicator.
   ***************************************************************************************************/
  let nowTop: number | null = null;
  if (isToday) {
    /***************************************************************************************************
     * Defines the now value used by the component layer.
     *
     * Usage context:
     * - Reused by the component layer to keep shared values centralized.
     ***************************************************************************************************/
    const now = new Date();
    /***************************************************************************************************
     * Defines the now minutes value used by the component layer.
     *
     * Usage context:
     * - Reused by the component layer to keep shared values centralized.
     ***************************************************************************************************/
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    if (nowMinutes >= minHour * 60 && nowMinutes <= maxHour * 60) {
      nowTop = ((nowMinutes - minHour * 60) / 60) * HOUR_HEIGHT;
    }
  }

  return (
    <div className={'relative'} style={{ height: totalHeight + 16 }}>
      {/***************************************************************************************************
       * Hour grid lines and labels.
       ***************************************************************************************************/}
      {hourLabels.map((hour) => (
        <div
          key={hour}
          className={'absolute right-0 left-0 flex items-center'}
          style={{ top: (hour - minHour) * HOUR_HEIGHT }}
        >
          <span
            className={
              'text-muted-foreground w-12 shrink-0 -translate-y-1/2 pr-2 text-right text-xs'
            }
          >
            {formatHour(hour)}
          </span>
          <div className={'border-border flex-1 border-t'} />
        </div>
      ))}

      {/***************************************************************************************************
       * Empty slot cards.
       ***************************************************************************************************/}
      {emptySlots.map((slot) => {
        /***************************************************************************************************
         * Defines the top value used by the component layer.
         *
         * Usage context:
         * - Reused by the component layer to keep shared values centralized.
         ***************************************************************************************************/
        const top = ((slot.startMin - minHour * 60) / 60) * HOUR_HEIGHT;
        /***************************************************************************************************
         * Defines the height value used by the component layer.
         *
         * Usage context:
         * - Reused by the component layer to keep shared values centralized.
         ***************************************************************************************************/
        const height = ((slot.endMin - slot.startMin) / 60) * HOUR_HEIGHT;

        return (
          <TimelineEmptySlot
            key={`empty-${slot.startMin}`}
            slot={slot}
            date={date}
            top={top}
            height={height}
            onEmptySlotClick={onEmptySlotClick}
          />
        );
      })}

      {/***************************************************************************************************
       * Booking cards.
       ***************************************************************************************************/}
      {bookings.map((booking) => {
        /***************************************************************************************************
         * Defines the start value used by the component layer.
         *
         * Usage context:
         * - Reused by the component layer to keep shared values centralized.
         ***************************************************************************************************/
        const start = new Date(booking.startsAt);
        /***************************************************************************************************
         * Defines the end value used by the component layer.
         *
         * Usage context:
         * - Reused by the component layer to keep shared values centralized.
         ***************************************************************************************************/
        const end = new Date(booking.endsAt);
        /***************************************************************************************************
         * Defines the start min value used by the component layer.
         *
         * Usage context:
         * - Reused by the component layer to keep shared values centralized.
         ***************************************************************************************************/
        const startMin = start.getUTCHours() * 60 + start.getUTCMinutes();
        /***************************************************************************************************
         * Defines the end min value used by the component layer.
         *
         * Usage context:
         * - Reused by the component layer to keep shared values centralized.
         ***************************************************************************************************/
        const endMin = end.getUTCHours() * 60 + end.getUTCMinutes();
        /***************************************************************************************************
         * Defines the top value used by the component layer.
         *
         * Usage context:
         * - Reused by the component layer to keep shared values centralized.
         ***************************************************************************************************/
        const top = ((startMin - minHour * 60) / 60) * HOUR_HEIGHT;
        /***************************************************************************************************
         * Defines the height value used by the component layer.
         *
         * Usage context:
         * - Reused by the component layer to keep shared values centralized.
         ***************************************************************************************************/
        const height = ((endMin - startMin) / 60) * HOUR_HEIGHT;

        return (
          <TimelineBookingCard
            key={booking.id}
            booking={booking}
            top={top}
            height={height}
            onBookingClick={onBookingClick}
            formatTime={formatTime}
          />
        );
      })}

      {/***************************************************************************************************
       * Current time indicator.
       ***************************************************************************************************/}
      {nowTop !== null && <CurrentTimeIndicator top={nowTop} />}
    </div>
  );
}
