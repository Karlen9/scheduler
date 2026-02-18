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
    <div className="grid grid-cols-4 gap-2">
      {slots.map((slot) => (
        <button
          key={slot.time}
          onClick={() => slot.available && onSelect(slot.time)}
          disabled={!slot.available}
          className={`rounded-lg py-3 text-sm transition-all ${
            selected === slot.time
              ? 'bg-primary text-primary-foreground'
              : slot.available
                ? 'bg-card text-foreground hover:bg-border'
                : 'bg-error/15 text-error cursor-not-allowed'
          }`}
        >
          {slot.time}
        </button>
      ))}
    </div>
  );
}
