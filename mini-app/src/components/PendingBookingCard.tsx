"use client";

import { Check, X } from "lucide-react";
import { Booking } from "@/lib/types";
import { ClientAvatar } from "@/components/ClientAvatar";

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
  return `${days[date.getUTCDay()]}, ${date.getUTCDate()} ${months[date.getUTCMonth()]}`;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
}

export function PendingBookingCard({ booking, onAccept, onReject }: PendingBookingCardProps) {
  const startsAt = new Date(booking.startsAt);
  const endsAt = new Date(booking.endsAt);

  return (
    <div className="bg-card rounded-xl p-4 border-l-4 border-l-warning">
      <div className="flex items-start gap-3">
        <ClientAvatar name={booking.clientName} photoUrl={booking.clientPhotoUrl} />
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
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-action-success-bg text-action-success-text text-sm font-medium transition-opacity active:opacity-70"
        >
          <Check className="w-4 h-4" />
          Принять
        </button>
        <button
          onClick={() => onReject(booking)}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-action-danger-bg text-action-danger-text text-sm font-medium transition-opacity active:opacity-70"
        >
          <X className="w-4 h-4" />
          Отклонить
        </button>
      </div>
    </div>
  );
}
