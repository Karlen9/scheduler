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
export function TimeSlotGrid({ slots, selected, onSelect }: TTimeSlotGridProps): ReactNode {
  return (
    <div className={'grid grid-cols-4 gap-2'}>
      {slots.map((slot) => (
        <button
          key={slot.time}
          onClick={() => slot.available && onSelect(slot.time)}
          disabled={!slot.available}
          className={`rounded-lg py-3 text-sm transition-all ${
            selected === slot.time
              ? 'bg-primary text-primary-foreground'
              : slot.available
                ? 'bg-card text-foreground hover:bg-border'
                : 'bg-error/15 text-error cursor-not-allowed'
          }`}
        >
          {slot.time}
        </button>
      ))}
    </div>
  );
}
