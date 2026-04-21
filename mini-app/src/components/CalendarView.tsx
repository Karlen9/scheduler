'use client';

import { useMemo, useState } from 'react';

import { MonthGrid } from '@/components/Calendar';

import type { TCalendarViewProps } from '@/lib/types';
import type { ReactNode } from 'react';

/***************************************************************************************************
 * Renders the calendar view UI and related interactions.
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
export function CalendarView({
  selectedDate,
  selectedDates,
  onSelectDate,
  nonWorkingDays,
  daysOff,
  bookedDates,
  disabledDates,
}: TCalendarViewProps): ReactNode {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  /***************************************************************************************************
   * Defines the today value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const today = useMemo(() => new Date(), []);
  /***************************************************************************************************
   * Defines the max date value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const maxDate = useMemo(() => {
    /***************************************************************************************************
     * Defines the d value used by the component layer.
     *
     * Usage context:
     * - Reused by the component layer to keep shared values centralized.
     ***************************************************************************************************/
    const d = new Date(today.getFullYear(), today.getMonth() + 3, today.getDate());
    return d;
  }, [today]);

  /***************************************************************************************************
   * Defines the prev month value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const prevMonth = (): void => {
    /***************************************************************************************************
     * Defines the prev value used by the component layer.
     *
     * Usage context:
     * - Reused by the component layer to keep shared values centralized.
     ***************************************************************************************************/
    const prev = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1);
    /***************************************************************************************************
     * Don't go before current month.
     ***************************************************************************************************/
    if (
      prev.getFullYear() < today.getFullYear() ||
      (prev.getFullYear() === today.getFullYear() && prev.getMonth() < today.getMonth())
    ) {
      return;
    }
    setCurrentMonth(prev);
  };

  /***************************************************************************************************
   * Defines the next month value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const nextMonth = (): void => {
    /***************************************************************************************************
     * Defines the next value used by the component layer.
     *
     * Usage context:
     * - Reused by the component layer to keep shared values centralized.
     ***************************************************************************************************/
    const next = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1);
    /***************************************************************************************************
     * Don't go beyond maxDate's month.
     ***************************************************************************************************/
    if (
      next.getFullYear() > maxDate.getFullYear() ||
      (next.getFullYear() === maxDate.getFullYear() && next.getMonth() > maxDate.getMonth())
    ) {
      return;
    }
    setCurrentMonth(next);
  };

  /***************************************************************************************************
   * Defines the booked dates set value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const bookedDatesSet = useMemo(
    () => (bookedDates ? new Set(bookedDates) : undefined),
    [bookedDates],
  );
  const disabledDatesSet = useMemo(
    () => (disabledDates ? new Set(disabledDates) : undefined),
    [disabledDates],
  );

  return (
    <MonthGrid
      displayDate={currentMonth}
      selectedDate={selectedDate}
      selectedDates={selectedDates}
      onSelectDate={onSelectDate}
      onPrevMonth={prevMonth}
      onNextMonth={nextMonth}
      nonWorkingDays={nonWorkingDays}
      daysOff={daysOff}
      bookedDates={bookedDatesSet}
      disabledDates={disabledDatesSet}
      disablePast
      maxDate={maxDate}
      card
      showLegend
    />
  );
}
