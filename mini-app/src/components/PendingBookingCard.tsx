"use client";

import { Check, X } from "lucide-react";
import { Booking } from "@/lib/types";

interface PendingBookingCardProps {
  booking: Booking;
  onAccept: (booking: Booking) => void;
  onReject: (booking: Booking) => void;
}

function formatDate(date: Date): string {
  const months = [
    "янв", "фев", "мар", "апр", "мая", "июн",
    "июл", "авг", "сен", "окт", "ноя", "дек",
  ];
  const days = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
  return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]}`;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

export function PendingBookingCard({ booking, onAccept, onReject }: PendingBookingCardProps) {
  const startsAt = new Date(booking.startsAt);
  const endsAt = new Date(booking.endsAt);

  return (
    <div className="bg-card rounded-xl p-4 border-l-4 border-l-warning">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-background flex items-center justify-center text-base font-medium text-muted-foreground shrink-0">
          {booking.clientName.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-foreground truncate">
            {booking.clientName}
          </p>
          <p className="text-sm text-muted-foreground">
            Тренировка{booking.durationMinutes ? ` · ${booking.durationMinutes} мин` : booking.sessionType?.durationMinutes ? ` · ${booking.sessionType.durationMinutes} мин` : ""}
          </p>
          <p className="text-sm text-foreground mt-1">
            {formatDate(startsAt)}, {formatTime(startsAt)} – {formatTime(endsAt)}
          </p>
          {booking.clientMessage && (
            <p className="text-xs text-muted-foreground mt-1 italic">
              &ldquo;{booking.clientMessage}&rdquo;
            </p>
          )}
        </div>
      </div>

      <div className="flex gap-2 mt-3">
        <button
          onClick={() => onAccept(booking)}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-green-600/20 text-green-500 text-sm font-medium transition-opacity active:opacity-70"
        >
          <Check className="w-4 h-4" />
          Принять
        </button>
        <button
          onClick={() => onReject(booking)}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-red-600/20 text-red-400 text-sm font-medium transition-opacity active:opacity-70"
        >
          <X className="w-4 h-4" />
          Отклонить
        </button>
      </div>
    </div>
  );
}
