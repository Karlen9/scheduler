"use client";

import { Booking } from "@/lib/types";
import { ClientAvatar } from "@/components/ClientAvatar";
import { BottomSheet } from "@/components/BottomSheet";
import { StatusBadge } from "@/components/StatusBadge";

interface BookingDetailModalProps {
  booking: Booking | null;
  isOpen: boolean;
  onClose: () => void;
  onReschedule?: (booking: Booking) => void;
  onCancel?: (booking: Booking) => void;
  onAccept?: (booking: Booking) => void;
  onReject?: (booking: Booking) => void;
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
  onAccept,
  onReject,
}: BookingDetailModalProps) {
  if (!booking) return null;

  const startsAt = new Date(booking.startsAt);
  const endsAt = new Date(booking.endsAt);

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} showClose>
      {/* Client info */}
      <div className="flex items-center gap-4 mb-4">
        <ClientAvatar name={booking.clientName} photoUrl={booking.clientPhotoUrl} size="lg" />
        <div>
          <h3 className="text-xl font-medium text-foreground">
            {booking.clientName}
          </h3>
          <StatusBadge status={booking.status} className="inline-block px-2 py-0.5" />
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

      {/* Accept / Reject for pending client-created bookings */}
      {booking.status === "pending" && booking.createdBy !== "trainer" && (onAccept || onReject) && (
        <div className="flex gap-3 mb-3">
          <button
            onClick={() => onAccept?.(booking)}
            className="flex-1 py-3 px-4 rounded-[28px] bg-action-confirm-bg text-action-confirm-text text-sm font-medium transition-opacity active:opacity-80"
          >
            Подтвердить
          </button>
          <button
            onClick={() => onReject?.(booking)}
            className="flex-1 py-3 px-4 rounded-[28px] bg-action-danger-bg text-action-danger-text text-sm font-medium transition-opacity active:opacity-80"
          >
            Отклонить
          </button>
        </div>
      )}

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
            className="flex-1 py-3 px-4 rounded-[28px] bg-action-danger-bg text-action-danger-text text-sm font-medium transition-opacity active:opacity-80"
          >
            Отменить
          </button>
        </div>
      )}
    </BottomSheet>
  );
}
