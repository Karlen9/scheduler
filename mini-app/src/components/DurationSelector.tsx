'use client';

import { useTranslations } from 'next-intl';

import type { ReactNode } from 'react';

type TDurationSelectorProps = {
  durations: number[];
  selected: number;
  onChange: (duration: number) => void;
};

export function formatDuration(minutes: number, hourLabel = 'h'): string {
  const hours = minutes / 60;
  if (hours === Math.floor(hours)) {
    return `${Math.floor(hours)} ${hourLabel}`;
  }
  return `${hours.toFixed(1).replace('.0', '')} ${hourLabel}`;
}

export function DurationSelector({
  durations,
  selected,
  onChange,
}: TDurationSelectorProps): ReactNode {
  const td = useTranslations('Duration');

  return (
    <div className={'flex flex-wrap gap-2'}>
      {durations.map((duration) => (
        <button
          key={duration}
          onClick={() => onChange(duration)}
          className={`rounded-full px-4 py-2 text-sm transition-colors ${
            selected === duration ? 'bg-primary text-primary-foreground' : 'bg-card text-foreground'
          }`}
        >
          {formatDuration(duration, td('hour'))}
        </button>
      ))}
    </div>
  );
}
