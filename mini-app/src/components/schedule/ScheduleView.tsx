"use client";

import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { Booking, WorkingHours } from "@/lib/types";
import { MonthGrid, WeekStrip } from "@/components/Calendar";
import { DayTimeline } from "./DayTimeline";

type ViewMode = "day" | "week" | "month";

interface ScheduleViewProps {
  bookings: Booking[];
  onBookingClick?: (booking: Booking) => void;
  nonWorkingDays?: number[];
  daysOff?: string[];
  workingHours?: WorkingHours[];
  onEmptySlotClick?: (date: Date, time: string) => void;
}

const monthGenKeys = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const dayFullKeysJS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function toLocalDate(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function ScheduleView({ bookings, onBookingClick, nonWorkingDays, daysOff, workingHours, onEmptySlotClick }: ScheduleViewProps) {
  const t = useTranslations("ScheduleView");
  const td = useTranslations("Dates");
  const locale = useLocale();

  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [selectedDate, setSelectedDate] = useState(() => toLocalDate(new Date()));

  function formatDateHeader(date: Date): string {
    const day = date.getDate();
    const monthKey = monthGenKeys[date.getMonth()];
    const month = td(`monthsGen.${monthKey}`);
    const weekdayKey = dayFullKeysJS[date.getDay()];
    const weekday = td(`daysFull.${weekdayKey}`);
    const displayMonth = locale === "en" ? month.charAt(0).toUpperCase() + month.slice(1) : month;
    return `${day} ${displayMonth}, ${weekday}`;
  }

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

  // Dates with bookings (for dots)
  const dotDates = useMemo(() => {
    const set = new Set<string>();
    bookings.forEach((b) => {
      const d = new Date(b.startsAt);
      set.add(toISODate(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())));
    });
    return set;
  }, [bookings]);

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
      <h2 className="text-base font-medium text-foreground mb-3">{t("title")}</h2>

      {/* Tabs */}
      <div className="flex border-b border-border mb-4">
        {(["day", "week", "month"] as ViewMode[]).map((mode) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            className={`flex-1 py-2.5 text-sm transition-colors relative ${
              viewMode === mode
                ? "text-brand font-medium"
                : "text-muted-foreground"
            }`}
          >
            {t(mode)}
            {viewMode === mode && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* Week strip */}
      {viewMode === "week" && (
        <div className="mb-4">
          <WeekStrip
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            onPrevWeek={() => navigate(-1)}
            onNextWeek={() => navigate(1)}
            nonWorkingDays={nonWorkingDays}
            daysOff={daysOff}
            dotDates={dotDates}
          />
        </div>
      )}

      {/* Month calendar */}
      {viewMode === "month" && (
        <div className="mb-4">
          <MonthGrid
            displayDate={selectedDate}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            onPrevMonth={() => navigate(-1)}
            onNextMonth={() => navigate(1)}
            nonWorkingDays={nonWorkingDays}
            daysOff={daysOff}
            dotDates={dotDates}
            fillOuterDays
          />
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
        workingHours={workingHours}
        onEmptySlotClick={onEmptySlotClick}
      />
    </div>
  );
}
