"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface WeekDatePickerProps {
  selectedDate: Date | null;
  onSelectDate: (date: Date) => void;
}

export function WeekDatePicker({
  selectedDate,
  onSelectDate,
}: WeekDatePickerProps) {
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

  // Get the current week (7 days starting from the beginning of current month)
  const getCurrentWeek = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    // Start from day 1 of the month
    const startDate = new Date(year, month, 1);

    // Get day of week for the 1st (0 = Sunday, adjust to Monday = 0)
    let startDay = startDate.getDay() - 1;
    if (startDay < 0) startDay = 6;

    // Create array of 7 days starting from Monday of the first week
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(year, month, 1 - startDay + i);
      week.push(date);
    }

    return week;
  };

  const week = getCurrentWeek();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

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
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <h3 className="text-lg font-medium text-[#101010]">Выберите дату</h3>

        <div className="flex items-center gap-4">
          <button
            onClick={prevMonth}
            className="p-0.5 transition-opacity active:opacity-60"
            aria-label="Предыдущий месяц"
          >
            <ChevronLeft
              className="w-[11.4px] h-[11.4px] text-[#999999]"
              strokeWidth={2}
            />
          </button>

          <span className="text-base font-medium text-[#999999] min-w-[110px] text-center">
            {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
          </span>

          <button
            onClick={nextMonth}
            className="p-0.5 transition-opacity active:opacity-60"
            aria-label="Следующий месяц"
          >
            <ChevronRight
              className="w-[11.4px] h-[11.4px] text-[#999999]"
              strokeWidth={2}
            />
          </button>
        </div>
      </div>

      {/* Week Days Grid */}
      <div className="grid grid-cols-7 gap-2 px-1">
        {week.map((date, index) => {
          const selected = isSelected(date);
          const past = isPast(date);

          return (
            <button
              key={index}
              onClick={() => !past && onSelectDate(date)}
              disabled={past}
              className={`
                relative flex flex-col items-center gap-3 py-3 rounded-[70px] transition-all
                border border-[#e9e9e9] bg-white
                ${selected ? "outline outline-2 outline-[#5381e3]" : ""}
                ${past && !selected ? "bg-[#e6e6e6] opacity-100 cursor-not-allowed" : ""}
                ${!past && !selected ? "active:opacity-70" : ""}
              `}
            >
              {/* Day Name */}
              <span
                className={`text-sm font-medium leading-none ${selected ? "text-[#0c0c0c]" : past ? "text-[#676767] opacity-30" : "text-[#676767]"}`}
              >
                {dayNames[index]}
              </span>

              {/* Circle Background with Date */}
              <div className="relative w-8 h-8 flex items-center justify-center">
                <div
                  className={`
                  absolute inset-0 rounded-full
                  ${selected ? "bg-[#5381e3]" : past ? "bg-[#cecece] opacity-50" : "bg-[#f5f5f5] opacity-50"}
                `}
                />

                {/* Date Number */}
                <span
                  className={`
                  relative text-base font-medium leading-none z-10
                  ${selected ? "text-white" : past ? "text-[#676767] opacity-30" : "text-[#676767]"}
                `}
                >
                  {date.getDate()}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
