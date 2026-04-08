'use client';

import { Pencil } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import type { TServiceCardProps } from '@/lib/types';
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
export function ServiceCard({ service, onEdit }: TServiceCardProps): ReactNode {
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

  return (
    <div className={'bg-card flex items-center gap-4 rounded-xl p-4'}>
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
      <button
        onClick={onEdit}
        className={
          'bg-brand flex h-10 w-10 items-center justify-center rounded-full transition-opacity active:opacity-80'
        }
      >
        <Pencil className={'h-4 w-4 text-white'} />
      </button>
    </div>
  );
}
