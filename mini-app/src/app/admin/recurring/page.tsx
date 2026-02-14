"use client";

import { useState, useEffect, useMemo } from "react";
import { Repeat, Eye } from "lucide-react";
import { toast } from "sonner";
import { ActivityBackButton } from "@/components/ActivityBackButton";
import { RecurringPageSkeleton } from "@/components/LoadingSkeleton";
import { PrimaryButton } from "@/components/PrimaryButton";
import { ServiceSelector } from "@/components/ServiceSelector";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { RecurringScheduleCard } from "@/components/RecurringScheduleCard";
import { RecurringSchedule, SessionType, WorkingHours } from "@/lib/types";
import { api } from "@/lib/api";
import { useAdminRecurringSchedules, useClients, useAdminServices, useWorkingHours } from "@/hooks/queries";
import { invalidateRecurring } from "@/hooks/mutations";

const DAYS = [
  { label: "Пн", value: 1 },
  { label: "Вт", value: 2 },
  { label: "Ср", value: 3 },
  { label: "Чт", value: 4 },
  { label: "Пт", value: 5 },
  { label: "Сб", value: 6 },
  { label: "Вс", value: 0 },
];

const PERIODS = [
  { label: "1 неделя", value: "1week" },
  { label: "1 месяц", value: "1month" },
  { label: "3 месяца", value: "3months" },
];

const DAY_NAMES_FULL: Record<number, string> = {
  0: "Вс",
  1: "Пн",
  2: "Вт",
  3: "Ср",
  4: "Чт",
  5: "Пт",
  6: "Сб",
};

const MONTH_NAMES = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

function formatPreviewDate(dateStr: string): string {
  const d = new Date(dateStr);
  const dayName = DAY_NAMES_FULL[d.getDay()] || "?";
  return `${dayName}, ${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
}

function generateTimeSlotsForDay(workingHours: WorkingHours[], day: number, durationMinutes: number): string[] {
  if (durationMinutes <= 0) return [];
  const wh = workingHours.find((h) => h.dayOfWeek === day);
  if (!wh) return [];

  const [startH, startM] = wh.startTime.split(":").map(Number);
  const [endH, endM] = wh.endTime.split(":").map(Number);
  const startMin = startH * 60 + startM;
  const endMin = endH * 60 + endM;

  const slots: string[] = [];
  for (let m = startMin; m + durationMinutes <= endMin; m += 30) {
    const h = Math.floor(m / 60);
    const min = m % 60;
    slots.push(`${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`);
  }
  return slots;
}

export default function AdminRecurringPage() {
  const { data: schedules, isLoading: schedulesLoading } = useAdminRecurringSchedules();
  const { data: clients, isLoading: clientsLoading } = useClients();
  const { data: services, isLoading: servicesLoading } = useAdminServices();
  const { data: workingHoursData, isLoading: workingHoursLoading } = useWorkingHours();

  const isLoading = schedulesLoading || clientsLoading || servicesLoading || workingHoursLoading;

  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedService, setSelectedService] = useState<SessionType | null>(null);
  const [dayTimeMap, setDayTimeMap] = useState<Record<number, string>>({});
  const [activeDay, setActiveDay] = useState<number | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<string>("");

  // Preview state
  const [previewDates, setPreviewDates] = useState<string[] | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);

  // Cancel dialog
  const [cancelTarget, setCancelTarget] = useState<RecurringSchedule | null>(null);

  const timeSlotsForActiveDay = useMemo(
    () => activeDay !== null ? generateTimeSlotsForDay(workingHoursData, activeDay, selectedService?.durationMinutes ?? 0) : [],
    [workingHoursData, activeDay, selectedService],
  );

  // Reset preview when form changes
  useEffect(() => {
    setPreviewDates(null);
  }, [selectedClientId, selectedService, dayTimeMap, selectedPeriod]);

  const handleDayClick = (day: number) => {
    if (activeDay === day) {
      setDayTimeMap((prev) => {
        const next = { ...prev };
        delete next[day];
        return next;
      });
      setActiveDay(null);
    } else if (day in dayTimeMap) {
      setActiveDay(day);
    } else {
      setActiveDay(day);
    }
  };

  const handleTimeSelect = (time: string) => {
    if (activeDay === null) return;
    setDayTimeMap((prev) => ({ ...prev, [activeDay]: time }));
    setActiveDay(null);
  };

  const configuredDays = Object.keys(dayTimeMap).map(Number);
  const hasDayTimes = configuredDays.length > 0;
  const formReady = selectedClientId && selectedService && hasDayTimes && selectedPeriod;

  const buildDayTimesPayload = (): Record<string, string> => {
    const result: Record<string, string> = {};
    for (const [day, time] of Object.entries(dayTimeMap)) {
      result[day] = time;
    }
    return result;
  };

  const handlePreview = async () => {
    if (!formReady) return;
    setIsPreviewing(true);
    try {
      const result = await api.admin.previewRecurringSchedule({
        sessionTypeId: selectedService.id,
        dayTimes: buildDayTimesPayload(),
        period: selectedPeriod,
      });
      setPreviewDates(result.dates);
    } catch {
      toast.error("Не удалось загрузить предпросмотр");
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleCreate = async () => {
    if (!formReady) return;
    setIsSaving(true);
    try {
      await api.admin.createRecurringSchedule({
        clientId: selectedClientId,
        sessionTypeId: selectedService.id,
        dayTimes: buildDayTimesPayload(),
        period: selectedPeriod,
      });
      toast.success("Расписание создано");
      setSelectedClientId("");
      setSelectedService(null);
      setDayTimeMap({});
      setActiveDay(null);
      setSelectedPeriod("");
      setPreviewDates(null);
      invalidateRecurring();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Ошибка создания расписания";
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleApprove = async (schedule: RecurringSchedule) => {
    try {
      await api.admin.approveRecurringSchedule(schedule.id);
      toast.success("Расписание подтверждено");
      invalidateRecurring();
    } catch {
      toast.error("Не удалось подтвердить расписание");
    }
  };

  const handleDecline = async (schedule: RecurringSchedule) => {
    try {
      await api.admin.declineRecurringSchedule(schedule.id);
      toast.success("Расписание отклонено");
      invalidateRecurring();
    } catch {
      toast.error("Не удалось отклонить расписание");
    }
  };

  const handleCancel = async () => {
    if (!cancelTarget) return;
    try {
      await api.admin.cancelRecurringSchedule(cancelTarget.id);
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
      <div>
        <ActivityBackButton href="/admin" />
        <RecurringPageSkeleton />
      </div>
    );
  }

  return (
    <div>
      <ActivityBackButton href="/admin" />

      <div className="p-4 space-y-6">
        {/* Add Form */}
        <div className="bg-card rounded-xl p-4 space-y-4">
          <h3 className="text-sm font-medium text-foreground">
            Добавить расписание
          </h3>

          {/* Client Selector */}
          <div>
            <label className="block text-sm text-muted-foreground mb-2">
              Клиент
            </label>
            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-background text-foreground outline-none focus:ring-2 focus:ring-brand appearance-none text-base"
            >
              <option value="">Выберите клиента</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </div>

          {/* Service Selector */}
          {services.length > 0 && (
            <div>
              <label className="block text-sm text-muted-foreground mb-2">
                Услуга
              </label>
              <ServiceSelector
                services={services}
                selectedId={selectedService?.id ?? ""}
                onChange={setSelectedService}
              />
            </div>
          )}

          {/* Day Selector */}
          <div>
            <label className="block text-sm text-muted-foreground mb-2">
              Дни недели
            </label>
            <div className="flex gap-2">
              {DAYS.map((day) => {
                const isConfigured = day.value in dayTimeMap;
                const isActive = activeDay === day.value;
                return (
                  <button
                    key={day.value}
                    onClick={() => handleDayClick(day.value)}
                    className={`w-10 h-10 rounded-full text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-primary text-primary-foreground ring-2 ring-primary/50"
                        : isConfigured
                          ? "bg-primary text-primary-foreground"
                          : "bg-background text-foreground"
                    }`}
                  >
                    {day.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Time Slot Grid for active day */}
          {selectedService && activeDay !== null && (
            <div>
              <label className="block text-sm text-muted-foreground mb-2">
                Время для {DAY_NAMES_FULL[activeDay]}
              </label>
              {timeSlotsForActiveDay.length > 0 ? (
                <div className="grid grid-cols-4 gap-2">
                  {timeSlotsForActiveDay.map((slot) => (
                    <button
                      key={slot}
                      onClick={() => handleTimeSelect(slot)}
                      className={`py-2.5 rounded-lg text-sm font-medium transition-colors ${
                        dayTimeMap[activeDay] === slot
                          ? "bg-primary text-primary-foreground"
                          : "bg-background text-foreground"
                      }`}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Нет доступных слотов для {DAY_NAMES_FULL[activeDay]}
                </p>
              )}
            </div>
          )}

          {/* Summary of configured days */}
          {hasDayTimes && activeDay === null && (
            <div className="space-y-1">
              {DAYS.filter((d) => d.value in dayTimeMap).map((d) => (
                <div key={d.value} className="flex items-center justify-between text-sm px-1">
                  <span className="text-foreground">{d.label}</span>
                  <span className="text-muted-foreground">{dayTimeMap[d.value]}</span>
                </div>
              ))}
            </div>
          )}

          {/* Period Selector */}
          {selectedService && hasDayTimes && (
            <div>
              <label className="block text-sm text-muted-foreground mb-2">
                Период
              </label>
              <div className="flex gap-2">
                {PERIODS.map((period) => (
                  <button
                    key={period.value}
                    onClick={() => setSelectedPeriod(period.value)}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      selectedPeriod === period.value
                        ? "bg-primary text-primary-foreground"
                        : "bg-background text-foreground"
                    }`}
                  >
                    {period.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Preview & Book buttons */}
          {formReady && (
            <div className="space-y-2">
              {!previewDates && (
                <button
                  onClick={handlePreview}
                  disabled={isPreviewing}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-background text-foreground font-medium text-sm transition-opacity active:opacity-70 disabled:opacity-40"
                >
                  <Eye className="w-4 h-4" />
                  {isPreviewing ? "Загрузка..." : "Предпросмотр"}
                </button>
              )}

              {previewDates && (
                <div>
                  <label className="block text-sm text-muted-foreground mb-2">
                    Будет создано тренировок: {previewDates.length}
                  </label>
                  <div className="max-h-40 overflow-y-auto rounded-lg bg-background p-3 space-y-1">
                    {previewDates.map((date) => (
                      <div key={date} className="text-sm text-foreground">
                        {formatPreviewDate(date)}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <PrimaryButton
                onClick={handleCreate}
                disabled={isSaving}
              >
                {isSaving ? "Сохранение..." : "Добавить расписание"}
              </PrimaryButton>
            </div>
          )}
        </div>

        {/* Schedules List */}
        {!hasSchedules ? (
          <EmptyState
            icon={<Repeat className="w-16 h-16" />}
            title="Нет регулярных записей"
            description="Добавьте расписание для автоматического создания тренировок"
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
                      onApprove={schedule.createdBy === "client" ? handleApprove : undefined}
                      onDecline={schedule.createdBy === "client" ? handleDecline : undefined}
                      detailPath="/admin/recurring"
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
                      detailPath="/admin/recurring"
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
