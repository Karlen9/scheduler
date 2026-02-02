"use client";

import { TimeSlot } from "@/lib/types";

interface TimeSlotsProps {
  slots: TimeSlot[];
  selectedTime: string | null;
  onSelectTime: (time: string) => void;
  isLoading?: boolean;
}

export function TimeSlots({ slots, selectedTime, onSelectTime, isLoading }: TimeSlotsProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-6 h-6 border-2 border-[#4A90D9] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const availableSlots = slots.filter((s) => s.available);

  if (slots.length === 0 || availableSlots.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        Нет доступного времени
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-5">
        <span className="font-semibold text-lg">Выберите время</span>
      </div>

      {/* Time grid - 3 columns */}
      <div className="grid grid-cols-3 gap-3">
        {availableSlots.map((slot) => (
          <button
            key={slot.time}
            onClick={() => onSelectTime(slot.time)}
            className={`
              py-3 px-4 rounded-2xl text-sm font-medium transition-all active:scale-95
              ${selectedTime === slot.time
                ? "border-2 border-[#4A90D9] text-[#4A90D9] bg-white"
                : "border border-gray-200 text-gray-700 bg-white"
              }
            `}
          >
            {slot.time}
          </button>
        ))}
      </div>
    </div>
  );
}
