"use client";

import { useTranslations } from "next-intl";

interface TimeSlotPickerProps {
  selectedTime: string | null;
  onSelectTime: (time: string) => void;
}

interface TimeSlot {
  time: string;
  status: "free" | "taken";
}

// Mock data - in a real app, this would come from the backend
const timeSlots: TimeSlot[] = [
  { time: "9:00", status: "taken" },
  { time: "10:00", status: "taken" },
  { time: "11:00", status: "free" },
  { time: "12:00", status: "free" },
  { time: "13:00", status: "free" },
  { time: "14:00", status: "free" },
  { time: "15:00", status: "free" },
  { time: "16:00", status: "free" },
  { time: "17:00", status: "free" },
  { time: "18:00", status: "taken" },
  { time: "19:00", status: "free" },
  { time: "20:00", status: "taken" },
  { time: "21:00", status: "free" },
  { time: "22:00", status: "free" },
  { time: "23:00", status: "free" },
];

export function TimeSlotPicker({
  selectedTime,
  onSelectTime,
}: TimeSlotPickerProps) {
  const t = useTranslations("BookingForm");

  const getSlotClassName = (slot: TimeSlot) => {
    const isSelected = selectedTime === slot.time;

    if (slot.status === "taken") {
      return "bg-surface-hover border border-surface-border text-muted-foreground cursor-not-allowed";
    }

    if (isSelected) {
      return "bg-brand border-2 border-brand text-white";
    }

    return "bg-card border border-surface-border text-foreground";
  };

  const handleSlotClick = (slot: TimeSlot) => {
    if (slot.status === "taken") return;
    onSelectTime(slot.time);
  };

  return (
    <div className="bg-card rounded-[10px] p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-foreground text-base font-semibold font-['Inter']">
          {t("selectTime")}
        </h3>
        <p className="text-muted-foreground text-xs font-medium font-['Inter']">
          {/* Working hours info */}
        </p>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-[21px] h-[22px] bg-card border border-surface-border rounded-full" />
          <span className="text-muted-foreground text-sm font-medium font-['Inter']">
            {t("available")}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-[21px] h-[22px] bg-surface-hover border border-surface-border rounded-full" />
          <span className="text-muted-foreground text-sm font-medium font-['Inter']">
            {t("occupied")}
          </span>
        </div>
      </div>

      {/* Time Slots Grid */}
      <div className="grid grid-cols-4 gap-2">
        {timeSlots.map((slot) => (
          <button
            key={slot.time}
            onClick={() => handleSlotClick(slot)}
            disabled={slot.status === "taken"}
            className={`
              h-[43px] rounded-[70px] text-base font-medium font-['Inter']
              transition-all active:scale-95
              ${getSlotClassName(slot)}
            `}
          >
            {slot.time}
          </button>
        ))}
      </div>
    </div>
  );
}
