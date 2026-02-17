"use client";

import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const MONTH_NAMES = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];
const DAY_NAMES = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getMonthGrid(year: number, month: number, fillOuter: boolean): (Date | null)[] {
  const days: (Date | null)[] = [];
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);

  let startDay = first.getDay();
  if (startDay === 0) startDay = 7;

  for (let i = startDay - 1; i > 0; i--) {
    days.push(fillOuter ? new Date(year, month, 1 - i) : null);
  }

  for (let i = 1; i <= last.getDate(); i++) {
    days.push(new Date(year, month, i));
  }

  if (fillOuter) {
    const remainder = 7 - (days.length % 7);
    if (remainder < 7) {
      for (let i = 1; i <= remainder; i++) {
        days.push(new Date(year, month + 1, i));
      }
    }
  }

  return days;
}

// ──────────────── Month Grid ────────────────

export interface MonthGridProps {
  /** Currently displayed month/year (year, month derived from this) */
  displayDate: Date;
  /** Selected date (highlighted) */
  selectedDate: Date | null;
  /** Multiple selected dates (for multi-select mode) */
  selectedDates?: Date[];
  onSelectDate: (date: Date) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  /** Days of week (0=Sun..6=Sat) that are non-working */
  nonWorkingDays?: number[];
  /** ISO date strings that are days off */
  daysOff?: string[];
  /** Disable past dates */
  disablePast?: boolean;
  /** ISO date strings (or a Set) that have a dot indicator */
  dotDates?: Set<string>;
  /** ISO date strings of dates already booked by this client */
  bookedDates?: Set<string>;
  /** Fill outer-month days instead of empty cells */
  fillOuterDays?: boolean;
  /** Wrap in bg-card container */
  card?: boolean;
  /** Show legend for days off */
  showLegend?: boolean;
  /** Title click handler (e.g. go to today) */
  onTitleClick?: () => void;
  /** When false, non-working days/days-off are styled but remain clickable (default: true) */
  disableNonWorking?: boolean;
}

export function MonthGrid({
  displayDate,
  selectedDate,
  selectedDates,
  onSelectDate,
  onPrevMonth,
  onNextMonth,
  nonWorkingDays,
  daysOff,
  disablePast,
  dotDates,
  bookedDates,
  fillOuterDays = false,
  card = false,
  showLegend = false,
  onTitleClick,
  disableNonWorking = true,
}: MonthGridProps) {
  const today = useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }, []);

  const daysOffSet = useMemo(() => new Set(daysOff ?? []), [daysOff]);
  const nonWorkingSet = useMemo(() => new Set(nonWorkingDays ?? []), [nonWorkingDays]);

  const month = displayDate.getMonth();
  const year = displayDate.getFullYear();
  const grid = useMemo(() => getMonthGrid(year, month, fillOuterDays), [year, month, fillOuterDays]);

  function isNonWorking(d: Date): boolean {
    if (nonWorkingSet.has(d.getDay())) return true;
    return daysOffSet.has(toISODate(d));
  }

  function isDayOffDate(d: Date): boolean {
    return daysOffSet.has(toISODate(d));
  }

  function isPast(d: Date): boolean {
    return d < today;
  }

  function isBooked(d: Date): boolean {
    return bookedDates?.has(toISODate(d)) ?? false;
  }

  function isDisabled(d: Date): boolean {
    if (disablePast && isPast(d)) return true;
    if (disableNonWorking) {
      if (nonWorkingSet.size > 0 && nonWorkingSet.has(d.getDay())) return true;
      if (daysOffSet.size > 0 && daysOffSet.has(toISODate(d))) return true;
    }
    if (bookedDates?.has(toISODate(d))) return true;
    return false;
  }

  const content = (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <button onClick={onPrevMonth} className="p-2 text-muted-foreground">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span
          className={`text-sm font-medium text-foreground ${onTitleClick ? "cursor-pointer" : ""}`}
          onClick={onTitleClick}
        >
          {MONTH_NAMES[month]} {year}
        </span>
        <button onClick={onNextMonth} className="p-2 text-muted-foreground">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Day names */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_NAMES.map((name) => (
          <div key={name} className="text-center text-[11px] text-muted-foreground py-1">
            {name}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className={`grid grid-cols-7 ${fillOuterDays ? "" : "gap-1"}`}>
        {grid.map((date, i) => {
          if (!date) {
            return <div key={`e-${i}`} className="aspect-square" />;
          }

          const isCurrentMonth = date.getMonth() === month;
          const selected = (selectedDate ? isSameDay(date, selectedDate) : false) ||
            (selectedDates?.some(sd => isSameDay(date, sd)) ?? false);
          const isDayToday = isSameDay(date, today);
          const disabled = isDisabled(date);
          const dayOff = isDayOffDate(date);
          const nonWorking = isNonWorking(date);
          const booked = isBooked(date);
          const hasDot = dotDates?.has(toISODate(date)) && !selected && !nonWorking;

          return (
            <button
              key={i}
              onClick={() => !disabled && onSelectDate(date)}
              disabled={disabled}
              className={`flex flex-col items-center ${fillOuterDays ? "py-1.5" : "aspect-square justify-center"}`}
            >
              <span
                className={`w-9 h-9 flex items-center justify-center rounded-full text-sm transition-colors ${
                  selected
                    ? "bg-brand text-white font-medium"
                    : booked && isCurrentMonth
                      ? "text-muted-foreground/50"
                      : dayOff && isCurrentMonth
                        ? "bg-red-900/30 text-red-400"
                        : disabled && disablePast && isPast(date)
                          ? "text-muted-foreground opacity-40"
                          : nonWorking
                            ? isCurrentMonth ? "text-muted-foreground/30" : "text-muted-foreground/20"
                            : isDayToday
                              ? "ring-1 ring-brand text-brand font-medium"
                              : isCurrentMonth
                                ? "text-foreground"
                                : "text-muted-foreground/40"
                }`}
              >
                {date.getDate()}
              </span>
              {booked && isCurrentMonth && !selected ? (
                <div className="w-1.5 h-1.5 rounded-full bg-brand/60 mt-0.5" />
              ) : hasDot ? (
                <div className="w-1 h-1 rounded-full bg-brand mt-0.5" />
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      {showLegend && daysOff && daysOff.length > 0 && (
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-red-900/30" />
            <span className="text-xs text-muted-foreground">Выходной</span>
          </div>
        </div>
      )}
    </>
  );

  if (card) {
    return <div className="bg-card rounded-xl p-4">{content}</div>;
  }

  return <div>{content}</div>;
}

// ──────────────── Week Strip ────────────────

export interface WeekStripProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  nonWorkingDays?: number[];
  daysOff?: string[];
  dotDates?: Set<string>;
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function WeekStrip({
  selectedDate,
  onSelectDate,
  onPrevWeek,
  onNextWeek,
  nonWorkingDays,
  daysOff,
  dotDates,
}: WeekStripProps) {
  const today = useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }, []);

  const daysOffSet = useMemo(() => new Set(daysOff ?? []), [daysOff]);
  const nonWorkingSet = useMemo(() => new Set(nonWorkingDays ?? []), [nonWorkingDays]);

  const weekDays = useMemo(() => {
    const start = getWeekStart(selectedDate);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [selectedDate]);

  function isNonWorking(d: Date): boolean {
    if (nonWorkingSet.has(d.getDay())) return true;
    return daysOffSet.has(toISODate(d));
  }

  function isDayOff(d: Date): boolean {
    return daysOffSet.has(toISODate(d));
  }

  return (
    <div className="flex items-center">
      <button onClick={onPrevWeek} className="p-1 text-muted-foreground shrink-0">
        <ChevronLeft className="w-5 h-5" />
      </button>
      <div className="flex-1 grid grid-cols-7 gap-0.5">
        {weekDays.map((day, i) => {
          const selected = isSameDay(day, selectedDate);
          const isDayToday = isSameDay(day, today);
          const nonWorking = isNonWorking(day);
          const dayOff = isDayOff(day);
          const hasDot = dotDates?.has(toISODate(day)) && !selected && !nonWorking;

          return (
            <button
              key={i}
              onClick={() => !nonWorking && onSelectDate(day)}
              disabled={nonWorking}
              className="flex flex-col items-center py-1.5"
            >
              <span className={`text-[11px] mb-1 ${nonWorking ? "text-muted-foreground/40" : "text-muted-foreground"}`}>
                {DAY_NAMES[i]}
              </span>
              <span
                className={`w-9 h-9 flex items-center justify-center rounded-full text-sm transition-colors ${
                  selected
                    ? "bg-brand text-white font-medium"
                    : dayOff
                      ? "bg-red-900/30 text-red-400"
                      : nonWorking
                        ? "text-muted-foreground/30"
                        : isDayToday
                          ? "ring-1 ring-brand text-brand font-medium"
                          : "text-foreground"
                }`}
              >
                {day.getDate()}
              </span>
              {hasDot && (
                <div className="w-1 h-1 rounded-full bg-brand mt-1" />
              )}
            </button>
          );
        })}
      </div>
      <button onClick={onNextWeek} className="p-1 text-muted-foreground shrink-0">
        <ChevronRight className="w-5 h-5" />
      </button>
    </div>
  );
}
