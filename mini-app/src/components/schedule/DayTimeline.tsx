"use client";

import { useMemo } from "react";
import { Plus } from "lucide-react";
import { Booking, WorkingHours } from "@/lib/types";
import { ClientAvatar } from "@/components/ClientAvatar";

interface DayTimelineProps {
  bookings: Booking[];
  date: Date;
  onBookingClick?: (booking: Booking) => void;
  workingHours?: WorkingHours[];
  onEmptySlotClick?: (date: Date, time: string) => void;
}

interface EmptySlot {
  startMin: number;
  endMin: number;
}

const HOUR_HEIGHT = 72;

function formatHour(hour: number): string {
  return `${hour.toString().padStart(2, "0")}:00`;
}

function formatMinutes(totalMin: number): string {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
}

function getCardStyle(status: string): { bg: string; text: string; subtext: string } {
  switch (status) {
    case "confirmed":
      return { bg: "bg-brand", text: "text-white", subtext: "text-white/70" };
    case "pending":
      return { bg: "bg-warning", text: "text-white", subtext: "text-white/80" };
    default:
      return { bg: "bg-brand", text: "text-white", subtext: "text-white/70" };
  }
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function parseTimeToMin(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function DayTimeline({ bookings, date, onBookingClick, workingHours, onEmptySlotClick }: DayTimelineProps) {
  const today = useMemo(() => new Date(), []);
  const isToday = isSameDay(date, today);

  // Get working hours for this day of week
  const dayWH = useMemo(() => {
    if (!workingHours) return null;
    const dow = date.getDay(); // 0=Sun
    return workingHours.find((wh) => wh.dayOfWeek === dow) ?? null;
  }, [workingHours, date]);

  // Calculate empty slots (gaps between bookings within working hours)
  const emptySlots = useMemo<EmptySlot[]>(() => {
    if (!dayWH) return [];
    const whStart = parseTimeToMin(dayWH.startTime);
    const whEnd = parseTimeToMin(dayWH.endTime);

    if (bookings.length === 0) {
      return [{ startMin: whStart, endMin: whEnd }];
    }

    // Get sorted occupied ranges
    const occupied = bookings
      .map((b) => {
        const s = new Date(b.startsAt);
        const e = new Date(b.endsAt);
        return {
          start: s.getUTCHours() * 60 + s.getUTCMinutes(),
          end: e.getUTCHours() * 60 + e.getUTCMinutes(),
        };
      })
      .sort((a, b) => a.start - b.start);

    const gaps: EmptySlot[] = [];
    let cursor = whStart;

    for (const slot of occupied) {
      const slotStart = Math.max(slot.start, whStart);
      const slotEnd = Math.min(slot.end, whEnd);
      if (cursor < slotStart) {
        gaps.push({ startMin: cursor, endMin: slotStart });
      }
      cursor = Math.max(cursor, slotEnd);
    }

    if (cursor < whEnd) {
      gaps.push({ startMin: cursor, endMin: whEnd });
    }

    return gaps;
  }, [bookings, dayWH]);

  // Determine hour range — extend to working hours if available
  const { minHour, maxHour } = useMemo(() => {
    let min = 23;
    let max = 0;

    if (dayWH) {
      min = Math.floor(parseTimeToMin(dayWH.startTime) / 60);
      max = Math.ceil(parseTimeToMin(dayWH.endTime) / 60);
    }

    for (const b of bookings) {
      const start = new Date(b.startsAt);
      const end = new Date(b.endsAt);
      min = Math.min(min, start.getUTCHours());
      const endHour = end.getUTCHours() + (end.getUTCMinutes() > 0 ? 1 : 0);
      max = Math.max(max, endHour);
    }

    return { minHour: min, maxHour: max };
  }, [bookings, dayWH]);

  // No working hours and no bookings — show simple empty
  if (bookings.length === 0 && !dayWH) {
    return (
      <div className="py-12 text-center text-muted-foreground text-sm">
        Нет записей на этот день
      </div>
    );
  }

  // No bookings but is a working day — show empty slot without timeline grid
  if (bookings.length === 0 && dayWH) {
    return (
      <div className="space-y-2">
        <button
          onClick={() => onEmptySlotClick?.(date, dayWH.startTime)}
          className="w-full border border-dashed border-border rounded-xl p-4 text-left transition-opacity active:opacity-80"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm text-muted-foreground">Пустой слот</p>
              <p className="text-xs text-muted-foreground/60">Время не занято</p>
              <p className="text-xs text-muted-foreground mt-1">
                {dayWH.startTime} – {dayWH.endTime}
              </p>
            </div>
            <div className="w-8 h-8 rounded-full bg-brand/10 flex items-center justify-center">
              <Plus className="w-4 h-4 text-brand" />
            </div>
          </div>
        </button>
      </div>
    );
  }

  const hourLabels: number[] = [];
  for (let h = minHour; h <= maxHour; h++) {
    hourLabels.push(h);
  }

  const totalHeight = (maxHour - minHour) * HOUR_HEIGHT;

  // Current time indicator
  let nowTop: number | null = null;
  if (isToday) {
    const now = new Date();
    const nowMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
    if (nowMinutes >= minHour * 60 && nowMinutes <= maxHour * 60) {
      nowTop = ((nowMinutes - minHour * 60) / 60) * HOUR_HEIGHT;
    }
  }

  return (
    <div className="relative" style={{ height: totalHeight + 16 }}>
      {/* Hour grid lines and labels */}
      {hourLabels.map((hour) => (
        <div
          key={hour}
          className="absolute left-0 right-0 flex items-center"
          style={{ top: (hour - minHour) * HOUR_HEIGHT }}
        >
          <span className="w-12 text-xs text-muted-foreground shrink-0 pr-2 text-right -translate-y-1/2">
            {formatHour(hour)}
          </span>
          <div className="flex-1 border-t border-border" />
        </div>
      ))}

      {/* Empty slot cards */}
      {emptySlots.map((slot) => {
        const top = ((slot.startMin - minHour * 60) / 60) * HOUR_HEIGHT;
        const height = Math.max(((slot.endMin - slot.startMin) / 60) * HOUR_HEIGHT, 40);

        return (
          <button
            key={`empty-${slot.startMin}`}
            onClick={() => onEmptySlotClick?.(date, formatMinutes(slot.startMin))}
            className="absolute left-12 right-0 bg-card border border-dashed border-surface-border rounded-xl px-3 py-2 text-left transition-opacity active:opacity-80 overflow-hidden"
            style={{ top: top + 1.5, height: height - 3 }}
          >
            <div className="flex items-center justify-between h-full">
              <div className="min-w-0">
                <p className="font-medium text-sm text-muted-foreground">Пустой слот</p>
                {height >= 54 && (
                  <p className="text-xs text-muted-foreground/60">Время не занято</p>
                )}
                {height >= 68 && (
                  <p className="text-xs text-muted-foreground/60">
                    {formatMinutes(slot.startMin)} – {formatMinutes(slot.endMin)}
                  </p>
                )}
              </div>
              <div className="w-7 h-7 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
                <Plus className="w-3.5 h-3.5 text-brand" />
              </div>
            </div>
          </button>
        );
      })}

      {/* Booking cards */}
      {bookings.map((booking) => {
        const start = new Date(booking.startsAt);
        const end = new Date(booking.endsAt);
        const startMin = start.getUTCHours() * 60 + start.getUTCMinutes();
        const endMin = end.getUTCHours() * 60 + end.getUTCMinutes();
        const top = ((startMin - minHour * 60) / 60) * HOUR_HEIGHT;
        const height = Math.max(((endMin - startMin) / 60) * HOUR_HEIGHT, 40);
        const style = getCardStyle(booking.status);

        return (
          <button
            key={booking.id}
            onClick={() => onBookingClick?.(booking)}
            className={`absolute left-12 right-0 ${style.bg} rounded-xl px-3 py-2 text-left transition-opacity active:opacity-80 overflow-hidden`}
            style={{ top: top + 1.5, height: height - 3 }}
          >
            <div className="flex items-center gap-2 h-full">
              <div className="flex-1 min-w-0">
                <p className={`font-medium text-sm ${style.text} truncate`}>
                  {booking.clientName}
                </p>
                {height >= 54 && (
                  <p className={`text-xs ${style.subtext} truncate`}>
                    Тренировка{booking.durationMinutes ? ` \u00b7 ${booking.durationMinutes} мин` : ""}
                  </p>
                )}
                {height >= 68 && (
                  <p className={`text-xs ${style.subtext}`}>
                    {formatTime(booking.startsAt)} – {formatTime(booking.endsAt)}
                  </p>
                )}
              </div>
              <ClientAvatar name={booking.clientName} photoUrl={booking.clientPhotoUrl} size="sm" />
            </div>
          </button>
        );
      })}

      {/* Current time indicator */}
      {nowTop !== null && (
        <div
          className="absolute left-10 right-0 flex items-center pointer-events-none z-10"
          style={{ top: nowTop }}
        >
          <div className="w-2.5 h-2.5 rounded-full bg-destructive -ml-1" />
          <div className="flex-1 border-t-2 border-destructive" />
        </div>
      )}
    </div>
  );
}
