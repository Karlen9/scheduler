'use client';

import { Clock, Dumbbell } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { formatDuration } from '@/components/DurationSelector';
import { TopBar } from '@/components/TopBar';
import { useSessionTypes } from '@/hooks/queries';
import { getPhotoUrl } from '@/lib/api';

import type { TSessionType } from '@/lib/types';
import type { ReactNode } from 'react';

export default function ServicesPage(): ReactNode {
  const t = useTranslations('ServicesPage');
  const td = useTranslations('Duration');
  const locale = useLocale();
  const { data: services, isLoading: loading } = useSessionTypes();

  if (loading) {
    return (
      <div>
        <TopBar title={t('title')} showBack />
        <div className={'animate-pulse space-y-3 p-4'}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className={'bg-card flex items-center gap-3 rounded-xl p-4'}>
              <div className={'bg-border h-10 w-10 flex-shrink-0 rounded-full'} />
              <div className={'flex-1'}>
                <div className={'bg-border mb-2 h-5 w-2/3 rounded'} />
                <div className={'bg-border h-4 w-1/3 rounded'} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <TopBar title={t('title')} showBack />

      <div className={'space-y-3 p-4'}>
        {services.length === 0 ? (
          <div className={'text-muted-foreground py-8 text-center'}>{t('empty')}</div>
        ) : (
          services.map((service: TSessionType) => (
            <div key={service.id} className={'bg-card flex items-center gap-3 rounded-xl p-4'}>
              {/* Service thumbnail */}
              <div
                className={
                  'bg-border flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-full'
                }
              >
                {service.imageUrl ? (
                  <img
                    src={getPhotoUrl(service.imageUrl)}
                    alt={service.name}
                    className={'h-full w-full object-cover'}
                  />
                ) : (
                  <Dumbbell className={'text-muted-foreground h-4 w-4'} />
                )}
              </div>
              {/* Service info */}
              <div className={'min-w-0 flex-1'}>
                <h3 className={'text-foreground mb-1 text-base font-medium'}>{service.name}</h3>
                <div className={'flex items-center gap-1'}>
                  <Clock className={'text-muted-foreground h-3 w-3'} />
                  <span className={'text-muted-foreground text-sm'}>
                    {formatDuration(service.durationMinutes, td('hour'))}
                  </span>
                </div>
              </div>
              <span className={'text-foreground flex-shrink-0 text-base font-semibold'}>
                {service.price.toLocaleString(locale === 'en' ? 'en-US' : 'ru-RU')}{' '}
                {service.currency === 'RUB' ? '\u20BD' : service.currency}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
