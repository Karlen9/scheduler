"use client";

import { useState, useMemo } from "react";

interface WeekCalendarProps {
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
  workingDays: number[];
}

// Monday first: Пн, Вт, Ср, Чт, Пт, Сб, Вс
const DAYS_SHORT = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

export function WeekCalendar({ selectedDate, onSelectDate, workingDays }: WeekCalendarProps) {
  const [weekOffset, setWeekOffset] = useState(0);

  const weekDays = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Start from Monday of current week
    const startOfWeek = new Date(today);
    const dayOfWeek = today.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    startOfWeek.setDate(today.getDate() + diff + (weekOffset * 7));

    const days: { date: Date; dayIndex: number; isDisabled: boolean }[] = [];

    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);

      const isPast = date < today;
      // Convert Monday-first index to Sunday-first for workingDays check
      const sundayFirstIndex = date.getDay();
      const isWorkingDay = workingDays.includes(sundayFirstIndex);

      days.push({
        date,
        dayIndex: i,
        isDisabled: isPast || !isWorkingDay,
      });
    }

    return days;
  }, [weekOffset, workingDays]);

  const formatDateString = (date: Date): string => {
    return date.toISOString().split("T")[0];
  };

  const canGoPrev = weekOffset > 0;

  return (
    <div className="select-none">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <span className="font-semibold text-lg">Выберите дату</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setWeekOffset((w) => w - 1)}
            disabled={!canGoPrev}
            className="w-8 h-8 flex items-center justify-center rounded-full disabled:opacity-30"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <button
            onClick={() => setWeekOffset((w) => w + 1)}
            className="w-8 h-8 flex items-center justify-center rounded-full"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>
      </div>

      {/* Week days */}
      <div className="flex justify-between">
        {weekDays.map(({ date, dayIndex, isDisabled }) => {
          const dateString = formatDateString(date);
          const isSelected = selectedDate === dateString;
          const dayName = DAYS_SHORT[dayIndex];

          return (
            <button
              key={dateString}
              onClick={() => !isDisabled && onSelectDate(dateString)}
              disabled={isDisabled}
              className={`
                flex flex-col items-center py-2 w-10 transition-all
                ${isDisabled ? "opacity-40" : ""}
                ${!isDisabled && !isSelected ? "active:scale-95" : ""}
              `}
            >
              <span className="text-sm text-gray-500 mb-2">
                {dayName}
              </span>
              <div
                className={`
                  w-10 h-10 flex items-center justify-center rounded-full text-sm font-medium transition-all
                  ${isSelected
                    ? "bg-[#4A90D9] text-white"
                    : ""
                  }
                `}
              >
                {date.getDate()}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
