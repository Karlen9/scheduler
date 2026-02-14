"use client";

import { MonthGrid } from "@/components/Calendar";

interface MonthCalendarProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  bookingDates?: Date[];
  daysOff?: Date[];
}

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function MonthCalendar({
  selectedDate,
  onSelectDate,
  bookingDates = [],
  daysOff = [],
}: MonthCalendarProps) {
  const daysOffISO = daysOff.map(toISODate);

  const dotDatesSet = new Set(bookingDates.map(toISODate));

  const prevMonth = () => {
    onSelectDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    onSelectDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 1));
  };

  const goToToday = () => {
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
