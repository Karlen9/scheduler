"use client";

import { Clock, Repeat, User, Pause, Play, X } from "lucide-react";
import { formatDuration } from "@/components/DurationSelector";
import { RecurringSchedule, SessionType } from "@/lib/types";

interface RecurringScheduleCardProps {
  schedule: RecurringSchedule;
  services?: SessionType[];
  onCancel?: (schedule: RecurringSchedule) => void;
  onPause?: (schedule: RecurringSchedule) => void;
  onResume?: (schedule: RecurringSchedule) => void;
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
  active: { label: "Активно", color: "bg-green-900/30 text-green-400", border: "border-green-500" },
  paused: { label: "Пауза", color: "bg-yellow-900/30 text-yellow-400", border: "border-yellow-500" },
  cancelled: { label: "Отменено", color: "bg-gray-700/30 text-gray-400", border: "border-gray-500" },
};

function getServiceName(durationMinutes: number, services?: SessionType[]): string {
  if (services && services.length > 0) {
    const match = services.find((s) => s.durationMinutes === durationMinutes);
    if (match) return match.name;
  }
  return formatDuration(durationMinutes);
}

export function RecurringScheduleCard({
  schedule,
  services,
  onCancel,
  onPause,
  onResume,
}: RecurringScheduleCardProps) {
  const status = statusConfig[schedule.status] || statusConfig.active;
  const dayName = DAY_NAMES[schedule.dayOfWeek] ?? "?";
  const canCancel = onCancel && (schedule.status === "active" || schedule.status === "paused");
  const canPause = onPause && schedule.status === "active";
  const canResume = onResume && schedule.status === "paused";
  const hasActions = canCancel || canPause || canResume;

  return (
    <div className={`bg-card rounded-xl p-4 border-l-4 ${status.border}`}>
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
              {dayName}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-foreground">
              {schedule.time}
              <span className="text-muted-foreground"> · {getServiceName(schedule.durationMinutes, services)}</span>
            </span>
          </div>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${status.color}`}>
          {status.label}
        </span>
      </div>

      {hasActions && (
        <div className="pt-3 border-t border-border">
          <div className="flex gap-2">
            {canPause && (
              <button
                onClick={() => onPause(schedule)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 px-4 rounded-lg bg-background text-foreground text-sm font-medium transition-opacity active:opacity-70"
              >
                <Pause className="w-4 h-4" />
                Пауза
              </button>
            )}
            {canResume && (
              <button
                onClick={() => onResume(schedule)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 px-4 rounded-lg bg-background text-foreground text-sm font-medium transition-opacity active:opacity-70"
              >
                <Play className="w-4 h-4" />
                Возобновить
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
