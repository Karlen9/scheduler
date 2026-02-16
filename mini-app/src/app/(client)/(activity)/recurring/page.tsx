"use client";

import { useState } from "react";
import { Repeat } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { RecurringScheduleCard } from "@/components/RecurringScheduleCard";
import { RecurringSchedule } from "@/lib/types";
import { api } from "@/lib/api";
import { useRecurringSchedules, useSessionTypes } from "@/hooks/queries";
import { invalidateRecurring } from "@/hooks/mutations";

export default function ClientRecurringPage() {
  const { data: schedules, isLoading: schedulesLoading } = useRecurringSchedules();
  const { data: services, isLoading: servicesLoading } = useSessionTypes();

  const isLoading = schedulesLoading || servicesLoading;

  const [cancelTarget, setCancelTarget] = useState<RecurringSchedule | null>(null);

  const handleCancel = async () => {
    if (!cancelTarget) return;
    try {
      await api.cancelRecurringSchedule(cancelTarget.id);
      toast.success("Расписание отменено");
      setCancelTarget(null);
      invalidateRecurring();
    } catch {
      toast.error("Не удалось отменить расписание");
    }
  };

  const pendingSchedules = schedules.filter((s) => s.status === "pending");
  const activeSchedules = schedules.filter((s) => s.status === "active");
  const declinedSchedules = schedules.filter((s) => s.status === "declined");
  const cancelledSchedules = schedules.filter((s) => s.status === "cancelled");
  const hasSchedules = schedules.length > 0;

  if (isLoading) {
    return (
      <div className="p-4 space-y-3 animate-pulse">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-card rounded-xl p-4 space-y-2">
            <div className="h-4 bg-border rounded w-1/3" />
            <div className="h-3 bg-border rounded w-2/3" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="p-4 space-y-6">
        {!hasSchedules ? (
          <EmptyState
            icon={<Repeat className="w-16 h-16" />}
            title="Нет регулярных записей"
            description="Создайте расписание через кнопку +"
          />
        ) : (
          <>
            {pendingSchedules.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-3">
                  Ожидают подтверждения
                </h3>
                <div className="space-y-3">
                  {pendingSchedules.map((schedule) => (
                    <RecurringScheduleCard
                      key={schedule.id}
                      schedule={schedule}
                      services={services}
                      onCancel={setCancelTarget}
                      detailPath="/recurring"
                    />
                  ))}
                </div>
              </div>
            )}

            {activeSchedules.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-3">
                  Активные расписания
                </h3>
                <div className="space-y-3">
                  {activeSchedules.map((schedule) => (
                    <RecurringScheduleCard
                      key={schedule.id}
                      schedule={schedule}
                      services={services}
                      onCancel={setCancelTarget}
                      detailPath="/recurring"
                    />
                  ))}
                </div>
              </div>
            )}

            {declinedSchedules.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-3">
                  Отклоненные
                </h3>
                <div className="space-y-3">
                  {declinedSchedules.map((schedule) => (
                    <RecurringScheduleCard
                      key={schedule.id}
                      schedule={schedule}
                      services={services}
                    />
                  ))}
                </div>
              </div>
            )}

            {cancelledSchedules.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-3">
                  Отмененные ({cancelledSchedules.length})
                </h3>
                <div className="space-y-3">
                  {cancelledSchedules.map((schedule) => (
                    <RecurringScheduleCard
                      key={schedule.id}
                      schedule={schedule}
                      services={services}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <ConfirmDialog
        isOpen={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        onConfirm={handleCancel}
        title="Отменить расписание?"
        description="Регулярные тренировки по этому расписанию больше не будут создаваться автоматически."
        confirmText="Отменить"
        destructive
      />
    </div>
  );
}
