"use client";

import { useState, useEffect, useCallback } from "react";
import { TopBar } from "@/components/TopBar";
import { PrimaryButton } from "@/components/PrimaryButton";
import { TimePickerModal } from "@/components/TimePickerModal";
import { WorkingHours } from "@/lib/types";
import { api } from "@/lib/api";

const DAY_NAMES = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

interface DaySchedule {
  enabled: boolean;
  startTime: string;
  endTime: string;
}

export default function SchedulePage() {
  const [schedule, setSchedule] = useState<Record<number, DaySchedule>>({
    0: { enabled: false, startTime: "09:00", endTime: "18:00" },
    1: { enabled: true, startTime: "09:00", endTime: "21:00" },
    2: { enabled: true, startTime: "09:00", endTime: "21:00" },
    3: { enabled: true, startTime: "09:00", endTime: "21:00" },
    4: { enabled: true, startTime: "09:00", endTime: "21:00" },
    5: { enabled: true, startTime: "09:00", endTime: "21:00" },
    6: { enabled: false, startTime: "09:00", endTime: "18:00" },
  });

  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [pickerDay, setPickerDay] = useState<number | null>(null);
  const [pickerType, setPickerType] = useState<"start" | "end">("start");
  const [showPicker, setShowPicker] = useState(false);

  const fetchWorkingHours = useCallback(async () => {
    try {
      setError(null);
      const hours = await api.admin.getWorkingHours();

      // Reset all days to disabled first
      const newSchedule: Record<number, DaySchedule> = {
        0: { enabled: false, startTime: "09:00", endTime: "18:00" },
        1: { enabled: false, startTime: "09:00", endTime: "21:00" },
        2: { enabled: false, startTime: "09:00", endTime: "21:00" },
        3: { enabled: false, startTime: "09:00", endTime: "21:00" },
        4: { enabled: false, startTime: "09:00", endTime: "21:00" },
        5: { enabled: false, startTime: "09:00", endTime: "21:00" },
        6: { enabled: false, startTime: "09:00", endTime: "18:00" },
      };

      // Enable days that have working hours
      hours.forEach((wh) => {
        newSchedule[wh.dayOfWeek] = {
          enabled: true,
          startTime: wh.startTime,
          endTime: wh.endTime,
        };
      });

      setSchedule(newSchedule);
    } catch (err) {
      console.error("Failed to fetch working hours:", err);
      setError("Ошибка загрузки расписания");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWorkingHours();
  }, [fetchWorkingHours]);

  const handleDayToggle = (day: number) => {
    setSchedule((prev) => ({
      ...prev,
      [day]: { ...prev[day], enabled: !prev[day].enabled },
    }));
  };

  const openTimePicker = (day: number, type: "start" | "end") => {
    setPickerDay(day);
    setPickerType(type);
    setShowPicker(true);
  };

  const handleTimeSelect = (time: string) => {
    if (pickerDay === null) return;

    setSchedule((prev) => ({
      ...prev,
      [pickerDay]: {
        ...prev[pickerDay],
        [pickerType === "start" ? "startTime" : "endTime"]: time,
      },
    }));
    setShowPicker(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const hours: WorkingHours[] = [];
      for (let day = 0; day < 7; day++) {
        if (schedule[day].enabled) {
          hours.push({
            dayOfWeek: day,
            startTime: schedule[day].startTime,
            endTime: schedule[day].endTime,
          });
        }
      }

      await api.admin.updateWorkingHours(hours);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (err) {
      console.error("Failed to save working hours:", err);
      setError("Ошибка сохранения");
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div>
        <TopBar title="Расписание" showBack />
        <div className="p-4 flex justify-center items-center min-h-[200px]">
          <div className="text-muted-foreground">Загрузка...</div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <TopBar title="Расписание" showBack />

      <div className="p-4 space-y-6">
        {/* Status Messages */}
        {error && (
          <div className="bg-red-900/20 text-red-400 p-3 rounded-lg text-sm text-center">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-900/20 text-green-400 p-3 rounded-lg text-sm text-center">
            Расписание сохранено
          </div>
        )}

        {/* Working Hours per Day */}
        <div>
          <h3 className="text-sm text-muted-foreground mb-3">Рабочие дни</h3>
          <div className="space-y-2">
            {[1, 2, 3, 4, 5, 6, 0].map((day) => (
              <div
                key={day}
                className="flex items-center gap-3 p-3 bg-card rounded-lg"
              >
                <input
                  type="checkbox"
                  checked={schedule[day].enabled}
                  onChange={() => handleDayToggle(day)}
                  className="w-5 h-5 rounded border-border text-brand focus:ring-brand"
                />
                <span className="w-8 text-foreground font-medium">
                  {DAY_NAMES[day]}
                </span>
                {schedule[day].enabled && (
                  <div className="flex-1 flex items-center gap-2 text-sm">
                    <button
                      onClick={() => openTimePicker(day, "start")}
                      className="px-3 py-1 rounded bg-surface-hover text-foreground"
                    >
                      {schedule[day].startTime}
                    </button>
                    <span className="text-muted-foreground">–</span>
                    <button
                      onClick={() => openTimePicker(day, "end")}
                      className="px-3 py-1 rounded bg-surface-hover text-foreground"
                    >
                      {schedule[day].endTime}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Save Button */}
        <PrimaryButton onClick={handleSave} disabled={isSaving}>
          {isSaving ? "Сохранение..." : "Сохранить изменения"}
        </PrimaryButton>
      </div>

      {/* Time Picker */}
      <TimePickerModal
        isOpen={showPicker}
        onClose={() => setShowPicker(false)}
        onSelect={handleTimeSelect}
        selectedTime={
          pickerDay !== null
            ? schedule[pickerDay][pickerType === "start" ? "startTime" : "endTime"]
            : "09:00"
        }
        title={pickerType === "start" ? "Начало работы" : "Конец работы"}
      />
    </div>
  );
}
