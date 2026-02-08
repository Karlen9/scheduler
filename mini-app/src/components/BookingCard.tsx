"use client";

import { Calendar, Clock, Dumbbell } from "lucide-react";
import { Booking } from "@/lib/types";

interface BookingCardProps {
  booking: Booking;
  onReschedule?: (booking: Booking) => void;
  onCancel?: (booking: Booking) => void;
}

const statusLabels: Record<string, { label: string; color: string }> = {
  pending: { label: "Ожидает", color: "bg-yellow-900/30 text-yellow-400" },
  confirmed: { label: "Подтверждено", color: "bg-green-900/30 text-green-400" },
  rejected: { label: "Отклонено", color: "bg-red-900/30 text-red-400" },
  cancelled: { label: "Отменено", color: "bg-gray-700/30 text-gray-400" },
  completed: { label: "Завершено", color: "bg-blue-900/30 text-blue-400" },
};

function formatDate(date: Date): string {
  const months = [
    "января", "февраля", "марта", "апреля", "мая", "июня",
    "июля", "августа", "сентября", "октября", "ноября", "декабря",
  ];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

export function BookingCard({ booking, onReschedule, onCancel }: BookingCardProps) {
  const startsAt = new Date(booking.startsAt);
  const endsAt = new Date(booking.endsAt);
  const status = statusLabels[booking.status] || statusLabels.pending;
  const isActive = booking.status === "pending" || booking.status === "confirmed";

  return (
    <div className="bg-card rounded-xl p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-foreground">{formatDate(startsAt)}</span>
          </div>
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-foreground">
              {formatTime(startsAt)} – {formatTime(endsAt)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Dumbbell className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-foreground">
              {booking.sessionType?.name || "Тренировка"}
              {booking.sessionType?.durationMinutes && (
                <span className="text-muted-foreground"> · {booking.sessionType.durationMinutes} мин</span>
              )}
            </span>
          </div>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${status.color}`}>
          {status.label}
        </span>
      </div>

      {isActive && (
        <div className="pt-3 border-t border-border">
          <div className="flex gap-2">
            <button
              onClick={() => onReschedule?.(booking)}
              className="flex-1 py-2 px-4 rounded-lg bg-background text-foreground text-sm font-medium transition-opacity active:opacity-70"
            >
              Перенести
            </button>
            <button
              onClick={() => onCancel?.(booking)}
              className="flex-1 py-2 px-4 rounded-lg bg-background text-destructive text-sm font-medium transition-opacity active:opacity-70"
            >
              Отменить
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
