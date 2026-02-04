interface TimeSlot {
  time: string;
  available: boolean;
}

interface TimeSlotGridProps {
  slots: TimeSlot[];
  selected: string | null;
  onSelect: (time: string) => void;
}

export function TimeSlotGrid({ slots, selected, onSelect }: TimeSlotGridProps) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {slots.map((slot) => (
        <button
          key={slot.time}
          onClick={() => slot.available && onSelect(slot.time)}
          disabled={!slot.available}
          className={`py-3 rounded-lg text-sm transition-colors ${
            selected === slot.time
              ? "bg-[var(--app-primary)] text-[var(--app-primary-text)]"
              : slot.available
                ? "bg-[var(--app-surface)] text-[var(--app-text)] hover:bg-[var(--app-divider)]"
                : "bg-[var(--app-surface)] text-[var(--app-subtext)] opacity-40 cursor-not-allowed"
          }`}
        >
          {slot.time}
        </button>
      ))}
    </div>
  );
}
