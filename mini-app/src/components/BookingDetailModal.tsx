"use client";

import { useTranslations, useLocale } from "next-intl";
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

const monthGenKeys = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const dayFullLowerKeysJS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export function BookingDetailModal({
  booking,
  isOpen,
  onClose,
  onReschedule,
  onCancel,
  onAccept,
  onReject,
}: BookingDetailModalProps) {
  const t = useTranslations("BookingDetailModal");
  const tc = useTranslations("Common");
  const td = useTranslations("Dates");
  const locale = useLocale();

  if (!booking) return null;

  const startsAt = new Date(booking.startsAt);
  const endsAt = new Date(booking.endsAt);

  function formatDate(date: Date): string {
    const monthKey = monthGenKeys[date.getUTCMonth()];
    const dayKey = dayFullLowerKeysJS[date.getUTCDay()];
    return `${date.getUTCDate()} ${td(`monthsGen.${monthKey}`)}, ${td(`daysFullLower.${dayKey}`)}`;
  }

  function formatTime(date: Date): string {
    return date.toLocaleTimeString(locale === "en" ? "en-US" : "ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
  }

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
          <span className="text-muted-foreground">{t("serviceLabel")}</span>
          <span className="text-foreground font-medium">
            {tc("workout")}
          </span>
        </div>
        <div className="flex justify-between py-2 border-b border-border">
          <span className="text-muted-foreground">{t("dateLabel")}</span>
          <span className="text-foreground font-medium">
            {formatDate(startsAt)}
          </span>
        </div>
        <div className="flex justify-between py-2 border-b border-border">
          <span className="text-muted-foreground">{t("timeLabel")}</span>
          <span className="text-foreground font-medium">
            {formatTime(startsAt)} – {formatTime(endsAt)}
          </span>
        </div>
        {(booking.durationMinutes || booking.sessionType?.durationMinutes) && (
          <div className="flex justify-between py-2 border-b border-border">
            <span className="text-muted-foreground">{t("durationLabel")}</span>
            <span className="text-foreground font-medium">
              {booking.durationMinutes || booking.sessionType?.durationMinutes} {tc("min")}
            </span>
          </div>
        )}
        {booking.clientMessage && (
          <div className="py-2 border-b border-border">
            <span className="text-muted-foreground text-sm">{t("clientComment")}</span>
            <p className="text-foreground text-sm mt-1">{booking.clientMessage}</p>
          </div>
        )}
        {booking.cancelReason && (
          <div className="py-2 border-b border-border">
            <span className="text-muted-foreground text-sm">{t("cancelReason")}</span>
            <p className="text-foreground text-sm mt-1">{t.has(`cancelReasons.${booking.cancelReason}`) ? t(`cancelReasons.${booking.cancelReason}`) : booking.cancelReason}</p>
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
            {tc("confirm")}
          </button>
          <button
            onClick={() => onReject?.(booking)}
            className="flex-1 py-3 px-4 rounded-[28px] bg-action-danger-bg text-action-danger-text text-sm font-medium transition-opacity active:opacity-80"
          >
            {tc("cancelVerb")}
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
            {t("rescheduleButton")}
          </button>
          <button
            onClick={() => onCancel?.(booking)}
            className="flex-1 py-3 px-4 rounded-[28px] bg-action-danger-bg text-action-danger-text text-sm font-medium transition-opacity active:opacity-80"
          >
            {t("cancelButton")}
          </button>
        </div>
      )}
    </BottomSheet>
  );
}
