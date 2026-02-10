"use client";

import { Booking } from "@/lib/types";
import { getAvatarColor } from "@/lib/colors";

interface UpcomingBookingCardProps {
  booking: Booking;
  onClick?: (booking: Booking) => void;
}

function formatDate(date: Date): string {
  const months = [
    "янв", "фев", "мар", "апр", "мая", "июн",
    "июл", "авг", "сен", "окт", "ноя", "дек",
  ];
  const days = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
  return `${days[date.getUTCDay()]}, ${date.getUTCDate()} ${months[date.getUTCMonth()]}`;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
}

export function UpcomingBookingCard({ booking, onClick }: UpcomingBookingCardProps) {
  const startsAt = new Date(booking.startsAt);
  const endsAt = new Date(booking.endsAt);

  return (
    <button
      onClick={() => onClick?.(booking)}
      className="w-full bg-card rounded-xl p-4 border-l-4 border-l-green-500 text-left transition-opacity active:opacity-80"
    >
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-base font-medium shrink-0 ${getAvatarColor(booking.clientName)}`}>
          {booking.clientName.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-foreground truncate">
            {booking.clientName}
          </p>
          <p className="text-sm text-muted-foreground">
            Тренировка{booking.durationMinutes ? ` · ${booking.durationMinutes} мин` : booking.sessionType?.durationMinutes ? ` · ${booking.sessionType.durationMinutes} мин` : ""}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-medium text-foreground">
            {formatTime(startsAt)} – {formatTime(endsAt)}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatDate(startsAt)}
          </p>
        </div>
      </div>
    </button>
  );
}
