import { memo } from 'react';

import type { TTimeSlotGridProps } from '@/lib/types';
import type { ReactNode } from 'react';

/***************************************************************************************************
 * Renders the time slot grid UI and related interactions.
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
function TimeSlotGridComponent({ slots, selected, onSelect }: TTimeSlotGridProps): ReactNode {
  return (
    <div className={'grid grid-cols-3 gap-2'}>
      {slots.map((slot) => (
        <button
          key={slot.time}
          onClick={() => slot.available && onSelect(slot.time)}
          disabled={!slot.available}
          className={`min-h-12 rounded-lg px-2 py-2 text-sm leading-tight transition-all ${
            selected === slot.time
              ? 'bg-primary text-primary-foreground'
              : slot.available
                ? 'bg-card text-foreground hover:bg-border'
                : slot.mine
                  ? 'bg-success/15 text-success cursor-not-allowed'
                  : 'bg-error/15 text-error cursor-not-allowed'
          }`}
        >
          <span className={'block font-medium'}>{slot.time}</span>
          {slot.endTime && (
            <span className={'mt-0.5 block text-[11px] opacity-70'}>{slot.endTime}</span>
          )}
        </button>
      ))}
    </div>
  );
}

export const TimeSlotGrid = memo(TimeSlotGridComponent);
