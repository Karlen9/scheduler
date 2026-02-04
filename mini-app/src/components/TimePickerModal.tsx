"use client";

import { X } from "lucide-react";

interface TimePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (time: string) => void;
  selectedTime?: string;
  title?: string;
}

const HOURS = Array.from({ length: 24 }, (_, i) =>
  `${i.toString().padStart(2, "0")}:00`
);

export function TimePickerModal({
  isOpen,
  onClose,
  onSelect,
  selectedTime,
  title = "Выберите время",
}: TimePickerModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div
        className="relative w-full bg-white rounded-t-2xl p-4 max-h-[80vh] overflow-auto"
        style={{ maxWidth: "430px" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-[var(--app-text)]">{title}</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-[var(--app-surface)]"
          >
            <X className="w-5 h-5 text-[var(--app-subtext)]" />
          </button>
        </div>

        {/* Time Grid */}
        <div className="grid grid-cols-4 gap-2">
          {HOURS.map((time) => (
            <button
              key={time}
              onClick={() => {
                onSelect(time);
                onClose();
              }}
              className={`py-3 rounded-lg text-sm transition-colors ${
                selectedTime === time
                  ? "bg-[#5984d8] text-white"
                  : "bg-[var(--app-surface)] text-[var(--app-text)] active:bg-[var(--app-divider)]"
              }`}
            >
              {time}
            </button>
          ))}
        </div>

        {/* Safe area */}
        <div className="h-[env(safe-area-inset-bottom)]" />
      </div>
    </div>
  );
}
