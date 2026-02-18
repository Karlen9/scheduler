"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";

interface WeekDatePickerProps {
  selectedDate: Date | null;
  onSelectDate: (date: Date) => void;
}

const monthNomKeys = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const dayShortKeysMon = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

export function WeekDatePicker({
  selectedDate,
  onSelectDate,
}: WeekDatePickerProps) {
  const td = useTranslations("Dates");
  const tf = useTranslations("BookingForm");

  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthNames = monthNomKeys.map(k => td(`monthsNom.${k}`));
  const dayNames = dayShortKeysMon.map(k => td(`daysShort.${k}`));

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
        <h3 className="text-lg font-medium text-foreground">{tf("selectDay")}</h3>

        <div className="flex items-center gap-4">
          <button
            onClick={prevMonth}
            className="p-0.5 transition-opacity active:opacity-60"
          >
            <ChevronLeft
              className="w-[11.4px] h-[11.4px] text-muted-foreground"
              strokeWidth={2}
            />
          </button>

          <span className="text-base font-medium text-muted-foreground min-w-[110px] text-center">
            {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
          </span>

          <button
            onClick={nextMonth}
            className="p-0.5 transition-opacity active:opacity-60"
          >
            <ChevronRight
              className="w-[11.4px] h-[11.4px] text-muted-foreground"
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
                border border-surface-border bg-card
                ${selected ? "outline outline-2 outline-brand" : ""}
                ${past && !selected ? "bg-surface-hover opacity-100 cursor-not-allowed" : ""}
                ${!past && !selected ? "active:opacity-70" : ""}
              `}
            >
              {/* Day Name */}
              <span
                className={`text-sm font-medium leading-none ${selected ? "text-white" : past ? "text-muted-foreground opacity-30" : "text-muted-foreground"}`}
              >
                {dayNames[index]}
              </span>

              {/* Circle Background with Date */}
              <div className="relative w-8 h-8 flex items-center justify-center">
                <div
                  className={`
                  absolute inset-0 rounded-full
                  ${selected ? "bg-brand" : past ? "bg-surface-hover opacity-50" : "bg-surface-hover opacity-50"}
                `}
                />

                {/* Date Number */}
                <span
                  className={`
                  relative text-base font-medium leading-none z-10
                  ${selected ? "text-white" : past ? "text-muted-foreground opacity-30" : "text-foreground"}
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
