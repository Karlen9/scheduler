"use client";

import { useState, useEffect, useCallback } from "react";
import { Repeat } from "lucide-react";
import { toast } from "sonner";
import { TopBar } from "@/components/TopBar";
import { PrimaryButton } from "@/components/PrimaryButton";
import { DurationSelector } from "@/components/DurationSelector";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { RecurringScheduleCard } from "@/components/RecurringScheduleCard";
import { RecurringSchedule, ClientInfo } from "@/lib/types";
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

export default function AdminRecurringPage() {
  const [schedules, setSchedules] = useState<RecurringSchedule[]>([]);
  const [clients, setClients] = useState<ClientInfo[]>([]);
  const [durations, setDurations] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [time, setTime] = useState("10:00");
  const [selectedDuration, setSelectedDuration] = useState<number>(60);

  // Cancel / status dialog
  const [cancelTarget, setCancelTarget] = useState<RecurringSchedule | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [schedulesData, clientsData, durationsData] = await Promise.all([
        api.admin.getRecurringSchedules(),
        api.admin.getClients(),
        api.admin.getDurations().catch(() => [60]),
      ]);
      setSchedules(schedulesData);
      setClients(clientsData);
      setDurations(durationsData);
      if (durationsData.length > 0 && !durationsData.includes(selectedDuration)) {
        setSelectedDuration(durationsData[0]);
      }
    } catch {
      toast.error("Не удалось загрузить данные");
    } finally {
      setIsLoading(false);
    }
  }, [selectedDuration]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreate = async () => {
    if (!selectedClientId) {
      toast.error("Выберите клиента");
      return;
    }
    if (selectedDay === null) {
      toast.error("Выберите день недели");
      return;
    }
    if (!time) {
      toast.error("Укажите время");
      return;
    }

    setIsSaving(true);
    try {
      await api.admin.createRecurringSchedule({
        clientId: selectedClientId,
        dayOfWeek: selectedDay,
        time,
        durationMinutes: selectedDuration,
      });
      toast.success("Расписание добавлено");
      setSelectedClientId("");
      setSelectedDay(null);
      setTime("10:00");
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
      await api.admin.updateRecurringStatus(cancelTarget.id, "cancelled");
      toast.success("Расписание отменено");
      setCancelTarget(null);
      fetchData();
    } catch {
      toast.error("Не удалось отменить расписание");
    }
  };

  const handlePause = async (schedule: RecurringSchedule) => {
    try {
      await api.admin.updateRecurringStatus(schedule.id, "paused");
      toast.success("Расписание приостановлено");
      fetchData();
    } catch {
      toast.error("Не удалось приостановить расписание");
    }
  };

  const handleResume = async (schedule: RecurringSchedule) => {
    try {
      await api.admin.updateRecurringStatus(schedule.id, "active");
      toast.success("Расписание возобновлено");
      fetchData();
    } catch {
      toast.error("Не удалось возобновить расписание");
    }
  };

  // Group schedules by client name
  const groupedSchedules = schedules
    .filter((s) => s.status !== "cancelled")
    .reduce<Record<string, RecurringSchedule[]>>((acc, schedule) => {
      const name = schedule.clientName || "Без имени";
      if (!acc[name]) acc[name] = [];
      acc[name].push(schedule);
      return acc;
    }, {});

  const cancelledSchedules = schedules.filter((s) => s.status === "cancelled");
  const hasSchedules = schedules.length > 0;

  if (isLoading) {
    return (
      <div>
        <TopBar title="Регулярные записи" showBack />
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
      <TopBar title="Регулярные записи" showBack />

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
              className="w-full px-4 py-3 rounded-lg bg-background text-foreground outline-none focus:ring-2 focus:ring-brand appearance-none"
            >
              <option value="">Выберите клиента</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </div>

          {/* Day Selector */}
          <div>
            <label className="block text-sm text-muted-foreground mb-2">
              День недели
            </label>
            <div className="flex gap-2">
              {DAYS.map((day) => (
                <button
                  key={day.value}
                  onClick={() => setSelectedDay(day.value)}
                  className={`w-10 h-10 rounded-full text-sm font-medium transition-colors ${
                    selectedDay === day.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-background text-foreground"
                  }`}
                >
                  {day.label}
                </button>
              ))}
            </div>
          </div>

          {/* Time Input */}
          <div>
            <label className="block text-sm text-muted-foreground mb-2">
              Время
            </label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-background text-foreground outline-none focus:ring-2 focus:ring-brand"
            />
          </div>

          {/* Duration Selector */}
          {durations.length > 0 && (
            <div>
              <label className="block text-sm text-muted-foreground mb-2">
                Длительность
              </label>
              <DurationSelector
                durations={durations}
                selected={selectedDuration}
                onChange={setSelectedDuration}
              />
            </div>
          )}

          <PrimaryButton
            onClick={handleCreate}
            disabled={isSaving || !selectedClientId || selectedDay === null}
          >
            {isSaving ? "Сохранение..." : "Добавить расписание"}
          </PrimaryButton>
        </div>

        {/* Schedules List */}
        {!hasSchedules ? (
          <EmptyState
            icon={<Repeat className="w-16 h-16" />}
            title="Нет регулярных записей"
            description="Добавьте расписание для автоматического создания тренировок каждую неделю"
          />
        ) : (
          <>
            {Object.entries(groupedSchedules).map(([clientName, clientSchedules]) => (
              <div key={clientName}>
                <h3 className="text-sm font-medium text-muted-foreground mb-3">
                  {clientName}
                </h3>
                <div className="space-y-3">
                  {clientSchedules.map((schedule) => (
                    <RecurringScheduleCard
                      key={schedule.id}
                      schedule={schedule}
                      onCancel={setCancelTarget}
                      onPause={handlePause}
                      onResume={handleResume}
                    />
                  ))}
                </div>
              </div>
            ))}

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
