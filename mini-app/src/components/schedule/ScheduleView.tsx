"use client";

import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Booking } from "@/lib/types";
import { DayTimeline } from "./DayTimeline";

type ViewMode = "day" | "week" | "month";

interface ScheduleViewProps {
  bookings: Booking[];
  onBookingClick?: (booking: Booking) => void;
}

const monthNamesGen = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];
const monthNamesNom = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];
const dayNamesShort = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const dayNamesLong = [
  "Воскресенье", "Понедельник", "Вторник", "Среда",
  "Четверг", "Пятница", "Суббота",
];

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function toLocalDate(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function formatDateHeader(date: Date): string {
  const day = date.getDate();
  const month = monthNamesGen[date.getMonth()];
  const weekday = dayNamesLong[date.getDay()];
  return `${day} ${month.charAt(0).toUpperCase() + month.slice(1)}, ${weekday}`;
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return toLocalDate(d);
}

function getMonthGrid(year: number, month: number): Date[] {
  const days: Date[] = [];
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);

  let startDay = first.getDay();
  if (startDay === 0) startDay = 7;
  for (let i = startDay - 1; i > 0; i--) {
    days.push(new Date(year, month, 1 - i));
  }

  for (let i = 1; i <= last.getDate(); i++) {
    days.push(new Date(year, month, i));
  }

  const remainder = 7 - (days.length % 7);
  if (remainder < 7) {
    for (let i = 1; i <= remainder; i++) {
      days.push(new Date(year, month + 1, i));
    }
  }

  return days;
}

export function ScheduleView({ bookings, onBookingClick }: ScheduleViewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [selectedDate, setSelectedDate] = useState(() => toLocalDate(new Date()));

  const today = useMemo(() => toLocalDate(new Date()), []);

  // Filter bookings for the selected date
  const dayBookings = useMemo(() => {
    return bookings
      .filter((b) => {
        const d = new Date(b.startsAt);
        const bookingDate = new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
        return isSameDay(bookingDate, selectedDate);
      })
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  }, [bookings, selectedDate]);

  // Dates with bookings (for calendar dots)
  const bookingDatesSet = useMemo(() => {
    const set = new Set<string>();
    bookings.forEach((b) => {
      const d = new Date(b.startsAt);
      set.add(`${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`);
    });
    return set;
  }, [bookings]);

  function hasBookingsOnDate(d: Date): boolean {
    return bookingDatesSet.has(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
  }

  // Week days
  const weekDays = useMemo(() => {
    const start = getWeekStart(selectedDate);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [selectedDate]);

  // Month grid
  const monthGrid = useMemo(() => {
    return getMonthGrid(selectedDate.getFullYear(), selectedDate.getMonth());
  }, [selectedDate]);

  // Navigation
  const navigate = (delta: number) => {
    setSelectedDate((d) => {
      const newDate = new Date(d);
      if (viewMode === "day") {
        newDate.setDate(d.getDate() + delta);
      } else if (viewMode === "week") {
        newDate.setDate(d.getDate() + delta * 7);
      } else {
        newDate.setMonth(d.getMonth() + delta);
      }
      return newDate;
    });
  };

  return (
    <div>
      <h2 className="text-base font-medium text-foreground mb-3">Расписание</h2>

      {/* Tabs */}
      <div className="flex bg-card rounded-xl p-1 mb-4">
        {(["day", "week", "month"] as ViewMode[]).map((mode) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            className={`flex-1 py-2 text-sm rounded-lg transition-colors ${
              viewMode === mode
                ? "bg-background text-foreground font-medium"
                : "text-muted-foreground"
            }`}
          >
            {mode === "day" ? "День" : mode === "week" ? "Неделя" : "Месяц"}
          </button>
        ))}
      </div>

      {/* Week strip */}
      {viewMode === "week" && (
        <div className="flex items-center mb-4">
          <button onClick={() => navigate(-1)} className="p-1 text-muted-foreground shrink-0">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 grid grid-cols-7 gap-0.5">
            {weekDays.map((day, i) => {
              const selected = isSameDay(day, selectedDate);
              const isDayToday = isSameDay(day, today);
              return (
                <button
                  key={i}
                  onClick={() => setSelectedDate(day)}
                  className="flex flex-col items-center py-1.5"
                >
                  <span className="text-[11px] text-muted-foreground mb-1">
                    {dayNamesShort[i]}
                  </span>
                  <span
                    className={`w-9 h-9 flex items-center justify-center rounded-full text-sm transition-colors ${
                      selected
                        ? "bg-brand text-white font-medium"
                        : isDayToday
                          ? "ring-1 ring-brand text-brand font-medium"
                          : "text-foreground"
                    }`}
                  >
                    {day.getDate()}
                  </span>
                  {hasBookingsOnDate(day) && !selected && (
                    <div className="w-1 h-1 rounded-full bg-brand mt-1" />
                  )}
                </button>
              );
            })}
          </div>
          <button onClick={() => navigate(1)} className="p-1 text-muted-foreground shrink-0">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Month calendar */}
      {viewMode === "month" && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => navigate(-1)} className="p-2 text-muted-foreground">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-sm font-medium text-foreground">
              {monthNamesNom[selectedDate.getMonth()]} {selectedDate.getFullYear()}
            </span>
            <button onClick={() => navigate(1)} className="p-2 text-muted-foreground">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-7 mb-1">
            {dayNamesShort.map((name) => (
              <div key={name} className="text-center text-[11px] text-muted-foreground py-1">
                {name}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {monthGrid.map((day, i) => {
              const isCurrentMonth = day.getMonth() === selectedDate.getMonth();
              const selected = isSameDay(day, selectedDate);
              const isDayToday = isSameDay(day, today);
              return (
                <button
                  key={i}
                  onClick={() => setSelectedDate(day)}
                  className="flex flex-col items-center py-1.5"
                >
                  <span
                    className={`w-9 h-9 flex items-center justify-center rounded-full text-sm transition-colors ${
                      selected
                        ? "bg-brand text-white font-medium"
                        : isDayToday
                          ? "ring-1 ring-brand text-brand font-medium"
                          : isCurrentMonth
                            ? "text-foreground"
                            : "text-muted-foreground/40"
                    }`}
                  >
                    {day.getDate()}
                  </span>
                  {hasBookingsOnDate(day) && !selected && (
                    <div className="w-1 h-1 rounded-full bg-brand mt-0.5" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Date header */}
      {viewMode === "day" ? (
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => navigate(-1)} className="p-2 text-muted-foreground">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h3 className="text-sm font-medium text-foreground">
            {formatDateHeader(selectedDate)}
          </h3>
          <button onClick={() => navigate(1)} className="p-2 text-muted-foreground">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      ) : (
        <h3 className="text-sm font-medium text-foreground mb-3">
          {formatDateHeader(selectedDate)}
        </h3>
      )}

      {/* Timeline */}
      <DayTimeline
        bookings={dayBookings}
        date={selectedDate}
        onBookingClick={onBookingClick}
      />
    </div>
  );
}
