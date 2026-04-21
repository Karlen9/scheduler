'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';

import { BottomSheet } from '@/components/BottomSheet';
import { ServiceCard } from '@/components/ServiceCard';
import { TopBar } from '@/components/TopBar';
import { useClientBatches, useSessionTypes } from '@/hooks/queries';
import { resolveTestAwareHref } from '@/lib/routes';

import type { TClientBatch, TSessionType } from '@/lib/types';
import type { ReactNode } from 'react';

function pickDisplayBatch(service: TSessionType, batches: TClientBatch[]): TClientBatch | null {
  if (service.type !== 'batch') {
    return null;
  }

  const serviceBatches = batches.filter((batch) => batch.serviceId === service.id);
  return (
    serviceBatches.find((batch) => batch.status === 'active' && batch.remainingSessions > 0) ??
    serviceBatches.find((batch) => batch.status === 'exhausted' || batch.remainingSessions <= 0) ??
    null
  );
}

/***************************************************************************************************
 * Renders the services page UI and related interactions.
 *
 * Parameters:
 * - None.
 *
 * Returns:
 * - The computed value for the current operation as ReactNode.
 *
 * Side effects:
 * - May derive UI state, invoke callbacks, and trigger user-facing rendering updates.
 ***************************************************************************************************/
export default function ServicesPage(): ReactNode {
  /***************************************************************************************************
   * Defines the t value used by the page layer.
   *
   * Usage context:
   * - Reused by the page layer to keep shared values centralized.
   ***************************************************************************************************/
  const t = useTranslations('ServicesPage');
  const router = useRouter();
  const pathname = usePathname();
  const { data: services, isLoading: loading } = useSessionTypes();
  const { data: clientBatches, isLoading: batchesLoading } = useClientBatches();
  const [noBatchService, setNoBatchService] = useState<TSessionType | null>(null);

  const batchByService = useMemo(() => {
    const result = new Map<string, TClientBatch | null>();
    for (const service of services) {
      result.set(service.id, pickDisplayBatch(service, clientBatches));
    }
    return result;
  }, [clientBatches, services]);

  const handleServiceClick = (service: TSessionType): void => {
    const batch = batchByService.get(service.id) ?? null;
    const hasActiveBatch =
      batch?.status === 'active' && batch.remainingSessions > 0 && service.type === 'batch';

    if (service.type === 'batch' && !hasActiveBatch) {
      setNoBatchService(service);
      return;
    }

    router.push(resolveTestAwareHref(pathname, `/book?service=${service.id}`));
  };

  if (loading || batchesLoading) {
    return (
      <div>
        <TopBar title={t('title')} showBack />
        <div className={'animate-pulse space-y-3 p-4'}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className={'bg-card flex items-center gap-3 rounded-xl p-4'}>
              <div className={'bg-skeleton h-10 w-10 shrink-0 rounded-full'} />
              <div className={'flex-1'}>
                <div className={'bg-skeleton mb-2 h-5 w-2/3 rounded'} />
                <div className={'bg-skeleton h-4 w-1/3 rounded'} />
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
            <ServiceCard
              key={service.id}
              service={service}
              clientBatch={batchByService.get(service.id)}
              onClick={() => handleServiceClick(service)}
              clickLabel={t('bookService')}
            />
          ))
        )}
      </div>

      <BottomSheet
        isOpen={!!noBatchService}
        onClose={() => setNoBatchService(null)}
        title={t('noBatchTitle')}
        showClose
      >
        <p className={'text-muted-foreground text-sm'}>{t('noBatchMessage')}</p>
        <button
          type={'button'}
          onClick={() => setNoBatchService(null)}
          className={
            'bg-brand mt-5 w-full rounded-[28px] px-4 py-3 text-sm font-medium text-white transition-opacity active:opacity-80'
          }
        >
          {t('noBatchClose')}
        </button>
      </BottomSheet>
    </div>
  );
}
