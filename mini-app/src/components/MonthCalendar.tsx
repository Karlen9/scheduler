"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

interface MonthCalendarProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  bookingDates?: Date[]; // Dates that have bookings
  daysOff?: Date[]; // Days off
}

export function MonthCalendar({
  selectedDate,
  onSelectDate,
  bookingDates = [],
  daysOff = [],
}: MonthCalendarProps) {
  const monthNames = [
    "Январь",
    "Февраль",
    "Март",
    "Апрель",
    "Май",
    "Июнь",
    "Июль",
    "Август",
    "Сентябрь",
    "Октябрь",
    "Ноябрь",
    "Декабрь",
  ];

  const dayNames = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const currentMonth = selectedDate.getMonth();
  const currentYear = selectedDate.getFullYear();

  // Get all days to display in the calendar grid
  const getCalendarDays = () => {
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);

    // Get day of week for first day (0 = Sunday, convert to Monday = 0)
    let startDayOfWeek = firstDay.getDay() - 1;
    if (startDayOfWeek < 0) startDayOfWeek = 6;

    const days: (Date | null)[] = [];

    // Add empty slots for days before the first day of month
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(null);
    }

    // Add all days of the month
    for (let day = 1; day <= lastDay.getDate(); day++) {
      days.push(new Date(currentYear, currentMonth, day));
    }

    return days;
  };

  const days = getCalendarDays();

  const isSameDay = (d1: Date, d2: Date) => {
    return (
      d1.getDate() === d2.getDate() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getFullYear() === d2.getFullYear()
    );
  };

  const isSelected = (date: Date) => isSameDay(date, selectedDate);
  const isToday = (date: Date) => isSameDay(date, today);

  const hasBookings = (date: Date) => {
    return bookingDates.some((d) => isSameDay(d, date));
  };

  const isDayOff = (date: Date) => {
    return daysOff.some((d) => isSameDay(d, date));
  };

  const prevMonth = () => {
    onSelectDate(new Date(currentYear, currentMonth - 1, 1));
  };

  const nextMonth = () => {
    onSelectDate(new Date(currentYear, currentMonth + 1, 1));
  };

  const goToToday = () => {
    onSelectDate(new Date());
  };

  return (
    <div className="bg-card rounded-xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={prevMonth}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-card transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-muted-foreground" />
        </button>

        <button
          onClick={goToToday}
          className="text-base font-medium text-foreground"
        >
          {monthNames[currentMonth]} {currentYear}
        </button>

        <button
          onClick={nextMonth}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-card transition-colors"
        >
          <ChevronRight className="w-5 h-5 text-muted-foreground" />
        </button>
      </div>

      {/* Day names */}
      <div className="grid grid-cols-7 mb-2">
        {dayNames.map((name) => (
          <div
            key={name}
            className="text-center text-xs font-medium text-muted-foreground py-2"
          >
            {name}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((date, index) => {
          if (!date) {
            return <div key={`empty-${index}`} className="h-10" />;
          }

          const selected = isSelected(date);
          const todayDate = isToday(date);
          const hasBooking = hasBookings(date);
          const dayOff = isDayOff(date);

          return (
            <button
              key={date.toISOString()}
              onClick={() => onSelectDate(date)}
              className={`
                relative h-10 flex items-center justify-center rounded-full text-sm font-medium transition-colors
                ${selected ? "bg-brand text-white" : ""}
                ${!selected && dayOff ? "bg-red-900/30 text-red-400" : ""}
                ${!selected && !dayOff && todayDate ? "bg-card text-brand font-bold" : ""}
                ${!selected && !dayOff && !todayDate ? "text-foreground hover:bg-card" : ""}
              `}
            >
              {date.getDate()}
              {hasBooking && !selected && !dayOff && (
                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-brand" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
