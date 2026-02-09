interface DurationSelectorProps {
  durations: number[];
  selected: number;
  onChange: (duration: number) => void;
}

export function formatDuration(minutes: number): string {
  const hours = minutes / 60;
  if (hours === Math.floor(hours)) {
    return `${Math.floor(hours)} ч`;
  }
  return `${hours.toFixed(1).replace(".0", "")} ч`;
}

export function DurationSelector({
  durations,
  selected,
  onChange,
}: DurationSelectorProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {durations.map((duration) => (
        <button
          key={duration}
          onClick={() => onChange(duration)}
          className={`px-4 py-2 rounded-full text-sm transition-colors ${
            selected === duration
              ? "bg-primary text-primary-foreground"
              : "bg-card text-foreground"
          }`}
        >
          {formatDuration(duration)}
        </button>
      ))}
    </div>
  );
}
