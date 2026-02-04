"use client";

import { useState } from "react";
import { TopBar } from "@/components/TopBar";
import { PrimaryButton } from "@/components/PrimaryButton";

interface ToggleProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function Toggle({ label, description, checked, onChange }: ToggleProps) {
  return (
    <label className="flex items-start justify-between gap-4 py-4 border-b border-[var(--app-divider)] cursor-pointer">
      <div className="flex-1">
        <span className="block text-[var(--app-text)]">{label}</span>
        {description && (
          <span className="block text-sm text-[var(--app-subtext)] mt-1">
            {description}
          </span>
        )}
      </div>
      <div
        onClick={() => onChange(!checked)}
        className={`relative w-12 h-7 rounded-full transition-colors ${
          checked ? "bg-[#5984d8]" : "bg-[var(--app-divider)]"
        }`}
      >
        <div
          className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </div>
    </label>
  );
}

export default function NotificationsPage() {
  const [newBooking, setNewBooking] = useState(true);
  const [cancellation, setCancellation] = useState(true);
  const [reminder, setReminder] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    // TODO: Implement save API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsSaving(false);
  };

  return (
    <div>
      <TopBar title="Уведомления" showBack />

      <div className="p-4">
        <div className="bg-white rounded-xl">
          <div className="px-4">
            <Toggle
              label="Новые записи"
              description="Уведомлять о новых записях клиентов"
              checked={newBooking}
              onChange={setNewBooking}
            />
            <Toggle
              label="Отмены"
              description="Уведомлять об отменах записей"
              checked={cancellation}
              onChange={setCancellation}
            />
            <Toggle
              label="Напоминания"
              description="Напоминать о предстоящих тренировках"
              checked={reminder}
              onChange={setReminder}
            />
          </div>
        </div>

        <div className="mt-6">
          <PrimaryButton onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Сохранение..." : "Сохранить"}
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}
