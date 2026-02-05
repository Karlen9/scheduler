"use client";

import { Booking } from "@/lib/types";

interface WeekGridProps {
  startDate: Date;
  bookings: Booking[];
  onDayClick?: (date: Date) => void;
}

function getWeekDays(startDate: Date): Date[] {
  const days: Date[] = [];
  const start = new Date(startDate);
  // Adjust to Monday
  const day = start.getDay();
  const diff = start.getDate() - day + (day === 0 ? -6 : 1);
  start.setDate(diff);

  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d);
  }
  return days;
}

function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

const DAY_NAMES = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

export function WeekGrid({ startDate, bookings, onDayClick }: WeekGridProps) {
  const days = getWeekDays(startDate);
  const today = new Date();

  const getBookingsForDay = (date: Date) => {
    return bookings.filter((b) => {
      const bookingDate = new Date(b.startsAt);
      return isSameDay(bookingDate, date);
    });
  };

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 mb-2">
        {DAY_NAMES.map((name) => (
          <div key={name} className="text-center text-xs text-muted-foreground">
            {name}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((date) => {
          const dayBookings = getBookingsForDay(date);
          const isToday = isSameDay(date, today);

          return (
            <button
              key={date.toISOString()}
              onClick={() => onDayClick?.(date)}
              className={`flex flex-col items-center p-2 rounded-lg transition-colors ${
                isToday
                  ? "bg-brand text-white"
                  : "bg-card hover:bg-border"
              }`}
            >
              <span className={`text-sm font-medium ${isToday ? "text-white" : "text-foreground"}`}>
                {date.getDate()}
              </span>
              {dayBookings.length > 0 && (
                <div className="flex gap-0.5 mt-1">
                  {dayBookings.slice(0, 3).map((_, i) => (
                    <div
                      key={i}
                      className={`w-1.5 h-1.5 rounded-full ${
                        isToday ? "bg-white/70" : "bg-brand"
                      }`}
                    />
                  ))}
                  {dayBookings.length > 3 && (
                    <span className={`text-[8px] ${isToday ? "text-white/70" : "text-muted-foreground"}`}>
                      +{dayBookings.length - 3}
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
