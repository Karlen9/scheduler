'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

import { MonthGrid, WeekStrip } from '@/components/Calendar';

import { DayTimeline } from './DayTimeline';

import type { TScheduleViewProps, TViewMode } from '@/lib/types';
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
 * Defines the day full keys js value used by the component layer.
 *
 * Usage context:
 * - Reused by the component layer to keep shared values centralized.
 ***************************************************************************************************/
const dayFullKeysJS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

const advanceDateByViewMode: Record<TViewMode, (date: Date, delta: number) => void> = {
  day: (date, delta) => {
    date.setDate(date.getDate() + delta);
  },
  week: (date, delta) => {
    date.setDate(date.getDate() + delta * 7);
  },
  month: (date, delta) => {
    date.setMonth(date.getMonth() + delta);
  },
};

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
 * Implements the to local date logic used by this module.
 *
 * Parameters:
 * - d: D used by the current operation.
 *
 * Returns:
 * - The computed value for the current operation as Date.
 *
 * Side effects:
 * - May derive UI state, invoke callbacks, and trigger user-facing rendering updates.
 ***************************************************************************************************/
function toLocalDate(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/***************************************************************************************************
 * Implements the to isodate logic used by this module.
 *
 * Parameters:
 * - d: D used by the current operation.
 *
 * Returns:
 * - The computed value for the current operation as string.
 *
 * Side effects:
 * - May derive UI state, invoke callbacks, and trigger user-facing rendering updates.
 ***************************************************************************************************/
function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/***************************************************************************************************
 * Renders the schedule view UI and related interactions.
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
export function ScheduleView({
  bookings,
  onBookingClick,
  nonWorkingDays,
  daysOff,
  workingHours,
  serviceDurations,
  onEmptySlotClick,
}: TScheduleViewProps): ReactNode {
  /***************************************************************************************************
   * Defines the t value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const t = useTranslations('ScheduleView');
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

  const [viewMode, setViewMode] = useState<TViewMode>('week');
  const [selectedDate, setSelectedDate] = useState(() => toLocalDate(new Date()));

  /***************************************************************************************************
   * Formats date header.
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
  function formatDateHeader(date: Date): string {
    /***************************************************************************************************
     * Defines the day value used by the component layer.
     *
     * Usage context:
     * - Reused by the component layer to keep shared values centralized.
     ***************************************************************************************************/
    const day = date.getDate();
    /***************************************************************************************************
     * Defines the month key value used by the component layer.
     *
     * Usage context:
     * - Reused by the component layer to keep shared values centralized.
     ***************************************************************************************************/
    const monthKey = monthGenKeys[date.getMonth()];
    /***************************************************************************************************
     * Defines the month value used by the component layer.
     *
     * Usage context:
     * - Reused by the component layer to keep shared values centralized.
     ***************************************************************************************************/
    const month = td(`monthsGen.${monthKey}`);
    /***************************************************************************************************
     * Defines the weekday key value used by the component layer.
     *
     * Usage context:
     * - Reused by the component layer to keep shared values centralized.
     ***************************************************************************************************/
    const weekdayKey = dayFullKeysJS[date.getDay()];
    /***************************************************************************************************
     * Defines the weekday value used by the component layer.
     *
     * Usage context:
     * - Reused by the component layer to keep shared values centralized.
     ***************************************************************************************************/
    const weekday = td(`daysFull.${weekdayKey}`);
    /***************************************************************************************************
     * Defines the display month value used by the component layer.
     *
     * Usage context:
     * - Reused by the component layer to keep shared values centralized.
     ***************************************************************************************************/
    const displayMonth = locale === 'en' ? month.charAt(0).toUpperCase() + month.slice(1) : month;
    return `${day} ${displayMonth}, ${weekday}`;
  }

  /***************************************************************************************************
   * Filter bookings for the selected date.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const dayBookings = useMemo(() => {
    return bookings
      .filter((b) => {
        /***************************************************************************************************
         * Defines the d value used by the component layer.
         *
         * Usage context:
         * - Reused by the component layer to keep shared values centralized.
         ***************************************************************************************************/
        const d = new Date(b.startsAt);
        /***************************************************************************************************
         * Defines the booking date value used by the component layer.
         *
         * Usage context:
         * - Reused by the component layer to keep shared values centralized.
         ***************************************************************************************************/
        const bookingDate = new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
        return isSameDay(bookingDate, selectedDate);
      })
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  }, [bookings, selectedDate]);

  /***************************************************************************************************
   * Dates with bookings (for dots).
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const dotDates = useMemo(() => {
    /***************************************************************************************************
     * Defines the set value used by the component layer.
     *
     * Usage context:
     * - Reused by the component layer to keep shared values centralized.
     ***************************************************************************************************/
    const set = new Set<string>();
    bookings.forEach((b) => {
      /***************************************************************************************************
       * Defines the d value used by the component layer.
       *
       * Usage context:
       * - Reused by the component layer to keep shared values centralized.
       ***************************************************************************************************/
      const d = new Date(b.startsAt);
      set.add(toISODate(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())));
    });
    return set;
  }, [bookings]);

  /***************************************************************************************************
   * Navigation.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const navigate = (delta: number): void => {
    setSelectedDate((d) => {
      /***************************************************************************************************
       * Defines the new date value used by the component layer.
       *
       * Usage context:
       * - Reused by the component layer to keep shared values centralized.
       ***************************************************************************************************/
      const newDate = new Date(d);
      advanceDateByViewMode[viewMode](newDate, delta);
      return newDate;
    });
  };

  return (
    <div className={'p-4'}>
      <h2 className={'text-foreground mb-3 text-base font-medium'}>{t('title')}</h2>

      {/***************************************************************************************************
       * Tabs.
       ***************************************************************************************************/}
      <div className={'border-border mb-4 flex border-b'}>
        {(['day', 'week', 'month'] as TViewMode[]).map((mode) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            className={`relative flex-1 py-2.5 text-sm transition-colors ${
              viewMode === mode ? 'text-brand font-medium' : 'text-muted-foreground'
            }`}
          >
            {t(mode)}
            {viewMode === mode && (
              <span className={'bg-brand absolute right-0 bottom-0 left-0 h-0.5 rounded-full'} />
            )}
          </button>
        ))}
      </div>

      {/***************************************************************************************************
       * Week strip.
       ***************************************************************************************************/}
      {viewMode === 'week' && (
        <div className={'mb-4'}>
          <WeekStrip
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            onPrevWeek={() => navigate(-1)}
            onNextWeek={() => navigate(1)}
            nonWorkingDays={nonWorkingDays}
            daysOff={daysOff}
            dotDates={dotDates}
          />
        </div>
      )}

      {/***************************************************************************************************
       * Month calendar.
       ***************************************************************************************************/}
      {viewMode === 'month' && (
        <div className={'mb-4'}>
          <MonthGrid
            displayDate={selectedDate}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            onPrevMonth={() => navigate(-1)}
            onNextMonth={() => navigate(1)}
            nonWorkingDays={nonWorkingDays}
            daysOff={daysOff}
            dotDates={dotDates}
            fillOuterDays
          />
        </div>
      )}

      {/***************************************************************************************************
       * Date header.
       ***************************************************************************************************/}
      {viewMode === 'day' ? (
        <div className={'mb-3 flex items-center justify-between'}>
          <button onClick={() => navigate(-1)} className={'text-muted-foreground p-2'}>
            <ChevronLeft className={'h-5 w-5'} />
          </button>
          <h3 className={'text-foreground text-sm font-medium'}>
            {formatDateHeader(selectedDate)}
          </h3>
          <button onClick={() => navigate(1)} className={'text-muted-foreground p-2'}>
            <ChevronRight className={'h-5 w-5'} />
          </button>
        </div>
      ) : (
        <h3 className={'text-foreground mb-3 text-sm font-medium'}>
          {formatDateHeader(selectedDate)}
        </h3>
      )}

      {/***************************************************************************************************
       * Timeline.
       ***************************************************************************************************/}
      <DayTimeline
        bookings={dayBookings}
        date={selectedDate}
        onBookingClick={onBookingClick}
        workingHours={workingHours}
        serviceDurations={serviceDurations}
        onEmptySlotClick={onEmptySlotClick}
      />
    </div>
  );
}
