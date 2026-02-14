"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import {
  Calendar,
  Clock,
  Dumbbell,
  Repeat,
  X,
  Check,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { TopBar } from "@/components/TopBar";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { api } from "@/lib/api";
import { ClientAvatar } from "@/components/ClientAvatar";
import { RecurringSchedule, Booking } from "@/lib/types";
import { formatDuration } from "@/components/DurationSelector";
import { useAdminRecurringDetail } from "@/hooks/queries";
import { invalidateRecurring } from "@/hooks/mutations";

// --- Constants ---

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
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
];

const SHORT_MONTHS = [
  "янв",
  "фев",
  "мар",
  "апр",
  "мая",
  "июн",
  "июл",
  "авг",
  "сен",
  "окт",
  "ноя",
  "дек",
];

const scheduleStatusConfig: Record<
  string,
  { label: string; color: string; border: string }
> = {
  pending: {
    label: "Ожидает",
    color: "bg-yellow-900/30 text-yellow-400",
    border: "border-yellow-500",
  },
  active: {
    label: "Активно",
    color: "bg-green-900/30 text-green-400",
    border: "border-green-500",
  },
  declined: {
    label: "Отклонено",
    color: "bg-red-900/30 text-red-400",
    border: "border-red-500",
  },
  cancelled: {
    label: "Отменено",
    color: "bg-gray-700/30 text-gray-400",
    border: "border-gray-500",
  },
};

const bookingStatusConfig: Record<
  string,
  { label: string; color: string }
> = {
  pending: {
    label: "Ожидает",
    color: "bg-yellow-900/30 text-yellow-400",
  },
  confirmed: {
    label: "Подтверждено",
    color: "bg-green-900/30 text-green-400",
  },
  rejected: {
    label: "Отклонено",
    color: "bg-red-900/30 text-red-400",
  },
  cancelled: {
    label: "Отменено",
    color: "bg-gray-700/30 text-gray-400",
  },
  completed: {
    label: "Завершено",
    color: "bg-blue-900/30 text-blue-400",
  },
  cancel_requested: {
    label: "Отмена запрошена",
    color: "bg-orange-900/30 text-orange-400",
  },
  reschedule_pending: {
    label: "Перенос",
    color: "bg-purple-900/30 text-purple-400",
  },
};

// --- Helpers ---

function formatDate(isoStr: string): string {
  const d = new Date(isoStr);
  const dayName = DAY_NAMES[d.getUTCDay()] || "?";
  return `${dayName}, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

function formatTime(isoStr: string): string {
  const d = new Date(isoStr);
  const h = String(d.getUTCHours()).padStart(2, "0");
  const m = String(d.getUTCMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

function formatDateRange(
  startDate?: string,
  endDate?: string,
): string | null {
  if (!startDate || !endDate) return null;
  const start = new Date(startDate);
  const end = new Date(endDate);
  return `${start.getDate()} ${SHORT_MONTHS[start.getMonth()]} — ${end.getDate()} ${SHORT_MONTHS[end.getMonth()]}`;
}

function formatDaysOfWeek(schedule: RecurringSchedule): string {
  if (schedule.daysOfWeek) {
    return schedule.daysOfWeek
      .split(",")
      .map((d) => DAY_NAMES[parseInt(d)] || "?")
      .join(", ");
  }
  return DAY_NAMES[schedule.dayOfWeek] || "?";
}

function getServiceName(schedule: RecurringSchedule): string {
  if (schedule.sessionType?.name) {
    return schedule.sessionType.name;
  }
  return formatDuration(schedule.durationMinutes);
}

// --- Component ---

export default function AdminRecurringDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const { data: schedule, isLoading, mutate } = useAdminRecurringDetail(id);
  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handleRequestCancel = async () => {
    if (!cancelTarget || !schedule) return;
    setActionLoading(cancelTarget.id);
    try {
      await api.admin.requestCancelBooking(schedule.id, cancelTarget.id);
      toast.success("Запрос на отмену отправлен");
      setCancelTarget(null);
      mutate();
      invalidateRecurring();
    } catch {
      toast.error("Не удалось запросить отмену");
    } finally {
      setActionLoading(null);
    }
  };

  const handleApproveCancelBooking = async (booking: Booking) => {
    if (!schedule) return;
    setActionLoading(booking.id);
    try {
      await api.admin.approveCancelBooking(schedule.id, booking.id);
      toast.success("Отмена подтверждена");
      mutate();
      invalidateRecurring();
    } catch {
      toast.error("Не удалось подтвердить отмену");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeclineCancelBooking = async (booking: Booking) => {
    if (!schedule) return;
    setActionLoading(booking.id);
    try {
      await api.admin.declineCancelBooking(schedule.id, booking.id);
      toast.success("Отмена отклонена");
      mutate();
      invalidateRecurring();
    } catch {
      toast.error("Не удалось отклонить отмену");
    } finally {
      setActionLoading(null);
    }
  };

  const handleApproveMoveBooking = async (booking: Booking) => {
    if (!schedule) return;
    setActionLoading(booking.id);
    try {
      await api.admin.approveMoveBooking(schedule.id, booking.id);
      toast.success("Перенос подтвержден");
      mutate();
      invalidateRecurring();
    } catch {
      toast.error("Не удалось подтвердить перенос");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeclineMoveBooking = async (booking: Booking) => {
    if (!schedule) return;
    setActionLoading(booking.id);
    try {
      await api.admin.declineMoveBooking(schedule.id, booking.id);
      toast.success("Перенос отклонен");
      mutate();
      invalidateRecurring();
    } catch {
      toast.error("Не удалось отклонить перенос");
    } finally {
      setActionLoading(null);
    }
  };

  // --- Loading skeleton ---
  if (isLoading) {
    return (
      <div>
        <TopBar title="Расписание" showBack />
        <div className="p-4 space-y-4">
          <div className="bg-card rounded-xl p-4 animate-pulse">
            <div className="h-5 bg-border rounded w-1/3 mb-4" />
            <div className="h-4 bg-border rounded w-2/3 mb-3" />
            <div className="h-4 bg-border rounded w-1/2 mb-3" />
            <div className="h-4 bg-border rounded w-2/5" />
          </div>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-card rounded-xl p-4 animate-pulse">
              <div className="h-4 bg-border rounded w-1/2 mb-3" />
              <div className="h-4 bg-border rounded w-1/3 mb-2" />
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
          <p className="text-sm text-muted-foreground text-center py-8">
            Расписание не найдено
          </p>
        </div>
      </div>
    );
  }

  const scheduleStatus =
    scheduleStatusConfig[schedule.status] || scheduleStatusConfig.pending;
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
        {/* Schedule Info Card */}
        <div
          className={`bg-card rounded-xl p-4 border-l-4 ${scheduleStatus.border}`}
        >
          <div className="flex items-start justify-between mb-3">
            <h2 className="text-base font-medium text-foreground">
              Регулярное расписание
            </h2>
            <span
              className={`px-3 py-1 rounded-full text-xs font-medium ${scheduleStatus.color}`}
            >
              {scheduleStatus.label}
            </span>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <ClientAvatar name={schedule.clientName} photoUrl={schedule.clientPhotoUrl} size="sm" />
              <span className="text-sm text-foreground">
                {schedule.clientName}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Dumbbell className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-foreground">{serviceName}</span>
            </div>

            <div className="flex items-center gap-2">
              <Repeat className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-foreground">{daysLabel}</span>
            </div>

            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-foreground">
                {schedule.time}
                <span className="text-muted-foreground">
                  {" "}
                  · {formatDuration(schedule.durationMinutes)}
                </span>
              </span>
            </div>

            {dateRange && (
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {dateRange}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Bookings Section */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3">
            Тренировки ({sortedBookings.length})
          </h3>

          {sortedBookings.length === 0 ? (
            <div className="bg-card rounded-xl p-6 text-center">
              <p className="text-sm text-muted-foreground">
                Нет запланированных тренировок
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {sortedBookings.map((booking) => (
                <BookingRow
                  key={booking.id}
                  booking={booking}
                  actionLoading={actionLoading}
                  onRequestCancel={setCancelTarget}
                  onApproveCancelBooking={handleApproveCancelBooking}
                  onDeclineCancelBooking={handleDeclineCancelBooking}
                  onApproveMoveBooking={handleApproveMoveBooking}
                  onDeclineMoveBooking={handleDeclineMoveBooking}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        onConfirm={handleRequestCancel}
        title="Отменить тренировку?"
        description={
          cancelTarget
            ? `${formatDate(cancelTarget.startsAt)} в ${formatTime(cancelTarget.startsAt)} — ${cancelTarget.clientName}`
            : undefined
        }
        confirmText="Отменить"
        destructive
      />
    </div>
  );
}

// --- Booking Row Component ---

interface BookingRowProps {
  booking: Booking;
  actionLoading: string | null;
  onRequestCancel: (booking: Booking) => void;
  onApproveCancelBooking: (booking: Booking) => void;
  onDeclineCancelBooking: (booking: Booking) => void;
  onApproveMoveBooking: (booking: Booking) => void;
  onDeclineMoveBooking: (booking: Booking) => void;
}

function BookingRow({
  booking,
  actionLoading,
  onRequestCancel,
  onApproveCancelBooking,
  onDeclineCancelBooking,
  onApproveMoveBooking,
  onDeclineMoveBooking,
}: BookingRowProps) {
  const status =
    bookingStatusConfig[booking.status] || bookingStatusConfig.pending;
  const isThisLoading = actionLoading === booking.id;

  const isConfirmed = booking.status === "confirmed";
  const isCancelRequestedByClient =
    booking.status === "cancel_requested" && booking.cancelledBy === "client";
  const isCancelRequestedByTrainer =
    booking.status === "cancel_requested" && booking.cancelledBy === "trainer";
  const isReschedulePending = booking.status === "reschedule_pending";

  return (
    <div className="bg-card rounded-xl p-4">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 space-y-1.5">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-foreground">
              {formatDate(booking.startsAt)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-foreground">
              {formatTime(booking.startsAt)} — {formatTime(booking.endsAt)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <ClientAvatar name={booking.clientName} photoUrl={booking.clientPhotoUrl} size="sm" />
            <span className="text-sm text-foreground">
              {booking.clientName}
            </span>
          </div>
        </div>
        <span
          className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${status.color}`}
        >
          {status.label}
        </span>
      </div>

      {/* Confirmed: Cancel button */}
      {isConfirmed && (
        <div className="pt-3 border-t border-border">
          <button
            onClick={() => onRequestCancel(booking)}
            disabled={isThisLoading}
            className="w-full py-2 px-4 rounded-lg bg-background text-destructive text-sm font-medium transition-opacity active:opacity-70 disabled:opacity-40"
          >
            {isThisLoading ? "Отмена..." : "Отменить"}
          </button>
        </div>
      )}

      {/* Cancel requested by client: Approve/Decline */}
      {isCancelRequestedByClient && (
        <div className="pt-3 border-t border-border space-y-2">
          <p className="text-xs text-orange-400 mb-2">
            Клиент просит отменить
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => onApproveCancelBooking(booking)}
              disabled={isThisLoading}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-4 rounded-lg bg-green-900/30 text-green-400 text-sm font-medium transition-opacity active:opacity-70 disabled:opacity-40"
            >
              <Check className="w-4 h-4" />
              Подтвердить
            </button>
            <button
              onClick={() => onDeclineCancelBooking(booking)}
              disabled={isThisLoading}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-4 rounded-lg bg-red-900/30 text-red-400 text-sm font-medium transition-opacity active:opacity-70 disabled:opacity-40"
            >
              <X className="w-4 h-4" />
              Отклонить
            </button>
          </div>
        </div>
      )}

      {/* Cancel requested by trainer: Waiting for client */}
      {isCancelRequestedByTrainer && (
        <div className="pt-3 border-t border-border">
          <p className="text-xs text-orange-400">
            Ожидает подтверждения клиента
          </p>
        </div>
      )}

      {/* Reschedule pending: Approve/Decline with new time */}
      {isReschedulePending && (
        <div className="pt-3 border-t border-border space-y-2">
          <div className="flex items-center gap-2 text-xs text-purple-400">
            <span>Запрос на перенос</span>
            <ArrowRight className="w-3 h-3" />
            <span className="font-medium">
              {formatDate(booking.startsAt)}, {formatTime(booking.startsAt)}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onApproveMoveBooking(booking)}
              disabled={isThisLoading}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-4 rounded-lg bg-green-900/30 text-green-400 text-sm font-medium transition-opacity active:opacity-70 disabled:opacity-40"
            >
              <Check className="w-4 h-4" />
              Подтвердить
            </button>
            <button
              onClick={() => onDeclineMoveBooking(booking)}
              disabled={isThisLoading}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-4 rounded-lg bg-red-900/30 text-red-400 text-sm font-medium transition-opacity active:opacity-70 disabled:opacity-40"
            >
              <X className="w-4 h-4" />
              Отклонить
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
