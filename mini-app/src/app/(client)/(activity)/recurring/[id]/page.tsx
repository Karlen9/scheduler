"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { Calendar, Clock, Dumbbell, Repeat, X, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { TopBar } from "@/components/TopBar";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { formatDuration } from "@/components/DurationSelector";
import { api } from "@/lib/api";
import { RecurringSchedule, Booking } from "@/lib/types";

// --- Status config ---

const bookingStatusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: "Ожидает", color: "bg-yellow-900/30 text-yellow-400" },
  confirmed: { label: "Подтверждено", color: "bg-green-900/30 text-green-400" },
  rejected: { label: "Отклонено", color: "bg-red-900/30 text-red-400" },
  cancelled: { label: "Отменено", color: "bg-gray-700/30 text-gray-400" },
  completed: { label: "Завершено", color: "bg-blue-900/30 text-blue-400" },
  cancel_requested: { label: "Отмена запрошена", color: "bg-orange-900/30 text-orange-400" },
  reschedule_pending: { label: "Перенос", color: "bg-purple-900/30 text-purple-400" },
};

const scheduleStatusConfig: Record<string, { label: string; color: string; border: string }> = {
  pending: { label: "Ожидает", color: "bg-yellow-900/30 text-yellow-400", border: "border-yellow-500" },
  active: { label: "Активно", color: "bg-green-900/30 text-green-400", border: "border-green-500" },
  declined: { label: "Отклонено", color: "bg-red-900/30 text-red-400", border: "border-red-500" },
  cancelled: { label: "Отменено", color: "bg-gray-700/30 text-gray-400", border: "border-gray-500" },
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

  const [schedule, setSchedule] = useState<RecurringSchedule | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const data = await api.getRecurringScheduleDetail(id);
      setSchedule(data);
    } catch {
      toast.error("Не удалось загрузить расписание");
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRequestCancel = async () => {
    if (!cancelTarget || !schedule) return;
    setIsCancelling(true);
    try {
      await api.requestCancelBooking(schedule.id, cancelTarget.id);
      toast.success("Запрос на отмену отправлен");
      setCancelTarget(null);
      fetchData();
    } catch {
      toast.error("Не удалось отправить запрос на отмену");
    } finally {
      setIsCancelling(false);
    }
  };

  // --- Loading skeleton ---
  if (isLoading) {
    return (
      <div>
        <TopBar title="Расписание" showBack />
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
      </div>
    );
  }

  if (!schedule) {
    return (
      <div>
        <TopBar title="Расписание" showBack />
        <div className="p-4">
          <p className="text-sm text-muted-foreground text-center mt-8">
            Расписание не найдено
          </p>
        </div>
      </div>
    );
  }

  const scheduleStatus = scheduleStatusConfig[schedule.status] || scheduleStatusConfig.pending;
  const daysLabel = formatDaysOfWeek(schedule);
  const dateRange = formatDateRange(schedule.startDate, schedule.endDate);
  const serviceName = getServiceName(schedule);

  const sortedBookings = [...(schedule.bookings || [])].sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
  );

  return (
    <div>
      <TopBar title="Расписание" showBack />

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
                const isCancelRequested = booking.status === "cancel_requested";
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
                          Запросить отмену
                        </button>
                      </div>
                    )}

                    {isCancelRequested && (
                      <div className="pt-3 border-t border-border">
                        <div className="flex items-center gap-2 justify-center">
                          <ArrowRight className="w-4 h-4 text-orange-400" />
                          <span className="text-sm text-orange-400">
                            Ожидает подтверждения отмены
                          </span>
                        </div>
                      </div>
                    )}

                    {isReschedulePending && (
                      <div className="pt-3 border-t border-border">
                        <div className="flex items-center gap-2 justify-center">
                          <ArrowRight className="w-4 h-4 text-purple-400" />
                          <span className="text-sm text-purple-400">
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
        onConfirm={handleRequestCancel}
        title="Запросить отмену?"
        description="Тренер получит запрос на отмену этой тренировки. До подтверждения тренером тренировка остается в силе."
        confirmText={isCancelling ? "Отправка..." : "Запросить отмену"}
        destructive
      />
    </div>
  );
}
