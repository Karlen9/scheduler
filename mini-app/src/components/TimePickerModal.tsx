"use client";

import { BottomSheet } from "@/components/BottomSheet";

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
  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={title} className="max-h-[80vh] overflow-auto">
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
                ? "bg-brand text-white"
                : "bg-card text-foreground active:bg-border"
            }`}
          >
            {time}
          </button>
        ))}
      </div>
    </BottomSheet>
  );
}
