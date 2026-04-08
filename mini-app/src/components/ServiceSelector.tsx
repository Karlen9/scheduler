import type { TServiceSelectorProps } from '@/lib/types';
import type { ReactNode } from 'react';

/***************************************************************************************************
 * Renders the service selector UI and related interactions.
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
export function ServiceSelector({
  services,
  selectedId,
  onChange,
}: TServiceSelectorProps): ReactNode {
  return (
    <div className={'flex flex-wrap gap-2'}>
      {services.map((service) => (
        <button
          key={service.id}
          onClick={() => onChange(service)}
          className={`rounded-full px-4 py-2 text-sm transition-colors ${
            selectedId === service.id
              ? 'bg-primary text-primary-foreground'
              : 'bg-card text-foreground'
          }`}
        >
          {service.name}
        </button>
      ))}
    </div>
  );
}
