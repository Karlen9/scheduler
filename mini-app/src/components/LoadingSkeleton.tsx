import type { ReactNode } from 'react';

/***************************************************************************************************
 * Renders the calendar skeleton UI and related interactions.
 *
 * Parameters:
 * - None.
 *
 * Returns:
 * - The computed value for the current operation as ReactNode.
 *
 * Side effects:
 * - May derive UI state, invoke callbacks, and trigger user-facing rendering updates.
 ***************************************************************************************************/
export function CalendarSkeleton(): ReactNode {
  return (
    <div className={'bg-card animate-pulse rounded-xl p-4'}>
      <div className={'bg-skeleton mx-auto mb-4 h-8 w-40 rounded'} />
      <div className={'grid grid-cols-7 gap-1'}>
        {Array.from({ length: 35 }).map((_, i) => (
          <div key={i} className={'bg-skeleton aspect-square rounded-lg'} />
        ))}
      </div>
    </div>
  );
}

/** Client BookingCard skeleton — matches BookingCard.tsx layout */
/***************************************************************************************************
 * Renders the booking card skeleton UI and related interactions.
 *
 * Parameters:
 * - None.
 *
 * Returns:
 * - The computed value for the current operation as ReactNode.
 *
 * Side effects:
 * - May derive UI state, invoke callbacks, and trigger user-facing rendering updates.
 ***************************************************************************************************/
export function BookingCardSkeleton(): ReactNode {
  return (
    <div className={'bg-card animate-pulse rounded-xl p-4'}>
      <div className={'mb-3 flex items-start justify-between'}>
        <div className={'flex-1 space-y-2'}>
          <div className={'flex items-center gap-2'}>
            <div className={'bg-skeleton h-4 w-4 rounded'} />
            <div className={'bg-skeleton h-4 w-36 rounded'} />
          </div>
          <div className={'flex items-center gap-2'}>
            <div className={'bg-skeleton h-4 w-4 rounded'} />
            <div className={'bg-skeleton h-4 w-28 rounded'} />
          </div>
          <div className={'flex items-center gap-2'}>
            <div className={'bg-skeleton h-4 w-4 rounded'} />
            <div className={'bg-skeleton h-4 w-32 rounded'} />
          </div>
        </div>
        <div className={'bg-skeleton h-6 w-20 shrink-0 rounded-full'} />
      </div>
      <div className={'border-border border-t pt-3'}>
        <div className={'bg-skeleton h-9 w-full rounded-lg'} />
      </div>
    </div>
  );
}
