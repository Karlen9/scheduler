"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, X, Calendar } from "lucide-react";
import { TopBar } from "@/components/TopBar";
import { PrimaryButton } from "@/components/PrimaryButton";
import { MonthCalendar } from "@/components/MonthCalendar";
import { DayOff } from "@/lib/types";
import { api } from "@/lib/api";

const formatDate = (date: Date): string => {
  const days = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
  const months = [
    "января", "февраля", "марта", "апреля", "мая", "июня",
    "июля", "августа", "сентября", "октября", "ноября", "декабря"
  ];
  return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]}`;
};

const formatDateISO = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export default function DaysOffPage() {
  const [daysOff, setDaysOff] = useState<DayOff[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [reason, setReason] = useState("");

  const fetchDaysOff = useCallback(async () => {
    try {
      setError(null);
      const data = await api.admin.getDaysOff();
      setDaysOff(data);
    } catch (err) {
      console.error("Failed to fetch days off:", err);
      setError("Ошибка загрузки выходных");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDaysOff();
  }, [fetchDaysOff]);

  const handleAddDayOff = async () => {
    const dateStr = formatDateISO(selectedDate);

    // Check if already exists
    const exists = daysOff.some((d) => d.date.startsWith(dateStr));
    if (exists) return;

    setSaving(true);
    setError(null);

    try {
      await api.admin.createDayOff(dateStr, reason || undefined);
      await fetchDaysOff();
      setShowCalendar(false);
      setReason("");
    } catch (err) {
      console.error("Failed to add day off:", err);
      setError(err instanceof Error ? err.message : "Ошибка добавления");
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveDayOff = async (id: string) => {
    try {
      await api.admin.deleteDayOff(id);
      setDaysOff((prev) => prev.filter((d) => d.id !== id));
    } catch (err) {
      console.error("Failed to delete day off:", err);
      setError("Ошибка удаления");
    }
  };

  const isDayOff = (date: Date) => {
    const dateStr = formatDateISO(date);
    return daysOff.some((d) => d.date.startsWith(dateStr));
  };

  // Convert ISO dates to Date objects for display
  const daysOffDates = daysOff.map((d) => new Date(d.date));

  if (loading) {
    return (
      <div>
        <TopBar title="Выходные дни" showBack />
        <div className="p-4 flex justify-center items-center min-h-[200px]">
          <div className="text-[var(--app-subtext)]">Загрузка...</div>
        </div>
      </div>
    );
  }

  if (showCalendar) {
    return (
      <div>
        <TopBar title="Выберите дату" showBack onBack={() => setShowCalendar(false)} />

        <div className="p-4 space-y-4">
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm text-center">
              {error}
            </div>
          )}

          <MonthCalendar
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            daysOff={daysOffDates}
          />

          <div>
            <label className="block text-sm text-[var(--app-subtext)] mb-1">
              Причина (необязательно)
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Отпуск, болезнь, праздник..."
              className="w-full px-4 py-3 rounded-lg bg-[var(--app-surface)] text-[var(--app-text)] outline-none focus:ring-2 focus:ring-[#5984d8]"
            />
          </div>

          <PrimaryButton
            onClick={handleAddDayOff}
            disabled={isDayOff(selectedDate) || saving}
          >
            {saving ? "Сохранение..." : isDayOff(selectedDate) ? "Уже выходной" : "Добавить выходной"}
          </PrimaryButton>
        </div>
      </div>
    );
  }

  return (
    <div>
      <TopBar title="Выходные дни" showBack />

      <div className="p-4 space-y-4">
        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm text-center">
            {error}
          </div>
        )}

        {/* Add Button */}
        <button
          onClick={() => setShowCalendar(true)}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 border-dashed border-[var(--app-divider)] text-[var(--app-subtext)] transition-colors active:bg-[var(--app-surface)]"
        >
          <Plus className="w-5 h-5" />
          <span>Добавить выходной</span>
        </button>

        {/* Days Off List */}
        {daysOff.length === 0 ? (
          <div className="text-center py-8 text-[var(--app-subtext)]">
            <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Нет запланированных выходных</p>
          </div>
        ) : (
          <div className="space-y-2">
            {daysOff.map((dayOff) => (
              <div
                key={dayOff.id}
                className="flex items-center gap-3 bg-white rounded-xl p-4"
              >
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-red-500" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-[var(--app-text)]">
                    {formatDate(new Date(dayOff.date))}
                  </p>
                  {dayOff.reason && (
                    <p className="text-sm text-[var(--app-subtext)]">
                      {dayOff.reason}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => handleRemoveDayOff(dayOff.id)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--app-subtext)] hover:bg-[var(--app-surface)]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
