import { useTranslations } from 'next-intl';

import { monthShortCapKeys } from '@/lib/mappings';

import type { TVoidFunction } from '@/lib/types';
import type { ReactNode } from 'react';

/***************************************************************************************************
 * Renders the date chip UI and related interactions.
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
export function DateChip({
  date,
  time,
  endTime,
  active,
  onClick,
}: {
  date: Date;
  time?: string;
  endTime?: string;
  active: boolean;
  onClick: TVoidFunction;
}): ReactNode {
  /***************************************************************************************************
   * Defines the td value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const td = useTranslations('Dates');
  /***************************************************************************************************
   * Defines the month key value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const monthKey = monthShortCapKeys[date.getMonth()];

  return (
    <button
      onClick={onClick}
      className={`flex min-w-[56px] shrink-0 flex-col items-center rounded-xl px-3 py-2 transition-all ${
        active
          ? 'border-border outline-brand bg-card border outline-2'
          : 'border-border bg-card border'
      }`}
    >
      <span className={'text-foreground text-lg font-semibold'}>{date.getDate()}</span>
      <span className={'text-muted-foreground text-[10px]'}>
        {td(`monthsShortCap.${monthKey}`)}
      </span>
      {time ? (
        <>
          <span className={'text-foreground mt-1 text-[10px]'}>{time}</span>
          {endTime && <span className={'text-muted-foreground text-[10px]'}>{endTime}</span>}
        </>
      ) : (
        <span className={'text-muted-foreground mt-1 text-sm'}>{'?'}</span>
      )}
    </button>
  );
}
