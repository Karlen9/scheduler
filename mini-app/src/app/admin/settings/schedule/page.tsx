"use client";

import { useState } from "react";
import { TopBar } from "@/components/TopBar";
import { PrimaryButton } from "@/components/PrimaryButton";
import { TimePickerModal } from "@/components/TimePickerModal";

export default function SchedulePage() {
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("23:00");
  const [allowReschedule, setAllowReschedule] = useState(true);
  const [blockCancellation, setBlockCancellation] = useState(true);
  const [cancelCutoffHours, setCancelCutoffHours] = useState("12");
  const [isSaving, setIsSaving] = useState(false);

  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    // TODO: Implement save API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsSaving(false);
  };

  return (
    <div>
      <TopBar title="Расписание" showBack />

      <div className="p-4 space-y-6">
        {/* Working Hours */}
        <div>
          <h3 className="text-sm text-[var(--app-subtext)] mb-3">Рабочие часы</h3>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-xs text-[var(--app-subtext)] mb-1">
                Начало
              </label>
              <button
                onClick={() => setShowStartPicker(true)}
                className="w-full px-4 py-3 rounded-lg bg-[var(--app-surface)] text-[var(--app-text)] text-left outline-none focus:ring-2 focus:ring-[#5984d8]"
              >
                {startTime}
              </button>
            </div>
            <div className="flex-1">
              <label className="block text-xs text-[var(--app-subtext)] mb-1">
                Конец
              </label>
              <button
                onClick={() => setShowEndPicker(true)}
                className="w-full px-4 py-3 rounded-lg bg-[var(--app-surface)] text-[var(--app-text)] text-left outline-none focus:ring-2 focus:ring-[#5984d8]"
              >
                {endTime}
              </button>
            </div>
          </div>
        </div>

        {/* Allow Reschedule */}
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={allowReschedule}
            onChange={(e) => setAllowReschedule(e.target.checked)}
            className="mt-1 w-5 h-5 rounded border-[var(--app-divider)] text-[#5984d8] focus:ring-[#5984d8]"
          />
          <span className="text-[var(--app-text)]">
            Разрешить клиентам меняться временем
          </span>
        </label>

        {/* Block Cancellation */}
        <div className="space-y-3">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={blockCancellation}
              onChange={(e) => setBlockCancellation(e.target.checked)}
              className="mt-1 w-5 h-5 rounded border-[var(--app-divider)] text-[#5984d8] focus:ring-[#5984d8]"
            />
            <span className="text-[var(--app-text)]">
              Блокировать возможность отмены занятия за N времени до начала
            </span>
          </label>

          {blockCancellation && (
            <div className="ml-8">
              <label className="block text-xs text-[var(--app-subtext)] mb-1">
                Времени до отмены
              </label>
              <input
                type="number"
                value={cancelCutoffHours}
                onChange={(e) => setCancelCutoffHours(e.target.value)}
                min="1"
                max="72"
                className="w-24 px-4 py-3 rounded-lg bg-[var(--app-surface)] text-[var(--app-text)] outline-none focus:ring-2 focus:ring-[#5984d8]"
              />
              <span className="ml-2 text-sm text-[var(--app-subtext)]">часов</span>
            </div>
          )}
        </div>

        {/* Save Button */}
        <PrimaryButton onClick={handleSave} disabled={isSaving}>
          {isSaving ? "Сохранение..." : "Сохранить изменения"}
        </PrimaryButton>
      </div>

      {/* Time Pickers */}
      <TimePickerModal
        isOpen={showStartPicker}
        onClose={() => setShowStartPicker(false)}
        onSelect={setStartTime}
        selectedTime={startTime}
        title="Начало рабочего дня"
      />
      <TimePickerModal
        isOpen={showEndPicker}
        onClose={() => setShowEndPicker(false)}
        onSelect={setEndTime}
        selectedTime={endTime}
        title="Конец рабочего дня"
      />
    </div>
  );
}
