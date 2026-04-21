import type { ReactNode } from 'react';

/***************************************************************************************************
 * Renders the time slot legend UI and related interactions.
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
export function TimeSlotLegend({
  availableLabel,
  occupiedLabel,
  mineLabel,
}: {
  availableLabel: string;
  occupiedLabel: string;
  mineLabel?: string;
}): ReactNode {
  return (
    <div className={'mb-3 flex items-center gap-4'}>
      <div className={'flex items-center gap-1.5'}>
        <span className={'bg-card border-border h-3 w-3 rounded border'} />
        <span className={'text-muted-foreground text-xs'}>{availableLabel}</span>
      </div>
      <div className={'flex items-center gap-1.5'}>
        <span className={'bg-error/15 h-3 w-3 rounded'} />
        <span className={'text-muted-foreground text-xs'}>{occupiedLabel}</span>
      </div>
      {mineLabel && (
        <div className={'flex items-center gap-1.5'}>
          <span className={'bg-success/15 h-3 w-3 rounded'} />
          <span className={'text-muted-foreground text-xs'}>{mineLabel}</span>
        </div>
      )}
    </div>
  );
}
