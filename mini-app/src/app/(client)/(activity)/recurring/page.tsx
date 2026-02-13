"use client";

import { useState, useEffect, useMemo } from "react";
import { Repeat, Eye } from "lucide-react";
import { toast } from "sonner";
import { PrimaryButton } from "@/components/PrimaryButton";
import { RecurringPageSkeleton } from "@/components/LoadingSkeleton";
import { ServiceSelector } from "@/components/ServiceSelector";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { RecurringScheduleCard } from "@/components/RecurringScheduleCard";
import { RecurringSchedule, SessionType, WorkingHours } from "@/lib/types";
import { api } from "@/lib/api";
import { useRecurringSchedules, useSessionTypes, useWorkingHours } from "@/hooks/queries";
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

function generateTimeSlots(workingHours: WorkingHours[], days: number[], durationMinutes: number): string[] {
  if (days.length === 0 || durationMinutes <= 0) return [];

  const slotsPerDay = days.map((day) => {
    const wh = workingHours.find((h) => h.dayOfWeek === day);
    if (!wh) return new Set<string>();

    const [startH, startM] = wh.startTime.split(":").map(Number);
    const [endH, endM] = wh.endTime.split(":").map(Number);
    const startMin = startH * 60 + startM;
    const endMin = endH * 60 + endM;

    const slots = new Set<string>();
    for (let m = startMin; m + durationMinutes <= endMin; m += 30) {
      const h = Math.floor(m / 60);
      const min = m % 60;
      slots.add(`${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`);
    }
    return slots;
  });

  if (slotsPerDay.length === 0) return [];
  let result = slotsPerDay[0];
  for (let i = 1; i < slotsPerDay.length; i++) {
    const next = slotsPerDay[i];
    result = new Set([...result].filter((s) => next.has(s)));
  }

  return [...result].sort();
}

export default function ClientRecurringPage() {
  const { data: schedules, isLoading: schedulesLoading } = useRecurringSchedules();
  const { data: services, isLoading: servicesLoading } = useSessionTypes();
  const { data: workingHours, isLoading: whLoading } = useWorkingHours();
  const isLoading = schedulesLoading || servicesLoading || whLoading;

  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [selectedService, setSelectedService] = useState<SessionType | null>(null);
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<string>("");

  // Preview state
  const [previewDates, setPreviewDates] = useState<string[] | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);

  // Cancel dialog
  const [cancelTarget, setCancelTarget] = useState<RecurringSchedule | null>(null);

  const timeSlots = useMemo(
    () => generateTimeSlots(workingHours, selectedDays, selectedService?.durationMinutes ?? 0),
    [workingHours, selectedDays, selectedService],
  );

  // Reset selected time when available slots change
  useEffect(() => {
    if (selectedTime && !timeSlots.includes(selectedTime)) {
      setSelectedTime(null);
    }
  }, [timeSlots, selectedTime]);

  // Reset preview when form changes
  useEffect(() => {
    setPreviewDates(null);
  }, [selectedService, selectedDays, selectedTime, selectedPeriod]);

  const toggleDay = (day: number) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  };

  const formReady = selectedService && selectedDays.length > 0 && selectedTime && selectedPeriod;

  const handlePreview = async () => {
    if (!formReady) return;
    setIsPreviewing(true);
    try {
      const result = await api.previewRecurringSchedule({
        sessionTypeId: selectedService.id,
        daysOfWeek: selectedDays,
        time: selectedTime,
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
    if (!formReady || !previewDates) return;

    setIsSaving(true);
    try {
      await api.createRecurringSchedule({
        sessionTypeId: selectedService.id,
        daysOfWeek: selectedDays,
        time: selectedTime,
        period: selectedPeriod,
      });
      toast.success("Расписание отправлено на подтверждение");
      setSelectedService(null);
      setSelectedDays([]);
      setSelectedTime(null);
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
    return <RecurringPageSkeleton />;
  }

  return (
    <>
    <div className="p-4 space-y-6">
        {/* Add Form */}
        <div className="bg-card rounded-xl p-4 space-y-4">
          <h3 className="text-sm font-medium text-foreground">
            Добавить расписание
          </h3>

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

          {/* Day Selector (multi) */}
          <div>
            <label className="block text-sm text-muted-foreground mb-2">
              Дни недели
            </label>
            <div className="flex gap-2">
              {DAYS.map((day) => (
                <button
                  key={day.value}
                  onClick={() => toggleDay(day.value)}
                  className={`w-10 h-10 rounded-full text-sm font-medium transition-colors ${
                    selectedDays.includes(day.value)
                      ? "bg-primary text-primary-foreground"
                      : "bg-background text-foreground"
                  }`}
                >
                  {day.label}
                </button>
              ))}
            </div>
          </div>

          {/* Time Slot Grid */}
          {selectedService && selectedDays.length > 0 && (
            <div>
              <label className="block text-sm text-muted-foreground mb-2">
                Время
              </label>
              {timeSlots.length > 0 ? (
                <div className="grid grid-cols-4 gap-2">
                  {timeSlots.map((slot) => (
                    <button
                      key={slot}
                      onClick={() => setSelectedTime(slot)}
                      className={`py-2.5 rounded-lg text-sm font-medium transition-colors ${
                        selectedTime === slot
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
                  Нет доступных слотов для выбранных дней
                </p>
              )}
            </div>
          )}

          {/* Period Selector */}
          {selectedService && selectedDays.length > 0 && selectedTime && (
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

          {/* Preview Button */}
          {formReady && !previewDates && (
            <button
              onClick={handlePreview}
              disabled={isPreviewing}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-background text-foreground font-medium text-sm transition-opacity active:opacity-70 disabled:opacity-40"
            >
              <Eye className="w-4 h-4" />
              {isPreviewing ? "Загрузка..." : "Предпросмотр"}
            </button>
          )}

          {/* Preview Dates */}
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
            disabled={isSaving || !formReady || !previewDates}
          >
            {isSaving ? "Сохранение..." : "Отправить на подтверждение"}
          </PrimaryButton>
        </div>

        {/* Schedules List */}
        {!hasSchedules ? (
          <EmptyState
            icon={<Repeat className="w-16 h-16" />}
            title="Нет регулярных тренировок"
            description="Добавьте расписание, чтобы автоматически бронировать тренировки каждую неделю"
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
    </>
  );
}
