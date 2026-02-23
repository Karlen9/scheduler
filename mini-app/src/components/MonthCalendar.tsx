'use client';

import { MonthGrid } from '@/components/Calendar';

import type { TMonthCalendarProps } from '@/lib/types';
import type { ReactNode } from 'react';

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function MonthCalendar({
  selectedDate,
  onSelectDate,
  bookingDates = [],
  daysOff = [],
}: TMonthCalendarProps): ReactNode {
  const daysOffISO = daysOff.map(toISODate);

  const dotDatesSet = new Set(bookingDates.map(toISODate));

  const prevMonth = (): void => {
    onSelectDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, 1));
  };

  const nextMonth = (): void => {
    onSelectDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 1));
  };

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
