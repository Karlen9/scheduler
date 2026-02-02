"use client";

import { Booking } from "@/lib/types";
import { Card } from "./Card";
import { Button } from "./Button";

interface BookingCardProps {
  booking: Booking;
  onReschedule: (booking: Booking) => void;
  onCancel: (booking: Booking) => void;
  canModify: boolean;
}

const DAYS = ["воскресенье", "понедельник", "вторник", "среду", "четверг", "пятницу", "субботу"];
const MONTHS_GENITIVE = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря"
];

function formatDateTime(isoString: string): { date: string; time: string; dayName: string } {
  const d = new Date(isoString);
  const day = d.getDate();
  const month = MONTHS_GENITIVE[d.getMonth()];
  const hours = d.getHours().toString().padStart(2, "0");
  const minutes = d.getMinutes().toString().padStart(2, "0");

  return {
    date: `${day} ${month}`,
    time: `${hours}:${minutes}`,
    dayName: DAYS[d.getDay()],
  };
}

function formatPrice(price: number, currency: string): string {
  if (currency === "RUB") {
    return `${price.toLocaleString("ru-RU")} руб.`;
  }
  return `${price} ${currency}`;
}

function getStatusBadge(status: string): { text: string; className: string } | null {
  switch (status) {
    case "pending":
      return { text: "Ожидает подтверждения", className: "bg-yellow-100 text-yellow-800" };
    case "confirmed":
      return { text: "Подтверждено", className: "bg-green-100 text-green-800" };
    case "rejected":
      return { text: "Отклонено", className: "bg-red-100 text-red-800" };
    default:
      return null;
  }
}

export function BookingCard({ booking, onReschedule, onCancel, canModify }: BookingCardProps) {
  const { date, time, dayName } = formatDateTime(booking.startsAt);
  const statusBadge = getStatusBadge(booking.status);

  return (
    <Card>
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-semibold text-lg">{booking.sessionType.name}</h3>
            <p className="text-[var(--tg-theme-hint-color)] text-sm">
              {booking.sessionType.durationMinutes} мин. | {formatPrice(booking.sessionType.price, booking.sessionType.currency)}
            </p>
          </div>
          {statusBadge && (
            <span className={`text-xs px-2 py-1 rounded-full ${statusBadge.className}`}>
              {statusBadge.text}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 text-[var(--tg-theme-text-color)]">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18" />
          </svg>
          <span>{date}, {dayName}</span>
        </div>

        <div className="flex items-center gap-2 text-[var(--tg-theme-text-color)]">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
          </svg>
          <span>{time}</span>
        </div>

        {booking.status === "rejected" ? (
          <p className="text-sm text-red-600 mt-2">
            Тренер отклонил эту заявку. Попробуйте выбрать другое время.
          </p>
        ) : booking.status === "pending" ? (
          <div className="mt-2">
            <Button
              variant="danger"
              onClick={() => onCancel(booking)}
              className="w-full"
            >
              Отменить заявку
            </Button>
          </div>
        ) : canModify ? (
          <div className="flex gap-2 mt-2">
            <Button
              variant="secondary"
              onClick={() => onReschedule(booking)}
              className="flex-1"
            >
              Перенести
            </Button>
            <Button
              variant="danger"
              onClick={() => onCancel(booking)}
              className="flex-1"
            >
              Отменить
            </Button>
          </div>
        ) : (
          <p className="text-sm text-[var(--tg-theme-hint-color)] mt-2">
            Изменение невозможно (менее 24ч до начала)
          </p>
        )}
      </div>
    </Card>
  );
}
