"use client";

import { useRouter } from "next/navigation";
import { Clock, Repeat, Calendar, Check, X, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { formatDuration } from "@/components/DurationSelector";
import { ClientAvatar } from "@/components/ClientAvatar";
import { StatusBadge, statusBorders } from "@/components/StatusBadge";
import { RecurringSchedule, SessionType } from "@/lib/types";

interface RecurringScheduleCardProps {
  schedule: RecurringSchedule;
  services?: SessionType[];
  onCancel?: (schedule: RecurringSchedule) => void;
  onApprove?: (schedule: RecurringSchedule) => void;
  onDecline?: (schedule: RecurringSchedule) => void;
  detailPath?: string; // e.g. "/recurring" or "/admin/recurring"
}

const dayShortKeysMap: Record<number, string> = {
  0: "sun", 1: "mon", 2: "tue", 3: "wed", 4: "thu", 5: "fri", 6: "sat",
};
const monthShortKeys = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

export function RecurringScheduleCard({
  schedule,
  services,
  onCancel,
  onApprove,
  onDecline,
  detailPath,
}: RecurringScheduleCardProps) {
  const router = useRouter();
  const tc = useTranslations("Common");
  const td = useTranslations("Dates");
  const tdu = useTranslations("Duration");

  function getDayName(dayNum: number): string {
    const key = dayShortKeysMap[dayNum];
    return key ? td(`daysShort.${key}`) : "?";
  }

  function formatDaysOfWeek(sched: RecurringSchedule): string {
    if (sched.daysOfWeek) {
      return sched.daysOfWeek
        .split(",")
        .map((d) => getDayName(parseInt(d)))
        .join(", ");
    }
    return getDayName(sched.dayOfWeek);
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
    return entries.map((e) => `${getDayName(e.day)} ${e.time}`).join(", ");
  }

  function formatDateRange(startDate?: string, endDate?: string): string | null {
    if (!startDate || !endDate) return null;
    const start = new Date(startDate);
    const end = new Date(endDate);
    return `${start.getDate()} ${td(`monthsShort.${monthShortKeys[start.getMonth()]}`)} — ${end.getDate()} ${td(`monthsShort.${monthShortKeys[end.getMonth()]}`)}`;
  }

  function getServiceName(sched: RecurringSchedule, svcs?: SessionType[]): string {
    if (sched.sessionType?.name) {
      return sched.sessionType.name;
    }
    if (svcs && svcs.length > 0 && sched.sessionTypeId) {
      const match = svcs.find((s) => s.id === sched.sessionTypeId);
      if (match) return match.name;
    }
    if (svcs && svcs.length > 0) {
      const match = svcs.find((s) => s.durationMinutes === sched.durationMinutes);
      if (match) return match.name;
    }
    return formatDuration(sched.durationMinutes, tdu("hour"));
  }

  const border = statusBorders[schedule.status] || statusBorders.pending;
  const dayTimes = parseDayTimes(schedule.dayTimes);
  const daysLabel = dayTimes ? formatDayTimesDisplay(dayTimes) : formatDaysOfWeek(schedule);
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
      className={`bg-card rounded-xl p-4 border-l-4 ${border} ${detailPath && isActive ? "cursor-pointer active:opacity-80 transition-opacity" : ""}`}
      onClick={handleCardClick}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          {schedule.clientName && (
            <div className="flex items-center gap-2 mb-2">
              <ClientAvatar name={schedule.clientName} photoUrl={schedule.clientPhotoUrl} size="sm" />
              <span className="text-sm font-medium text-foreground">
                {schedule.clientName}
              </span>
            </div>
          )}
          {dayTimes ? (
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="text-sm text-foreground">
                {daysLabel}
                <span className="text-muted-foreground"> · {getServiceName(schedule, services)}</span>
              </span>
            </div>
          ) : (
            <>
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
            </>
          )}
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
          <StatusBadge status={schedule.status} />
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
                className="flex-1 flex items-center justify-center gap-1.5 py-2 px-4 rounded-lg bg-action-success-bg text-action-success-text text-sm font-medium transition-opacity active:opacity-70"
              >
                <Check className="w-4 h-4" />
                {tc("confirm")}
              </button>
            )}
            {canDecline && (
              <button
                onClick={() => onDecline(schedule)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 px-4 rounded-lg bg-action-danger-bg text-action-danger-text text-sm font-medium transition-opacity active:opacity-70"
              >
                <X className="w-4 h-4" />
                {tc("cancelVerb")}
              </button>
            )}
            {canCancel && (
              <button
                onClick={() => onCancel(schedule)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 px-4 rounded-lg bg-background text-destructive text-sm font-medium transition-opacity active:opacity-70"
              >
                <X className="w-4 h-4" />
                {tc("cancelVerb")}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
