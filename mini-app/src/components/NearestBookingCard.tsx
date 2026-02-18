"use client";

import { useTranslations, useLocale } from "next-intl";
import { Booking } from "@/lib/types";
import { ClientAvatar } from "@/components/ClientAvatar";

interface NearestBookingCardProps {
  booking: Booking;
  onClick?: () => void;
}

export function NearestBookingCard({ booking, onClick }: NearestBookingCardProps) {
  const t = useTranslations("NextBookingBanner");
  const tc = useTranslations("Common");
  const tu = useTranslations("TimeUnits");
  const locale = useLocale();

  const startsAt = new Date(booking.startsAt);
  const endsAt = new Date(booking.endsAt);

  function getTimeUntil(date: Date): string {
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    if (diff < 0) return tu("now");

    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      const word = days % 10 === 1 && days % 100 !== 11 ? tu("day1") : [2, 3, 4].includes(days % 10) && ![12, 13, 14].includes(days % 100) ? tu("day234") : tu("day5");
      return tu("inDays", { count: days, word });
    }
    if (hours > 0) {
      const word = hours % 10 === 1 && hours % 100 !== 11 ? tu("hour1") : [2, 3, 4].includes(hours % 10) && ![12, 13, 14].includes(hours % 100) ? tu("hour234") : tu("hour5");
      return tu("inHours", { count: hours, word });
    }
    const word = minutes % 10 === 1 && minutes % 100 !== 11 ? tu("minute1") : [2, 3, 4].includes(minutes % 10) && ![12, 13, 14].includes(minutes % 100) ? tu("minute234") : tu("minute5");
    return tu("inMinutes", { count: minutes, word });
  }

  function formatTime(date: Date): string {
    return date.toLocaleTimeString(locale === "en" ? "en-US" : "ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
  }

  const timeUntil = getTimeUntil(startsAt);

  return (
    <div className="mb-6">
      <h3 className="text-base font-medium text-foreground mb-3">
        {t("title")}
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
              {tc("workout")}{booking.durationMinutes ? ` · ${booking.durationMinutes} ${tc("min")}` : booking.sessionType?.durationMinutes ? ` · ${booking.sessionType.durationMinutes} ${tc("min")}` : ""}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {timeUntil}
            </p>
            <p className="text-sm font-medium text-foreground mt-1">
              {formatTime(startsAt)} – {formatTime(endsAt)}
            </p>
          </div>
          <ClientAvatar name={booking.clientName} photoUrl={booking.clientPhotoUrl} />
        </div>
      </button>
    </div>
  );
}
