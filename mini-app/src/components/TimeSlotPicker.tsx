"use client";

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
  const getSlotClassName = (slot: TimeSlot) => {
    const isSelected = selectedTime === slot.time;

    if (slot.status === "taken") {
      return "bg-[#e6e6e6] border border-[#e9e9e9] text-[#c8c8c8] cursor-not-allowed";
    }

    if (isSelected) {
      return "bg-white border-2 border-[#5984d8] text-[#5984d8]";
    }

    return "bg-white border border-[#e9e9e9] text-[#676767]";
  };

  const handleSlotClick = (slot: TimeSlot) => {
    if (slot.status === "taken") return;
    onSelectTime(slot.time);
  };

  return (
    <div className="bg-[#f0f4ff] rounded-[10px] p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[#101010] text-base font-semibold font-['Inter']">
          Выберите время
        </h3>
        <p className="text-[#999] text-xs font-medium font-['Inter']">
          Рабочие часы с 9:00 до 23:00
        </p>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-[21px] h-[22px] bg-white border border-[#e9e9e9] rounded-full" />
          <span className="text-[#595959] text-sm font-medium font-['Inter']">
            Свободно
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-[21px] h-[22px] bg-[#d4d4d4] border border-[#e9e9e9] rounded-full" />
          <span className="text-[#595959] text-sm font-medium font-['Inter']">
            Занято
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
