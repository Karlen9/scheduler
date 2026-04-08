import { Clock, Pencil } from 'lucide-react';
import { useLocale } from 'next-intl';

import type { TSessionType, TVoidFunction } from '@/lib/types';
import type { ReactNode } from 'react';

/***************************************************************************************************
 * Renders the service card UI and related interactions.
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
export function ServiceCard({
  service,
  selected,
  onSelect,
  onEdit,
  minLabel,
}: {
  service: TSessionType;
  selected: boolean;
  onSelect: TVoidFunction;
  onEdit?: TVoidFunction;
  minLabel: string;
}): ReactNode {
  /***************************************************************************************************
   * Defines the locale value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const locale = useLocale();

  /***************************************************************************************************
   * Formats price.
   *
   * Parameters:
   * - price: Price used by the current operation.
   * - currency: Currency used by the current operation.
   *
   * Returns:
   * - The computed value for the current operation as string.
   *
   * Side effects:
   * - May derive UI state, invoke callbacks, and trigger user-facing rendering updates.
   ***************************************************************************************************/
  function formatPrice(price: number, currency: string): string {
    /***************************************************************************************************
     * Defines the formatted value used by the component layer.
     *
     * Usage context:
     * - Reused by the component layer to keep shared values centralized.
     ***************************************************************************************************/
    const formatted = new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'ru-RU').format(price);
    return `${formatted} ${currency}`;
  }

  return (
    <button
      onClick={selected ? onEdit : onSelect}
      className={`bg-card w-full rounded-xl p-4 text-left transition-all ${
        selected ? 'ring-brand ring-2' : ''
      }`}
    >
      <div className={'flex items-start justify-between gap-2'}>
        <p className={'text-foreground text-sm leading-snug font-medium'}>{service.name}</p>
        {selected && (
          <div
            className={
              'bg-brand flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white'
            }
          >
            <Pencil className={'h-3.5 w-3.5'} />
          </div>
        )}
      </div>
      <div className={'mt-2.5 flex items-center gap-3'}>
        <span className={'text-muted-foreground inline-flex items-center gap-1 text-xs'}>
          <Clock className={'h-3 w-3'} />
          {service.durationMinutes} {minLabel}
        </span>
        <span className={'text-muted-foreground text-xs'}>
          {formatPrice(service.price, service.currency)}
        </span>
      </div>
    </button>
  );
}
