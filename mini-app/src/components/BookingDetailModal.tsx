"use client";

import { X, Phone, MessageCircle } from "lucide-react";
import { Booking } from "@/lib/types";
import { ClientAvatar } from "@/components/ClientAvatar";

interface BookingDetailModalProps {
  booking: Booking | null;
  isOpen: boolean;
  onClose: () => void;
  onReschedule?: (booking: Booking) => void;
  onCancel?: (booking: Booking) => void;
}

function formatDate(date: Date): string {
  const months = [
    "января", "февраля", "марта", "апреля", "мая", "июня",
    "июля", "августа", "сентября", "октября", "ноября", "декабря"
  ];
  const days = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"];
  return `${date.getUTCDate()} ${months[date.getUTCMonth()]}, ${days[date.getUTCDay()]}`;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
}

export function BookingDetailModal({
  booking,
  isOpen,
  onClose,
  onReschedule,
  onCancel,
}: BookingDetailModalProps) {
  if (!isOpen || !booking) return null;

  const startsAt = new Date(booking.startsAt);
  const endsAt = new Date(booking.endsAt);

  const statusLabels: Record<string, { label: string; color: string }> = {
    pending: { label: "Ожидает", color: "bg-yellow-900/30 text-yellow-400" },
    confirmed: { label: "Подтверждено", color: "bg-green-900/30 text-green-400" },
    rejected: { label: "Отклонено", color: "bg-red-900/30 text-red-400" },
    cancelled: { label: "Отменено", color: "bg-gray-700/30 text-gray-400" },
    completed: { label: "Завершено", color: "bg-blue-900/30 text-blue-400" },
  };

  const status = statusLabels[booking.status] || statusLabels.pending;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="relative w-full bg-background rounded-t-2xl p-4 animate-slide-up"
        style={{ maxWidth: "430px" }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-full hover:bg-card"
        >
          <X className="w-5 h-5 text-muted-foreground" />
        </button>

        {/* Client info */}
        <div className="flex items-center gap-4 mb-4">
          <ClientAvatar name={booking.clientName} photoUrl={booking.clientPhotoUrl} size="lg" />
          <div>
            <h3 className="text-xl font-medium text-foreground">
              {booking.clientName}
            </h3>
            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
              {status.label}
            </span>
          </div>
        </div>

        {/* Booking details */}
        <div className="space-y-3 mb-6">
          <div className="flex justify-between py-2 border-b border-border">
            <span className="text-muted-foreground">Услуга</span>
            <span className="text-foreground font-medium">
              Тренировка
            </span>
          </div>
          <div className="flex justify-between py-2 border-b border-border">
            <span className="text-muted-foreground">Дата</span>
            <span className="text-foreground font-medium">
              {formatDate(startsAt)}
            </span>
          </div>
          <div className="flex justify-between py-2 border-b border-border">
            <span className="text-muted-foreground">Время</span>
            <span className="text-foreground font-medium">
              {formatTime(startsAt)} – {formatTime(endsAt)}
            </span>
          </div>
          {(booking.durationMinutes || booking.sessionType?.durationMinutes) && (
            <div className="flex justify-between py-2 border-b border-border">
              <span className="text-muted-foreground">Длительность</span>
              <span className="text-foreground font-medium">
                {booking.durationMinutes || booking.sessionType?.durationMinutes} мин
              </span>
            </div>
          )}
          {booking.clientMessage && (
            <div className="py-2 border-b border-border">
              <span className="text-muted-foreground text-sm">Комментарий клиента</span>
              <p className="text-foreground text-sm mt-1">{booking.clientMessage}</p>
            </div>
          )}
          {booking.cancelReason && (
            <div className="py-2 border-b border-border">
              <span className="text-muted-foreground text-sm">Причина отмены</span>
              <p className="text-foreground text-sm mt-1">{booking.cancelReason}</p>
            </div>
          )}
        </div>

        {/* Actions */}
        {(booking.status === "pending" || booking.status === "confirmed") && (
          <div className="flex gap-3">
            <button
              onClick={() => onReschedule?.(booking)}
              className="flex-1 py-3 px-4 rounded-[28px] bg-card text-foreground text-sm font-medium transition-opacity active:opacity-80"
            >
              Изменить
            </button>
            <button
              onClick={() => onCancel?.(booking)}
              className="flex-1 py-3 px-4 rounded-[28px] bg-red-900/30 text-red-400 text-sm font-medium transition-opacity active:opacity-80"
            >
              Отменить
            </button>
          </div>
        )}

        {/* Safe area */}
        <div className="h-[env(safe-area-inset-bottom)]" />
      </div>
    </div>
  );
}
