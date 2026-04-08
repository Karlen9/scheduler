'use client';

import { MonthGrid } from '@/components/Calendar';

import type { TMonthCalendarProps } from '@/lib/types';
import type { ReactNode } from 'react';

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
 * Renders the month calendar UI and related interactions.
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
export function MonthCalendar({
  selectedDate,
  onSelectDate,
  bookingDates = [],
  daysOff = [],
}: TMonthCalendarProps): ReactNode {
  /***************************************************************************************************
   * Defines the days off iso value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const daysOffISO = daysOff.map(toISODate);

  /***************************************************************************************************
   * Defines the dot dates set value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const dotDatesSet = new Set(bookingDates.map(toISODate));

  /***************************************************************************************************
   * Defines the prev month value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const prevMonth = (): void => {
    onSelectDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, 1));
  };

  /***************************************************************************************************
   * Defines the next month value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const nextMonth = (): void => {
    onSelectDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 1));
  };

  /***************************************************************************************************
   * Defines the go to today value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const goToToday = (): void => {
    onSelectDate(new Date());
  };

  return (
    <MonthGrid
      displayDate={selectedDate}
      selectedDate={selectedDate}
      onSelectDate={onSelectDate}
      onPrevMonth={prevMonth}
      onNextMonth={nextMonth}
      daysOff={daysOffISO}
      dotDates={dotDatesSet}
      disableNonWorking={false}
      card
      onTitleClick={goToToday}
    />
  );
}
