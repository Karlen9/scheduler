import { Clock, Pencil } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

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
  disabled = false,
}: {
  service: TSessionType;
  selected: boolean;
  onSelect: TVoidFunction;
  onEdit?: TVoidFunction;
  minLabel: string;
  /** Batch service the relevant client has no active package for: visible but not selectable. */
  disabled?: boolean;
}): ReactNode {
  /***************************************************************************************************
   * Defines the locale value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const locale = useLocale();
  const t = useTranslations('ServiceCard');
  const sessionsCount = service.sessionsCount ?? 0;
  const isBatch = service.type === 'batch' && sessionsCount > 0;

  /***************************************************************************************************
   * Formats price amount.
   *
   * Parameters:
   * - price: Price used by the current operation.
   * Returns:
   * - The computed value for the current operation as string.
   *
   * Side effects:
   * - May derive UI state, invoke callbacks, and trigger user-facing rendering updates.
   ***************************************************************************************************/
  function formatAmount(price: number): string {
    /***************************************************************************************************
     * Defines the formatted value used by the component layer.
     *
     * Usage context:
     * - Reused by the component layer to keep shared values centralized.
     ***************************************************************************************************/
    return new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'ru-RU').format(price);
  }

  const currencyLabel = service.currency === 'RUB' ? '\u20BD' : service.currency;
  const formattedPrice = formatAmount(service.price);
  const perSessionPrice = isBatch ? Math.round(service.price / sessionsCount) : 0;
  const formattedPerSession = formatAmount(perSessionPrice);

  return (
    <button
      type={'button'}
      onClick={selected ? onEdit : onSelect}
      disabled={disabled}
      aria-disabled={disabled}
      className={`bg-card w-full rounded-xl p-4 text-left transition-all ${
        selected ? 'ring-brand ring-2' : ''
      } ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
    >
      <div className={'flex items-start justify-between gap-2'}>
        <div className={'min-w-0'}>
          <div className={'flex flex-wrap items-center gap-2'}>
            <p className={'text-foreground min-w-0 text-sm leading-snug font-medium'}>
              {service.name}
            </p>
            {isBatch && (
              <span
                className={
                  'bg-brand/10 text-brand inline-flex shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium'
                }
              >
                {t('batchLabel')}
              </span>
            )}
          </div>
        </div>
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
          {isBatch
            ? t('batchPriceLine', {
                count: sessionsCount,
                price: formattedPrice,
                currency: currencyLabel,
                perSession: formattedPerSession,
              })
            : `${formattedPrice} ${currencyLabel}`}
        </span>
      </div>
      {disabled && <p className={'text-warning mt-2 text-xs font-medium'}>{t('noActiveBatch')}</p>}
    </button>
  );
}
