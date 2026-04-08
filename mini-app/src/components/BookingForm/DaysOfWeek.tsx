import { useTranslations } from 'next-intl';

import type { ReactNode } from 'react';

/***************************************************************************************************
 * Renders the days of week UI and related interactions.
 *
 * Parameters:
 * - props: Component props that drive rendering and callbacks.
 *
 * Returns:
 * - The computed value for the current operation as ReactNode.
 *
 * Side effects:
 * - May derive UI state, invoke callbacks, and trigger user-facing rendering updates.
 ***************************************************************************************************/
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
  /***************************************************************************************************
   * Defines the t value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const t = useTranslations('BookingForm');

  return (
    <div>
      <label className={'text-muted-foreground mb-2 block text-sm'}>{t('daysOfWeek')}</label>
      <div className={'flex gap-2'}>
        {DAYS.map((day) => {
          /***************************************************************************************************
           * Defines the is configured value used by the component layer.
           *
           * Usage context:
           * - Reused by the component layer to keep shared values centralized.
           ***************************************************************************************************/
          const isConfigured = day.value in dayTimeMap;
          /***************************************************************************************************
           * Defines the is active value used by the component layer.
           *
           * Usage context:
           * - Reused by the component layer to keep shared values centralized.
           ***************************************************************************************************/
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
