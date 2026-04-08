import { useTranslations } from 'next-intl';

import { addMinutesToTime } from '@/lib/helpers';
import { monthGenKeys, monthShortCapKeys } from '@/lib/mappings';

import type { TSessionType } from '@/lib/types';
import type { ReactNode } from 'react';

/***************************************************************************************************
 * Renders the booking summary UI and related interactions.
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
export function BookingSummary({
  date,
  service,
  time,
  minLabel,
}: {
  date: Date;
  service: TSessionType;
  time: string | null;
  minLabel: string;
}): ReactNode {
  /***************************************************************************************************
   * Defines the td value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const td = useTranslations('Dates');
  /***************************************************************************************************
   * Defines the month short cap key value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const monthShortCapKey = monthShortCapKeys[date.getMonth()];
  /***************************************************************************************************
   * Defines the month gen key value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const monthGenKey = monthGenKeys[date.getMonth()];
  /***************************************************************************************************
   * Defines the end time value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const endTime = time ? addMinutesToTime(time, service.durationMinutes) : null;
  return (
    <div className={'bg-card flex items-center gap-4 rounded-xl p-4'}>
      <div className={'flex w-14 flex-col items-center justify-center'}>
        <span className={'text-foreground text-2xl leading-none font-bold'}>{date.getDate()}</span>
        <span className={'text-muted-foreground mt-0.5 text-xs'}>
          {td(`monthsShortCap.${monthShortCapKey}`)}
        </span>
      </div>
      <div className={'flex-1 space-y-0.5'}>
        <p className={'text-muted-foreground text-xs'}>
          {date.getDate()} {td(`monthsGen.${monthGenKey}`)}
        </p>
        <p className={'text-foreground truncate text-sm'}>{service.name}</p>
        {time && (
          <p className={'text-muted-foreground text-xs'}>
            {time} &ndash; {endTime} &middot; {service.durationMinutes} {minLabel}
          </p>
        )}
      </div>
    </div>
  );
}
