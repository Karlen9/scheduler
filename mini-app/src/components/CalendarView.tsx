"use client";

import { useState } from "react";
import { MonthGrid } from "@/components/Calendar";

interface CalendarViewProps {
  selectedDate: Date | null;
  onSelectDate: (date: Date) => void;
  disabledDates?: Date[];
  nonWorkingDays?: number[];
  daysOff?: string[];
}

export function CalendarView({
  selectedDate,
  onSelectDate,
  nonWorkingDays,
  daysOff,
}: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  return (
    <MonthGrid
      displayDate={currentMonth}
      selectedDate={selectedDate}
      onSelectDate={onSelectDate}
      onPrevMonth={prevMonth}
      onNextMonth={nextMonth}
      nonWorkingDays={nonWorkingDays}
      daysOff={daysOff}
      disablePast
      card
      showLegend
    />
  );
}
