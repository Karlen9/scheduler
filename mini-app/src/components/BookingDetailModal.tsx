"use client";

import { X, Phone, MessageCircle } from "lucide-react";
import { Booking } from "@/lib/types";

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
  return `${date.getDate()} ${months[date.getMonth()]}, ${days[date.getDay()]}`;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
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
    pending: { label: "Ожидает", color: "bg-yellow-100 text-yellow-800" },
    confirmed: { label: "Подтверждено", color: "bg-green-100 text-green-800" },
    rejected: { label: "Отклонено", color: "bg-red-100 text-red-800" },
    cancelled: { label: "Отменено", color: "bg-gray-100 text-gray-800" },
    completed: { label: "Завершено", color: "bg-blue-100 text-blue-800" },
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
        className="relative w-full bg-white rounded-t-2xl p-4 animate-slide-up"
        style={{ maxWidth: "430px" }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-full hover:bg-[var(--app-surface)]"
        >
          <X className="w-5 h-5 text-[var(--app-subtext)]" />
        </button>

        {/* Client info */}
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 rounded-full bg-[var(--app-surface)] flex items-center justify-center text-2xl text-[var(--app-subtext)]">
            {booking.clientName.charAt(0)}
          </div>
          <div>
            <h3 className="text-xl font-medium text-[var(--app-text)]">
              {booking.clientName}
            </h3>
            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
              {status.label}
            </span>
          </div>
        </div>

        {/* Booking details */}
        <div className="space-y-3 mb-6">
          <div className="flex justify-between py-2 border-b border-[var(--app-divider)]">
            <span className="text-[var(--app-subtext)]">Услуга</span>
            <span className="text-[var(--app-text)] font-medium">
              {booking.sessionType?.name || "Тренировка"}
            </span>
          </div>
          <div className="flex justify-between py-2 border-b border-[var(--app-divider)]">
            <span className="text-[var(--app-subtext)]">Дата</span>
            <span className="text-[var(--app-text)] font-medium">
              {formatDate(startsAt)}
            </span>
          </div>
          <div className="flex justify-between py-2 border-b border-[var(--app-divider)]">
            <span className="text-[var(--app-subtext)]">Время</span>
            <span className="text-[var(--app-text)] font-medium">
              {formatTime(startsAt)} – {formatTime(endsAt)}
            </span>
          </div>
          {booking.sessionType?.durationMinutes && (
            <div className="flex justify-between py-2 border-b border-[var(--app-divider)]">
              <span className="text-[var(--app-subtext)]">Длительность</span>
              <span className="text-[var(--app-text)] font-medium">
                {booking.sessionType.durationMinutes} мин
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        {(booking.status === "pending" || booking.status === "confirmed") && (
          <div className="flex gap-3">
            <button
              onClick={() => onReschedule?.(booking)}
              className="flex-1 py-3 px-4 rounded-[28px] bg-[var(--app-surface)] text-[var(--app-text)] text-sm font-medium transition-opacity active:opacity-80"
            >
              Изменить
            </button>
            <button
              onClick={() => onCancel?.(booking)}
              className="flex-1 py-3 px-4 rounded-[28px] bg-red-50 text-red-600 text-sm font-medium transition-opacity active:opacity-80"
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
