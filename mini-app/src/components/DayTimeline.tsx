"use client";

import { useTranslations, useLocale } from "next-intl";
import { Booking } from "@/lib/types";
import { ClientAvatar } from "@/components/ClientAvatar";

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

// Convert time to grid row (1-based, 4 rows per hour)
function getGridRow(date: Date, startHour: number): number {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const hourOffset = hours - startHour;
  const quarterSlot = Math.floor(minutes / 15);
  return hourOffset * 4 + quarterSlot + 1; // 1-based for CSS grid
}

function getBookingGridPosition(
  booking: Booking,
  startHour: number
): { rowStart: number; rowSpan: number } {
  const startsAt = new Date(booking.startsAt);
  const endsAt = new Date(booking.endsAt);

  const rowStart = getGridRow(startsAt, startHour);
  const rowEnd = getGridRow(endsAt, startHour);
  const rowSpan = Math.max(rowEnd - rowStart, 1);

  return { rowStart, rowSpan };
}

// Background and border colors for bookings
const BOOKING_COLORS = [
  { bg: "var(--timeline-1-bg)", border: "var(--timeline-1-border)" },
  { bg: "var(--timeline-2-bg)", border: "var(--timeline-2-border)" },
  { bg: "var(--timeline-3-bg)", border: "var(--timeline-3-border)" },
  { bg: "var(--timeline-4-bg)", border: "var(--timeline-4-border)" },
];

const monthGenKeys = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const dayFullKeysJS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export function DayTimeline({
  date,
  bookings,
  startHour = 9,
  endHour = 21,
  onBookingClick,
}: DayTimelineProps) {
  const tc = useTranslations("Common");
  const td = useTranslations("Dates");

  const hours = Array.from(
    { length: endHour - startHour + 1 },
    (_, i) => startHour + i
  );
  const totalRows = hours.length * 4; // 4 rows per hour (15-min slots)

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
    const dayKey = dayFullKeysJS[d.getDay()];
    const monthKey = monthGenKeys[d.getMonth()];
    const monthGen = td(`monthsGen.${monthKey}`);
    return `${d.getDate()} ${monthGen.charAt(0).toUpperCase() + monthGen.slice(1)}, ${td(`daysFull.${dayKey}`)}`;
  };

  return (
    <div>
      <h3 className="text-base font-medium text-foreground mb-4">
        {formatDateHeader(date)}
      </h3>

      {/* Grid: 2 columns (time labels + bookings), N rows (4 per hour) */}
      <div
        className="grid"
        style={{
          gridTemplateColumns: "48px 1fr",
          gridTemplateRows: `repeat(${totalRows}, 16px)`,
        }}
      >
        {/* Time labels - one per hour, spanning 4 rows */}
        {hours.map((hour, hourIndex) => (
          <div
            key={hour}
            className="text-xs text-muted-foreground pr-2 border-t border-border"
            style={{
              gridColumn: 1,
              gridRow: `${hourIndex * 4 + 1} / span 4`,
            }}
          >
            {formatTime(hour)}
          </div>
        ))}

        {/* Hour dividers in the booking column */}
        {hours.map((hour, hourIndex) => (
          <div
            key={`divider-${hour}`}
            className="border-t border-border"
            style={{
              gridColumn: 2,
              gridRow: `${hourIndex * 4 + 1} / span 4`,
            }}
          />
        ))}

        {/* Bookings */}
        {dayBookings.map((booking, index) => {
          const { rowStart, rowSpan } = getBookingGridPosition(
            booking,
            startHour
          );
          const colors = BOOKING_COLORS[index % BOOKING_COLORS.length];

          return (
            <button
              key={booking.id}
              onClick={() => onBookingClick?.(booking)}
              className="mx-1 rounded-lg p-2 text-left transition-opacity active:opacity-80 overflow-hidden z-10"
              style={{
                gridColumn: 2,
                gridRow: `${rowStart} / span ${rowSpan}`,
                backgroundColor: colors.bg,
                borderLeft: `3px solid ${colors.border}`,
              }}
            >
              <div className="flex items-center gap-1.5">
                <ClientAvatar name={booking.clientName} photoUrl={booking.clientPhotoUrl} size="sm" />
                <p className="text-sm font-medium text-foreground truncate">
                  {booking.clientName}
                </p>
              </div>
              {rowSpan >= 2 && (
                <p className="text-xs text-muted-foreground truncate">
                  {booking.sessionType?.name || tc("workout")}
                </p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
