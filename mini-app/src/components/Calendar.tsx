'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo } from 'react';

import type { TMonthGridProps, TWeekStripProps } from '@/lib/types';
import type { ReactNode } from 'react';

/***************************************************************************************************
 * Lists translation or cache keys reused by the component layer.
 *
 * Usage context:
 * - Reused by the component layer to keep shared values centralized.
 ***************************************************************************************************/
const monthNomKeys = [
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
 * Defines the day short keys mon value used by the component layer.
 *
 * Usage context:
 * - Reused by the component layer to keep shared values centralized.
 ***************************************************************************************************/
const dayShortKeysMon = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

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
 * Returns month grid.
 *
 * Parameters:
 * - year: Year used by the current operation.
 * - month: Month used by the current operation.
 * - fillOuter: Fill outer used by the current operation.
 *
 * Returns:
 * - The computed value for the current operation as (Date | null)[].
 *
 * Side effects:
 * - May derive UI state, invoke callbacks, and trigger user-facing rendering updates.
 ***************************************************************************************************/
function getMonthGrid(year: number, month: number, fillOuter: boolean): (Date | null)[] {
  const days: (Date | null)[] = [];
  /***************************************************************************************************
   * Defines the first value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const first = new Date(year, month, 1);
  /***************************************************************************************************
   * Defines the last value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const last = new Date(year, month + 1, 0);

  /***************************************************************************************************
   * Defines the start day value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  let startDay = first.getDay();
  if (startDay === 0) {
    startDay = 7;
  }

  for (let i = startDay - 1; i > 0; i--) {
    days.push(fillOuter ? new Date(year, month, 1 - i) : null);
  }

  for (let i = 1; i <= last.getDate(); i++) {
    days.push(new Date(year, month, i));
  }

  if (fillOuter) {
    /***************************************************************************************************
     * Defines the remainder value used by the component layer.
     *
     * Usage context:
     * - Reused by the component layer to keep shared values centralized.
     ***************************************************************************************************/
    const remainder = 7 - (days.length % 7);
    if (remainder < 7) {
      for (let i = 1; i <= remainder; i++) {
        days.push(new Date(year, month + 1, i));
      }
    }
  }

  return days;
}

/***************************************************************************************************
 * Month Grid.
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
export function MonthGrid({
  displayDate,
  selectedDate,
  selectedDates,
  rangeStart,
  rangeEnd,
  onSelectDate,
  onPrevMonth,
  onNextMonth,
  nonWorkingDays,
  daysOff,
  disablePast,
  dotDates,
  bookedDates,
  fillOuterDays = false,
  card = false,
  showLegend = false,
  onTitleClick,
  disableNonWorking = true,
  maxDate,
}: TMonthGridProps): ReactNode {
  /***************************************************************************************************
   * Defines the td value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const td = useTranslations('Dates');
  /***************************************************************************************************
   * Defines the month names value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const MONTH_NAMES = monthNomKeys.map((k) => td(`monthsNom.${k}`));
  /***************************************************************************************************
   * Defines the day names value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const DAY_NAMES = dayShortKeysMon.map((k) => td(`daysShort.${k}`));

  /***************************************************************************************************
   * Defines the today value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const today = useMemo(() => {
    /***************************************************************************************************
     * Defines the d value used by the component layer.
     *
     * Usage context:
     * - Reused by the component layer to keep shared values centralized.
     ***************************************************************************************************/
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }, []);

  /***************************************************************************************************
   * Defines the days off set value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const daysOffSet = useMemo(() => new Set(daysOff ?? []), [daysOff]);
  /***************************************************************************************************
   * Defines the non working set value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const nonWorkingSet = useMemo(() => new Set(nonWorkingDays ?? []), [nonWorkingDays]);

  /***************************************************************************************************
   * Defines the month value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const month = displayDate.getMonth();
  /***************************************************************************************************
   * Defines the year value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const year = displayDate.getFullYear();
  /***************************************************************************************************
   * Defines the grid value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const grid = useMemo(
    () => getMonthGrid(year, month, fillOuterDays),
    [year, month, fillOuterDays],
  );

  /***************************************************************************************************
   * Checks whether non working.
   *
   * Parameters:
   * - d: D used by the current operation.
   *
   * Returns:
   * - The computed value for the current operation as boolean.
   *
   * Side effects:
   * - May derive UI state, invoke callbacks, and trigger user-facing rendering updates.
   ***************************************************************************************************/
  function isNonWorking(d: Date): boolean {
    if (nonWorkingSet.has(d.getDay())) {
      return true;
    }
    return daysOffSet.has(toISODate(d));
  }

  /***************************************************************************************************
   * Checks whether day off date.
   *
   * Parameters:
   * - d: D used by the current operation.
   *
   * Returns:
   * - The computed value for the current operation as boolean.
   *
   * Side effects:
   * - May derive UI state, invoke callbacks, and trigger user-facing rendering updates.
   ***************************************************************************************************/
  function isDayOffDate(d: Date): boolean {
    return daysOffSet.has(toISODate(d));
  }

  /***************************************************************************************************
   * Checks whether past.
   *
   * Parameters:
   * - d: D used by the current operation.
   *
   * Returns:
   * - The computed value for the current operation as boolean.
   *
   * Side effects:
   * - May derive UI state, invoke callbacks, and trigger user-facing rendering updates.
   ***************************************************************************************************/
  function isPast(d: Date): boolean {
    return d < today;
  }

  /***************************************************************************************************
   * Checks whether booked.
   *
   * Parameters:
   * - d: D used by the current operation.
   *
   * Returns:
   * - The computed value for the current operation as boolean.
   *
   * Side effects:
   * - May derive UI state, invoke callbacks, and trigger user-facing rendering updates.
   ***************************************************************************************************/
  function isBooked(d: Date): boolean {
    return bookedDates?.has(toISODate(d)) ?? false;
  }

  /***************************************************************************************************
   * Checks whether beyond max.
   *
   * Parameters:
   * - d: D used by the current operation.
   *
   * Returns:
   * - The computed value for the current operation as boolean.
   *
   * Side effects:
   * - May derive UI state, invoke callbacks, and trigger user-facing rendering updates.
   ***************************************************************************************************/
  function isBeyondMax(d: Date): boolean {
    return maxDate ? d > maxDate : false;
  }

  /***************************************************************************************************
   * Checks whether disabled.
   *
   * Parameters:
   * - d: D used by the current operation.
   *
   * Returns:
   * - The computed value for the current operation as boolean.
   *
   * Side effects:
   * - May derive UI state, invoke callbacks, and trigger user-facing rendering updates.
   ***************************************************************************************************/
  function isDisabled(d: Date): boolean {
    if (disablePast && isPast(d)) {
      return true;
    }
    if (isBeyondMax(d)) {
      return true;
    }
    if (disableNonWorking) {
      if (nonWorkingSet.size > 0 && nonWorkingSet.has(d.getDay())) {
        return true;
      }
      if (daysOffSet.size > 0 && daysOffSet.has(toISODate(d))) {
        return true;
      }
    }
    return false;
  }

  /***************************************************************************************************
   * Defines the content value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const content = (
    <>
      {/***************************************************************************************************
       * Header.
       ***************************************************************************************************/}
      <div className={'mb-3 flex items-center justify-between'}>
        <button onClick={onPrevMonth} className={'text-muted-foreground p-2'}>
          <ChevronLeft className={'h-5 w-5'} />
        </button>
        <span
          className={`text-foreground text-sm font-medium ${onTitleClick ? 'cursor-pointer' : ''}`}
          onClick={onTitleClick}
        >
          {MONTH_NAMES[month]} {year}
        </span>
        <button onClick={onNextMonth} className={'text-muted-foreground p-2'}>
          <ChevronRight className={'h-5 w-5'} />
        </button>
      </div>

      {/***************************************************************************************************
       * Day names.
       ***************************************************************************************************/}
      <div className={'mb-1 grid grid-cols-7'}>
        {DAY_NAMES.map((name, i) => (
          <div key={i} className={'text-muted-foreground py-1 text-center text-[11px]'}>
            {name}
          </div>
        ))}
      </div>

      {/***************************************************************************************************
       * Grid.
       ***************************************************************************************************/}
      <div className={`grid grid-cols-7 ${fillOuterDays ? '' : 'gap-1'}`}>
        {grid.map((date, i) => {
          if (!date) {
            return <div key={`e-${i}`} className={'aspect-square'} />;
          }

          /***************************************************************************************************
           * Defines the is current month value used by the component layer.
           *
           * Usage context:
           * - Reused by the component layer to keep shared values centralized.
           ***************************************************************************************************/
          const isCurrentMonth = date.getMonth() === month;
          /***************************************************************************************************
           * Defines the selected value used by the component layer.
           *
           * Usage context:
           * - Reused by the component layer to keep shared values centralized.
           ***************************************************************************************************/
          const selected =
            (selectedDate ? isSameDay(date, selectedDate) : false) ||
            (selectedDates?.some((sd) => isSameDay(date, sd)) ?? false);
          /***************************************************************************************************
           * Defines the is day today value used by the component layer.
           *
           * Usage context:
           * - Reused by the component layer to keep shared values centralized.
           ***************************************************************************************************/
          const isDayToday = isSameDay(date, today);
          /***************************************************************************************************
           * Defines the disabled value used by the component layer.
           *
           * Usage context:
           * - Reused by the component layer to keep shared values centralized.
           ***************************************************************************************************/
          const disabled = isDisabled(date);
          /***************************************************************************************************
           * Defines the day off value used by the component layer.
           *
           * Usage context:
           * - Reused by the component layer to keep shared values centralized.
           ***************************************************************************************************/
          const dayOff = isDayOffDate(date);
          /***************************************************************************************************
           * Defines the non working value used by the component layer.
           *
           * Usage context:
           * - Reused by the component layer to keep shared values centralized.
           ***************************************************************************************************/
          const nonWorking = isNonWorking(date);
          /***************************************************************************************************
           * Defines the booked value used by the component layer.
           *
           * Usage context:
           * - Reused by the component layer to keep shared values centralized.
           ***************************************************************************************************/
          const booked = isBooked(date);
          /***************************************************************************************************
           * Defines the has dot value used by the component layer.
           *
           * Usage context:
           * - Reused by the component layer to keep shared values centralized.
           ***************************************************************************************************/
          const hasDot = dotDates?.has(toISODate(date)) && !selected && !nonWorking;

          /***************************************************************************************************
           * Range highlight: renders a connecting bar between rangeStart and rangeEnd.
           ***************************************************************************************************/
          const hasRange = Boolean(rangeStart && rangeEnd);
          const isRangeStart = hasRange && isSameDay(date, rangeStart!);
          const isRangeEnd = hasRange && isSameDay(date, rangeEnd!);
          const inRange =
            hasRange && date >= rangeStart! && date <= rangeEnd! && !isRangeStart && !isRangeEnd;
          const rangeEndpoint = isRangeStart || isRangeEnd;
          const isRangeSingleDay = hasRange && isSameDay(rangeStart!, rangeEnd!);

          return (
            <button
              key={i}
              onClick={() => !disabled && onSelectDate(date)}
              disabled={disabled}
              className={`relative flex flex-col items-center ${fillOuterDays ? 'py-1.5' : 'aspect-square justify-center'}`}
            >
              {(inRange || (rangeEndpoint && !isRangeSingleDay)) && (
                <div
                  className={`bg-brand/15 pointer-events-none absolute top-1/2 h-9 -translate-y-1/2 ${
                    inRange
                      ? '-right-0.5 -left-0.5'
                      : isRangeStart
                        ? '-right-0.5 left-1/2'
                        : 'right-1/2 -left-0.5'
                  }`}
                />
              )}
              <span
                className={`relative flex h-9 w-9 items-center justify-center rounded-full text-sm transition-colors ${
                  selected || rangeEndpoint
                    ? 'bg-brand font-medium text-white'
                    : inRange
                      ? 'text-brand font-medium'
                      : booked && isCurrentMonth
                        ? 'text-success'
                        : dayOff && isCurrentMonth
                          ? 'bg-dayoff-bg text-dayoff-text'
                          : disabled && (isPast(date) || isBeyondMax(date))
                            ? 'text-muted-foreground opacity-40'
                            : nonWorking
                              ? isCurrentMonth
                                ? 'text-muted-foreground/30'
                                : 'text-muted-foreground/20'
                              : isDayToday
                                ? 'ring-brand text-brand font-medium ring-1'
                                : isCurrentMonth
                                  ? 'text-foreground'
                                  : 'text-muted-foreground/40'
                }`}
              >
                {date.getDate()}
              </span>
              {booked && isCurrentMonth && !selected && !rangeEndpoint && !inRange ? (
                <div className={'bg-success mt-0.5 h-1.5 w-1.5 rounded-full'} />
              ) : hasDot ? (
                <div className={'bg-brand mt-0.5 h-1 w-1 rounded-full'} />
              ) : null}
            </button>
          );
        })}
      </div>

      {/***************************************************************************************************
       * Legend.
       ***************************************************************************************************/}
      {showLegend && ((daysOff && daysOff.length > 0) || (bookedDates && bookedDates.size > 0)) && (
        <div className={'border-border mt-3 flex items-center gap-4 border-t pt-3'}>
          {daysOff && daysOff.length > 0 && (
            <div className={'flex items-center gap-1.5'}>
              <span className={'bg-dayoff-bg h-3 w-3 rounded'} />
              <span className={'text-muted-foreground text-xs'}>{td('dayOff')}</span>
            </div>
          )}
          {bookedDates && bookedDates.size > 0 && (
            <div className={'flex items-center gap-1.5'}>
              <span className={'bg-success h-3 w-3 rounded-full'} />
              <span className={'text-muted-foreground text-xs'}>{td('myBooking')}</span>
            </div>
          )}
        </div>
      )}
    </>
  );

  if (card) {
    return <div className={'bg-card rounded-xl p-4'}>{content}</div>;
  }

  return <div>{content}</div>;
}

/***************************************************************************************************
 * Week Strip.
 *
 * Parameters:
 * - date: Date value used by the current operation.
 *
 * Returns:
 * - The computed value for the current operation as Date.
 *
 * Side effects:
 * - May derive UI state, invoke callbacks, and trigger user-facing rendering updates.
 ***************************************************************************************************/
function getWeekStart(date: Date): Date {
  /***************************************************************************************************
   * Defines the d value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const d = new Date(date);
  /***************************************************************************************************
   * Defines the day value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const day = d.getDay();
  /***************************************************************************************************
   * Defines the diff value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/***************************************************************************************************
 * Renders the week strip UI and related interactions.
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
export function WeekStrip({
  selectedDate,
  onSelectDate,
  onPrevWeek,
  onNextWeek,
  nonWorkingDays,
  daysOff,
  dotDates,
}: TWeekStripProps): ReactNode {
  /***************************************************************************************************
   * Defines the td value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const td = useTranslations('Dates');
  /***************************************************************************************************
   * Defines the day names value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const DAY_NAMES = dayShortKeysMon.map((k) => td(`daysShort.${k}`));

  /***************************************************************************************************
   * Defines the today value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const today = useMemo(() => {
    /***************************************************************************************************
     * Defines the d value used by the component layer.
     *
     * Usage context:
     * - Reused by the component layer to keep shared values centralized.
     ***************************************************************************************************/
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }, []);

  /***************************************************************************************************
   * Defines the days off set value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const daysOffSet = useMemo(() => new Set(daysOff ?? []), [daysOff]);
  /***************************************************************************************************
   * Defines the non working set value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const nonWorkingSet = useMemo(() => new Set(nonWorkingDays ?? []), [nonWorkingDays]);

  /***************************************************************************************************
   * Defines the week days value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const weekDays = useMemo(() => {
    /***************************************************************************************************
     * Defines the start value used by the component layer.
     *
     * Usage context:
     * - Reused by the component layer to keep shared values centralized.
     ***************************************************************************************************/
    const start = getWeekStart(selectedDate);
    return Array.from({ length: 7 }, (_, i) => {
      /***************************************************************************************************
       * Defines the d value used by the component layer.
       *
       * Usage context:
       * - Reused by the component layer to keep shared values centralized.
       ***************************************************************************************************/
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [selectedDate]);

  /***************************************************************************************************
   * Checks whether non working.
   *
   * Parameters:
   * - d: D used by the current operation.
   *
   * Returns:
   * - The computed value for the current operation as boolean.
   *
   * Side effects:
   * - May derive UI state, invoke callbacks, and trigger user-facing rendering updates.
   ***************************************************************************************************/
  function isNonWorking(d: Date): boolean {
    if (nonWorkingSet.has(d.getDay())) {
      return true;
    }
    return daysOffSet.has(toISODate(d));
  }

  /***************************************************************************************************
   * Checks whether day off.
   *
   * Parameters:
   * - d: D used by the current operation.
   *
   * Returns:
   * - The computed value for the current operation as boolean.
   *
   * Side effects:
   * - May derive UI state, invoke callbacks, and trigger user-facing rendering updates.
   ***************************************************************************************************/
  function isDayOff(d: Date): boolean {
    return daysOffSet.has(toISODate(d));
  }

  return (
    <div className={'flex items-center'}>
      <button onClick={onPrevWeek} className={'text-muted-foreground shrink-0 p-1'}>
        <ChevronLeft className={'h-5 w-5'} />
      </button>
      <div className={'grid flex-1 grid-cols-7 gap-0.5'}>
        {weekDays.map((day, i) => {
          /***************************************************************************************************
           * Defines the selected value used by the component layer.
           *
           * Usage context:
           * - Reused by the component layer to keep shared values centralized.
           ***************************************************************************************************/
          const selected = isSameDay(day, selectedDate);
          /***************************************************************************************************
           * Defines the is day today value used by the component layer.
           *
           * Usage context:
           * - Reused by the component layer to keep shared values centralized.
           ***************************************************************************************************/
          const isDayToday = isSameDay(day, today);
          /***************************************************************************************************
           * Defines the non working value used by the component layer.
           *
           * Usage context:
           * - Reused by the component layer to keep shared values centralized.
           ***************************************************************************************************/
          const nonWorking = isNonWorking(day);
          /***************************************************************************************************
           * Defines the day off value used by the component layer.
           *
           * Usage context:
           * - Reused by the component layer to keep shared values centralized.
           ***************************************************************************************************/
          const dayOff = isDayOff(day);
          /***************************************************************************************************
           * Defines the has dot value used by the component layer.
           *
           * Usage context:
           * - Reused by the component layer to keep shared values centralized.
           ***************************************************************************************************/
          const hasDot = dotDates?.has(toISODate(day)) && !selected && !nonWorking;

          return (
            <button
              key={i}
              onClick={() => !nonWorking && onSelectDate(day)}
              disabled={nonWorking}
              className={'flex flex-col items-center py-1.5'}
            >
              <span
                className={`mb-1 text-[11px] ${nonWorking ? 'text-muted-foreground/40' : 'text-muted-foreground'}`}
              >
                {DAY_NAMES[i]}
              </span>
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-full text-sm transition-colors ${
                  selected
                    ? 'bg-brand font-medium text-white'
                    : dayOff
                      ? 'bg-dayoff-bg text-dayoff-text'
                      : nonWorking
                        ? 'text-muted-foreground/30'
                        : isDayToday
                          ? 'ring-brand text-brand font-medium ring-1'
                          : 'text-foreground'
                }`}
              >
                {day.getDate()}
              </span>
              {hasDot && <div className={'bg-brand mt-1 h-1 w-1 rounded-full'} />}
            </button>
          );
        })}
      </div>
      <button onClick={onNextWeek} className={'text-muted-foreground shrink-0 p-1'}>
        <ChevronRight className={'h-5 w-5'} />
      </button>
    </div>
  );
}
