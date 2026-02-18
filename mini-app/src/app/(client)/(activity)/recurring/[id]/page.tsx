"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Calendar, Clock, Dumbbell, Repeat, X, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { formatDuration } from "@/components/DurationSelector";
import { api } from "@/lib/api";
import { RecurringSchedule, Booking } from "@/lib/types";
import { useRecurringDetail } from "@/hooks/queries";
import { invalidateRecurring } from "@/hooks/mutations";

// --- Status config (colors only, labels come from translations) ---

const bookingStatusColors: Record<string, string> = {
  pending: "bg-status-pending-bg text-status-pending-text",
  confirmed: "bg-status-confirmed-bg text-status-confirmed-text",
  rejected: "bg-status-rejected-bg text-status-rejected-text",
  cancelled: "bg-status-cancelled-bg text-status-cancelled-text",
  completed: "bg-status-completed-bg text-status-completed-text",
  cancel_requested: "bg-status-warning-bg text-status-warning-text",
  reschedule_pending: "bg-status-purple-bg text-status-purple-text",
};

const bookingStatusKeys: Record<string, string> = {
  pending: "pending",
  confirmed: "confirmed",
  rejected: "rejected",
  cancelled: "cancelled",
  completed: "completed",
  cancel_requested: "cancelRequested",
  reschedule_pending: "reschedulePending",
};

const scheduleStatusColors: Record<string, { color: string; border: string }> = {
  pending: { color: "bg-status-pending-bg text-status-pending-text", border: "border-status-pending-border" },
  active: { color: "bg-status-confirmed-bg text-status-confirmed-text", border: "border-status-confirmed-border" },
  declined: { color: "bg-status-rejected-bg text-status-rejected-text", border: "border-status-rejected-border" },
  cancelled: { color: "bg-status-cancelled-bg text-status-cancelled-text", border: "border-status-cancelled-border" },
};

const scheduleStatusKeys: Record<string, string> = {
  pending: "pending",
  active: "active",
  declined: "declined",
  cancelled: "cancelled",
};

// --- Day / month key mappings ---

const dayKeys = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
const monthGenKeys = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"] as const;
const monthShortKeys = monthGenKeys;

// --- Helpers ---

function parseDayTimes(dayTimesJSON?: string): Record<string, string> | null {
  if (!dayTimesJSON) return null;
  try {
    return JSON.parse(dayTimesJSON);
  } catch {
    return null;
  }
}

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

// --- Component ---

export default function RecurringScheduleDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const t = useTranslations("RecurringDetail");
  const tst = useTranslations("Status");
  const tc = useTranslations("Common");
  const td = useTranslations("Duration");
  const tdat = useTranslations("Dates");
  const te = useTranslations("Errors");
  const ts = useTranslations("Success");

  const { data: schedule, isLoading, mutate } = useRecurringDetail(id);
  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  const getDayName = (day: number) => tdat(`daysShort.${dayKeys[day]}`);
  const getMonthGen = (month: number) => tdat(`monthsGen.${monthGenKeys[month]}`);
  const getMonthShort = (month: number) => tdat(`monthsShort.${monthShortKeys[month]}`);

  const formatDaysOfWeek = (sched: RecurringSchedule): string => {
    if (sched.daysOfWeek) {
      return sched.daysOfWeek
        .split(",")
        .map((d) => getDayName(parseInt(d)))
        .join(", ");
    }
    return getDayName(sched.dayOfWeek);
  };

  const formatDayTimesDisplay = (dayTimesMap: Record<string, string>): string => {
    const entries = Object.entries(dayTimesMap)
      .map(([d, time]) => ({ day: parseInt(d), time }))
      .sort((a, b) => a.day - b.day);
    return entries.map((e) => `${getDayName(e.day)} ${e.time}`).join(", ");
  };

  const formatDateRange = (startDate?: string, endDate?: string): string | null => {
    if (!startDate || !endDate) return null;
    const start = new Date(startDate);
    const end = new Date(endDate);
    return `${start.getDate()} ${getMonthShort(start.getMonth())} — ${end.getDate()} ${getMonthShort(end.getMonth())}`;
  };

  const formatBookingDate = (isoString: string): string => {
    const date = new Date(isoString);
    const dayName = getDayName(date.getUTCDay());
    return `${dayName}, ${date.getUTCDate()} ${getMonthGen(date.getUTCMonth())}`;
  };

  const getServiceName = (sched: RecurringSchedule): string => {
    if (sched.sessionType?.name) {
      return sched.sessionType.name;
    }
    return formatDuration(sched.durationMinutes, td("hour"));
  };

  const handleCancelBooking = async () => {
    if (!cancelTarget || !schedule) return;
    setIsCancelling(true);
    try {
      await api.requestCancelBooking(schedule.id, cancelTarget.id);
      toast.success(ts("sessionCancelled"));
      setCancelTarget(null);
      mutate();
      invalidateRecurring();
    } catch {
      toast.error(te("sessionCancelFailed"));
    } finally {
      setIsCancelling(false);
    }
  };

  // --- Loading skeleton ---
  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        <div className="bg-card rounded-xl p-4 animate-pulse">
          <div className="h-5 bg-border rounded w-2/5 mb-4" />
          <div className="h-4 bg-border rounded w-1/2 mb-3" />
          <div className="h-4 bg-border rounded w-1/3 mb-3" />
          <div className="h-4 bg-border rounded w-2/5" />
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-card rounded-xl p-4 animate-pulse">
            <div className="h-4 bg-border rounded w-1/3 mb-3" />
            <div className="h-4 bg-border rounded w-1/2 mb-2" />
            <div className="h-4 bg-border rounded w-2/5" />
          </div>
        ))}
      </div>
    );
  }

  if (!schedule) {
    return (
      <div className="p-4">
        <p className="text-sm text-muted-foreground text-center mt-8">
          {t("scheduleNotFound")}
        </p>
      </div>
    );
  }

  const scheduleStatus = scheduleStatusColors[schedule.status] || scheduleStatusColors.pending;
  const scheduleStatusKey = scheduleStatusKeys[schedule.status] || "pending";
  const dayTimes = parseDayTimes(schedule.dayTimes);
  const daysLabel = dayTimes ? formatDayTimesDisplay(dayTimes) : formatDaysOfWeek(schedule);
  const dateRange = formatDateRange(schedule.startDate, schedule.endDate);
  const serviceName = getServiceName(schedule);

  const sortedBookings = [...(schedule.bookings || [])].sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
  );

  return (
    <>
      <div className="p-4 space-y-4">
        {/* Schedule info card */}
        <div className={`bg-card rounded-xl p-4 border-l-4 ${scheduleStatus.border}`}>
          <div className="flex items-start justify-between mb-3">
            <h3 className="text-base font-medium text-foreground">
              {serviceName}
            </h3>
            <span className={`px-3 py-1 rounded-full text-xs font-medium shrink-0 ${scheduleStatus.color}`}>
              {tst(scheduleStatusKey)}
            </span>
          </div>

          <div className="space-y-2">
            {dayTimes ? (
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-sm text-foreground">
                  {daysLabel}
                  <span className="text-muted-foreground"> · {formatDuration(schedule.durationMinutes, td("hour"))}</span>
                </span>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <Repeat className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-sm text-foreground">{daysLabel}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-sm text-foreground">
                    {schedule.time}
                    <span className="text-muted-foreground"> · {formatDuration(schedule.durationMinutes, td("hour"))}</span>
                  </span>
                </div>
              </>
            )}
            {dateRange && (
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-sm text-muted-foreground">{dateRange}</span>
              </div>
            )}
          </div>
        </div>

        {/* Bookings section */}
        {sortedBookings.length > 0 ? (
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-3">
              {t("sessionsCount", { count: sortedBookings.length })}
            </h3>
            <div className="space-y-3">
              {sortedBookings.map((booking) => {
                const statusColor = bookingStatusColors[booking.status] || bookingStatusColors.pending;
                const statusKey = bookingStatusKeys[booking.status] || "pending";
                const isConfirmed = booking.status === "confirmed";
                const isReschedulePending = booking.status === "reschedule_pending";

                return (
                  <div key={booking.id} className="bg-card rounded-xl p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
                          <span className="text-sm text-foreground">
                            {formatBookingDate(booking.startsAt)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                          <span className="text-sm text-foreground">
                            {formatTime(booking.startsAt)}
                            <span className="text-muted-foreground"> — </span>
                            {formatTime(booking.endsAt)}
                          </span>
                        </div>
                        {(booking.durationMinutes || booking.sessionType?.durationMinutes) && (
                          <div className="flex items-center gap-2">
                            <Dumbbell className="w-4 h-4 text-muted-foreground shrink-0" />
                            <span className="text-sm text-foreground">
                              {tc("workout")}
                              <span className="text-muted-foreground">
                                {" "} · {booking.durationMinutes || booking.sessionType?.durationMinutes} {tc("min")}
                              </span>
                            </span>
                          </div>
                        )}
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium shrink-0 ${statusColor}`}>
                        {tst(statusKey)}
                      </span>
                    </div>

                    {/* Action area */}
                    {isConfirmed && (
                      <div className="pt-3 border-t border-border">
                        <button
                          onClick={() => setCancelTarget(booking)}
                          className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-background text-destructive text-sm font-medium transition-opacity active:opacity-70"
                        >
                          <X className="w-4 h-4" />
                          {tc("cancelVerb")}
                        </button>
                      </div>
                    )}

                    {isReschedulePending && (
                      <div className="pt-3 border-t border-border">
                        <div className="flex items-center gap-2 justify-center">
                          <ArrowRight className="w-4 h-4 text-status-purple-text" />
                          <span className="text-sm text-status-purple-text">
                            {t("awaitingRescheduleConfirmation")}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">
              {t("noSessionsPlanned")}
            </p>
          </div>
        )}
      </div>

      {/* Cancel confirmation dialog */}
      <ConfirmDialog
        isOpen={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        onConfirm={handleCancelBooking}
        title={t("cancelSessionDialog")}
        description={t("cancelSessionDescription")}
        confirmText={isCancelling ? tc("cancelling") : tc("cancelVerb")}
        destructive
      />
    </>
  );
}
