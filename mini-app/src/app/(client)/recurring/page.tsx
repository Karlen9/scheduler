"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Repeat } from "lucide-react";
import { toast } from "sonner";
import { TopBar } from "@/components/TopBar";
import { PrimaryButton } from "@/components/PrimaryButton";
import { ServiceSelector } from "@/components/ServiceSelector";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { RecurringScheduleCard } from "@/components/RecurringScheduleCard";
import { RecurringSchedule, SessionType, WorkingHours } from "@/lib/types";
import { api } from "@/lib/api";

const DAYS = [
  { label: "Пн", value: 1 },
  { label: "Вт", value: 2 },
  { label: "Ср", value: 3 },
  { label: "Чт", value: 4 },
  { label: "Пт", value: 5 },
  { label: "Сб", value: 6 },
  { label: "Вс", value: 0 },
];

function generateTimeSlots(workingHours: WorkingHours[], days: number[], durationMinutes: number): string[] {
  if (days.length === 0 || durationMinutes <= 0) return [];

  // For each selected day, find working hours and generate slots
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

  // Intersection of all days' slots
  if (slotsPerDay.length === 0) return [];
  let result = slotsPerDay[0];
  for (let i = 1; i < slotsPerDay.length; i++) {
    const next = slotsPerDay[i];
    result = new Set([...result].filter((s) => next.has(s)));
  }

  return [...result].sort();
}

export default function ClientRecurringPage() {
  const [schedules, setSchedules] = useState<RecurringSchedule[]>([]);
  const [services, setServices] = useState<SessionType[]>([]);
  const [workingHours, setWorkingHours] = useState<WorkingHours[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState<SessionType | null>(null);

  // Cancel dialog
  const [cancelTarget, setCancelTarget] = useState<RecurringSchedule | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [schedulesData, servicesData, whData] = await Promise.all([
        api.getRecurringSchedules(),
        api.getSessionTypes(),
        api.getWorkingHours(),
      ]);
      setSchedules(schedulesData);
      setServices(servicesData);
      setWorkingHours(whData);
    } catch {
      toast.error("Не удалось загрузить расписания");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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

  const toggleDay = (day: number) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  };

  const handleCreate = async () => {
    if (selectedDays.length === 0) {
      toast.error("Выберите день недели");
      return;
    }
    if (!selectedTime) {
      toast.error("Выберите время");
      return;
    }
    if (!selectedService) {
      toast.error("Выберите услугу");
      return;
    }

    setIsSaving(true);
    try {
      for (const day of selectedDays) {
        await api.createRecurringSchedule({
          dayOfWeek: day,
          time: selectedTime,
          durationMinutes: selectedService.durationMinutes,
        });
      }
      toast.success(selectedDays.length > 1 ? "Расписания добавлены" : "Расписание добавлено");
      setSelectedDays([]);
      setSelectedTime(null);
      fetchData();
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
      fetchData();
    } catch {
      toast.error("Не удалось отменить расписание");
    }
  };

  const activeSchedules = schedules.filter((s) => s.status !== "cancelled");
  const cancelledSchedules = schedules.filter((s) => s.status === "cancelled");

  if (isLoading) {
    return (
      <div>
        <TopBar title="Регулярные тренировки" showBack />
        <div className="p-4 space-y-3">
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

  return (
    <div>
      <TopBar title="Регулярные тренировки" showBack />

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

          <PrimaryButton
            onClick={handleCreate}
            disabled={isSaving || selectedDays.length === 0 || !selectedTime || !selectedService}
          >
            {isSaving ? "Сохранение..." : "Добавить расписание"}
          </PrimaryButton>
        </div>

        {/* Schedules List */}
        {activeSchedules.length === 0 && cancelledSchedules.length === 0 ? (
          <EmptyState
            icon={<Repeat className="w-16 h-16" />}
            title="Нет регулярных тренировок"
            description="Добавьте расписание, чтобы автоматически бронировать тренировки каждую неделю"
          />
        ) : (
          <>
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
