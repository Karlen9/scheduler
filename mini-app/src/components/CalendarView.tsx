"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface CalendarViewProps {
  selectedDate: Date | null;
  onSelectDate: (date: Date) => void;
  disabledDates?: Date[];
  nonWorkingDays?: number[]; // days of week (0=Sun, 6=Sat) that have no working hours
  daysOff?: string[]; // specific ISO date strings ("2025-01-15") that are days off
}

export function CalendarView({
  selectedDate,
  onSelectDate,
  nonWorkingDays,
  daysOff,
}: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

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

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();

    // Get day of week (0 = Sunday, adjust to Monday = 0)
    let startDay = firstDay.getDay() - 1;
    if (startDay < 0) startDay = 6;

    const days: (Date | null)[] = [];

    // Add empty cells for days before month starts
    for (let i = 0; i < startDay; i++) {
      days.push(null);
    }

    // Add all days in month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }

    return days;
  };

  const days = getDaysInMonth(currentMonth);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const isToday = (date: Date) => {
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    return checkDate.getTime() === today.getTime();
  };

  const isSelected = (date: Date) => {
    if (!selectedDate) return false;
    const checkDate = new Date(date);
    const selDate = new Date(selectedDate);
    checkDate.setHours(0, 0, 0, 0);
    selDate.setHours(0, 0, 0, 0);
    return checkDate.getTime() === selDate.getTime();
  };

  const isPast = (date: Date) => {
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    return checkDate < today;
  };

  const isUnavailable = (date: Date) => {
    if (nonWorkingDays && nonWorkingDays.includes(date.getDay())) {
      return true;
    }
    if (daysOff) {
      const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      if (daysOff.includes(iso)) {
        return true;
      }
    }
    return false;
  };

  const isDisabled = (date: Date) => isPast(date) || isUnavailable(date);

  const prevMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1),
    );
  };

  const nextMonth = () => {
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1),
    );
  };

  return (
    <div className="bg-card rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={prevMonth}
          className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-border transition-colors"
          aria-label="Предыдущий месяц"
        >
          <ChevronLeft className="w-5 h-5 text-foreground" />
        </button>
        <h3 className="text-base font-medium text-foreground">
          {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
        </h3>
        <button
          onClick={nextMonth}
          className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-border transition-colors"
          aria-label="Следующий месяц"
        >
          <ChevronRight className="w-5 h-5 text-foreground" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-2">
        {dayNames.map((day) => (
          <div key={day} className="flex items-center justify-center h-10">
            <span className="text-xs font-medium text-muted-foreground">
              {day}
            </span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((date, index) => (
          <div key={index} className="aspect-square">
            {date ? (
              <button
                onClick={() => !isDisabled(date) && onSelectDate(date)}
                disabled={isDisabled(date)}
                className={`w-full h-full flex items-center justify-center rounded-lg text-sm transition-colors ${
                  isSelected(date)
                    ? "bg-primary text-primary-foreground"
                    : isDisabled(date)
                      ? "text-muted-foreground opacity-40 cursor-not-allowed"
                      : isToday(date)
                        ? "bg-border text-foreground font-medium"
                        : "text-foreground hover:bg-border"
                }`}
              >
                {date.getDate()}
              </button>
            ) : (
              <div />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
