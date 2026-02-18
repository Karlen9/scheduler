"use client";

import { useTranslations } from "next-intl";

interface DurationSelectorProps {
  durations: number[];
  selected: number;
  onChange: (duration: number) => void;
}

export function formatDuration(minutes: number, hourLabel = "h"): string {
  const hours = minutes / 60;
  if (hours === Math.floor(hours)) {
    return `${Math.floor(hours)} ${hourLabel}`;
  }
  return `${hours.toFixed(1).replace(".0", "")} ${hourLabel}`;
}

export function DurationSelector({
  durations,
  selected,
  onChange,
}: DurationSelectorProps) {
  const td = useTranslations("Duration");

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
          {formatDuration(duration, td("hour"))}
        </button>
      ))}
    </div>
  );
}
