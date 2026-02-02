"use client";

import { useState, useMemo } from "react";

interface CalendarProps {
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
  workingDays: number[]; // 0-6, days when trainer works
}

const DAYS_SHORT = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
const MONTHS = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
];

export function Calendar({ selectedDate, onSelectDate, workingDays }: CalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(() => new Date());

  const days = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPadding = firstDay.getDay();

    const result: { date: Date; isCurrentMonth: boolean; isDisabled: boolean }[] = [];

    // Previous month padding
    for (let i = startPadding - 1; i >= 0; i--) {
      const date = new Date(year, month, -i);
      result.push({ date, isCurrentMonth: false, isDisabled: true });
    }

    // Current month
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let day = 1; day <= lastDay.getDate(); day++) {
      const date = new Date(year, month, day);
      const isPast = date < today;
      const isWorkingDay = workingDays.includes(date.getDay());
      result.push({
        date,
        isCurrentMonth: true,
        isDisabled: isPast || !isWorkingDay,
      });
    }

    // Next month padding
    const remaining = 7 - (result.length % 7);
    if (remaining < 7) {
      for (let i = 1; i <= remaining; i++) {
        const date = new Date(year, month + 1, i);
        result.push({ date, isCurrentMonth: false, isDisabled: true });
      }
    }

    return result;
  }, [currentMonth, workingDays]);

  const goToPrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  const formatDateString = (date: Date): string => {
    return date.toISOString().split("T")[0];
  };

  const canGoPrev = useMemo(() => {
    const today = new Date();
    return currentMonth.getFullYear() > today.getFullYear() ||
      (currentMonth.getFullYear() === today.getFullYear() && currentMonth.getMonth() > today.getMonth());
  }, [currentMonth]);

  return (
    <div className="select-none">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={goToPrevMonth}
          disabled={!canGoPrev}
          className="p-2 rounded-lg disabled:opacity-30"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <span className="font-semibold text-lg">
          {MONTHS[currentMonth.getMonth()]} {currentMonth.getFullYear()}
        </span>
        <button onClick={goToNextMonth} className="p-2 rounded-lg">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>

      {/* Day names */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {DAYS_SHORT.map((day) => (
          <div key={day} className="text-center text-sm text-[var(--tg-theme-hint-color)] py-2">
            {day}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-1">
        {days.map(({ date, isCurrentMonth, isDisabled }, index) => {
          const dateString = formatDateString(date);
          const isSelected = selectedDate === dateString;
          const isToday = formatDateString(new Date()) === dateString;

          return (
            <button
              key={index}
              onClick={() => !isDisabled && onSelectDate(dateString)}
              disabled={isDisabled}
              className={`
                aspect-square flex items-center justify-center rounded-lg text-sm transition-all
                ${!isCurrentMonth ? "text-[var(--tg-theme-hint-color)] opacity-30" : ""}
                ${isDisabled && isCurrentMonth ? "text-[var(--tg-theme-hint-color)] opacity-50" : ""}
                ${!isDisabled && !isSelected ? "active:scale-95" : ""}
                ${isSelected ? "bg-[var(--tg-theme-button-color)] text-[var(--tg-theme-button-text-color)]" : ""}
                ${isToday && !isSelected ? "ring-1 ring-[var(--tg-theme-button-color)]" : ""}
              `}
            >
              {date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
