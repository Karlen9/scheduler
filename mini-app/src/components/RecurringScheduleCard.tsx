"use client";

import { useRouter } from "next/navigation";
import { Clock, Repeat, User, Calendar, Check, X, ChevronRight } from "lucide-react";
import { formatDuration } from "@/components/DurationSelector";
import { RecurringSchedule, SessionType } from "@/lib/types";

interface RecurringScheduleCardProps {
  schedule: RecurringSchedule;
  services?: SessionType[];
  onCancel?: (schedule: RecurringSchedule) => void;
  onApprove?: (schedule: RecurringSchedule) => void;
  onDecline?: (schedule: RecurringSchedule) => void;
  detailPath?: string; // e.g. "/recurring" or "/admin/recurring"
}

const DAY_NAMES: Record<number, string> = {
  0: "Вс",
  1: "Пн",
  2: "Вт",
  3: "Ср",
  4: "Чт",
  5: "Пт",
  6: "Сб",
};

const statusConfig: Record<string, { label: string; color: string; border: string }> = {
  pending: { label: "Ожидает", color: "bg-yellow-900/30 text-yellow-400", border: "border-yellow-500" },
  active: { label: "Активно", color: "bg-green-900/30 text-green-400", border: "border-green-500" },
  declined: { label: "Отклонено", color: "bg-red-900/30 text-red-400", border: "border-red-500" },
  cancelled: { label: "Отменено", color: "bg-gray-700/30 text-gray-400", border: "border-gray-500" },
};

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
  const months = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
  return `${start.getDate()} ${months[start.getMonth()]} — ${end.getDate()} ${months[end.getMonth()]}`;
}

function getServiceName(schedule: RecurringSchedule, services?: SessionType[]): string {
  if (schedule.sessionType?.name) {
    return schedule.sessionType.name;
  }
  if (services && services.length > 0 && schedule.sessionTypeId) {
    const match = services.find((s) => s.id === schedule.sessionTypeId);
    if (match) return match.name;
  }
  if (services && services.length > 0) {
    const match = services.find((s) => s.durationMinutes === schedule.durationMinutes);
    if (match) return match.name;
  }
  return formatDuration(schedule.durationMinutes);
}

export function RecurringScheduleCard({
  schedule,
  services,
  onCancel,
  onApprove,
  onDecline,
  detailPath,
}: RecurringScheduleCardProps) {
  const router = useRouter();
  const status = statusConfig[schedule.status] || statusConfig.pending;
  const daysLabel = formatDaysOfWeek(schedule);
  const dateRange = formatDateRange(schedule.startDate, schedule.endDate);
  const canCancel = onCancel && (schedule.status === "active" || schedule.status === "pending");
  const canApprove = onApprove && schedule.status === "pending";
  const canDecline = onDecline && schedule.status === "pending";
  const hasActions = canCancel || canApprove || canDecline;
  const isActive = schedule.status === "active";

  const handleCardClick = () => {
    if (detailPath && isActive) {
      router.push(`${detailPath}/${schedule.id}`);
    }
  };

  return (
    <div
      className={`bg-card rounded-xl p-4 border-l-4 ${status.border} ${detailPath && isActive ? "cursor-pointer active:opacity-80 transition-opacity" : ""}`}
      onClick={handleCardClick}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          {schedule.clientName && (
            <div className="flex items-center gap-2 mb-2">
              <User className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">
                {schedule.clientName}
              </span>
            </div>
          )}
          <div className="flex items-center gap-2 mb-2">
            <Repeat className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-foreground">
              {daysLabel}
            </span>
          </div>
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-foreground">
              {schedule.time}
              <span className="text-muted-foreground"> · {getServiceName(schedule, services)}</span>
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
        <div className="flex items-center gap-2 shrink-0">
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${status.color}`}>
            {status.label}
          </span>
          {detailPath && isActive && (
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {hasActions && (
        <div className="pt-3 border-t border-border" onClick={(e) => e.stopPropagation()}>
          <div className="flex gap-2">
            {canApprove && (
              <button
                onClick={() => onApprove(schedule)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 px-4 rounded-lg bg-green-900/30 text-green-400 text-sm font-medium transition-opacity active:opacity-70"
              >
                <Check className="w-4 h-4" />
                Подтвердить
              </button>
            )}
            {canDecline && (
              <button
                onClick={() => onDecline(schedule)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 px-4 rounded-lg bg-red-900/30 text-red-400 text-sm font-medium transition-opacity active:opacity-70"
              >
                <X className="w-4 h-4" />
                Отклонить
              </button>
            )}
            {canCancel && (
              <button
                onClick={() => onCancel(schedule)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 px-4 rounded-lg bg-background text-destructive text-sm font-medium transition-opacity active:opacity-70"
              >
                <X className="w-4 h-4" />
                Отменить
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
