'use client';

import { Trash2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import type { TServiceCardProps } from '@/lib/types';
import type { MouseEvent, ReactNode } from 'react';

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
  onEdit,
  onDelete,
  onClick,
  clickLabel,
  clientBatch,
}: TServiceCardProps): ReactNode {
  /***************************************************************************************************
   * Defines the t value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const t = useTranslations('ServiceCard');
  /***************************************************************************************************
   * Defines the locale value used by the component layer.
   *
   * Usage context:
   * - Reused by the component layer to keep shared values centralized.
   ***************************************************************************************************/
  const locale = useLocale();

  const handleDeleteClick = (e: MouseEvent<HTMLButtonElement>): void => {
    e.stopPropagation();
    onDelete?.();
  };

  const cardAction = onEdit ?? onClick;
  const isBatch = service.type === 'batch' && !!service.sessionsCount;
  const currencyLabel = service.currency === 'RUB' ? '\u20BD' : service.currency;
  const formattedPrice = service.price.toLocaleString(locale === 'en' ? 'en-US' : 'ru-RU');
  const perSessionPrice =
    isBatch && service.sessionsCount ? Math.round(service.price / service.sessionsCount) : 0;
  const formattedPerSession = perSessionPrice.toLocaleString(locale === 'en' ? 'en-US' : 'ru-RU');
  const batchStatus =
    clientBatch && clientBatch.remainingSessions > 0
      ? t('remaining', {
          remaining: clientBatch.remainingSessions,
          total: clientBatch.totalSessions,
        })
      : clientBatch
        ? t('exhausted')
        : '';

  return (
    <div
      role={cardAction ? 'button' : undefined}
      tabIndex={cardAction ? 0 : undefined}
      onClick={cardAction}
      onKeyDown={(e) => {
        if (cardAction && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          cardAction();
        }
      }}
      aria-label={onEdit ? t('editAction') : clickLabel}
      className={`bg-card flex items-center gap-4 rounded-xl p-4 ${
        cardAction ? 'cursor-pointer transition-opacity active:opacity-80' : ''
      }`}
    >
      <div className={'flex-1'}>
        <h4 className={'text-foreground font-medium'}>{service.name}</h4>
        <p className={'text-muted-foreground text-sm'}>
          {isBatch
            ? t('batchPriceLine', {
                count: service.sessionsCount,
                price: formattedPrice,
                currency: currencyLabel,
                perSession: formattedPerSession,
              })
            : `${t('priceLabel')} ${formattedPrice} ${currencyLabel}`}
        </p>
        <p className={'text-muted-foreground text-sm'}>
          {t('durationLabel')} {service.durationMinutes} {t('minutes')}
        </p>
        {batchStatus && (
          <span
            className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
              clientBatch?.remainingSessions
                ? 'bg-status-confirmed-bg text-status-confirmed-text'
                : 'bg-status-cancelled-bg text-status-cancelled-text'
            }`}
          >
            {batchStatus}
          </span>
        )}
      </div>
      {onDelete && (
        <button
          type={'button'}
          onClick={handleDeleteClick}
          className={
            'bg-card border-border text-destructive flex h-10 w-10 items-center justify-center rounded-full border transition-opacity active:opacity-80'
          }
          aria-label={t('deleteAction')}
        >
          <Trash2 className={'h-4 w-4'} />
        </button>
      )}
    </div>
  );
}
