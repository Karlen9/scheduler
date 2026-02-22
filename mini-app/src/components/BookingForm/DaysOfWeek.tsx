import { useTranslations } from 'next-intl';

import type { ReactNode } from 'react';

export function DaysOfWeek({
  activeDay,
  dayTimeMap,
  handleDayClick,
  DAYS,
}: {
  activeDay: number | null;
  dayTimeMap: Record<number, string>;
  handleDayClick: (day: number) => void;
  DAYS: {
    label: string;
    value: number;
  }[];
}): ReactNode {
  const t = useTranslations('BookingForm');

  return (
    <div>
      <label className={'text-muted-foreground mb-2 block text-sm'}>{t('daysOfWeek')}</label>
      <div className={'flex gap-2'}>
        {DAYS.map((day) => {
          const isConfigured = day.value in dayTimeMap;
          const isActive = activeDay === day.value;
          return (
            <button
              key={day.value}
              onClick={() => handleDayClick(day.value)}
              className={`h-10 w-10 rounded-full text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-primary text-primary-foreground ring-primary/50 ring-2'
                  : isConfigured
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-card text-foreground'
              }`}
            >
              {day.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
