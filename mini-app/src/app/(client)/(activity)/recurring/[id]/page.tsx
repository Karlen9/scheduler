"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Calendar, Clock, Dumbbell, Repeat, X, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { formatDuration } from "@/components/DurationSelector";
import { api } from "@/lib/api";
import { RecurringSchedule, Booking } from "@/lib/types";
import { useRecurringDetail } from "@/hooks/queries";
import { invalidateRecurring } from "@/hooks/mutations";

// --- Status config ---

const bookingStatusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: "Ожидает", color: "bg-status-pending-bg text-status-pending-text" },
  confirmed: { label: "Подтверждено", color: "bg-status-confirmed-bg text-status-confirmed-text" },
  rejected: { label: "Отклонено", color: "bg-status-rejected-bg text-status-rejected-text" },
  cancelled: { label: "Отменено", color: "bg-status-cancelled-bg text-status-cancelled-text" },
  completed: { label: "Завершено", color: "bg-status-completed-bg text-status-completed-text" },
  cancel_requested: { label: "Отмена запрошена", color: "bg-status-warning-bg text-status-warning-text" },
  reschedule_pending: { label: "Перенос", color: "bg-status-purple-bg text-status-purple-text" },
};

const scheduleStatusConfig: Record<string, { label: string; color: string; border: string }> = {
  pending: { label: "Ожидает", color: "bg-status-pending-bg text-status-pending-text", border: "border-status-pending-border" },
  active: { label: "Активно", color: "bg-status-confirmed-bg text-status-confirmed-text", border: "border-status-confirmed-border" },
  declined: { label: "Отклонено", color: "bg-status-rejected-bg text-status-rejected-text", border: "border-status-rejected-border" },
  cancelled: { label: "Отменено", color: "bg-status-cancelled-bg text-status-cancelled-text", border: "border-status-cancelled-border" },
};

// --- Day / month names ---

const DAY_NAMES: Record<number, string> = {
  0: "Вс",
  1: "Пн",
  2: "Вт",
  3: "Ср",
  4: "Чт",
  5: "Пт",
  6: "Сб",
};

const MONTHS = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

const SHORT_MONTHS = [
  "янв", "фев", "мар", "апр", "мая", "июн",
  "июл", "авг", "сен", "окт", "ноя", "дек",
];

// --- Helpers ---

function formatDaysOfWeek(schedule: RecurringSchedule): string {
  if (schedule.daysOfWeek) {
    return schedule.daysOfWeek
      .split(",")
      .map((d) => DAY_NAMES[parseInt(d)] || "?")
      .join(", ");
  }
  return DAY_NAMES[schedule.dayOfWeek] || "?";
}

function parseDayTimes(dayTimesJSON?: string): Record<string, string> | null {
  if (!dayTimesJSON) return null;
  try {
    return JSON.parse(dayTimesJSON);
  } catch {
    return null;
  }
}

function formatDayTimesDisplay(dayTimes: Record<string, string>): string {
  const entries = Object.entries(dayTimes)
    .map(([d, t]) => ({ day: parseInt(d), time: t }))
    .sort((a, b) => a.day - b.day);
  return entries.map((e) => `${DAY_NAMES[e.day] || "?"} ${e.time}`).join(", ");
}

function formatDateRange(startDate?: string, endDate?: string): string | null {
  if (!startDate || !endDate) return null;
  const start = new Date(startDate);
  const end = new Date(endDate);
  return `${start.getDate()} ${SHORT_MONTHS[start.getMonth()]} — ${end.getDate()} ${SHORT_MONTHS[end.getMonth()]}`;
}

function formatBookingDate(isoString: string): string {
  const date = new Date(isoString);
  const dayName = DAY_NAMES[date.getUTCDay()] || "?";
  return `${dayName}, ${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
}

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function getServiceName(schedule: RecurringSchedule): string {
  if (schedule.sessionType?.name) {
    return schedule.sessionType.name;
  }
  return formatDuration(schedule.durationMinutes);
}

// --- Component ---

export default function RecurringScheduleDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const { data: schedule, isLoading, mutate } = useRecurringDetail(id);
  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  const handleCancelBooking = async () => {
    if (!cancelTarget || !schedule) return;
    setIsCancelling(true);
    try {
      await api.requestCancelBooking(schedule.id, cancelTarget.id);
      toast.success("Тренировка отменена");
      setCancelTarget(null);
      mutate();
      invalidateRecurring();
    } catch {
      toast.error("Не удалось отменить тренировку");
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
          Расписание не найдено
        </p>
      </div>
    );
  }

  const scheduleStatus = scheduleStatusConfig[schedule.status] || scheduleStatusConfig.pending;
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
              {scheduleStatus.label}
            </span>
          </div>

          <div className="space-y-2">
            {dayTimes ? (
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-sm text-foreground">
                  {daysLabel}
                  <span className="text-muted-foreground"> · {formatDuration(schedule.durationMinutes)}</span>
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
                    <span className="text-muted-foreground"> · {formatDuration(schedule.durationMinutes)}</span>
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
              Тренировки ({sortedBookings.length})
            </h3>
            <div className="space-y-3">
              {sortedBookings.map((booking) => {
                const status = bookingStatusConfig[booking.status] || bookingStatusConfig.pending;
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
                              Тренировка
                              <span className="text-muted-foreground">
                                {" "}· {booking.durationMinutes || booking.sessionType?.durationMinutes} мин
                              </span>
                            </span>
                          </div>
                        )}
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium shrink-0 ${status.color}`}>
                        {status.label}
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
                          Отменить
                        </button>
                      </div>
                    )}

                    {isReschedulePending && (
                      <div className="pt-3 border-t border-border">
                        <div className="flex items-center gap-2 justify-center">
                          <ArrowRight className="w-4 h-4 text-status-purple-text" />
                          <span className="text-sm text-status-purple-text">
                            Ожидает подтверждения переноса
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
              Тренировки пока не запланированы
            </p>
          </div>
        )}
      </div>

      {/* Cancel confirmation dialog */}
      <ConfirmDialog
        isOpen={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        onConfirm={handleCancelBooking}
        title="Отменить тренировку?"
        description="Тренировка будет отменена. Тренер получит уведомление."
        confirmText={isCancelling ? "Отмена..." : "Отменить"}
        destructive
      />
    </>
  );
}
