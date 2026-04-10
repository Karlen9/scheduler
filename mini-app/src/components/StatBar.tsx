import type { TStatBarProps } from '@/lib/types';
import type { ReactNode } from 'react';

/***************************************************************************************************
 * Renders the stat bar UI and related interactions.
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
export function StatBar({ label, value, maxValue, valueLabel }: TStatBarProps): ReactNode {
  const width = maxValue > 0 ? Math.max((value / maxValue) * 100, value > 0 ? 8 : 0) : 0;

  return (
    <div className={'space-y-2'}>
      <div className={'flex items-center justify-between gap-3'}>
        <span className={'text-foreground text-sm font-medium'}>{label}</span>
        <span className={'text-muted-foreground text-xs'}>{valueLabel ?? value}</span>
      </div>
      <div className={'bg-brand/10 h-2.5 overflow-hidden rounded-full'}>
        <div
          className={'bg-brand h-full rounded-full transition-[width] duration-300'}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}
