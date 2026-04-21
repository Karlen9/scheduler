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
export function ServiceCard({ service, onEdit, onDelete }: TServiceCardProps): ReactNode {
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

  return (
    <div
      role={onEdit ? 'button' : undefined}
      tabIndex={onEdit ? 0 : undefined}
      onClick={onEdit}
      onKeyDown={(e) => {
        if (onEdit && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onEdit();
        }
      }}
      aria-label={onEdit ? t('editAction') : undefined}
      className={`bg-card flex items-center gap-4 rounded-xl p-4 ${
        onEdit ? 'cursor-pointer transition-opacity active:opacity-80' : ''
      }`}
    >
      <div className={'flex-1'}>
        <h4 className={'text-foreground font-medium'}>{service.name}</h4>
        <p className={'text-muted-foreground text-sm'}>
          {t('priceLabel')} {service.price.toLocaleString(locale === 'en' ? 'en-US' : 'ru-RU')}{' '}
          {service.currency === 'RUB' ? '\u20BD' : service.currency}
        </p>
        <p className={'text-muted-foreground text-sm'}>
          {t('durationLabel')} {service.durationMinutes} {t('minutes')}
        </p>
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
