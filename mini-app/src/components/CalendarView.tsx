"use client";

import { useMemo, useState } from "react";
import { MonthGrid } from "@/components/Calendar";

interface CalendarViewProps {
  selectedDate: Date | null;
  selectedDates?: Date[];
  onSelectDate: (date: Date) => void;
  nonWorkingDays?: number[];
  daysOff?: string[];
  bookedDates?: string[];
}

export function CalendarView({
  selectedDate,
  selectedDates,
  onSelectDate,
  nonWorkingDays,
  daysOff,
  bookedDates,
}: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  const bookedDatesSet = useMemo(() => bookedDates ? new Set(bookedDates) : undefined, [bookedDates]);

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
      card
      showLegend
    />
  );
}
