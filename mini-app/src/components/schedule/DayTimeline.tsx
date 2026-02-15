"use client";

import { useMemo } from "react";
import { Booking } from "@/lib/types";
import { ClientAvatar } from "@/components/ClientAvatar";

interface DayTimelineProps {
  bookings: Booking[];
  date: Date;
  onBookingClick?: (booking: Booking) => void;
}

const HOUR_HEIGHT = 72;

function formatHour(hour: number): string {
  return `${hour.toString().padStart(2, "0")}:00`;
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

export function DayTimeline({ bookings, date, onBookingClick }: DayTimelineProps) {
  const today = useMemo(() => new Date(), []);
  const isToday = isSameDay(date, today);

  if (bookings.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground text-sm">
        Нет записей на этот день
      </div>
    );
  }

  // Determine hour range
  let minHour = 23;
  let maxHour = 0;
  for (const b of bookings) {
    const start = new Date(b.startsAt);
    const end = new Date(b.endsAt);
    minHour = Math.min(minHour, start.getUTCHours());
    const endHour = end.getUTCHours() + (end.getUTCMinutes() > 0 ? 1 : 0);
    maxHour = Math.max(maxHour, endHour);
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
            className={`absolute left-14 right-0 ${style.bg} rounded-xl px-3 py-2 text-left transition-opacity active:opacity-80 overflow-hidden`}
            style={{ top: top + 2, height: height - 4 }}
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
