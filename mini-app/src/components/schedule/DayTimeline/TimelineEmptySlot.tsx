import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';

import type { TTimelineEmptySlotProps } from '@/lib/types';
import type { ReactNode } from 'react';

/***************************************************************************************************
 * Formats minutes.
 *
 * Parameters:
 * - totalMin: Total min used by the current operation.
 *
 * Returns:
 * - The computed value for the current operation as string.
 *
 * Side effects:
 * - May derive UI state, invoke callbacks, and trigger user-facing rendering updates.
 ***************************************************************************************************/
function formatMinutes(totalMin: number): string {
  /***************************************************************************************************
   * Defines the h value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const h = Math.floor(totalMin / 60);
  /***************************************************************************************************
   * Defines the m value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const m = totalMin % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

/***************************************************************************************************
 * Renders the timeline empty slot UI and related interactions.
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
export function TimelineEmptySlot({
  slot,
  date,
  top,
  height,
  onEmptySlotClick,
}: TTimelineEmptySlotProps): ReactNode {
  /***************************************************************************************************
   * Defines the t value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const t = useTranslations('DayTimeline');

  return (
    <button
      key={`empty-${slot.startMin}`}
      onClick={() => onEmptySlotClick?.(date, formatMinutes(slot.startMin))}
      className={
        'bg-card border-surface-border absolute right-0 left-12 overflow-hidden rounded-xl border border-dashed px-3 py-2 text-left transition-opacity active:opacity-80'
      }
      style={{ top: top + 3, height: height - 3 }}
    >
      <div className={'flex h-full items-center justify-between'}>
        <div className={'min-w-0'}>
          <p className={'text-muted-foreground text-sm font-medium'}>{t('emptySlot')}</p>
          {height >= 54 && (
            <p className={'text-muted-foreground/60 text-xs'}>{t('timeNotOccupied')}</p>
          )}
          {height >= 68 && (
            <p className={'text-muted-foreground/60 text-xs'}>
              {formatMinutes(slot.startMin)}
              {' – '}
              {formatMinutes(slot.endMin)}
            </p>
          )}
        </div>
        <div
          className={'bg-brand/10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full'}
        >
          <Plus className={'text-brand h-3.5 w-3.5'} />
        </div>
      </div>
    </button>
  );
}
