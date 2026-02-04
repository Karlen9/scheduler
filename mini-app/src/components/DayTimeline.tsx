"use client";

import { Booking } from "@/lib/types";

interface DayTimelineProps {
  date: Date;
  bookings: Booking[];
  startHour?: number;
  endHour?: number;
  onBookingClick?: (booking: Booking) => void;
}

function formatTime(hour: number): string {
  return `${hour.toString().padStart(2, "0")}:00`;
}

function getBookingPosition(booking: Booking, startHour: number): { top: number; height: number } {
  const startsAt = new Date(booking.startsAt);
  const endsAt = new Date(booking.endsAt);

  const startMinutes = startsAt.getHours() * 60 + startsAt.getMinutes();
  const endMinutes = endsAt.getHours() * 60 + endsAt.getMinutes();
  const baseMinutes = startHour * 60;

  const top = ((startMinutes - baseMinutes) / 60) * 64; // 64px per hour
  const height = ((endMinutes - startMinutes) / 60) * 64;

  return { top, height: Math.max(height, 40) };
}

function formatBookingTime(booking: Booking): string {
  const startsAt = new Date(booking.startsAt);
  const endsAt = new Date(booking.endsAt);
  const format = (d: Date) => d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  return `${format(startsAt)} – ${format(endsAt)}`;
}

const BOOKING_COLORS = ["#f5a623", "#5984d8", "#4caf50", "#9c27b0"];

export function DayTimeline({
  date,
  bookings,
  startHour = 9,
  endHour = 21,
  onBookingClick,
}: DayTimelineProps) {
  const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i);

  // Filter bookings for this day
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  const dayBookings = bookings.filter((b) => {
    const bookingDate = new Date(b.startsAt);
    return bookingDate >= dayStart && bookingDate <= dayEnd;
  });

  const formatDateHeader = (d: Date) => {
    const days = ["Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"];
    const months = [
      "Января", "Февраля", "Марта", "Апреля", "Мая", "Июня",
      "Июля", "Августа", "Сентября", "Октября", "Ноября", "Декабря"
    ];
    return `${d.getDate()} ${months[d.getMonth()]}, ${days[d.getDay()]}`;
  };

  return (
    <div>
      <h3 className="text-base font-medium text-[var(--app-text)] mb-4">
        {formatDateHeader(date)}
      </h3>

      <div className="relative">
        {/* Hour lines */}
        {hours.map((hour) => (
          <div key={hour} className="flex items-start h-16 border-t border-[var(--app-divider)]">
            <span className="text-xs text-[var(--app-subtext)] w-12 -mt-2 pr-2">
              {formatTime(hour)}
            </span>
            <div className="flex-1 relative" />
          </div>
        ))}

        {/* Bookings */}
        <div className="absolute left-12 right-0 top-0">
          {dayBookings.map((booking, index) => {
            const { top, height } = getBookingPosition(booking, startHour);
            const color = BOOKING_COLORS[index % BOOKING_COLORS.length];

            return (
              <button
                key={booking.id}
                onClick={() => onBookingClick?.(booking)}
                style={{
                  top: `${top}px`,
                  height: `${height}px`,
                  backgroundColor: `${color}20`,
                  borderLeft: `3px solid ${color}`,
                }}
                className="absolute left-1 right-1 rounded-lg p-2 text-left transition-opacity active:opacity-80 overflow-hidden"
              >
                <p className="text-sm font-medium text-[var(--app-text)] truncate">
                  {booking.clientName}
                </p>
                <p className="text-xs text-[var(--app-subtext)] truncate">
                  {booking.sessionType?.name || "Тренировка"}
                </p>
                <p className="text-xs text-[var(--app-subtext)]">
                  {formatBookingTime(booking)}
                </p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
