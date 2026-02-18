"use client";

import { useTranslations, useLocale } from "next-intl";
import { Booking } from "@/lib/types";
import { ClientAvatar } from "@/components/ClientAvatar";

interface UpcomingBookingCardProps {
  booking: Booking;
  onClick?: (booking: Booking) => void;
}

const monthShortKeys = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const dayShortKeysJS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export function UpcomingBookingCard({ booking, onClick }: UpcomingBookingCardProps) {
  const tc = useTranslations("Common");
  const td = useTranslations("Dates");
  const locale = useLocale();

  const startsAt = new Date(booking.startsAt);
  const endsAt = new Date(booking.endsAt);

  function formatDate(date: Date): string {
    const dayKey = dayShortKeysJS[date.getUTCDay()];
    const monthKey = monthShortKeys[date.getUTCMonth()];
    return `${td(`daysShort.${dayKey}`)}, ${date.getUTCDate()} ${td(`monthsShort.${monthKey}`)}`;
  }

  function formatTime(date: Date): string {
    return date.toLocaleTimeString(locale === "en" ? "en-US" : "ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
  }

  return (
    <button
      onClick={() => onClick?.(booking)}
      className="w-full bg-card rounded-xl p-4 border-l-4 border-l-status-confirmed-border text-left transition-opacity active:opacity-80"
    >
      <div className="flex items-center gap-3">
        <ClientAvatar name={booking.clientName} photoUrl={booking.clientPhotoUrl} />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-foreground truncate">
            {booking.clientName}
          </p>
          <p className="text-sm text-muted-foreground">
            {tc("workout")}{booking.durationMinutes ? ` · ${booking.durationMinutes} ${tc("min")}` : booking.sessionType?.durationMinutes ? ` · ${booking.sessionType.durationMinutes} ${tc("min")}` : ""}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-medium text-foreground">
            {formatTime(startsAt)} – {formatTime(endsAt)}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatDate(startsAt)}
          </p>
        </div>
      </div>
    </button>
  );
}
