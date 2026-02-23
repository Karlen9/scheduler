'use client';

import { useMemo, useState } from 'react';

import { MonthGrid } from '@/components/Calendar';

import type { TCalendarViewProps } from '@/lib/types';
import type { ReactNode } from 'react';

export function CalendarView({
  selectedDate,
  selectedDates,
  onSelectDate,
  nonWorkingDays,
  daysOff,
  bookedDates,
}: TCalendarViewProps): ReactNode {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const today = useMemo(() => new Date(), []);
  const maxDate = useMemo(() => {
    const d = new Date(today.getFullYear(), today.getMonth() + 3, today.getDate());
    return d;
  }, [today]);

  const prevMonth = (): void => {
    const prev = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1);
    // Don't go before current month
    if (
      prev.getFullYear() < today.getFullYear() ||
      (prev.getFullYear() === today.getFullYear() && prev.getMonth() < today.getMonth())
    ) {
      return;
    }
    setCurrentMonth(prev);
  };

  const nextMonth = (): void => {
    const next = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1);
    // Don't go beyond maxDate's month
    if (
      next.getFullYear() > maxDate.getFullYear() ||
      (next.getFullYear() === maxDate.getFullYear() && next.getMonth() > maxDate.getMonth())
    ) {
      return;
    }
    setCurrentMonth(next);
  };

  const bookedDatesSet = useMemo(
    () => (bookedDates ? new Set(bookedDates) : undefined),
    [bookedDates],
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
      disablePast
      maxDate={maxDate}
      card
      showLegend
    />
  );
}
