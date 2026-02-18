"use client";

import { Calendar, Clock, Dumbbell } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { Booking } from "@/lib/types";
import { StatusBadge } from "@/components/StatusBadge";

interface BookingCardProps {
  booking: Booking;
  onCancel?: (booking: Booking) => void;
  onConfirm?: (booking: Booking) => void;
  onDecline?: (booking: Booking) => void;
}

const monthGenKeys = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

export function BookingCard({ booking, onCancel, onConfirm, onDecline }: BookingCardProps) {
  const tc = useTranslations("Common");
  const tb = useTranslations("BookingsPage");
  const td = useTranslations("Dates");
  const locale = useLocale();

  const startsAt = new Date(booking.startsAt);
  const endsAt = new Date(booking.endsAt);
  const isActive = booking.status === "pending" || booking.status === "confirmed";
  const isTrainerPending = booking.status === "pending" && booking.createdBy === "trainer";

  function formatDate(date: Date): string {
    return `${date.getUTCDate()} ${td(`monthsGen.${monthGenKeys[date.getUTCMonth()]}`)} ${date.getUTCFullYear()}`;
  }

  function formatTime(date: Date): string {
    return date.toLocaleTimeString(locale === "en" ? "en-US" : "ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
  }

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
              {tc("workout")}
              {(booking.durationMinutes || booking.sessionType?.durationMinutes) && (
                <span className="text-muted-foreground"> · {booking.durationMinutes || booking.sessionType?.durationMinutes} {tc("min")}</span>
              )}
            </span>
          </div>
        </div>
        <StatusBadge status={booking.status} />
      </div>

      {isTrainerPending && onConfirm && onDecline ? (
        <div className="pt-3 border-t border-border space-y-2">
          <p className="text-xs text-muted-foreground mb-2">{tb("trainerBookedYou")}</p>
          <button
            onClick={() => onConfirm(booking)}
            className="w-full py-2 px-4 rounded-lg bg-action-confirm-bg text-action-confirm-text text-sm font-medium transition-opacity active:opacity-70"
          >
            {tc("confirm")}
          </button>
          <button
            onClick={() => onDecline(booking)}
            className="w-full py-2 px-4 rounded-lg bg-background text-destructive text-sm font-medium transition-opacity active:opacity-70"
          >
            {tb("declineButton")}
          </button>
        </div>
      ) : isActive && (
        <div className="pt-3 border-t border-border">
          <button
            onClick={() => onCancel?.(booking)}
            className="w-full py-2 px-4 rounded-lg bg-background text-destructive text-sm font-medium transition-opacity active:opacity-70"
          >
            {tc("cancelVerb")}
          </button>
        </div>
      )}
    </div>
  );
}
