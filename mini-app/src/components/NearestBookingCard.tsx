"use client";

import { Booking } from "@/lib/types";

interface NearestBookingCardProps {
  booking: Booking;
  onClick?: () => void;
}

function getTimeUntil(date: Date): string {
  const now = new Date();
  const diff = date.getTime() - now.getTime();

  if (diff < 0) return "сейчас";

  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `через ${days} ${days === 1 ? "день" : days < 5 ? "дня" : "дней"}`;
  if (hours > 0) return `через ${hours} ${hours === 1 ? "час" : hours < 5 ? "часа" : "часов"}`;
  return `через ${minutes} ${minutes === 1 ? "минуту" : minutes < 5 ? "минуты" : "минут"}`;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
}

export function NearestBookingCard({ booking, onClick }: NearestBookingCardProps) {
  const startsAt = new Date(booking.startsAt);
  const endsAt = new Date(booking.endsAt);
  const timeUntil = getTimeUntil(startsAt);

  return (
    <div className="mb-6">
      <h3 className="text-base font-medium text-foreground mb-3">
        Ближайшая запись
      </h3>
      <button
        onClick={onClick}
        className="w-full bg-card rounded-xl p-4 border-l-4 border-l-warning text-left transition-opacity active:opacity-80"
      >
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <p className="font-medium text-foreground">
              {booking.clientName}
            </p>
            <p className="text-sm text-muted-foreground">
              Тренировка{booking.durationMinutes ? ` · ${booking.durationMinutes} мин` : booking.sessionType?.durationMinutes ? ` · ${booking.sessionType.durationMinutes} мин` : ""}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {timeUntil}
            </p>
            <p className="text-sm font-medium text-foreground mt-1">
              {formatTime(startsAt)} – {formatTime(endsAt)}
            </p>
          </div>
          <div className="w-12 h-12 rounded-full bg-card flex items-center justify-center text-lg text-muted-foreground">
            {booking.clientName.charAt(0)}
          </div>
        </div>
      </button>
    </div>
  );
}
