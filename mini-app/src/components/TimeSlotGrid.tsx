import { Bell, BellRing } from "lucide-react";

interface TimeSlot {
  time: string;
  available: boolean;
  waitlistCount?: number;
  hasMyWaitlist?: boolean;
}

interface TimeSlotGridProps {
  slots: TimeSlot[];
  selected: string | null;
  onSelect: (time: string) => void;
  onJoinWaitlist?: (time: string) => void;
}

export function TimeSlotGrid({ slots, selected, onSelect, onJoinWaitlist }: TimeSlotGridProps) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {slots.map((slot) => {
        const isWaitlistable = !slot.available && onJoinWaitlist;
        const hasMyWaitlist = slot.hasMyWaitlist;

        return (
          <button
            key={slot.time}
            onClick={() => {
              if (slot.available) {
                onSelect(slot.time);
              } else if (isWaitlistable) {
                onJoinWaitlist(slot.time);
              }
            }}
            disabled={!slot.available && !isWaitlistable}
            className={`py-3 rounded-lg text-sm transition-colors relative ${
              selected === slot.time
                ? "bg-primary text-primary-foreground"
                : slot.available
                  ? "bg-card text-foreground hover:bg-border"
                  : hasMyWaitlist
                    ? "bg-yellow-900/20 text-yellow-400 border border-yellow-700/50"
                    : isWaitlistable
                      ? "bg-card/60 text-muted-foreground border border-dashed border-border hover:border-muted-foreground"
                      : "bg-card text-muted-foreground opacity-40 cursor-not-allowed"
            }`}
          >
            <span>{slot.time}</span>
            {isWaitlistable && !hasMyWaitlist && (
              <Bell className="w-3 h-3 absolute top-1 right-1 text-muted-foreground" />
            )}
            {hasMyWaitlist && (
              <BellRing className="w-3 h-3 absolute top-1 right-1 text-yellow-400" />
            )}
          </button>
        );
      })}
    </div>
  );
}
